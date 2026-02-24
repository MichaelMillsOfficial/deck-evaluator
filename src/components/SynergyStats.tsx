"use client";

import type { DeckSynergyAnalysis } from "@/lib/types";

interface SynergyStatsProps {
  analysis: DeckSynergyAnalysis;
}

export default function SynergyStats({ analysis }: SynergyStatsProps) {
  const scores = Object.values(analysis.cardScores);
  const avgScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-avg-synergy"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Avg Synergy
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {avgScore.toFixed(0)}
          <span className="text-sm font-normal text-slate-400"> / 100</span>
        </p>
      </div>
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-combo-count"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Known Combos
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {analysis.knownCombos.length}
        </p>
      </div>
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-anti-synergy-count"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Anti-Synergies
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {analysis.antiSynergies.length}
        </p>
      </div>
    </div>
  );
}
