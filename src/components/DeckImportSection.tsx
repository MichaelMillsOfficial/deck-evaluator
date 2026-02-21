"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import DeckInput from "@/components/DeckInput";
import DeckList from "@/components/DeckList";

export default function DeckImportSection() {
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardMap, setCardMap] = useState<Record<string, EnrichedCard> | null>(
    null
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const deckResultRef = useRef<HTMLDivElement>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (deckData && deckResultRef.current) {
      deckResultRef.current.focus();
    }
  }, [deckData]);

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
        setEnrichError("Could not load card details");
        return;
      }

      const json = await res.json();
      setCardMap(json.cards as Record<string, EnrichedCard>);
    } catch (err) {
      // Don't update state for aborted requests
      if (err instanceof DOMException && err.name === "AbortError") return;
      setEnrichError("Could not load card details");
    } finally {
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
        return;
      }

      const deck = json as DeckData;
      setDeckData(deck);
      // Form re-enables immediately; enrichment is background
      enrichDeck(deck);
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

  const handleParseDeck = (text: string) =>
    handleImport(() =>
      fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
    );

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
          <DeckList deck={deckData} cardMap={cardMap} enrichLoading={enrichLoading} />

          {enrichError && !enrichLoading && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              <span>{enrichError}. The basic decklist is still available.</span>
              <button
                type="button"
                onClick={() => {
                  setEnrichError(null);
                  deckResultRef.current?.focus();
                }}
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

          {/* Visually-hidden announcement for screen readers when enrichment completes */}
          <p className="sr-only" role="status" aria-live="polite">
            {cardMap && !enrichLoading ? "Card details loaded" : ""}
          </p>
        </div>
      )}
    </>
  );
}
