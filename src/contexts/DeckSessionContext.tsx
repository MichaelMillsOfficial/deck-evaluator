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
  commanderWarning: null,
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
  commanderWarning: string | null;
  analysisResults: DeckAnalysisResults | null;
  retryEnrichment: () => void;
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

    try {
      const res = await fetch("/api/deck-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNames: uniqueNames }),
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
      dispatch({
        type: "ENRICH_SUCCESS",
        cardMap: json.cards as Record<string, EnrichedCard>,
        notFoundCount: json.notFound?.length ?? 0,
      });
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

  // After hydration, kick off enrichment + combos if missing.
  // Track which deckId we've fetched for so we don't refetch on every render.
  const enrichedDeckIdRef = useRef<string | null>(null);
  const combosDeckIdRef = useRef<string | null>(null);

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

  const retryEnrichment = useCallback(() => {
    if (state.payload) {
      enrichedDeckIdRef.current = null;
      void enrich(state.payload.deck);
    }
  }, [state.payload, enrich]);

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
    enrichedDeckIdRef.current = null;
    combosDeckIdRef.current = null;
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
      commanderWarning: state.commanderWarning,
      analysisResults,
      retryEnrichment,
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
      state.commanderWarning,
      analysisResults,
      retryEnrichment,
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
