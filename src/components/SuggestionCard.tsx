"use client";

import ManaCost from "@/components/ManaCost";
import type { CardSuggestion } from "@/lib/card-suggestions";

interface SuggestionCardProps {
  suggestion: CardSuggestion;
}

export default function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <div
      data-testid="suggestions-card"
      className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-3"
    >
      {/* Card name linked to Scryfall */}
      <a
        href={suggestion.scryfallUri}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-purple-300 hover:text-purple-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm truncate"
      >
        {suggestion.cardName}
        <span className="sr-only"> (opens in new tab)</span>
      </a>

      {/* Mana cost and type line */}
      <div className="flex items-center gap-2 flex-wrap">
        {suggestion.manaCost && (
          <ManaCost cost={suggestion.manaCost} />
        )}
        <span className="text-xs text-slate-400 truncate">
          {suggestion.typeLine}
        </span>
      </div>

      {/* Reason */}
      <p className="text-xs text-slate-400 leading-relaxed">
        {suggestion.reason}
      </p>
    </div>
  );
}
