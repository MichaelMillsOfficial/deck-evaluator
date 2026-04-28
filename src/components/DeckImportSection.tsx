"use client";

import { useReducer, useRef, useEffect, useCallback, useMemo } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import { validateCommanderLegality } from "@/lib/commander-validation";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "@/lib/deck-analysis-aggregate";
import { encodeCompactDeckPayload } from "@/lib/deck-codec";
import DeckInput from "@/components/DeckInput";
import DeckViewTabs from "@/components/DeckViewTabs";
import { DeckSidebar, DeckDrawer } from "@/components/DeckSidebar";
import DeckMobileTopBar from "@/components/DeckMobileTopBar";
import DiscordExportModal from "@/components/DiscordExportModal";
import type { ViewTab } from "@/lib/view-tabs";
import styles from "./DeckImportSection.module.css";

function AlertIcon() {
  return (
    <svg
      className={styles.alertIcon}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface DeckImportState {
  deckData: DeckData | null;
  loading: boolean;
  error: string | null;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  notFoundCount: number;
  spellbookCombos: { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] } | null;
  spellbookLoading: boolean;
  parseWarnings: string[];
  commanderWarning: string | null;
  activeTab: ViewTab;
  discordModalOpen: boolean;
  shareUrl: string | null;
  drawerOpen: boolean;
}

type DeckImportAction =
  | { type: "IMPORT_START" }
  | { type: "IMPORT_SUCCESS"; deck: DeckData; warnings: string[] }
  | { type: "IMPORT_ERROR"; error: string }
  | { type: "ENRICH_START" }
  | { type: "ENRICH_SUCCESS"; cardMap: Record<string, EnrichedCard>; notFoundCount: number }
  | { type: "ENRICH_ERROR"; error: string }
  | { type: "SPELLBOOK_START" }
  | { type: "SPELLBOOK_SUCCESS"; combos: { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] } }
  | { type: "SPELLBOOK_ERROR" }
  | { type: "SET_COMMANDER_WARNING"; warning: string | null }
  | { type: "SET_TAB"; tab: ViewTab }
  | { type: "SET_SHARE_URL"; url: string | null }
  | { type: "TOGGLE_DISCORD_MODAL"; open: boolean }
  | { type: "DISMISS_PARSE_WARNINGS" }
  | { type: "DISMISS_NOT_FOUND" }
  | { type: "DISMISS_ENRICH_ERROR" }
  | { type: "TOGGLE_DRAWER"; open: boolean };

const initialState: DeckImportState = {
  deckData: null,
  loading: false,
  error: null,
  cardMap: null,
  enrichLoading: false,
  enrichError: null,
  notFoundCount: 0,
  spellbookCombos: null,
  spellbookLoading: false,
  parseWarnings: [],
  commanderWarning: null,
  activeTab: "list",
  discordModalOpen: false,
  shareUrl: null,
  drawerOpen: false,
};

