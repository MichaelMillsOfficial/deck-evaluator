"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import DeckHeader, { type ViewTab } from "@/components/DeckHeader";
import DiscordExportModal from "@/components/DiscordExportModal";

export default function DeckImportSection() {
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardMap, setCardMap] = useState<Record<string, EnrichedCard> | null>(
    null
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [notFoundCount, setNotFoundCount] = useState<number>(0);
  const [spellbookCombos, setSpellbookCombos] = useState<{
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null>(null);
  const [spellbookLoading, setSpellbookLoading] = useState(false);
  const [commanderWarning, setCommanderWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("list");
  const [discordModalOpen, setDiscordModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const deckResultRef = useRef<HTMLDivElement>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const spellbookAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (deckData && deckResultRef.current) {
      deckResultRef.current.focus();
    }
  }, [deckData]);

  // Post-enrichment commander legality check
  useEffect(() => {
    if (!deckData || !cardMap || enrichLoading) {
      setCommanderWarning(null);
      return;
    }
    if (deckData.commanders.length === 0) return;

    const { warnings } = validateCommanderLegality(
      deckData.commanders.map((c) => c.name),
      cardMap
    );
    setCommanderWarning(warnings.length > 0 ? warnings.join(" ") : null);
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

    setEnrichLoading(true);
    setEnrichError(null);
    setCardMap(null);
    setNotFoundCount(0);

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
        if (res.status === 502) {
          setEnrichError("Card data service temporarily unavailable");
        } else {
          setEnrichError("Could not load card details");
        }
        return;
      }

      const json = await res.json();
      setCardMap(json.cards as Record<string, EnrichedCard>);
      setNotFoundCount(json.notFound?.length ?? 0);
    } catch (err) {
      // Don't update state for aborted requests
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof TypeError) {
        setEnrichError("Network error — could not reach card data service");
      } else {
        setEnrichError("Could not load card details");
      }
    } finally {
      setEnrichLoading(false);
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

    setSpellbookLoading(true);
    setSpellbookCombos(null);

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
        setSpellbookCombos({ exactCombos: [], nearCombos: [] });
        return;
      }

      const json = await res.json();
      setSpellbookCombos({
        exactCombos: json.exactCombos ?? [],
        nearCombos: json.nearCombos ?? [],
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSpellbookCombos({ exactCombos: [], nearCombos: [] });
    } finally {
      setSpellbookLoading(false);
    }
  }, []);

  const handleImport = async (fetcher: () => Promise<Response>) => {
    setLoading(true);
    setError(null);
    setDeckData(null);
    setCardMap(null);
    setEnrichError(null);
    setCommanderWarning(null);
    setSpellbookCombos(null);
    setNotFoundCount(0);
    setShareUrl(null);
    setActiveTab("list");

    try {
      const res = await fetcher();
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `Request failed with status ${res.status}`);
        return;
      }

      const deck = json as DeckData;
      setDeckData(deck);
      enrichDeck(deck);
      fetchCombos(deck);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
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
      setShareUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const encoded = await encodeCompactDeckPayload(deckData, cardMap);
        if (!cancelled) {
          setShareUrl(`${window.location.origin}/shared?d=${encoded}`);
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
          className="mt-8 text-center text-sm text-slate-400 animate-pulse motion-reduce:animate-none"
        >
          Fetching deck...
        </p>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          <svg
            className="mr-2 inline-block h-4 w-4"
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
          {error}
        </div>
      )}

      {deckData && !loading && (
        <div
          ref={deckResultRef}
          tabIndex={-1}
          className="mt-10 focus:outline-none"
          aria-label="Deck import results"
        >
          <DeckHeader
            deck={deckData}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            notFoundCount={notFoundCount}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            analysisResults={analysisResults}
            onOpenDiscordModal={() => setDiscordModalOpen(true)}
            onCopyShareLink={handleCopyShareLink}
          />

          <div className="rounded-xl rounded-t-none border border-t-0 border-slate-700 bg-slate-800/50 overflow-hidden">
            <div className="p-6">
              <DeckViewTabs
                deck={deckData}
                cardMap={cardMap}
                enrichLoading={enrichLoading}
                spellbookCombos={spellbookCombos}
                spellbookLoading={spellbookLoading}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                analysisResults={analysisResults}
              />
            </div>
          </div>

          {enrichError && !enrichLoading && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              <span>{enrichError}. The basic decklist is still available.</span>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  type="button"
                  data-testid="enrich-retry-btn"
                  disabled={enrichLoading}
                  onClick={() => {
                    if (deckData) enrichDeck(deckData);
                  }}
                  className="rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrichError(null);
                    deckResultRef.current?.focus();
                  }}
                  className="text-amber-400 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
                  aria-label="Dismiss warning"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {notFoundCount > 0 && !enrichError && !enrichLoading && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              <span>
                {notFoundCount} {notFoundCount === 1 ? "card" : "cards"} could
                not be found and {notFoundCount === 1 ? "is" : "are"} shown
                without details
              </span>
              <button
                type="button"
                onClick={() => setNotFoundCount(0)}
                className="ml-4 shrink-0 text-amber-400 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
                aria-label="Dismiss warning"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          )}

          {commanderWarning && !enrichLoading && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              <span>{commanderWarning}</span>
              <button
                type="button"
                onClick={() => {
                  setCommanderWarning(null);
                  deckResultRef.current?.focus();
                }}
                className="ml-4 shrink-0 text-amber-400 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
                aria-label="Dismiss commander warning"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
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
          onClose={() => setDiscordModalOpen(false)}
          analysisResults={analysisResults}
          deck={deckData}
          shareUrl={shareUrl ?? undefined}
        />
      )}
    </>
  );
}
