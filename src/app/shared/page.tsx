"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import Link from "next/link";
import { decodeDeckPayload, buildDeckFromCompactPayload } from "@/lib/deck-codec";
import { parseDecklist } from "@/lib/decklist-parser";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "@/lib/deck-analysis-aggregate";
import type { ShareAnalysisSummary } from "@/lib/share-analysis-summary";
import { DeckSidebar } from "@/components/DeckSidebar";
import DeckViewTabs from "@/components/DeckViewTabs";
import type { ViewTab } from "@/lib/view-tabs";

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
  // v3: instant summary shown before full analysis is computed
  const [instantSummary, setInstantSummary] = useState<ShareAnalysisSummary | null>(null);

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

        if (payload.version === 3 || payload.version === 2) {
          // v3/v2 compact: enrich by set+collector_number
          // For v3, extract instant summary if present
          if (payload.version === 3 && payload.summary) {
            setInstantSummary(payload.summary);
          }

          const allTuples = [
            ...payload.commanders,
            ...payload.mainboard,
            ...payload.sideboard,
          ];

          // Separate set+number tuples from fallback name tuples
          const idTuples = allTuples.filter(([set]) => set !== "_");
          const nameTuples = allTuples.filter(([set]) => set === "_");

          setEnrichLoading(true);
          setEnrichError(null);

          try {
            const cards: Record<string, EnrichedCard> = {};

            // Fetch by set+number identifiers
            if (idTuples.length > 0) {
              const res = await fetch("/api/deck-enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  identifiers: idTuples.map(([set, num]) => ({
                    set,
                    collector_number: num,
                  })),
                }),
              });
              if (res.ok) {
                const json = await res.json();
                Object.assign(cards, json.cards);
              }
            }

            // Fetch fallback name-based cards
            if (nameTuples.length > 0) {
              const names = nameTuples.map(([, name]) => name);
              const res = await fetch("/api/deck-enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cardNames: names }),
              });
              if (res.ok) {
                const json = await res.json();
                Object.assign(cards, json.cards);
              }
            }

            const deck = buildDeckFromCompactPayload(payload, cards);
            setDeckData(deck);
            setCardMap(cards);
          } catch {
            setEnrichError("Could not load card details");
          } finally {
            setEnrichLoading(false);
          }
        } else {
          // v1: existing text-based path
          const { deck } = parseDecklist(
            payload.text,
            payload.commanders ? { commanders: payload.commanders } : undefined
          );
          setDeckData(deck);
          enrichDeck(deck);
        }
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
          <Link
            href="/"
            className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Import Your Own Deck
          </Link>
        </div>
      </div>
    );
  }

  if (!deckData) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        {/* v3 instant summary shown before full analysis loads */}
        {instantSummary && (
          <div
            data-testid="instant-summary"
            className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left"
          >
            <h2 className="text-sm font-semibold text-slate-300 mb-3">
              Viewing a shared deck analysis
            </h2>
            <div className="flex flex-wrap gap-3 mb-3">
              <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                PL {instantSummary.pl}
              </span>
              <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                Bracket {instantSummary.br}
              </span>
              <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                Avg CMC {instantSummary.avg}
              </span>
              <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
                {instantSummary.kr}% keep rate
              </span>
              {instantSummary.combos > 0 && (
                <span className="rounded border border-purple-600/40 bg-purple-600/10 px-2 py-0.5 text-xs text-purple-300">
                  {instantSummary.combos} combo{instantSummary.combos !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {instantSummary.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {instantSummary.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-purple-600/20 px-2 py-0.5 text-xs text-purple-300"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-sm text-slate-400 animate-pulse">
          Loading shared deck...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      {/* Shared deck banner */}
      <div
        data-testid="shared-banner"
        className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-300 flex items-center justify-between max-w-3xl mx-auto"
      >
        <span>Viewing a shared deck analysis</span>
        <Link
          href="/"
          className="text-purple-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded-sm"
        >
          Import your own deck
        </Link>
      </div>

      <div className="flex min-h-0">
        <DeckSidebar
          deck={deckData}
          cardMap={cardMap}
          enrichLoading={enrichLoading}
          enrichError={enrichError}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          analysisResults={analysisResults}
        />

        <div className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden md:rounded-l-none md:border-l-0">
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
