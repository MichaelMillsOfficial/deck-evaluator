"use client";

import { useState } from "react";
import type { GoldfishResult, GoldfishAggregateStats } from "@/lib/goldfish-simulator";
import { compareGoldfishResults } from "@/lib/goldfish-comparison";
import type { MetricDiff } from "@/lib/deck-comparison";
import MetricComparisonTable from "@/components/MetricComparisonTable";

interface GoldfishComparisonProps {
  resultA: GoldfishResult;
  nameA: string;
  /** Optional second result for comparison. When absent, comparison mode is inactive. */
  resultB?: GoldfishResult;
  nameB?: string;
}

/**
 * Side-by-side goldfish metric comparison panel.
 * Shows toggle button to enable/disable comparison mode.
 * When active: displays MetricComparisonTable and per-turn mana delta.
 */
export default function GoldfishComparison({
  resultA,
  nameA,
  resultB,
  nameB = "Reference",
}: GoldfishComparisonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!resultB) {
    return null;
  }

  const comparison = compareGoldfishResults(resultA, nameA, resultB, nameB);

  // Convert advantages to MetricDiff format for MetricComparisonTable
  const metricDiffs: MetricDiff[] = [
    {
      label: "Avg Total Spells Cast",
      valueA: Math.round(comparison.deckA.stats.avgTotalSpellsCast * 10) / 10,
      valueB: Math.round(comparison.deckB.stats.avgTotalSpellsCast * 10) / 10,
      diff: Math.round(comparison.deltas.avgTotalSpellsCast * 10) / 10,
      diffLabel:
        comparison.deltas.avgTotalSpellsCast > 0
          ? `+${(comparison.deltas.avgTotalSpellsCast).toFixed(1)}`
          : comparison.deltas.avgTotalSpellsCast < 0
          ? (comparison.deltas.avgTotalSpellsCast).toFixed(1)
          : "0",
    },
    {
      label: "Commander Cast Rate",
      valueA: Math.round(comparison.deckA.stats.commanderCastRate * 1000) / 10,
      valueB: Math.round(comparison.deckB.stats.commanderCastRate * 1000) / 10,
      diff: Math.round(comparison.deltas.commanderCastRate * 1000) / 10,
      diffLabel:
        comparison.deltas.commanderCastRate > 0
          ? `+${(comparison.deltas.commanderCastRate * 100).toFixed(1)}%`
          : comparison.deltas.commanderCastRate < 0
          ? `${(comparison.deltas.commanderCastRate * 100).toFixed(1)}%`
          : "0%",
      unit: "%",
    },
    {
      label: "Ramp Acceleration",
      valueA: Math.round(comparison.deckA.stats.rampAcceleration * 100) / 100,
      valueB: Math.round(comparison.deckB.stats.rampAcceleration * 100) / 100,
      diff: Math.round(comparison.deltas.rampAcceleration * 100) / 100,
      diffLabel:
        comparison.deltas.rampAcceleration > 0
          ? `+${comparison.deltas.rampAcceleration.toFixed(2)}`
          : comparison.deltas.rampAcceleration < 0
          ? comparison.deltas.rampAcceleration.toFixed(2)
          : "0",
    },
    {
      label: "Avg Mana T4",
      valueA: Math.round((comparison.deckA.stats.avgManaByTurn[3] ?? 0) * 100) / 100,
      valueB: Math.round((comparison.deckB.stats.avgManaByTurn[3] ?? 0) * 100) / 100,
      diff: Math.round((comparison.deltas.avgManaByTurn[3] ?? 0) * 100) / 100,
      diffLabel:
        (comparison.deltas.avgManaByTurn[3] ?? 0) > 0
          ? `+${(comparison.deltas.avgManaByTurn[3] ?? 0).toFixed(2)}`
          : (comparison.deltas.avgManaByTurn[3] ?? 0) < 0
          ? (comparison.deltas.avgManaByTurn[3] ?? 0).toFixed(2)
          : "0",
    },
  ];

  return (
    <section aria-labelledby="goldfish-comparison-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h4
          id="goldfish-comparison-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-400"
        >
          Deck Comparison
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-pressed={isOpen}
          aria-expanded={isOpen}
          aria-controls="goldfish-comparison-panel"
          className={`min-h-[44px] rounded-full border px-4 py-1.5 text-xs transition-colors cursor-pointer ${
            isOpen
              ? "border-purple-500 bg-purple-900/30 text-purple-300"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:border-purple-500 hover:text-slate-200"
          }`}
        >
          {isOpen ? "Hide comparison" : "Compare decks"}
        </button>
      </div>

      {isOpen && (
        <div id="goldfish-comparison-panel" className="space-y-4">
          {/* Deck name labels */}
          <div className="flex gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" aria-hidden="true" />
              <span className="text-purple-300 font-medium">{nameA}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-500" aria-hidden="true" />
              <span className="text-cyan-400 font-medium">{nameB}</span>
            </span>
          </div>

          {/* Metric comparison table */}
          <MetricComparisonTable
            diffs={metricDiffs}
            labelA={nameA}
            labelB={nameB}
          />

          {/* Advantages summary */}
          {comparison.advantages.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/30 px-3 py-2">
              <p className="mb-2 text-xs font-medium text-slate-400">Advantages</p>
              <ul className="space-y-1">
                {comparison.advantages.map((adv) => (
                  <li key={adv.metric} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{adv.metric}</span>
                    <span
                      className={
                        adv.winner === "A"
                          ? "text-purple-300"
                          : adv.winner === "B"
                          ? "text-cyan-400"
                          : "text-slate-500"
                      }
                    >
                      {adv.winner === "tie"
                        ? "Tie"
                        : adv.winner === "A"
                        ? `${nameA} +${adv.magnitude.toFixed(2)}`
                        : `${nameB} +${adv.magnitude.toFixed(2)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
