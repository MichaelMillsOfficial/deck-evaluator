"use client";

import { useState } from "react";
import type { DeckData } from "@/lib/types";
import DeckInput from "@/components/DeckInput";
import DeckList from "@/components/DeckList";

export default function HomePage() {
  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Deck Evaluator</h1>
        <p className="mt-2 text-sm text-gray-500">
          Paste a public Moxfield or Archidekt deck URL to view your decklist.
        </p>
      </div>

      <DeckInput onSubmit={handleFetchDeck} loading={loading} />

      {loading && (
        <p className="mt-8 text-sm text-gray-400 animate-pulse">
          Fetching deck...
        </p>
      )}

      {error && !loading && (
        <div className="mt-8 w-full max-w-2xl rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {deckData && !loading && (
        <div className="mt-10 w-full max-w-2xl">
          <DeckList deck={deckData} />
        </div>
      )}
    </main>
  );
}
