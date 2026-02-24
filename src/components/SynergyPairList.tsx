"use client";

import { useState } from "react";
import type { SynergyPair, EnrichedCard } from "@/lib/types";

interface SynergyPairListProps {
  pairs: SynergyPair[];
  variant: "synergy" | "anti-synergy";
  title: string;
  testId: string;
  cardMap: Record<string, EnrichedCard>;
}

function strengthLabel(strength: number): string {
  if (strength >= 0.8) return "Strong";
  if (strength >= 0.5) return "Moderate";
  return "Weak";
}

function PairItem({
  pair,
  index,
  variant,
  cardMap,
}: {
  pair: SynergyPair;
  index: number;
  variant: "synergy" | "anti-synergy";
  cardMap: Record<string, EnrichedCard>;
}) {
  const [expanded, setExpanded] = useState(false);

  const accentBorder =
    variant === "synergy" ? "border-purple-500/30" : "border-amber-500/30";
  const accentBg =
    variant === "synergy" ? "bg-purple-500/10" : "bg-amber-500/10";
  const accentText =
    variant === "synergy" ? "text-purple-300" : "text-amber-300";
  const badgeBg =
    variant === "synergy" ? "bg-purple-500/20" : "bg-amber-500/20";

  const detailId = `pair-detail-${variant}-${index}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  }

  return (
    <li
      data-testid={`pair-item-${index}`}
      className={`rounded-lg border ${accentBorder} ${accentBg}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${accentText}`}>
            {pair.cards.join(" + ")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{pair.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeBg} ${accentText}`}
          >
            {pair.type === "combo" ? "Combo" : strengthLabel(pair.strength)}
          </span>
          <svg
            aria-hidden="true"
            className={`h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>
      {expanded && (
        <div
          id={detailId}
          data-testid="pair-card-images"
          className="border-t border-slate-700/50 px-3 py-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            {pair.cards.map((cardName) => {
              const enriched = cardMap[cardName];
              const imageUrl = enriched?.imageUris?.normal;
              return (
                <div key={cardName} className="flex-1">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={cardName}
                      className="w-full rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-8">
                      <p className="text-sm text-slate-400">{cardName}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}

export default function SynergyPairList({
  pairs,
  variant,
  title,
  testId,
  cardMap,
}: SynergyPairListProps) {
  if (pairs.length === 0) return null;

  return (
    <div className="mb-4" data-testid={testId}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      <ul className="space-y-2">
        {pairs.map((pair, i) => (
          <PairItem
            key={`${pair.cards.join("-")}-${i}`}
            pair={pair}
            index={i}
            variant={variant}
            cardMap={cardMap}
          />
        ))}
      </ul>
    </div>
  );
}
