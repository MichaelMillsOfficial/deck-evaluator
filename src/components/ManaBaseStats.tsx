"use client";

import type { ManaBaseMetrics } from "@/lib/color-distribution";

interface ManaBaseStatsProps {
  metrics: ManaBaseMetrics;
}

export default function ManaBaseStats({ metrics }: ManaBaseStatsProps) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-land-count"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Lands
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {metrics.landCount}{" "}
          <span className="text-sm font-normal text-slate-400">
            / {metrics.totalCards} ({metrics.landPercentage.toFixed(1)}%)
          </span>
        </p>
      </div>
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-avg-cmc"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Avg CMC
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {metrics.averageCmc.toFixed(1)}
        </p>
      </div>
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
        data-testid="stat-colorless-sources"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Colorless Sources
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          {metrics.colorlessSources}
        </p>
      </div>
    </div>
  );
}
