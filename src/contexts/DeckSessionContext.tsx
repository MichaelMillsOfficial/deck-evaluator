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
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import { computeDeckMeta, type DeckMetaResult, type MetaSource } from "@/lib/edhrec-meta";
import { validateCommanderLegality } from "@/lib/commander-validation";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "@/lib/deck-analysis-aggregate";
import {
  loadDeckSession,
  saveDeckSession,
  clearDeckSession,
  type DeckSessionPayload,
} from "@/lib/deck-session";
import { ENRICH_CHUNK_SIZE, chunk } from "@/lib/enrich-chunking";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

type Hydration = "pending" | "hydrated" | "absent";

interface State {
  hydration: Hydration;
  payload: DeckSessionPayload | null;
  enrichLoading: boolean;
  enrichError: string | null;
  spellbookLoading: boolean;
  metaLoading: boolean;
  commanderWarning: string | null;
}

type Action =
  | { type: "HYDRATE"; payload: DeckSessionPayload | null }
  | { type: "SET_PAYLOAD"; payload: DeckSessionPayload }
  | { type: "ENRICH_START" }
  | {
      type: "ENRICH_SUCCESS";
      cardMap: Record<string, EnrichedCard>;
      notFoundCount: number;
    }
  | { type: "ENRICH_ERROR"; error: string }
  | { type: "SPELLBOOK_START" }
  | {
      type: "SPELLBOOK_SUCCESS";
      combos: { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] };
    }
  | { type: "SPELLBOOK_ERROR" }
  | { type: "META_START" }
  | { type: "META_SUCCESS"; result: DeckMetaResult }
  | { type: "META_ERROR"; result: DeckMetaResult }
  | { type: "SET_COMMANDER_WARNING"; warning: string | null }
  | { type: "DISMISS_ENRICH_ERROR" }
  | { type: "DISMISS_NOT_FOUND" }
  | { type: "CLEAR" };

const initialState: State = {
  hydration: "pending",
  payload: null,
  enrichLoading: false,
  enrichError: null,
  spellbookLoading: false,
  metaLoading: false,
  commanderWarning: null,
};

/** A minimal DeckMetaResult standing in for a failed EDHREC fetch, so the UI
 * can render the error state uniformly. */
