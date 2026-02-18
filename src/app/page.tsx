"use client";

import { useState } from "react";
import type { DeckData } from "@/lib/types";
import DeckInput from "@/components/DeckInput";
import DeckList from "@/components/DeckList";

const features = [
  "Mana curve and color distribution analysis",
  "Land base efficiency scoring",
  "Card synergy and interaction mapping",
  "Opening hand simulation and mulligan testing",
  "Format-specific deck validation",
  "Performance metrics and win-rate estimation",
];

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
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold text-white">
            Magic: The Gathering
            <br />
            Deck Evaluator
          </h1>
          <p className="mt-4 text-xl text-slate-300">
            Import your deck and analyze its performance, mana base efficiency,
            and test it under various scenarios
          </p>
        </div>

        <DeckInput
          onSubmitUrl={handleFetchDeck}
          onSubmitText={handleParseDeck}
          loading={loading}
        />

        {loading && (
          <p className="mt-8 text-center text-sm text-slate-400 animate-pulse">
            Fetching deck...
          </p>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {deckData && !loading && (
          <div className="mt-10">
            <DeckList deck={deckData} />
          </div>
        )}

        {/* Features section */}
        <div className="mt-12 rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Features
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
