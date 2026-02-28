"use client";

import { useMemo } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import { computeCreatureTypeBreakdown } from "@/lib/creature-types";

interface CreatureTypeBreakdownProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

export default function CreatureTypeBreakdown({
  deck,
  cardMap,
}: CreatureTypeBreakdownProps) {
  const allCardNames = useMemo(() => {
    const names: string[] = [];
    for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
      for (const card of section) {
        names.push(card.name);
      }
    }
    return names;
  }, [deck]);

  const sortedTypes = useMemo(() => {
    const breakdown = computeCreatureTypeBreakdown(allCardNames, cardMap);
    return Array.from(breakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [allCardNames, cardMap]);

  if (sortedTypes.length === 0) return null;

  const maxCount = sortedTypes[0][1];

  return (
    <div data-testid="creature-type-breakdown">
      <p className="mb-3 text-xs text-slate-400">
        Creature type frequency across the deck
      </p>
      <div className="space-y-1.5">
        {sortedTypes.map(([type, count]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-right text-xs text-slate-300">
              {type}
            </span>
            <div className="relative h-5 flex-1 rounded bg-slate-700">
              <div
                className="absolute inset-y-0 left-0 rounded bg-teal-500/60"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
              <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-white">
                {count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