function errorMeta(commanders: string[], label?: string): DeckMetaResult {
  return {
    status: "error",
    source: null,
    commanderLabel: label ?? commanders.join(" + "),
    potentialDecks: 0,
    cards: [],
    ratedCount: 0,
    unratedCount: 0,
    coverage: { pct: 0, have: 0, of: 0 },
    spiceCount: 0,
    meanInclusion: 0,
    fieldPercentile: 0,
    bandCounts: { staple: 0, standard: 0, niche: 0, spice: 0 },
  };
}

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
    case "ENRICH_START":
      return { ...state, enrichLoading: true, enrichError: null };
    case "ENRICH_SUCCESS":
      return {
        ...state,
        enrichLoading: false,
        payload: state.payload && {
          ...state.payload,
          cardMap: action.cardMap,
          notFoundCount: action.notFoundCount,
        },
      };
    case "ENRICH_ERROR":
      return { ...state, enrichLoading: false, enrichError: action.error };
    case "SPELLBOOK_START":
      return { ...state, spellbookLoading: true };
    case "SPELLBOOK_SUCCESS":
      return {
        ...state,
        spellbookLoading: false,
        payload: state.payload && {
          ...state.payload,
          spellbookCombos: action.combos,
        },
      };
    case "SPELLBOOK_ERROR":
      return {
        ...state,
        spellbookLoading: false,
        payload: state.payload && {
          ...state.payload,
          spellbookCombos: state.payload.spellbookCombos ?? {
            exactCombos: [],
            nearCombos: [],
          },
        },
      };
    case "META_START":
      return { ...state, metaLoading: true };
    case "META_SUCCESS":
    case "META_ERROR":
      return {
        ...state,
        metaLoading: false,
        payload: state.payload && { ...state.payload, deckMeta: action.result },
      };
    case "SET_COMMANDER_WARNING":
      return { ...state, commanderWarning: action.warning };
    case "DISMISS_ENRICH_ERROR":
      return { ...state, enrichError: null };
    case "DISMISS_NOT_FOUND":
      return {
        ...state,
        payload: state.payload && { ...state.payload, notFoundCount: 0 },
      };
    case "CLEAR":
      return {
        ...initialState,
        hydration: "absent",
        payload: null,
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface DeckSessionContextValue {
  hydration: Hydration;
  payload: DeckSessionPayload | null;
  enrichLoading: boolean;
  enrichError: string | null;
  spellbookLoading: boolean;
  metaLoading: boolean;
  commanderWarning: string | null;
  analysisResults: DeckAnalysisResults | null;
  /** Set or replace the active deck session. Persists to sessionStorage and
   * triggers enrichment + combo fetches in the background. Used by the
   * import form to seed a fresh reading before navigating to /ritual. */
  setPayload: (payload: DeckSessionPayload) => void;
  retryEnrichment: () => void;
  retryMeta: () => void;
  dismissEnrichError: () => void;
  dismissNotFound: () => void;
  dismissCommanderWarning: () => void;
  clearSession: () => void;
}

const DeckSessionContext = createContext<DeckSessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DeckSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const spellbookAbortRef = useRef<AbortController | null>(null);
  const metaAbortRef = useRef<AbortController | null>(null);

  // Hydrate from sessionStorage on mount.
  useEffect(() => {
    const payload = loadDeckSession();
    dispatch({ type: "HYDRATE", payload });
  }, []);

  // Persist payload changes back to sessionStorage so refreshes are stable.
  useEffect(() => {
    if (state.hydration === "hydrated" && state.payload) {
      saveDeckSession(state.payload);
    }
  }, [state.hydration, state.payload]);

  const enrich = useCallback(async (deck: DeckData) => {
    const allCards = [
      ...deck.commanders,
      ...deck.mainboard,
      ...deck.sideboard,
    ];
    const uniqueNames = [...new Set(allCards.map((c) => c.name))];
    if (uniqueNames.length === 0) return;

    enrichAbortRef.current?.abort();
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    dispatch({ type: "ENRICH_START" });

    const cardMap: Record<string, EnrichedCard> = {};
    let notFoundCount = 0;

    try {
      for (const names of chunk(uniqueNames, ENRICH_CHUNK_SIZE)) {
        const res = await fetch("/api/deck-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardNames: names }),
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
        notFoundCount += json.notFound?.length ?? 0;
      }

      dispatch({ type: "ENRICH_SUCCESS", cardMap, notFoundCount });
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

  const fetchCombos = useCallback(async (deck: DeckData) => {
    const allCards = [...deck.commanders, ...deck.mainboard];
    const uniqueNames = [...new Set(allCards.map((c) => c.name))];
    if (uniqueNames.length === 0) return;

    spellbookAbortRef.current?.abort();
    const controller = new AbortController();
    spellbookAbortRef.current = controller;

    dispatch({ type: "SPELLBOOK_START" });

    try {
      const res = await fetch("/api/deck-combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNames: uniqueNames,
          commanders: deck.commanders.map((c) => c.name),
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20_000),
        ]),
      });

      if (!res.ok) {
        dispatch({ type: "SPELLBOOK_ERROR" });
        return;
      }

      const json = await res.json();
      dispatch({
        type: "SPELLBOOK_SUCCESS",
        combos: {
          exactCombos: json.exactCombos ?? [],
          nearCombos: json.nearCombos ?? [],
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "SPELLBOOK_ERROR" });
    }
  }, []);

  const fetchMeta = useCallback(async (deck: DeckData) => {
    metaAbortRef.current?.abort();
    const controller = new AbortController();
    metaAbortRef.current = controller;

    dispatch({ type: "META_START" });

    const commanders = deck.commanders.map((c) => c.name);

    try {
      const res = await fetch("/api/deck-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commanders }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });

      if (!res.ok) {
        dispatch({ type: "META_ERROR", result: errorMeta(commanders) });
        return;
      }

      const json = (await res.json()) as {
        source: MetaSource | null;
        commanderLabel: string;
        inclusionMap: Record<string, number>;
        potentialDecks: number;
        error?: string;
      };

      if (json.error) {
        dispatch({ type: "META_ERROR", result: errorMeta(commanders, json.commanderLabel) });
        return;
      }

      const result = computeDeckMeta(
        deck,
        json.inclusionMap,
        json.potentialDecks,
        json.source ?? "primary",
        json.commanderLabel
      );
      dispatch({ type: "META_SUCCESS", result });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "META_ERROR", result: errorMeta(commanders) });
    }
  }, []);

  // After hydration, kick off enrichment + combos if missing.
  // Track which deckId we've fetched for so we don't refetch on every render.
  const enrichedDeckIdRef = useRef<string | null>(null);
  const combosDeckIdRef = useRef<string | null>(null);
  const metaDeckIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    const { deckId, deck, cardMap } = state.payload;

    if (cardMap === null && enrichedDeckIdRef.current !== deckId) {
      enrichedDeckIdRef.current = deckId;
      void enrich(deck);
    }
  }, [state.hydration, state.payload, enrich]);

  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    const { deckId, deck, spellbookCombos } = state.payload;

    if (spellbookCombos === null && combosDeckIdRef.current !== deckId) {
      combosDeckIdRef.current = deckId;
      void fetchCombos(deck);
    }
  }, [state.hydration, state.payload, fetchCombos]);

  useEffect(() => {
    if (state.hydration !== "hydrated" || !state.payload) return;
    const { deckId, deck, deckMeta } = state.payload;

    if (deckMeta === null && metaDeckIdRef.current !== deckId) {
      metaDeckIdRef.current = deckId;
      void fetchMeta(deck);
    }
  }, [state.hydration, state.payload, fetchMeta]);

  // Commander legality check — runs after enrichment completes.
  useEffect(() => {
    const payload = state.payload;
    if (!payload || !payload.cardMap || state.enrichLoading) {
      dispatch({ type: "SET_COMMANDER_WARNING", warning: null });
      return;
    }
    if (payload.deck.commanders.length === 0) return;
    const { warnings } = validateCommanderLegality(
      payload.deck.commanders.map((c) => c.name),
      payload.cardMap
    );
    dispatch({
      type: "SET_COMMANDER_WARNING",
      warning: warnings.length > 0 ? warnings.join(" ") : null,
    });
  }, [state.payload, state.enrichLoading]);

  // Memoized analysis derived from deck + cardMap + combos.
  const analysisResults: DeckAnalysisResults | null = useMemo(() => {
    const payload = state.payload;
    if (!payload?.cardMap) return null;
    return computeAllAnalyses({
      deck: payload.deck,
      cardMap: payload.cardMap,
      spellbookCombos: payload.spellbookCombos ?? null,
    });
  }, [state.payload]);

  const setPayload = useCallback((next: DeckSessionPayload) => {
    enrichAbortRef.current?.abort();
    spellbookAbortRef.current?.abort();
    metaAbortRef.current?.abort();
    enrichedDeckIdRef.current = null;
    combosDeckIdRef.current = null;
    metaDeckIdRef.current = null;
    saveDeckSession(next);
    dispatch({ type: "SET_PAYLOAD", payload: next });
  }, []);

  const retryEnrichment = useCallback(() => {
    if (state.payload) {
      enrichedDeckIdRef.current = null;
      void enrich(state.payload.deck);
    }
  }, [state.payload, enrich]);

  const retryMeta = useCallback(() => {
    if (state.payload) {
      metaDeckIdRef.current = null;
      void fetchMeta(state.payload.deck);
    }
  }, [state.payload, fetchMeta]);

  const dismissEnrichError = useCallback(() => {
    dispatch({ type: "DISMISS_ENRICH_ERROR" });
  }, []);

  const dismissNotFound = useCallback(() => {
    dispatch({ type: "DISMISS_NOT_FOUND" });
  }, []);

  const dismissCommanderWarning = useCallback(() => {
    dispatch({ type: "SET_COMMANDER_WARNING", warning: null });
  }, []);

  const clearSession = useCallback(() => {
    enrichAbortRef.current?.abort();
    spellbookAbortRef.current?.abort();
    metaAbortRef.current?.abort();
    enrichedDeckIdRef.current = null;
    combosDeckIdRef.current = null;
    metaDeckIdRef.current = null;
    clearDeckSession();
    dispatch({ type: "CLEAR" });
  }, []);

  const value = useMemo<DeckSessionContextValue>(
    () => ({
      hydration: state.hydration,
      payload: state.payload,
      enrichLoading: state.enrichLoading,
      enrichError: state.enrichError,
      spellbookLoading: state.spellbookLoading,
      metaLoading: state.metaLoading,
      commanderWarning: state.commanderWarning,
      analysisResults,
      setPayload,
      retryEnrichment,
      retryMeta,
      dismissEnrichError,
      dismissNotFound,
      dismissCommanderWarning,
      clearSession,
    }),
    [
      state.hydration,
      state.payload,
      state.enrichLoading,
      state.enrichError,
      state.spellbookLoading,
      state.metaLoading,
      state.commanderWarning,
      analysisResults,
      setPayload,
      retryEnrichment,
      retryMeta,
      dismissEnrichError,
      dismissNotFound,
      dismissCommanderWarning,
      clearSession,
    ]
  );

  return (
    <DeckSessionContext.Provider value={value}>
      {children}
    </DeckSessionContext.Provider>
  );
}

export function useDeckSession(): DeckSessionContextValue {
  const ctx = useContext(DeckSessionContext);
  if (!ctx) {
    throw new Error("useDeckSession must be used within a DeckSessionProvider");
  }
  return ctx;
}
