"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { DeckCard, DeckData, DeckSynergyAnalysis, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import { buildTagCache } from "@/lib/card-tags";
import { analyzeDeckSynergy } from "@/lib/synergy-engine";
import {
  computeCompositionScorecard,
  TEMPLATE_COMMAND_ZONE,
  type CompositionScorecardResult,
} from "@/lib/deck-composition";
import {
  validateCommanderDeck,
  type CommanderValidationResult,
} from "@/lib/commander-validation";
import { suggestCuts, type CutSuggestion } from "@/lib/cut-suggestions";
import {
  createCrucibleSession,
  loadCrucibleSession,
  saveCrucibleSession,
  clearCrucibleSession,
  addCardToPool,
  setCardStatus,
  setKeptQuantity as setKeptQuantityOnPayload,
  keptCards,
  keptCount,
  buildFinalDeck,
  type CruciblePayload,
  type CrucibleCardStatus,
} from "@/lib/crucible-session";
import { ENRICH_CHUNK_SIZE, chunk } from "@/lib/enrich-chunking";

/** /api/deck-combos rejects requests above this many unique names. Combos
 * cannot be chunked without missing cross-chunk pairs, so for larger piles
 * detection runs over the keep+undecided subset once cuts bring it under the
 * cap — until then the UI shows how many more unique cuts are needed. */
const COMBOS_MAX_NAMES = 250;

/** Debounce for combo refetches after the first threshold crossing, so triage
 * clicks never fire a request each. */
const COMBOS_REFETCH_DEBOUNCE_MS = 1500;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type Hydration = "pending" | "hydrated" | "absent";

export interface EnrichProgress {
  done: number;
  total: number;
}

interface CrucibleCombos {
  exactCombos: SpellbookCombo[];
  nearCombos: SpellbookCombo[];
}

interface CommanderRules {
  bannedSet: Set<string>;
  gameChangerNames: Set<string>;
}

interface State {
  hydration: Hydration;
  payload: CruciblePayload | null;
  /** Runtime-only; re-fetched on hydrate like the reading session. */
  cardMap: Record<string, EnrichedCard> | null;
  notFound: string[];
  enrichLoading: boolean;
  enrichError: string | null;
  enrichProgress: EnrichProgress;
  combos: CrucibleCombos | null;
  combosLoading: boolean;
  rules: CommanderRules | null;
  dismissedSuggestions: string[];
}

type Action =
  | { type: "HYDRATE"; payload: CruciblePayload | null }
  | { type: "SET_PAYLOAD"; payload: CruciblePayload }
  | { type: "NEW_PILE"; payload: CruciblePayload }
  | { type: "ENRICH_START"; total: number }
  | { type: "ENRICH_PROGRESS"; done: number }
  | {
      type: "ENRICH_SUCCESS";
      cardMap: Record<string, EnrichedCard>;
      notFound: string[];
    }
  | { type: "ENRICH_ERROR"; error: string }
  | {
      type: "ENRICH_MERGE";
      cardMap: Record<string, EnrichedCard>;
      notFound: string[];
    }
  | { type: "COMBOS_START" }
  | { type: "COMBOS_SUCCESS"; combos: CrucibleCombos }
  | { type: "COMBOS_ERROR" }
  | { type: "RULES_SUCCESS"; rules: CommanderRules }
  | { type: "DISMISS_SUGGESTION"; name: string }
  | { type: "DISMISS_ENRICH_ERROR" }
  | { type: "CLEAR" };

