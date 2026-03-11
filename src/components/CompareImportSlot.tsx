"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import DeckInput from "@/components/DeckInput";

interface CompareImportSlotProps {
  /** Label shown as the slot heading */
  label: string;
  /** Descriptive subtitle shown below the heading */
  subtitle: string;
  /** Called with the imported deck and enriched card map once both are ready */
  onDeckReady: (deck: DeckData, cardMap: Record<string, EnrichedCard>) => void;
  /** Called when the user clears this slot */
  onDeckCleared: () => void;
  /** data-testid value for the slot root element */
  testId?: string;
}

export default function CompareImportSlot({
  label,
  subtitle,
  onDeckReady,
  onDeckCleared,
  testId,
}: CompareImportSlotProps) {
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [cardMap, setCardMap] = useState<Record<string, EnrichedCard> | null>(null);

  const enrichAbortRef = useRef<AbortController | null>(null);

  // Stable ref to avoid stale closure — onDeckReady is an inline arrow in parent
  const onDeckReadyRef = useRef(onDeckReady);
  useEffect(() => {
    onDeckReadyRef.current = onDeckReady;
  }, [onDeckReady]);

  const enrichDeck = useCallback(async (deck: DeckData) => {
    const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
    const uniqueNames = [...new Set(allCards.map((c) => c.name))];

    if (uniqueNames.length === 0) return;

    enrichAbortRef.current?.abort();
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    setEnrichLoading(true);
    setEnrichError(null);
    setCardMap(null);

    try {
      const res = await fetch("/api/deck-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNames: uniqueNames }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
      });

      if (!res.ok) {
        setEnrichError(
          res.status === 502
            ? "Card data service temporarily unavailable"
            : "Could not load card details"
        );
        setEnrichLoading(false);
        return;
      }

      const json = await res.json();
      const enrichedMap = json.cards as Record<string, EnrichedCard>;
      setCardMap(enrichedMap);
      setEnrichLoading(false);
      onDeckReadyRef.current(deck, enrichedMap);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setEnrichError(
        err instanceof TypeError
          ? "Network error — could not reach card data service"
          : "Could not load card details"
      );
      setEnrichLoading(false);
    }
  }, []);

  const handleImport = async (fetcher: () => Promise<Response>) => {
    setLoading(true);
    setError(null);
    setDeckData(null);
    setCardMap(null);
    setEnrichError(null);

    try {
      const res = await fetcher();
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `Request failed with status ${res.status}`);
        setLoading(false);
        return;
      }

      const { warnings: _warnings, ...deckFields } = json as DeckData & { warnings?: string[] };
      const deck = deckFields as DeckData;
      setDeckData(deck);
      setLoading(false);
      enrichDeck(deck);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
      setLoading(false);
    }
  };

  const handleParseDeck = (text: string, commanders?: string[]) =>
    handleImport(() =>
      fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(commanders ? { commanders } : {}) }),
      })
    );

  const handleFetchDeck = (url: string) =>
    handleImport(() => fetch(`/api/deck?url=${encodeURIComponent(url)}`));

  const handleClear = () => {
    enrichAbortRef.current?.abort();
    setDeckData(null);
    setCardMap(null);
    setLoading(false);
    setError(null);
    setEnrichLoading(false);
    setEnrichError(null);
    onDeckCleared();
  };

  const totalCards =
    deckData
      ? [...deckData.commanders, ...deckData.mainboard, ...deckData.sideboard].reduce(
          (sum, c) => sum + c.quantity,
          0
        )
      : 0;

  const sourceLabel: Record<DeckData["source"], string> = {
    text: "Text",
    moxfield: "Moxfield",
    archidekt: "Archidekt",
  };

  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
    >
      {/* Slot heading */}
      <div className="mb-4">
        <h2 className="text-base font-semibold uppercase tracking-wide text-slate-300">
          {label}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>

      {/* Import form — shown when no deck loaded yet */}
      {!deckData && (
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
              className="mt-4 text-center text-sm text-slate-400 animate-pulse motion-reduce:animate-none"
            >
              Fetching deck...
            </p>
          )}

          {error && !loading && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}
        </>
      )}

      {/* Deck summary — shown once a deck is imported */}
      {deckData && (
        <div className="space-y-3">
          {/* Summary card */}
          <div className="rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white" title={deckData.name}>
                  {deckData.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-400">
                  {totalCards} {totalCards === 1 ? "card" : "cards"}
                  {deckData.commanders.length > 0 && (
                    <span className="ml-2 text-slate-500">
                      · {deckData.commanders.length} commander{deckData.commanders.length > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                {sourceLabel[deckData.source]}
              </span>
            </div>

            {/* Enrichment status */}
            {enrichLoading && (
              <p
                role="status"
                aria-live="polite"
                className="mt-2 text-xs text-slate-500 animate-pulse motion-reduce:animate-none"
              >
                Loading card details...
              </p>
            )}
            {cardMap && !enrichLoading && (
              <p role="status" aria-live="polite" className="mt-2 text-xs text-emerald-500">
                Card details loaded
              </p>
            )}
            {enrichError && !enrichLoading && (
              <p role="alert" className="mt-2 text-xs text-amber-400">
                {enrichError}
              </p>
            )}
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 motion-reduce:transition-none"
            aria-label={`Clear ${label} deck`}
          >
            Clear deck
          </button>
        </div>
      )}
    </div>
  );
}