function reducer(state: DeckImportState, action: DeckImportAction): DeckImportState {
  switch (action.type) {
    case "IMPORT_START":
      return {
        ...initialState,
        loading: true,
      };
    case "IMPORT_SUCCESS":
      return {
        ...state,
        loading: false,
        deckData: action.deck,
        parseWarnings: action.warnings,
      };
    case "IMPORT_ERROR":
      return { ...state, loading: false, error: action.error };
    case "ENRICH_START":
      return {
        ...state,
        enrichLoading: true,
        enrichError: null,
        cardMap: null,
        notFoundCount: 0,
      };
    case "ENRICH_SUCCESS":
      return {
        ...state,
        enrichLoading: false,
        cardMap: action.cardMap,
        notFoundCount: action.notFoundCount,
      };
    case "ENRICH_ERROR":
      return { ...state, enrichLoading: false, enrichError: action.error };
    case "SPELLBOOK_START":
      return { ...state, spellbookLoading: true, spellbookCombos: null };
    case "SPELLBOOK_SUCCESS":
      return { ...state, spellbookLoading: false, spellbookCombos: action.combos };
    case "SPELLBOOK_ERROR":
      return {
        ...state,
        spellbookLoading: false,
        spellbookCombos: { exactCombos: [], nearCombos: [] },
      };
    case "SET_COMMANDER_WARNING":
      return { ...state, commanderWarning: action.warning };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_SHARE_URL":
      return { ...state, shareUrl: action.url };
    case "TOGGLE_DISCORD_MODAL":
      return { ...state, discordModalOpen: action.open };
    case "DISMISS_PARSE_WARNINGS":
      return { ...state, parseWarnings: [] };
    case "DISMISS_NOT_FOUND":
      return { ...state, notFoundCount: 0 };
    case "DISMISS_ENRICH_ERROR":
      return { ...state, enrichError: null };
    case "TOGGLE_DRAWER":
      return { ...state, drawerOpen: action.open };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeckImportSection() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const deckResultRef = useRef<HTMLDivElement>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const spellbookAbortRef = useRef<AbortController | null>(null);

  const {
    deckData, loading, error, cardMap, enrichLoading, enrichError,
    notFoundCount, spellbookCombos, spellbookLoading, parseWarnings,
    commanderWarning, activeTab, discordModalOpen, shareUrl, drawerOpen,
  } = state;

  useEffect(() => {
    if (deckData && deckResultRef.current) {
      deckResultRef.current.focus();
    }
  }, [deckData]);

  // Post-enrichment commander legality check
  useEffect(() => {
    if (!deckData || !cardMap || enrichLoading) {
      dispatch({ type: "SET_COMMANDER_WARNING", warning: null });
      return;
    }
    if (deckData.commanders.length === 0) return;

    const { warnings } = validateCommanderLegality(
      deckData.commanders.map((c) => c.name),
      cardMap
    );
    dispatch({
      type: "SET_COMMANDER_WARNING",
      warning: warnings.length > 0 ? warnings.join(" ") : null,
    });
  }, [deckData, cardMap, enrichLoading]);

  // Compute analysis results when cardMap is available
  const analysisResults: DeckAnalysisResults | null = useMemo(
    () =>
      deckData && cardMap
        ? computeAllAnalyses({ deck: deckData, cardMap, spellbookCombos })
        : null,
    [deckData, cardMap, spellbookCombos]
  );

  const enrichDeck = useCallback(async (deck: DeckData) => {
    const allCards = [
      ...deck.commanders,
      ...deck.mainboard,
      ...deck.sideboard,
    ];
    const uniqueNames = [...new Set(allCards.map((c) => c.name))];

    if (uniqueNames.length === 0) return;

    // Abort any in-flight enrichment request
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
          error: res.status === 502
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
      // Don't update state for aborted requests
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({
        type: "ENRICH_ERROR",
        error: err instanceof TypeError
          ? "Network error — could not reach card data service"
          : "Could not load card details",
      });
    }
  }, []);

  const fetchCombos = useCallback(async (deck: DeckData) => {
    const allCards = [
      ...deck.commanders,
      ...deck.mainboard,
    ];
    const uniqueNames = [...new Set(allCards.map((c) => c.name))];

    if (uniqueNames.length === 0) return;

    // Abort any in-flight spellbook request
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

  const handleImport = async (fetcher: () => Promise<Response>) => {
    dispatch({ type: "IMPORT_START" });

    try {
      const res = await fetcher();
      const json = await res.json();

      if (!res.ok) {
        dispatch({
          type: "IMPORT_ERROR",
          error: json.error ?? `Request failed with status ${res.status}`,
        });
        return;
      }

      const { warnings: w, ...deckFields } = json as DeckData & { warnings?: string[] };
      const deck = deckFields as DeckData;
      dispatch({ type: "IMPORT_SUCCESS", deck, warnings: w ?? [] });
      enrichDeck(deck);
      fetchCombos(deck);
    } catch (err) {
      dispatch({
        type: "IMPORT_ERROR",
        error: err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      });
    }
  };

  const handleFetchDeck = (url: string) =>
    handleImport(() => fetch(`/api/deck?url=${encodeURIComponent(url)}`));

  const handleParseDeck = (text: string, commanders?: string[]) =>
    handleImport(() =>
      fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(commanders ? { commanders } : {}) }),
      })
    );

  // Compute share URL after enrichment completes (v2 compact codec)
  useEffect(() => {
    if (!deckData || !cardMap) {
      dispatch({ type: "SET_SHARE_URL", url: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const encoded = await encodeCompactDeckPayload(deckData, cardMap);
        if (!cancelled) {
          dispatch({ type: "SET_SHARE_URL", url: `${window.location.origin}/shared?d=${encoded}` });
        }
      } catch {
        // Encoding error — leave shareUrl null
      }
    })();
    return () => { cancelled = true; };
  }, [deckData, cardMap]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard error — silently fail
    }
  }, [shareUrl]);

  return (
    <>
      <div className={styles.layout}>
      <DeckInput
        onSubmitUrl={handleFetchDeck}
        onSubmitText={handleParseDeck}
        loading={loading}
      />

      {loading && (
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={styles.status}
        >
          Fetching deck...
        </p>
      )}

      {error && !loading && (
        <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
          <div className={styles.alertContent}>
            <AlertIcon />
            <div className={styles.alertBody}>{error}</div>
          </div>
        </div>
      )}

      {parseWarnings.length > 0 && !loading && (
        <div
          data-testid="parse-warnings"
          role="alert"
          className={`${styles.alert} ${styles.alertWatch}`}
        >
          <div className={styles.alertContent}>
            <AlertIcon />
            <div className={styles.alertBody}>
              <p className={styles.alertTitle}>
                Some lines could not be parsed and were skipped:
              </p>
              <ul className={styles.alertList}>
                {parseWarnings.slice(0, 5).map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {parseWarnings.length > 5 && (
                  <li>...and {parseWarnings.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
          <div className={styles.alertActions}>
            <button
              type="button"
              onClick={() => dispatch({ type: "DISMISS_PARSE_WARNINGS" })}
              className={styles.dismissButton}
              aria-label="Dismiss parse warnings"
            >
              <DismissIcon />
            </button>
          </div>
        </div>
      )}

      </div>{/* end layout wrapper for import form */}

      {deckData && !loading && (
        <div
          ref={deckResultRef}
          tabIndex={-1}
          className={styles.results}
          aria-label="Deck import results"
        >
          {/* Mobile top bar (only visible below md) */}
          <DeckMobileTopBar
            deckName={deckData.name}
            enrichLoading={enrichLoading}
            cardMap={cardMap}
            enrichError={enrichError}
            hasAnalysis={!!analysisResults}
            onOpenDrawer={() => dispatch({ type: "TOGGLE_DRAWER", open: true })}
            onShare={handleCopyShareLink}
          />

          {/* Mobile drawer */}
          <DeckDrawer
            open={drawerOpen}
            onClose={() => dispatch({ type: "TOGGLE_DRAWER", open: false })}
            deck={deckData}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            activeTab={activeTab}
            onTabChange={(tab) => {
              dispatch({ type: "SET_TAB", tab });
              dispatch({ type: "TOGGLE_DRAWER", open: false });
            }}
            analysisResults={analysisResults}
            onOpenDiscordModal={() => dispatch({ type: "TOGGLE_DISCORD_MODAL", open: true })}
            onCopyShareLink={handleCopyShareLink}
          />

          {/* Desktop layout: sidebar + content */}
          <div className={styles.resultsLayout}>
            {/* Desktop sidebar */}
            <DeckSidebar
              deck={deckData}
              cardMap={cardMap}
              enrichLoading={enrichLoading}
              enrichError={enrichError}
              activeTab={activeTab}
              onTabChange={(tab) => dispatch({ type: "SET_TAB", tab })}
              analysisResults={analysisResults}
              onOpenDiscordModal={() => dispatch({ type: "TOGGLE_DISCORD_MODAL", open: true })}
              onCopyShareLink={handleCopyShareLink}
            />

            {/* Content area */}
            <div className={styles.contentPanel}>
              <div className={styles.contentPanelInner}>
                <DeckViewTabs
                  deck={deckData}
                  cardMap={cardMap}
                  enrichLoading={enrichLoading}
                  spellbookCombos={spellbookCombos}
                  spellbookLoading={spellbookLoading}
                  activeTab={activeTab}
                  onTabChange={(tab) => dispatch({ type: "SET_TAB", tab })}
                  analysisResults={analysisResults}
                />
              </div>
            </div>
          </div>

          {enrichError && !enrichLoading && (
            <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
              <div className={styles.alertContent}>
                <AlertIcon />
                <div className={styles.alertBody}>
                  {enrichError}. The basic decklist is still available.
                </div>
              </div>
              <div className={styles.alertActions}>
                <button
                  type="button"
                  data-testid="enrich-retry-btn"
                  disabled={enrichLoading}
                  onClick={() => {
                    if (deckData) enrichDeck(deckData);
                  }}
                  className={styles.retryButton}
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "DISMISS_ENRICH_ERROR" });
                    deckResultRef.current?.focus();
                  }}
                  className={styles.dismissButton}
                  aria-label="Dismiss warning"
                >
                  <DismissIcon />
                </button>
              </div>
            </div>
          )}

          {notFoundCount > 0 && !enrichError && !enrichLoading && (
            <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
              <div className={styles.alertContent}>
                <AlertIcon />
                <div className={styles.alertBody}>
                  {notFoundCount} {notFoundCount === 1 ? "card" : "cards"} could
                  not be found and {notFoundCount === 1 ? "is" : "are"} shown
                  without details
                </div>
              </div>
              <div className={styles.alertActions}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "DISMISS_NOT_FOUND" })}
                  className={styles.dismissButton}
                  aria-label="Dismiss warning"
                >
                  <DismissIcon />
                </button>
              </div>
            </div>
          )}

          {commanderWarning && !enrichLoading && (
            <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
              <div className={styles.alertContent}>
                <AlertIcon />
                <div className={styles.alertBody}>{commanderWarning}</div>
              </div>
              <div className={styles.alertActions}>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "SET_COMMANDER_WARNING", warning: null });
                    deckResultRef.current?.focus();
                  }}
                  className={styles.dismissButton}
                  aria-label="Dismiss commander warning"
                >
                  <DismissIcon />
                </button>
              </div>
            </div>
          )}

          {/* Visually-hidden announcement for screen readers when enrichment completes */}
          <p className="sr-only" role="status" aria-live="polite">
            {cardMap && !enrichLoading ? "Card details loaded" : ""}
          </p>
        </div>
      )}

      {deckData && analysisResults && (
        <DiscordExportModal
          open={discordModalOpen}
          onClose={() => dispatch({ type: "TOGGLE_DISCORD_MODAL", open: false })}
          analysisResults={analysisResults}
          deck={deckData}
          shareUrl={shareUrl ?? undefined}
        />
      )}
    </>
  );
}