const initialState: State = {
  hydration: "pending",
  payload: null,
  cardMap: null,
  notFound: [],
  enrichLoading: false,
  enrichError: null,
  enrichProgress: { done: 0, total: 0 },
  combos: null,
  combosLoading: false,
  rules: null,
  dismissedSuggestions: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        hydration: action.payload ? "hydrated" : "absent",
        payload: action.payload,
      };
    case "SET_PAYLOAD":
      return { ...state, hydration: "hydrated", payload: action.payload };
    case "NEW_PILE":
      return {
        ...initialState,
        hydration: "hydrated",
        payload: action.payload,
        rules: state.rules,
      };
    case "ENRICH_START":
      return {
        ...state,
        enrichLoading: true,
        enrichError: null,
        enrichProgress: { done: 0, total: action.total },
      };
    case "ENRICH_PROGRESS":
      return {
        ...state,
        enrichProgress: { ...state.enrichProgress, done: action.done },
      };
    case "ENRICH_SUCCESS":
      return {
        ...state,
        enrichLoading: false,
        cardMap: action.cardMap,
        notFound: action.notFound,
        enrichProgress: {
          done: state.enrichProgress.total,
          total: state.enrichProgress.total,
        },
      };
    case "ENRICH_ERROR":
      return { ...state, enrichLoading: false, enrichError: action.error };
    case "ENRICH_MERGE": {
      const cardMap = { ...(state.cardMap ?? {}), ...action.cardMap };
      return {
        ...state,
        cardMap,
        notFound: [...new Set([...state.notFound, ...action.notFound])].filter(
          (name) => !(name in cardMap)
        ),
      };
    }
    case "COMBOS_START":
      return { ...state, combosLoading: true };
    case "COMBOS_SUCCESS": {
      const prev = state.combos;
      if (!prev) {
        return { ...state, combosLoading: false, combos: action.combos };
      }
      const exactById = new Map(prev.exactCombos.map((c) => [c.id, c]));
      for (const combo of action.combos.exactCombos) exactById.set(combo.id, combo);
      const nearById = new Map(prev.nearCombos.map((c) => [c.id, c]));
      for (const combo of action.combos.nearCombos) nearById.set(combo.id, combo);
      for (const id of exactById.keys()) nearById.delete(id);
      return {
        ...state,
        combosLoading: false,
        combos: {
          exactCombos: [...exactById.values()],
          nearCombos: [...nearById.values()],
        },
      };
    }
    case "COMBOS_ERROR":
      return {
        ...state,
        combosLoading: false,
        combos: state.combos ?? { exactCombos: [], nearCombos: [] },
      };
    case "RULES_SUCCESS":
      return { ...state, rules: action.rules };
    case "DISMISS_SUGGESTION":
      return {
        ...state,
        dismissedSuggestions: [...state.dismissedSuggestions, action.name],
      };
    case "DISMISS_ENRICH_ERROR":
      return { ...state, enrichError: null };
    case "CLEAR":
      return { ...initialState, hydration: "absent" };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface CrucibleSessionContextValue {
  hydration: Hydration;
  payload: CruciblePayload | null;
  cardMap: Record<string, EnrichedCard> | null;
  notFound: string[];
  enrichLoading: boolean;
  enrichError: string | null;
  enrichProgress: EnrichProgress;
  combos: CrucibleCombos | null;
  combosLoading: boolean;
  /** How many unique keep/undecided cards over the combo lookup's cap the
   * pile currently is. Zero means combo detection is available; positive
   * means "cut this many more unique cards" to unlock it. */
  combosOverBy: number;
  /** Tag cache over the enriched pool. Null until enrichment completes. */
  tagCache: Map<string, string[]> | null;
  /** Synergy over the whole pool (synthetic deck: commanders + pool). */
  synergy: DeckSynergyAnalysis | null;
  /** Composition scorecard for the kept subset vs the Command Zone template. */
  keptScorecard: CompositionScorecardResult | null;
  /** Commander-format legality of (commanders + kept). Null until the banned
   * list and enrichment have both loaded. */
  legality: CommanderValidationResult | null;
  /** Ranked cut suggestions, minus dismissed ones. */
  cutSuggestions: CutSuggestion[];
  keptTotal: number;
  /** Start a fresh crucible from an imported pile. Persists and triggers
   * enrichment + combo fetches in the background. */
  setPile: (pool: DeckCard[], warnings: string[]) => void;
  /** Add a single card to the pile mid-triage (new name arrives undecided;
   * an existing name gets a quantity bump). Enriches it incrementally and
   * refreshes combo detection where the pile size allows. */
  addCard: (name: string) => void;
  setStatus: (name: string, status: CrucibleCardStatus) => void;
  /** Flip every listed card to "keep" in a single update, so one click can
   * keep all of a combo's pieces without dispatches overwriting each other. */
  keepAll: (names: string[]) => void;
  /** Keep a partial count of a stacked card. Zero returns it to undecided. */
  setKeptQuantity: (name: string, count: number) => void;
  /** Choose commanders (0-2 names from the pool). Chosen names are forced to
   * "keep" so they count toward the 100. */
  setCommanders: (names: string[]) => void;
  /** Flip a cut card back to undecided. */
  restore: (name: string) => void;
  dismissSuggestion: (name: string) => void;
  /** Build the final DeckData for handoff. Caller navigates the journey. */
  finalize: (deckName: string) => DeckData | null;
  retryEnrichment: () => void;
  dismissEnrichError: () => void;
  clearCrucible: () => void;
}

