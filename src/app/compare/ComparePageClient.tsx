"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeDeckComparison,
  computeManaPressureComparison,
  type DeckComparisonResult,
  type ManaPressureComparison,
} from "@/lib/deck-comparison";
import CompareImportSlot from "@/components/CompareImportSlot";
import ComparisonOverview from "@/components/ComparisonOverview";
import ManaCurveComparison from "@/components/comparison/ManaCurveComparison";
import ColorAnalysisComparison from "@/components/comparison/ColorAnalysisComparison";
import ManaBaseComparison from "@/components/comparison/ManaBaseComparison";

interface DeckSlot {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

const DEFAULT_NAME_A = "Deck 1";
const DEFAULT_NAME_B = "Deck 2";

export default function ComparePageClient() {
  const [slotA, setSlotA] = useState<DeckSlot | null>(null);
  const [slotB, setSlotB] = useState<DeckSlot | null>(null);
  const [nameA, setNameA] = useState(DEFAULT_NAME_A);
  const [nameB, setNameB] = useState(DEFAULT_NAME_B);

  const labelA = nameA.trim() || DEFAULT_NAME_A;
  const labelB = nameB.trim() || DEFAULT_NAME_B;

  // Compute comparison only when both decks are enriched
  const comparisonResult = useMemo<{
    comparison: DeckComparisonResult | null;
    pressure: ManaPressureComparison | null;
    error: string | null;
  }>(() => {
    if (!slotA || !slotB) return { comparison: null, pressure: null, error: null };
    try {
      return {
        comparison: computeDeckComparison(slotA.deck, slotA.cardMap, slotB.deck, slotB.cardMap),
        pressure: computeManaPressureComparison(slotA.deck, slotA.cardMap, slotB.deck, slotB.cardMap),
        error: null,
      };
    } catch (err) {
      return {
        comparison: null,
        pressure: null,
        error: err instanceof Error ? err.message : "Failed to compute comparison",
      };
    }
  }, [slotA, slotB]);

  const comparison = comparisonResult.comparison;
  const pressure = comparisonResult.pressure;
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
        {/* Back navigation */}
        <div className="mb-6">
          <Link
            href="/"
            data-testid="compare-back-link"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 motion-reduce:transition-none"
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back to Deck Evaluator
          </Link>
        </div>

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
            defaultName={DEFAULT_NAME_A}
            testId="compare-slot-a"
            onDeckReady={(deck, cardMap) => setSlotA({ deck, cardMap })}
            onDeckCleared={() => setSlotA(null)}
            onNameChange={setNameA}
          />
          <CompareImportSlot
            label="Comparison deck"
            subtitle="Import the deck to compare against"
            defaultName={DEFAULT_NAME_B}
            testId="compare-slot-b"
            onDeckReady={(deck, cardMap) => setSlotB({ deck, cardMap })}
            onDeckCleared={() => setSlotB(null)}
            onNameChange={setNameB}
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
              {pressure && (
                <ManaBaseComparison
                  diffs={comparison.metricDiffs}
                  pressure={pressure}
                  labelA={labelA}
                  labelB={labelB}
                />
              )}
            </div>

            {/* Charts — full width */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ManaCurveComparison
                data={comparison.curveOverlay}
                labelA={labelA}
                labelB={labelB}
              />
              <ColorAnalysisComparison
                data={comparison.tagComparison}
                labelA={labelA}
                labelB={labelB}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
