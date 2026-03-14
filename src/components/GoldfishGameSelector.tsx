"use client";

import type { NotableGame } from "@/lib/goldfish-simulator";

export type GameSelection =
  | { type: "notable"; index: number }
  | { type: "random" }
  | { type: "new" };

interface GoldfishGameSelectorProps {
  notableGames: NotableGame[];
  activeSelection: GameSelection;
  onSelect: (selection: GameSelection) => void;
}

export default function GoldfishGameSelector({
  notableGames,
  activeSelection,
  onSelect,
}: GoldfishGameSelectorProps) {
  return (
    <div data-testid="goldfish-game-selector" className="space-y-3">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        Game Viewer
      </h4>

      <div className="flex flex-wrap gap-2">
        {/* Notable game buttons */}
        {notableGames.map((notable, i) => {
          const isActive =
            activeSelection.type === "notable" && activeSelection.index === i;
          return (
            <button
              key={notable.label}
              type="button"
              onClick={() => onSelect({ type: "notable", index: i })}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-purple-500/50 bg-purple-600/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              }`}
              data-testid={`notable-game-${notable.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <p className="text-sm font-semibold text-slate-200">{notable.label}</p>
              <p className="text-xs text-slate-500">{notable.description}</p>
            </button>
          );
        })}

        {/* Random Game */}
        <button
          type="button"
          onClick={() => onSelect({ type: "random" })}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            activeSelection.type === "random"
              ? "border-purple-500/50 bg-purple-600/10"
              : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          }`}
          data-testid="random-game-button"
        >
          <p className="text-sm font-semibold text-slate-200">Random Game</p>
          <p className="text-xs text-slate-500">Pick a random simulation</p>
        </button>

        {/* New Game */}
        <button
          type="button"
          onClick={() => onSelect({ type: "new" })}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            activeSelection.type === "new"
              ? "border-purple-500/50 bg-purple-600/10"
              : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
          }`}
          data-testid="new-game-button"
        >
          <p className="text-sm font-semibold text-slate-200">New Game</p>
          <p className="text-xs text-slate-500">Generate a fresh game</p>
        </button>
      </div>
    </div>
  );
}
