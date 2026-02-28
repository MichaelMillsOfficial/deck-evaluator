"use client";

import type { SimulationStats } from "@/lib/opening-hand";

interface HandSimulationStatsProps {
  stats: SimulationStats | null;
  loading?: boolean;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function HandSimulationStats({
  stats,
  loading,
}: HandSimulationStatsProps) {
  if (loading || !stats) {
    return (
      <div data-testid="simulation-stats" className="space-y-4">
        {/* Shimmer placeholders for stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center"
            >
              <div className="mx-auto h-3 w-16 animate-pulse rounded bg-slate-700" />
              <div className="mx-auto mt-2 h-6 w-12 animate-pulse rounded bg-slate-700" />
            </div>
          ))}
        </div>
        {/* Shimmer placeholder for verdict distribution */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <div className="mb-2 h-3 w-40 animate-pulse rounded bg-slate-700" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1 h-3 w-full animate-pulse rounded bg-slate-700" />
                <div className="h-2 w-full animate-pulse rounded-full bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="simulation-stats" className="space-y-4">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          testId="stat-keepable-rate"
          label="Keepable Rate"
          value={formatPercent(stats.keepableRate)}
        />
        <StatCard
          testId="stat-avg-lands"
          label="Avg Lands"
          value={stats.avgLandsInOpener.toFixed(1)}
        />
        <StatCard
          testId="stat-t1-play"
          label="T1 Play"
          value={formatPercent(stats.probT1Play)}
        />
        <StatCard
          testId="stat-t2-play"
          label="T2 Play"
          value={formatPercent(stats.probT2Play)}
        />
        {stats.avgStrategyScore !== undefined && (
          <StatCard
            testId="stat-avg-strategy"
            label="Avg Strategy"
            value={String(stats.avgStrategyScore)}
          />
        )}
      </div>

      {/* Verdict distribution */}
      <div
        data-testid="verdict-distribution"
        className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
      >
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Verdict Distribution ({stats.totalSimulations} hands)
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <VerdictBar
            label="Strong Keep"
            count={stats.verdictDistribution["Strong Keep"]}
            total={stats.totalSimulations}
            colorClass="bg-emerald-500"
          />
          <VerdictBar
            label="Keepable"
            count={stats.verdictDistribution["Keepable"]}
            total={stats.totalSimulations}
            colorClass="bg-green-500"
          />
          <VerdictBar
            label="Marginal"
            count={stats.verdictDistribution["Marginal"]}
            total={stats.totalSimulations}
            colorClass="bg-yellow-500"
          />
          <VerdictBar
            label="Mulligan"
            count={stats.verdictDistribution["Mulligan"]}
            total={stats.totalSimulations}
            colorClass="bg-red-500"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function VerdictBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
