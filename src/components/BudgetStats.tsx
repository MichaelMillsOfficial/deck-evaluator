"use client";

import type { BudgetAnalysisResult } from "@/lib/budget-analysis";
import { formatUSD } from "@/lib/budget-analysis";

interface BudgetStatsProps {
  result: BudgetAnalysisResult;
}

export default function BudgetStats({ result }: BudgetStatsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
          data-testid="budget-total-cost"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Total Cost
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {result.totalCostFormatted}
          </p>
        </div>
        <div
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
          data-testid="budget-avg-price"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Avg Price/Card
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatUSD(result.averagePricePerCard)}
          </p>
        </div>
        <div
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
          data-testid="budget-median-price"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Median Price
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatUSD(result.medianPricePerCard)}
          </p>
        </div>
      </div>
      {result.unknownPriceCount > 0 && (
        <p className="text-xs text-slate-400">
          {result.unknownPriceCount} card{result.unknownPriceCount === 1 ? "" : "s"} without price data
        </p>
      )}
    </div>
  );
}