const CrucibleSessionContext = createContext<CrucibleSessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CrucibleSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const combosAbortRef = useRef<AbortController | null>(null);
  const enrichedIdRef = useRef<string | null>(null);
  const combosIdRef = useRef<string | null>(null);
  const combosSubsetKeyRef = useRef<string | null>(null);
  const combosDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulesFetchedRef = useRef(false);

  // Hydrate from sessionStorage on mount.
  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadCrucibleSession() });
  }, []);

  // Persist payload changes so refreshes keep triage state.
  useEffect(() => {
    if (state.hydration === "hydrated" && state.payload) {
      saveCrucibleSession(state.payload);
    }
  }, [state.hydration, state.payload]);

  const enrich = useCallback(async (pool: DeckCard[]) => {
    const uniqueNames = [...new Set(pool.map((c) => c.name))];
    if (uniqueNames.length === 0) return;

    enrichAbortRef.current?.abort();
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    const chunks = chunk(uniqueNames, ENRICH_CHUNK_SIZE);
    dispatch({ type: "ENRICH_START", total: chunks.length });

    const cardMap: Record<string, EnrichedCard> = {};
    const notFound: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch("/api/deck-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardNames: chunks[i] }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30_000),
          ]),
        });
        if (!res.ok) {
          dispatch({
            type: "ENRICH_ERROR",
            error:
              res.status === 502
                ? "Card data service temporarily unavailable"
                : "Could not load card details",
          });
          return;
        }
        const json = await res.json();
        Object.assign(cardMap, json.cards as Record<string, EnrichedCard>);
        notFound.push(...((json.notFound as string[] | undefined) ?? []));
        dispatch({ type: "ENRICH_PROGRESS", done: i + 1 });
      }
      dispatch({ type: "ENRICH_SUCCESS", cardMap, notFound });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({
        type: "ENRICH_ERROR",
        error:
          err instanceof TypeError
            ? "Network error — could not reach card data service"
            : "Could not load card details",
      });
    }
  }, []);

  const fetchCombos = useCallback(
    async (cardNames: string[], commanders: string[]): Promise<boolean> => {
      if (cardNames.length === 0 || cardNames.length > COMBOS_MAX_NAMES) {
        return false;
      }

      combosAbortRef.current?.abort();
      const controller = new AbortController();
      combosAbortRef.current = controller;

      dispatch({ type: "COMBOS_START" });

      try {
        const res = await fetch("/api/deck-combos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardNames,
            commanders,
          }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20_000),
          ]),
        });
        if (!res.ok) {
          dispatch({ type: "COMBOS_ERROR" });
          return false;
        }
        const json = await res.json();
        dispatch({
          type: "COMBOS_SUCCESS",
          combos: {
            exactCombos: json.exactCombos ?? [],
            nearCombos: json.nearCombos ?? [],
          },
        });
        return true;
      } catch (err) {
        // A superseding fetch owns the state now; don't report failure.
        if (err instanceof DOMException && err.name === "AbortError") return true;
        dispatch({ type: "COMBOS_ERROR" });
        return false;
      }
    },
    []
  );

  // After hydration, kick off enrichment + combos when missing.
  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    const { crucibleId, pool } = state.payload;
    if (state.cardMap === null && enrichedIdRef.current !== crucibleId) {
      enrichedIdRef.current = crucibleId;
      void enrich(pool);
    }
  }, [state.hydration, state.payload, state.cardMap, enrich]);

  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    if (state.combos !== null || combosIdRef.current === state.payload.crucibleId) {
      return;
    }
    const uniqueNames = [...new Set(state.payload.pool.map((c) => c.name))];
    if (uniqueNames.length > COMBOS_MAX_NAMES) return;
    combosIdRef.current = state.payload.crucibleId;
    void fetchCombos(uniqueNames, state.payload.commanders);
  }, [state.hydration, state.payload, state.combos, fetchCombos]);

  // Large piles: combo detection runs over the keep+undecided subset once
  // cuts bring its unique-name count under the cap. First crossing fetches
  // immediately; later subset changes are debounced so individual triage
  // clicks never fire a request each. Results merge in the reducer so combos
  // whose pieces are later cut keep rendering as Broken.
  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    const { pool, statuses, commanders } = state.payload;
    const poolUnique = new Set(pool.map((c) => c.name));
    if (poolUnique.size <= COMBOS_MAX_NAMES) return;
    const subset = [
      ...new Set(
        pool
          .filter((c) => (statuses[c.name] ?? "undecided") !== "cut")
          .map((c) => c.name)
      ),
    ];
    if (subset.length > COMBOS_MAX_NAMES) return;
    const key = [...subset].sort().join("\n");
    if (combosSubsetKeyRef.current === key) return;
    const delay =
      combosSubsetKeyRef.current === null ? 0 : COMBOS_REFETCH_DEBOUNCE_MS;
    if (combosDebounceRef.current) clearTimeout(combosDebounceRef.current);
    combosDebounceRef.current = setTimeout(() => {
      combosSubsetKeyRef.current = key;
      void fetchCombos(subset, commanders).then((ok) => {
        // Failed fetches release the key so the next payload change retries,
        // matching the rules fetch's clear-flag-on-failure behavior.
        if (!ok && combosSubsetKeyRef.current === key) {
          combosSubsetKeyRef.current = null;
        }
      });
    }, delay);
    return () => {
      if (combosDebounceRef.current) clearTimeout(combosDebounceRef.current);
    };
  }, [state.hydration, state.payload, fetchCombos]);

  // Banned list + game changers, fetched once per provider lifetime. The
  // effect re-runs on every payload change, so it must NOT abort in its
  // cleanup — a triage click mid-fetch would kill the request and leave
  // legality null forever. Abort only on provider unmount, and clear the
  // fetched flag on failure so a later payload change retries.
  const rulesAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => rulesAbortRef.current?.abort(), []);
  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload || rulesFetchedRef.current) {
      return;
    }
    rulesFetchedRef.current = true;
    const controller = new AbortController();
    rulesAbortRef.current = controller;
    void (async () => {
      try {
        const res = await fetch("/api/commander-rules", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        });
        if (!res.ok) {
          rulesFetchedRef.current = false;
          return;
        }
        const json = await res.json();
        dispatch({
          type: "RULES_SUCCESS",
          rules: {
            bannedSet: new Set<string>(json.banned ?? []),
            gameChangerNames: new Set<string>(
              ((json.gameChangers ?? []) as { name: string }[]).map((g) => g.name)
            ),
          },
        });
      } catch {
        // Legality stays null for now; allow a retry on the next change.
        rulesFetchedRef.current = false;
      }
    })();
  }, [state.hydration, state.payload]);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const tagCache = useMemo(
    () => (state.cardMap ? buildTagCache(state.cardMap) : null),
    [state.cardMap]
  );

  // Keyed on pool + commanders (stable across triage clicks), NOT the whole
  // payload — the O(n²) synergy engine must not re-run on every keep/cut.
  const pool = state.payload?.pool ?? null;
  const commanders = state.payload?.commanders ?? null;
  const synergy = useMemo<DeckSynergyAnalysis | null>(() => {
    if (!pool || !commanders || !state.cardMap) return null;
    const commanderSet = new Set(commanders);
    const syntheticDeck: DeckData = {
      name: "Crucible Pool",
      source: "text",
      url: "",
      commanders: commanders.map((n) => ({ name: n, quantity: 1 })),
      mainboard: pool.filter((c) => !commanderSet.has(c.name)),
      sideboard: [],
    };
    return analyzeDeckSynergy(syntheticDeck, state.cardMap, tagCache ?? undefined);
  }, [pool, commanders, state.cardMap, tagCache]);

  const keptDeck = useMemo<DeckData | null>(() => {
    if (!state.payload) return null;
    return buildFinalDeck(state.payload, "Crucible Kept");
  }, [state.payload]);

  const keptScorecard = useMemo<CompositionScorecardResult | null>(() => {
    if (!keptDeck || !state.cardMap) return null;
    // Score only commanders + kept mainboard; drop the sideboard (cuts).
    const keptOnly: DeckData = { ...keptDeck, sideboard: [] };
    return computeCompositionScorecard(
      keptOnly,
      state.cardMap,
      TEMPLATE_COMMAND_ZONE,
      tagCache ?? undefined
    );
  }, [keptDeck, state.cardMap, tagCache]);

  const legality = useMemo<CommanderValidationResult | null>(() => {
    if (!keptDeck || !state.cardMap || !state.rules) return null;
    const keptOnly: DeckData = { ...keptDeck, sideboard: [] };
    return validateCommanderDeck(
      keptOnly,
      state.cardMap,
      state.rules.bannedSet,
      state.rules.gameChangerNames
    );
  }, [keptDeck, state.cardMap, state.rules]);

  const cutSuggestions = useMemo<CutSuggestion[]>(() => {
    if (!state.payload || !state.cardMap) return [];
    return suggestCuts(
      state.payload,
      state.cardMap,
      synergy,
      keptScorecard,
      new Set(state.dismissedSuggestions)
    );
  }, [state.payload, state.cardMap, synergy, keptScorecard, state.dismissedSuggestions]);

  const keptTotal = useMemo(
    () => (state.payload ? keptCount(state.payload) : 0),
    [state.payload]
  );

  const combosOverBy = useMemo(() => {
    if (!state.payload) return 0;
    const { pool: fullPool, statuses } = state.payload;
    const poolUnique = new Set(fullPool.map((c) => c.name));
    if (poolUnique.size <= COMBOS_MAX_NAMES) return 0;
    const subsetUnique = new Set(
      fullPool
        .filter((c) => (statuses[c.name] ?? "undecided") !== "cut")
        .map((c) => c.name)
    );
    return Math.max(0, subsetUnique.size - COMBOS_MAX_NAMES);
  }, [state.payload]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const setPile = useCallback((pool: DeckCard[], warnings: string[]) => {
    enrichAbortRef.current?.abort();
    combosAbortRef.current?.abort();
    if (combosDebounceRef.current) clearTimeout(combosDebounceRef.current);
    enrichedIdRef.current = null;
    combosIdRef.current = null;
    combosSubsetKeyRef.current = null;
    const payload = createCrucibleSession(pool, warnings);
    saveCrucibleSession(payload);
    dispatch({ type: "NEW_PILE", payload });
  }, []);

  const addCard = useCallback(
    (name: string) => {
      if (!state.payload) return;
      const wasInPool = state.payload.pool.some((card) => card.name === name);
      const next = addCardToPool(state.payload, name);
      dispatch({ type: "SET_PAYLOAD", payload: next });

      // Enrich the newcomer incrementally; a failure surfaces it as
      // unresolved rather than blocking the whole session.
      if (!state.cardMap || !(name in state.cardMap)) {
        void (async () => {
          try {
            const res = await fetch("/api/deck-enrich", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardNames: [name] }),
              signal: AbortSignal.timeout(30_000),
            });
            if (!res.ok) {
              dispatch({ type: "ENRICH_MERGE", cardMap: {}, notFound: [name] });
              return;
            }
            const json = await res.json();
            dispatch({
              type: "ENRICH_MERGE",
              cardMap: (json.cards as Record<string, EnrichedCard>) ?? {},
              notFound: (json.notFound as string[] | undefined) ?? [],
            });
          } catch {
            dispatch({ type: "ENRICH_MERGE", cardMap: {}, notFound: [name] });
          }
        })();
      }

      // Small piles fetch combos once up front, so a mid-triage addition
      // needs an explicit refresh (results merge in the reducer). Large
      // piles are covered by the keep+undecided subset effect. A quantity
      // bump leaves the unique-name set unchanged, so no refetch needed.
      if (!wasInPool) {
        const uniqueNames = [...new Set(next.pool.map((c) => c.name))];
        if (uniqueNames.length <= COMBOS_MAX_NAMES) {
          void fetchCombos(uniqueNames, next.commanders);
        }
      }
    },
    [state.payload, state.cardMap, fetchCombos]
  );

  const setStatus = useCallback(
    (name: string, status: CrucibleCardStatus) => {
      if (!state.payload) return;
      // Commanders are forced to "keep"; triage cannot move them.
      if (state.payload.commanders.includes(name)) return;
      dispatch({
        type: "SET_PAYLOAD",
        payload: setCardStatus(state.payload, name, status),
      });
    },
    [state.payload]
  );

  const keepAll = useCallback(
    (names: string[]) => {
      if (!state.payload) return;
      let next = state.payload;
      for (const name of names) {
        if (next.commanders.includes(name)) continue;
        next = setCardStatus(next, name, "keep");
      }
      if (next === state.payload) return;
      dispatch({ type: "SET_PAYLOAD", payload: next });
    },
    [state.payload]
  );

  const setKeptQuantity = useCallback(
    (name: string, count: number) => {
      if (!state.payload) return;
      if (state.payload.commanders.includes(name)) return;
      dispatch({
        type: "SET_PAYLOAD",
        payload: setKeptQuantityOnPayload(state.payload, name, count),
      });
    },
    [state.payload]
  );

  const setCommanders = useCallback(
    (names: string[]) => {
      if (!state.payload) return;
      let next: CruciblePayload = { ...state.payload, commanders: names.slice(0, 2) };
      for (const name of next.commanders) {
        next = setCardStatus(next, name, "keep");
      }
      dispatch({ type: "SET_PAYLOAD", payload: next });
    },
    [state.payload]
  );

  const restore = useCallback(
    (name: string) => setStatus(name, "undecided"),
    [setStatus]
  );

  const dismissSuggestion = useCallback((name: string) => {
    dispatch({ type: "DISMISS_SUGGESTION", name });
  }, []);

  const finalize = useCallback(
    (deckName: string): DeckData | null => {
      if (!state.payload) return null;
      return buildFinalDeck(state.payload, deckName);
    },
    [state.payload]
  );

  const retryEnrichment = useCallback(() => {
    if (state.payload) {
      enrichedIdRef.current = null;
      void enrich(state.payload.pool);
    }
  }, [state.payload, enrich]);

  const dismissEnrichError = useCallback(() => {
    dispatch({ type: "DISMISS_ENRICH_ERROR" });
  }, []);

  const clearCrucible = useCallback(() => {
    enrichAbortRef.current?.abort();
    combosAbortRef.current?.abort();
    if (combosDebounceRef.current) clearTimeout(combosDebounceRef.current);
    enrichedIdRef.current = null;
    combosIdRef.current = null;
    combosSubsetKeyRef.current = null;
    clearCrucibleSession();
    dispatch({ type: "CLEAR" });
  }, []);

  const value = useMemo<CrucibleSessionContextValue>(
    () => ({
      hydration: state.hydration,
      payload: state.payload,
      cardMap: state.cardMap,
      notFound: state.notFound,
      enrichLoading: state.enrichLoading,
      enrichError: state.enrichError,
      enrichProgress: state.enrichProgress,
      combos: state.combos,
      combosLoading: state.combosLoading,
      combosOverBy,
      tagCache,
      synergy,
      keptScorecard,
      legality,
      cutSuggestions,
      keptTotal,
      setPile,
      addCard,
      setStatus,
      keepAll,
      setKeptQuantity,
      setCommanders,
      restore,
      dismissSuggestion,
      finalize,
      retryEnrichment,
      dismissEnrichError,
      clearCrucible,
    }),
    [
      state.hydration,
      state.payload,
      state.cardMap,
      state.notFound,
      state.enrichLoading,
      state.enrichError,
      state.enrichProgress,
      state.combos,
      state.combosLoading,
      combosOverBy,
      tagCache,
      synergy,
      keptScorecard,
      legality,
      cutSuggestions,
      keptTotal,
      setPile,
      addCard,
      setStatus,
      keepAll,
      setKeptQuantity,
      setCommanders,
      restore,
      dismissSuggestion,
      finalize,
      retryEnrichment,
      dismissEnrichError,
      clearCrucible,
    ]
  );

  return (
    <CrucibleSessionContext.Provider value={value}>
      {children}
    </CrucibleSessionContext.Provider>
  );
}

export function useCrucibleSession(): CrucibleSessionContextValue {
  const ctx = useContext(CrucibleSessionContext);
  if (!ctx) {
    throw new Error(
      "useCrucibleSession must be used within a CrucibleSessionProvider"
    );
  }
  return ctx;
}

/** Kept cards helper re-exported for components that need the list shape. */
export { keptCards };
