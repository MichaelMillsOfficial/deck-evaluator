"use client";

import ManaCost from "@/components/ManaCost";
import type { GoldfishOpeningHand } from "@/lib/goldfish-simulator";

const VERDICT_STYLES: Record<string, string> = {
  "Strong Keep": "text-green-300 bg-green-500/20 border-green-500/30",
  Keepable: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  Marginal: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  Mulligan: "text-red-300 bg-red-500/20 border-red-500/30",
};

interface GoldfishOpeningHandDisplayProps {
  hand: GoldfishOpeningHand;
}

export default function GoldfishOpeningHandDisplay({ hand }: GoldfishOpeningHandDisplayProps) {
  const verdictStyle = VERDICT_STYLES[hand.verdict] ?? "text-slate-300 bg-slate-500/20 border-slate-500/30";

  return (
    <div className="space-y-3">
      {/* Score + verdict badge */}
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${verdictStyle}`}
        >
          {hand.verdict}
        </span>
        <span className="text-sm text-slate-400">
          Score: <span className="font-semibold text-slate-200">{Math.round(hand.score)}</span>
          <span className="text-slate-500">/100</span>
        </span>
      </div>

      {/* Card images row */}
      <div className="flex flex-wrap gap-2 justify-center">
        {hand.cards.map((card, i) => (
          <div key={`${card.name}-${i}`} className="flex flex-col items-center gap-1">
            {card.imageUri ? (
              <img
                src={card.imageUri}
                alt={card.name}
                width={110}
                height={154}
                className="rounded-lg shadow-lg border border-slate-600"
              />
            ) : (
              <div
                role="img"
                className="flex flex-col items-center justify-center rounded-lg border border-slate-600 bg-slate-700/50 text-center px-1"
                style={{ width: 110, height: 154 }}
                aria-label={card.name}
              >
                <p className="text-[9px] font-medium text-slate-200 leading-tight">
                  {card.name}
                </p>
                <ManaCost cost={card.manaCost} />
                <p className="mt-1 text-[8px] text-slate-400 leading-tight">
                  {card.typeLine}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reasoning */}
      {hand.reasoning.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-400">
          {hand.reasoning.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
