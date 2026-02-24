"use client";

import { useState, useMemo, Fragment } from "react";
import type { CardSynergyScore } from "@/lib/types";
import { getAxisById } from "@/lib/synergy-axes";

interface CardSynergyTableProps {
  cardScores: Record<string, CardSynergyScore>;
}

type SortKey = "name" | "score";
type SortDir = "asc" | "desc";

function scoreBadgeClasses(score: number): string {
  if (score >= 80) return "bg-green-500/20 text-green-300";
  if (score >= 60) return "bg-emerald-500/20 text-emerald-300";
  if (score >= 40) return "bg-yellow-500/20 text-yellow-300";
  if (score >= 20) return "bg-orange-500/20 text-orange-300";
  return "bg-red-500/20 text-red-300";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Questionable";
  return "Poor";
}

export default function CardSynergyTable({
  cardScores,
}: CardSynergyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const sortedCards = useMemo(() => {
    const entries = Object.values(cardScores);
    return entries.sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortKey === "score") return (a.score - b.score) * mul;
      return a.cardName.localeCompare(b.cardName) * mul;
    });
  }, [cardScores, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "score" ? "desc" : "asc");
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "desc" ? " \u25BC" : " \u25B2") : "";

  return (
    <div data-testid="card-synergy-table">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Per-Card Synergy Scores
      </h4>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80">
              <th className="px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                >
                  Card{sortArrow("name")}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("score")}
                  className="text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                >
                  Score{sortArrow("score")}
                </button>
              </th>
              <th className="px-3 py-2 text-left hidden sm:table-cell">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Rating
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => {
              const isExpanded = expandedCard === card.cardName;
              const detailId = `synergy-detail-${card.cardName.replace(/[^a-zA-Z0-9]/g, "-")}`;
              return (
                <Fragment key={card.cardName}>
                  <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        onClick={() =>
                          setExpandedCard(isExpanded ? null : card.cardName)
                        }
                        className="flex items-center gap-1.5 min-h-[44px] text-left text-slate-200 hover:text-purple-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {card.cardName}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        data-testid={`synergy-score-${card.cardName.replace(/[^a-zA-Z0-9]/g, "-")}`}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${scoreBadgeClasses(card.score)}`}
                      >
                        {card.score}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 hidden sm:table-cell">
                      {scoreLabel(card.score)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr id={detailId} className="bg-slate-900/50">
                      <td colSpan={3} className="px-4 py-3">
                        {card.axes.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-slate-400 mb-1">
                              Synergy Axes
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {card.axes.map((axis) => {
                                const axisDef = getAxisById(axis.axisId);
                                const bg =
                                  axisDef?.color.bg ?? "bg-slate-500/20";
                                const text =
                                  axisDef?.color.text ?? "text-slate-300";
                                return (
                                  <span
                                    key={axis.axisId}
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${bg} ${text}`}
                                  >
                                    {axis.axisName} (
                                    {(axis.relevance * 100).toFixed(0)}%)
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {card.pairs.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-1">
                              Relationships
                            </p>
                            <ul className="space-y-1">
                              {card.pairs.slice(0, 5).map((pair, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-slate-300"
                                >
                                  <span
                                    className={
                                      pair.type === "anti-synergy"
                                        ? "text-amber-300"
                                        : pair.type === "combo"
                                          ? "text-purple-300"
                                          : "text-emerald-300"
                                    }
                                  >
                                    {pair.type === "combo"
                                      ? "Combo"
                                      : pair.type === "anti-synergy"
                                        ? "Anti-synergy"
                                        : "Synergy"}
                                  </span>{" "}
                                  with{" "}
                                  {pair.cards
                                    .filter((n) => n !== card.cardName)
                                    .join(", ")}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {card.axes.length === 0 && card.pairs.length === 0 && (
                          <p className="text-xs text-slate-500">
                            No synergy axes detected for this card.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
