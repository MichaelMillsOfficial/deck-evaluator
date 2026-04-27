"use client";

import type { CentralityScore, CentralityCategory } from "@/lib/interaction-centrality";
import type { CardProfile } from "@/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// BADGE CONFIG
// ═══════════════════════════════════════════════════════════════

const CATEGORY_CONFIG: Record<
  CentralityCategory,
  { label: string; classes: string }
> = {
  engine: {
    label: "Makes Your Deck Tick",
    classes: "bg-purple-900/60 border border-purple-600/60 text-purple-200",
  },
  contributor: {
    label: "Solid Fit",
    classes: "bg-blue-900/60 border border-blue-600/60 text-blue-200",
  },
  peripheral: {
    label: "Light Connection",
    classes: "bg-slate-800/80 border border-slate-600/60 text-slate-300",
  },
  isolated: {
    label: "No Connections",
    classes: "bg-red-900/30 border border-red-700/50 text-red-300",
  },
};

// ═══════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════

interface CentralityRankingProps {
  scores: CentralityScore[];
  selectedCard: string | null;
  onSelectCard: (cardName: string | null) => void;
  profiles?: Record<string, CardProfile>;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CentralityRanking({
  scores,
  selectedCard,
  onSelectCard,
  profiles,
}: CentralityRankingProps) {
  if (scores.length === 0) {
    return (
      <p
        data-testid="centrality-empty"
        className="text-xs text-slate-500 italic py-1"
      >
        No interactions detected.
      </p>
    );
  }

  return (
    <div data-testid="centrality-ranking" className="overflow-x-auto">
      <table className="table-auto w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-700">
            <th className="py-2 pr-3 whitespace-nowrap w-8">#</th>
            <th className="py-2 pr-3 min-w-0">Card</th>
            <th className="py-2 pr-3 whitespace-nowrap text-right">Connections</th>
            <th className="py-2 whitespace-nowrap">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {scores.map((score) => {
            const isSelected = selectedCard === score.cardName;
            const config = CATEGORY_CONFIG[score.category];
            const hasEminence =
              profiles?.[score.cardName]?.commander?.eminence != null &&
              (profiles[score.cardName].commander!.eminence!.length > 0);
            return (
              <tr
                key={score.cardName}
                data-testid="centrality-row"
                data-card={score.cardName}
                onClick={() =>
                  onSelectCard(isSelected ? null : score.cardName)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectCard(isSelected ? null : score.cardName);
                  }
                }}
                role="row"
                aria-selected={isSelected}
                tabIndex={0}
                className={`cursor-pointer transition-colors duration-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 min-h-[44px] ${
                  isSelected
                    ? "bg-purple-900/20 border-l-2 border-l-purple-500"
                    : "hover:bg-slate-700/20"
                }`}
              >
                {/* Rank */}
                <td className="py-2 pr-3 tabular-nums text-slate-500 shrink-0">
                  {score.rank}
                </td>

                {/* Card name */}
                <td className="py-2 pr-3 min-w-0">
                  <span
                    className={`font-medium truncate block ${
                      isSelected ? "text-purple-200" : "text-slate-200"
                    }`}
                  >
                    {score.cardName}
                    {hasEminence && (
                      <span className="text-amber-400 ml-1" aria-label="Has command zone ability">
                        &#9733;
                      </span>
                    )}
                  </span>
                </td>

                {/* Connection count */}
                <td className="py-2 pr-3 text-right tabular-nums">
                  <span
                    aria-label={`Works with ${score.interactionCount} other cards`}
                    className="text-slate-300 font-semibold"
                  >
                    {score.interactionCount}
                  </span>
                  <span className="text-slate-600 ml-1 hidden sm:inline">
                    {score.interactionCount === 1 ? "card" : "cards"}
                  </span>
                </td>

                {/* Category badge */}
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-label={`Category: ${config.label}`}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${config.classes}`}
                    >
                      {config.label}
                    </span>
                    {/* Panel-open indicator */}
                    {isSelected && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3 w-3 shrink-0 text-purple-400"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
