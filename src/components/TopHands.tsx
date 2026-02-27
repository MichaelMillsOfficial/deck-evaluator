"use client";

import { useState } from "react";
import type { RankedHand } from "@/lib/opening-hand";
import ManaCost from "@/components/ManaCost";

const VERDICT_COLORS: Record<string, string> = {
  "Strong Keep": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Keepable: "bg-green-500/20 text-green-300 border-green-500/30",
  Marginal: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Mulligan: "bg-red-500/20 text-red-300 border-red-500/30",
};

interface TopHandsProps {
  hands: RankedHand[];
  loading: boolean;
}

export default function TopHands({ hands, loading }: TopHandsProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section data-testid="top-hands" aria-label="Top 5 best hands">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-controls="top-hands-content"
        className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left transition-colors hover:bg-slate-800"
      >
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Top 5 Best Hands
          </h4>
          <p className="text-xs text-slate-400">
            Highest-scoring hands from simulation
          </p>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div id="top-hands-content" className="mt-3 space-y-3">
          {loading ? (
            // Shimmer placeholders
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-slate-700" />
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-700" />
                </div>
                <div className="mt-3 flex gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-[68px] w-[49px] animate-pulse rounded bg-slate-700"
                    />
                  ))}
                </div>
              </div>
            ))
          ) : hands.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hands found from simulation.
            </p>
          ) : (
            hands.map((ranked) => (
              <TopHandEntry key={ranked.cardKey} ranked={ranked} />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function TopHandEntry({ ranked }: { ranked: RankedHand }) {
  const { rank, hand } = ranked;
  const { cards, quality } = hand;
  const verdictStyle = VERDICT_COLORS[quality.verdict] ?? "";

  return (
    <div
      data-testid={`top-hand-${rank}`}
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
    >
      {/* Header: rank + verdict */}
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
          {rank}
        </span>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${verdictStyle}`}
        >
          {quality.verdict}
        </span>
        <span className="text-xs text-slate-400">Score: {quality.score}</span>
      </div>

      {/* Card thumbnails */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {cards.map((card, idx) => (
          <div key={`${card.name}-${idx}`} className="flex-shrink-0">
            {card.enriched.imageUris?.normal ? (
              <img
                src={card.enriched.imageUris.normal}
                alt={card.name}
                width={73}
                height={102}
                className="rounded border border-slate-600"
              />
            ) : (
              <div
                role="img"
                aria-label={card.name}
                className="flex items-center justify-center rounded border border-slate-600 bg-slate-700/50 text-center"
                style={{ width: 73, height: 102 }}
              >
                <div className="px-1">
                  <p className="text-[8px] font-medium leading-tight text-slate-200">
                    {card.name}
                  </p>
                  <div className="mt-0.5 flex justify-center">
                    <ManaCost cost={card.enriched.manaCost} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reasoning */}
      {quality.reasoning.length > 0 && (
        <ul className="space-y-0.5">
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
