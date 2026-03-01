"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import { decodeDeckPayload } from "@/lib/deck-codec";
import { parseDecklist } from "@/lib/decklist-parser";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "@/lib/deck-analysis-aggregate";
import DeckHeader, { type ViewTab } from "@/components/DeckHeader";
import DeckViewTabs from "@/components/DeckViewTabs";

function SharedDeckContent() {
  const searchParams = useSearchParams();
  const d = searchParams.get("d");

  const [deckData, setDeckData] = useState<DeckData | null>(null);
  const [cardMap, setCardMap] = useState<Record<string, EnrichedCard> | null>(
    null
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("list");
  const [spellbookCombos, setSpellbookCombos] = useState<{
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null>(null);
  const [spellbookLoading, setSpellbookLoading] = useState(false);
  const enrichAbortRef = useRef<AbortController | null>(null);

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
      if (err instanceof DOMException && err.name === "AbortError") return;
      setEnrichError("Could not load card details");
    } finally {
      setEnrichLoading(false);
    }
  }, []);

  // Decode payload on mount
  useEffect(() => {
    if (!d) {
      setDecodeError("No deck data provided");
      return;
    }

    (async () => {
      try {
        const payload = await decodeDeckPayload(d);
        const deck = parseDecklist(
          payload.text,
          payload.commanders ? { commanders: payload.commanders } : undefined
        );
        setDeckData(deck);
        enrichDeck(deck);
      } catch {
        setDecodeError("Invalid or corrupted share link");
      }
    })();
  }, [d, enrichDeck]);

  if (decodeError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            Unable to Load Deck
          </h1>
          <p className="text-sm text-red-400 mb-4">{decodeError}</p>
          <a
            href="/"
            className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Import Your Own Deck
          </a>
        </div>
      </div>
    );
  }

  if (!deckData) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-slate-400 animate-pulse">
          Loading shared deck...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Shared deck banner */}
      <div
        data-testid="shared-banner"
        className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-300 flex items-center justify-between"
      >
        <span>Shared deck</span>
        <a
          href="/"
          className="text-purple-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded-sm"
        >
          Import your own deck
        </a>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <DeckHeader
          deck={deckData}
          cardMap={cardMap}
          enrichLoading={enrichLoading}
          enrichError={enrichError}
          notFoundCount={0}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          analysisResults={analysisResults}
        />

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
    </div>
  );
}

export default function SharedPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <p className="text-sm text-slate-400 animate-pulse">Loading...</p>
        </div>
      }
    >
      <SharedDeckContent />
    </Suspense>
  );
}
