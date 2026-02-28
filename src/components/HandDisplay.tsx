"use client";

import type { DrawnHand, HandCard } from "@/lib/opening-hand";
import ManaCost from "@/components/ManaCost";

const VERDICT_COLORS: Record<string, string> = {
  "Strong Keep": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Keepable: "bg-green-500/20 text-green-300 border-green-500/30",
  Marginal: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Mulligan: "bg-red-500/20 text-red-300 border-red-500/30",
};

interface HandDisplayProps {
  hand: DrawnHand;
  commandZone?: HandCard[];
}

export default function HandDisplay({ hand, commandZone = [] }: HandDisplayProps) {
  const { cards, quality, mulliganNumber } = hand;
  const verdictStyle = VERDICT_COLORS[quality.verdict] ?? "";

  return (
    <div
      data-testid="hand-display"
      aria-label={`Drawn hand: ${quality.verdict}, score ${quality.score}`}
      className="space-y-4"
    >
      {/* Command Zone */}
      {commandZone.length > 0 && (
        <div
          data-testid="command-zone"
          className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-2"
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-purple-400">
            Command Zone
          </p>
          <div className="flex flex-wrap gap-2">
            {commandZone.map((card, idx) => (
              <div key={`cmd-${card.name}-${idx}`} className="flex items-center gap-1.5">
                {card.enriched.imageUris?.small ? (
                  <img
                    src={card.enriched.imageUris.small}
                    alt={card.name}
                    width={48}
                    height={67}
                    className="rounded border border-purple-500/40"
                  />
                ) : (
                  <div
                    role="img"
                    className="flex items-center justify-center rounded border border-purple-500/40 bg-slate-700/50"
                    style={{ width: 48, height: 67 }}
                    aria-label={card.name}
                  >
                    <p className="px-0.5 text-[8px] font-medium text-slate-200 leading-tight text-center">
                      {card.name}
                    </p>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-purple-200 truncate">{card.name}</p>
                  <ManaCost cost={card.enriched.manaCost} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mulligan indicator */}
      {mulliganNumber > 0 && (
        <p
          data-testid="mulligan-indicator"
          className="text-sm font-medium text-yellow-400"
        >
          Mulligan {mulliganNumber} — {cards.length} cards
        </p>
      )}

      {/* Card images row */}
      <div
        className="flex flex-wrap gap-2 justify-center"
        data-testid="hand-cards"
      >
        {cards.map((card, idx) => (
          <div key={`${card.name}-${idx}`} className="flex flex-col items-center gap-1">
            {card.enriched.imageUris?.normal ? (
              <img
                src={card.enriched.imageUris.normal}
                alt={card.name}
                width={146}
                height={204}
                className="rounded-lg shadow-lg border border-slate-600"
              />
            ) : (
              <div
                role="img"
                className="flex items-center justify-center rounded-lg border border-slate-600 bg-slate-700/50 text-center"
                style={{ width: 146, height: 204 }}
                aria-label={card.name}
              >
                <div className="px-2">
                  <p className="text-xs font-medium text-slate-200 leading-tight">
                    {card.name}
                  </p>
                  <div className="mt-1 flex justify-center">
                    <ManaCost cost={card.enriched.manaCost} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {card.enriched.typeLine}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quality verdict */}
      <div className="flex items-center gap-3" data-testid="hand-verdict">
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${verdictStyle}`}
          data-testid="verdict-badge"
        >
          {quality.verdict}
        </span>
        <span className="text-sm text-slate-300" data-testid="hand-score">
          Score: {quality.score}
        </span>
      </div>

      {/* Reasoning */}
      {quality.reasoning.length > 0 && (
        <ul className="space-y-0.5" data-testid="hand-reasoning">
          {quality.reasoning.map((reason, idx) => (
            <li key={idx} className="text-xs text-slate-400">
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
