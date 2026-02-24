"use client";

import type { DeckTheme } from "@/lib/types";
import { getAxisById } from "@/lib/synergy-axes";

interface DeckThemesProps {
  themes: DeckTheme[];
}

export default function DeckThemes({ themes }: DeckThemesProps) {
  if (themes.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2" data-testid="deck-themes">
      {themes.map((theme) => {
        const axis = getAxisById(theme.axisId);
        const bg = axis?.color.bg ?? "bg-slate-500/20";
        const text = axis?.color.text ?? "text-slate-300";
        return (
          <span
            key={theme.axisId}
            data-testid={`theme-pill-${theme.axisId}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${bg} ${text}`}
          >
            {theme.axisName}
            <span className="text-[10px] opacity-70">
              ({theme.cardCount})
            </span>
          </span>
        );
      })}
    </div>
  );
}
