"use client";

import { useState, useCallback } from "react";
import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import ManaCost from "@/components/ManaCost";
import CardTags from "@/components/CardTags";
import { formatUSD } from "@/lib/budget-analysis";

interface CandidateCardRowProps {
  card: EnrichedCard;
  analysis: CandidateAnalysis | null;
  onRemove: () => void;
}

export default function CandidateCardRow({
  card,
  analysis,
  onRemove,
}: CandidateCardRowProps) {
  const [open, setOpen] = useState(false);

  const detailId = `candidate-detail-${card.name.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  const isOffIdentity =
    analysis !== null && analysis.offIdentityColors.length > 0;

  const accentColor = !analysis
    ? "border-l-slate-600"
    : analysis.synergyScore >= 65
      ? "border-l-emerald-500"
      : analysis.synergyScore >= 45
        ? "border-l-amber-500"
        : "border-l-red-500";

  return (
    <div
      className={`rounded-lg border border-slate-700 bg-slate-800/50 mb-3 border-l-4 ${accentColor}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-0.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          className="flex flex-1 items-center gap-2 min-h-[44px] min-w-0 text-left text-slate-200 hover:text-purple-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
        >
          <svg
            data-testid="expand-chevron"
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <span className="min-w-0 font-medium">{card.name}</span>
        </button>

        <ManaCost cost={card.manaCost} />

        {analysis && (
          <span
            data-testid="synergy-badge"
            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              analysis.synergyScore >= 65
                ? "bg-emerald-500/20 text-emerald-300"
                : analysis.synergyScore >= 45
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-red-500/20 text-red-300"
            }`}
          >
            {analysis.synergyScore}
          </span>
        )}

        {isOffIdentity && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300 whitespace-nowrap">
            Off-identity ({analysis.offIdentityColors.join(", ")})
          </span>
        )}

        {card.prices.usd != null && (
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {formatUSD(card.prices.usd)}
          </span>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-sm p-1 text-slate-400 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          aria-label={`Remove ${card.name}`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Summary row — type, tags, and inline metrics */}
      <div className="flex items-center gap-1.5 flex-wrap px-3 pb-2.5 ml-6 text-xs">
        <span className="text-slate-500">{card.typeLine}</span>
        <CardTags card={card} />
        {analysis && (
          <>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span
              data-testid="cmc-delta"
              className={
                analysis.cmcImpact.delta > 0
                  ? "text-red-400"
                  : analysis.cmcImpact.delta < 0
                    ? "text-emerald-400"
                    : "text-slate-400"
              }
            >
              CMC {analysis.cmcImpact.delta >= 0 ? "+" : ""}
              {analysis.cmcImpact.delta.toFixed(2)}
            </span>
            {analysis.axes.length > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400">
                  {analysis.axes.map((a) => a.axisName).join(", ")}
                </span>
              </>
            )}
            {analysis.manaBaseImpact.stressedColors.length > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-amber-400">
                  {analysis.manaBaseImpact.stressedColors.join(", ")} stressed
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Expandable details */}
      {open && analysis && (
        <div id={detailId} className="border-t border-slate-700 p-3 ml-6">
          <div className="space-y-4 text-sm">
            {/* Synergy Pairs */}
            {analysis.pairs.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1.5">
                  Synergizes With
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.pairs.map((p) => {
                    const partner =
                      p.cardA === card.name ? p.cardB : p.cardA;
                    return (
                      <span
                        key={`${p.cardA}-${p.cardB}`}
                        className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {partner}
                        <span className="text-slate-500 ml-1">
                          ({p.reason})
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CMC Impact detail */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1">
                CMC Impact
              </h4>
              <p className="text-slate-400 text-xs">
                Avg CMC: {analysis.cmcImpact.currentAvgCmc.toFixed(2)} →{" "}
                {analysis.cmcImpact.projectedAvgCmc.toFixed(2)}{" "}
                <span
                  className={
                    analysis.cmcImpact.delta > 0
                      ? "text-red-400"
                      : analysis.cmcImpact.delta < 0
                        ? "text-emerald-400"
                        : "text-slate-400"
                  }
                >
                  ({analysis.cmcImpact.delta >= 0 ? "+" : ""}
                  {analysis.cmcImpact.delta.toFixed(2)})
                </span>
              </p>
            </div>

            {/* Mana Base Stress */}
            {analysis.manaBaseImpact.stressedColors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1">
                  Mana Base Stress
                </h4>
                <p className="text-amber-400 text-xs">
                  Stressed colors:{" "}
                  {analysis.manaBaseImpact.stressedColors.join(", ")}
                </p>
              </div>
            )}

            {/* Replacement Suggestions */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-1">
                Replacement Suggestions
              </h4>
              {analysis.replacements.length === 0 ? (
                <p className="text-slate-500 text-xs">
                  No replacement candidates available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-slate-400">
                        <th className="pb-1 pr-3 font-medium">Card</th>
                        <th className="pb-1 pr-3 font-medium">Reason</th>
                        <th className="pb-1 pr-3 font-medium text-right">
                          Synergy
                        </th>
                        <th className="pb-1 pr-3 font-medium text-right">
                          Price
                        </th>
                        <th className="pb-1 font-medium text-right">
                          Net Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.replacements.map((r) => {
                        const candidatePrice = card.prices.usd ?? 0;
                        const replacementPrice = r.priceUsd ?? 0;
                        const netCost = candidatePrice - replacementPrice;
                        return (
                          <tr
                            key={r.cardName}
                            className="border-b border-slate-700/50"
                          >
                            <td className="py-1 pr-3 text-slate-200">
                              {r.cardName}
                            </td>
                            <td className="py-1 pr-3 text-slate-400">
                              {r.reason}
                            </td>
                            <td className="py-1 pr-3 text-right text-slate-300">
                              {r.synergyScore}
                            </td>
                            <td className="py-1 pr-3 text-right text-slate-400">
                              {r.priceUsd != null
                                ? formatUSD(r.priceUsd)
                                : "—"}
                            </td>
                            <td
                              className={`py-1 text-right ${
                                netCost > 0
                                  ? "text-red-400"
                                  : netCost < 0
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                              }`}
                            >
                              {card.prices.usd != null && r.priceUsd != null
                                ? `${netCost >= 0 ? "+" : ""}${formatUSD(netCost)}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading state when analysis is not yet available */}
      {open && !analysis && (
        <div id={detailId} className="border-t border-slate-700 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-purple-400" />
            Analyzing...
          </div>
        </div>
      )}
    </div>
  );
}
