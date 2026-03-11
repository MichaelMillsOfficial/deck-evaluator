"use client";

import SuggestionCard from "@/components/SuggestionCard";
import type { UpgradeSuggestion } from "@/lib/card-suggestions";

interface UpgradeListProps {
  upgrades: UpgradeSuggestion[];
}

export default function UpgradeList({ upgrades }: UpgradeListProps) {
  if (upgrades.length === 0) {
    return (
      <div
        data-testid="suggestions-upgrades-empty"
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400"
      >
        No upgrade suggestions available
      </div>
    );
  }

  return (
    <div data-testid="suggestions-upgrades" className="flex flex-col gap-5">
      {upgrades.map((upgrade) => (
        <div key={upgrade.existingCard} data-testid="suggestions-upgrade-item">
          {/* Existing card header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">
              {upgrade.existingCard}
            </span>
            <span className="text-xs text-slate-500">
              (CMC {upgrade.existingCmc})
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-3.5 w-3.5 shrink-0 text-purple-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L18 9m0 0l-4.5 4.5M18 9H2"
              />
            </svg>
            <span className="text-xs text-slate-400">Better Alternatives</span>
          </div>

          {/* Upgrade suggestions grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upgrade.upgrades.map((suggestion) => (
              <SuggestionCard key={suggestion.cardName} suggestion={suggestion} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
