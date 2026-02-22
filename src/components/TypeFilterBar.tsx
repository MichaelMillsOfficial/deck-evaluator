"use client";

import { CARD_TYPES, type CardType } from "@/lib/mana-curve";

interface TypeFilterBarProps {
  enabledTypes: Set<CardType>;
  onToggle: (type: CardType) => void;
  typeCounts: Record<CardType, number>;
}

export default function TypeFilterBar({
  enabledTypes,
  onToggle,
  typeCounts,
}: TypeFilterBarProps) {
  return (
    <div
      role="group"
      aria-label="Card type filters"
      className="flex flex-wrap gap-2"
    >
      {CARD_TYPES.map((type) => {
        const active = enabledTypes.has(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(type)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-purple-500 bg-purple-600/20 text-purple-300"
                : "border-slate-600 bg-slate-700/50 text-slate-500 line-through"
            }`}
          >
            {type} ({typeCounts[type]})
          </button>
        );
      })}
    </div>
  );
}
