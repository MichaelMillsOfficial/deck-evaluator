"use client";

import type { LandSwapRecommendation } from "@/lib/card-suggestions";

function scoreBadgeClasses(score: number): string {
  if (score < 20) return "bg-red-500/20 text-red-300 border border-red-500/30";
  if (score < 35)
    return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
  return "bg-slate-500/20 text-slate-300 border border-slate-600";
}

interface LandSwapListProps {
  recommendation: LandSwapRecommendation | null;
}

export default function LandSwapList({ recommendation }: LandSwapListProps) {
  if (!recommendation) {
    return (
      <div
        data-testid="land-swap-empty"
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-green-400"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        Land count is on target
      </div>
    );
  }

  const { gap, currentCount, targetMin, status, candidates } = recommendation;

  return (
    <div data-testid="land-swap-list" className="flex flex-col gap-2">
      {/* Summary banner */}
      <div
        className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
          status === "critical"
            ? "border-red-500/30 bg-red-500/10 text-red-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          Your deck has {currentCount} lands but needs at least {targetMin}.
          Consider cutting {gap} card{gap !== 1 ? "s" : ""} for lands.
        </span>
      </div>

      {/* Candidate cards to cut */}
      {candidates.map((card) => (
        <div
          key={card.cardName}
          data-testid="land-swap-candidate"
          className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5"
        >
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums mt-0.5 ${scoreBadgeClasses(card.synergyScore)}`}
            title={`Synergy score: ${card.synergyScore}/100`}
          >
            {card.synergyScore}
          </span>

          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-200">
              {card.cardName}
            </span>
            <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
              Low impact — consider replacing with a land
            </p>
            {card.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
