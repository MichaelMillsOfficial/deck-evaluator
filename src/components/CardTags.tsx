"use client";

import type { EnrichedCard } from "@/lib/types";
import { generateTags, TAG_COLORS } from "@/lib/card-tags";

export default function CardTags({ card }: { card: EnrichedCard }) {
  const tags = generateTags(card);

  if (tags.length === 0) return null;

  return (
    <span
      className="flex flex-wrap gap-1"
      aria-label={`Tags: ${tags.join(", ")}`}
    >
      {tags.map((tag) => {
        const colors = TAG_COLORS[tag] ?? {
          bg: "bg-slate-500/20",
          text: "text-slate-300",
        };
        return (
          <span
            key={tag}
            data-testid="card-tag"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {tag}
          </span>
        );
      })}
    </span>
  );
}
