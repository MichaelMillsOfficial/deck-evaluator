"use client";

import { useState } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SuggestionCard from "@/components/SuggestionCard";
import type { CategoryFillRecommendation } from "@/lib/card-suggestions";

const STATUS_BADGE: Record<
  "low" | "critical",
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-500/20 text-red-300 border border-red-500/30",
  },
  low: {
    label: "Low",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  },
};

const TAG_TOOLTIPS: Record<string, string> = {
  Ramp: "Mana acceleration — helps you play cards ahead of schedule",
  "Card Draw": "Drawing extra cards — keeps your hand full of options",
  Removal: "Dealing with opponents' threats — destroy or exile their permanents",
  "Board Wipe": "Clearing the battlefield — removes many creatures at once",
  Counterspell: "Stopping spells — prevents opponents' key plays",
  Tutor: "Library search — finds exactly the card you need",
  "Cost Reduction": "Making spells cheaper — lets you do more each turn",
  Protection: "Keeping your key pieces safe from removal",
  Recursion: "Getting cards back from the graveyard",
  "Token Generator": "Creating creature tokens for value or defense",
  "Sacrifice Outlet": "A way to sacrifice your own creatures for value",
};

interface CategoryFillListProps {
  categoryFills: CategoryFillRecommendation[];
}

export default function CategoryFillList({
  categoryFills,
}: CategoryFillListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(categoryFills.map((c) => c.tag))
  );

  if (categoryFills.length === 0) {
    return (
      <div
        data-testid="suggestions-category-fills-empty"
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-green-400"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        All functional categories are on target
      </div>
    );
  }

  const toggle = (tag: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div
      data-testid="suggestions-category-fills"
      className="flex flex-col gap-3"
    >
      {categoryFills.map((fill) => {
        const badge = STATUS_BADGE[fill.status];
        const tooltip = TAG_TOOLTIPS[fill.tag] ?? `Cards that fulfill the ${fill.tag} role`;

        const summary = (
          <span className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
              title={tooltip}
            >
              {badge.label}
            </span>
            <span className="text-slate-400">
              {fill.currentCount}/{fill.targetMin} needed
            </span>
          </span>
        );

        return (
          <CollapsiblePanel
            key={fill.tag}
            id={`category-fill-${fill.tag.toLowerCase().replace(/\s+/g, "-")}`}
            title={fill.label}
            summary={summary}
            expanded={expanded.has(fill.tag)}
            onToggle={() => toggle(fill.tag)}
            testId={`suggestions-fill-${fill.tag.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {fill.suggestions.length === 0 ? (
              <p
                data-testid="suggestions-no-results"
                className="text-xs text-slate-400"
              >
                No suggestions found for this category.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fill.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.cardName}
                    suggestion={suggestion}
                  />
                ))}
              </div>
            )}
          </CollapsiblePanel>
        );
      })}
    </div>
  );
}
