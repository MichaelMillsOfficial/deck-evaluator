"use client";

import { useState, useRef, useEffect } from "react";
import type { DeckData } from "@/lib/types";
import DeckInput from "@/components/DeckInput";
import DeckList from "@/components/DeckList";

export default function DeckImportSection() {
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deckResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (deckData && deckResultRef.current) {
      deckResultRef.current.focus();
    }
  }, [deckData]);

  const handleFetchDeck = async (url: string) => {
    setLoading(true);
    setError(null);
    setDeckData(null);

    try {
      const res = await fetch(
        `/api/deck?url=${encodeURIComponent(url)}`
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `Request failed with status ${res.status}`);
        return;
      }

      setDeckData(json as DeckData);
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

  const handleParseDeck = async (text: string) => {
    setLoading(true);
    setError(null);
    setDeckData(null);

    try {
      const res = await fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `Request failed with status ${res.status}`);
        return;
      }

      setDeckData(json as DeckData);
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
          className="mt-8 text-center text-sm text-slate-400 animate-pulse"
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
          <DeckList deck={deckData} />
        </div>
      )}
    </>
  );
}
