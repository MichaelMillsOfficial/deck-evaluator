"use client";

import { useState, useMemo } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import { computeDeckComparison, type DeckComparisonResult } from "@/lib/deck-comparison";
import CompareImportSlot from "@/components/CompareImportSlot";
import ComparisonOverview from "@/components/ComparisonOverview";
import MetricComparisonTable from "@/components/MetricComparisonTable";
import ManaCurveOverlay from "@/components/ManaCurveOverlay";
import TagComparisonChart from "@/components/TagComparisonChart";

interface DeckSlot {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

export default function ComparePageClient() {
  const [slotA, setSlotA] = useState<DeckSlot | null>(null);
  const [slotB, setSlotB] = useState<DeckSlot | null>(null);

  const labelA = slotA?.deck.name && slotA.deck.name !== "Unknown Deck" ? slotA.deck.name : "Deck A";
  const labelB = slotB?.deck.name && slotB.deck.name !== "Unknown Deck" ? slotB.deck.name : "Deck B";

  // Compute comparison only when both decks are enriched
  const comparisonResult = useMemo<{
    comparison: DeckComparisonResult | null;
    error: string | null;
  }>(() => {
    if (!slotA || !slotB) return { comparison: null, error: null };
    try {
      return {
        comparison: computeDeckComparison(slotA.deck, slotA.cardMap, slotB.deck, slotB.cardMap),
        error: null,
      };
    } catch (err) {
      return {
        comparison: null,
        error: err instanceof Error ? err.message : "Failed to compute comparison",
      };
    }
  }, [slotA, slotB]);

  const comparison = comparisonResult.comparison;
  const comparisonError = comparisonResult.error;

  // Headline callouts for meaningful tag diffs
  const headlineCallouts = useMemo(() => {
    if (!comparison) return [];
    return comparison.tagComparison
      .filter((t) => Math.abs(t.diff) >= 2)
      .slice(0, 3)
      .map((t) => {
        if (t.diff > 0) {
          return `${labelB} has ${t.diff} more ${t.tag} cards`;
        } else {
          return `${labelA} has ${Math.abs(t.diff)} more ${t.tag} cards`;
        }
      });
  }, [comparison, labelA, labelB]);

  return (
    <div data-testid="compare-page" className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Page header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Compare Decks</h1>
          <p className="mt-3 text-lg text-slate-400">
            Import two decklists to see how they differ — card overlap, mana curves, tag
            composition, and key metrics side by side.
          </p>
        </div>

        {/* Import slots — side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CompareImportSlot
            label="Your deck"
            subtitle="Import your deck"
            testId="compare-slot-a"
            onDeckReady={(deck, cardMap) => setSlotA({ deck, cardMap })}
            onDeckCleared={() => setSlotA(null)}
          />
          <CompareImportSlot
            label="Comparison deck"
            subtitle="Import the deck to compare against"
            testId="compare-slot-b"
            onDeckReady={(deck, cardMap) => setSlotB({ deck, cardMap })}
            onDeckCleared={() => setSlotB(null)}
          />
        </div>

        {/* Status prompts */}
        {!slotA && !slotB && (
          <div className="mt-10 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-10 text-center">
            <p className="text-slate-300">
              Import two decklists above to start comparing them.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Supports text paste, Moxfield, and Archidekt exports.
            </p>
          </div>
        )}

        {comparisonError && (
          <div
            role="alert"
            className="mt-10 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center"
          >
            <p className="text-red-300">
              Could not compare decks: {comparisonError}
            </p>
          </div>
        )}

        {(slotA || slotB) && !comparison && !comparisonError && (
          <div className="mt-10 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-8 text-center">
            <p className="text-slate-300">
              Import a second deck to see the comparison.
            </p>
          </div>
        )}

        {/* Comparison results */}
        {comparison && (
          <div
            data-testid="comparison-results"
            className="mt-10 space-y-8"
          >
            {/* Screen reader announcement */}
            <p className="sr-only" role="status" aria-live="polite">
              Comparison results available for {labelA} and {labelB}.
            </p>

            {/* Headline callouts */}
            {headlineCallouts.length > 0 && (
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-5 py-4">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-purple-400">
                  Key Differences
                </h2>
                <ul className="space-y-1.5">
                  {headlineCallouts.map((callout) => (
                    <li key={callout} className="flex items-start gap-2 text-sm text-slate-300">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                      {callout}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Two-column results layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Card overlap */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <ComparisonOverview
                  overlap={comparison.cardOverlap}
                  labelA={labelA}
                  labelB={labelB}
                />
              </div>

              {/* Metric comparison */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <MetricComparisonTable
                  diffs={comparison.metricDiffs}
                  labelA={labelA}
                  labelB={labelB}
                />
              </div>
            </div>

            {/* Charts — full width */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <ManaCurveOverlay
                  data={comparison.curveOverlay}
                  labelA={labelA}
                  labelB={labelB}
                />
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <TagComparisonChart
                  data={comparison.tagComparison}
                  labelA={labelA}
                  labelB={labelB}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
