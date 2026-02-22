"use client";

import { useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import DeckList from "@/components/DeckList";
import DeckAnalysis from "@/components/DeckAnalysis";

interface DeckViewTabsProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
}

type ViewTab = "list" | "analysis";

const tabs: { key: ViewTab; label: string }[] = [
  { key: "list", label: "Deck List" },
  { key: "analysis", label: "Analysis" },
];

export default function DeckViewTabs({
  deck,
  cardMap,
  enrichLoading,
}: DeckViewTabsProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("list");

  const analysisDisabled = !cardMap || enrichLoading;

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabKeys = tabs.map((t) => t.key);
    const currentIndex = tabKeys.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === "ArrowRight") {
      newIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();

    // Skip disabled tabs
    const targetTab = tabs[newIndex];
    if (targetTab.key === "analysis" && analysisDisabled) return;

    setActiveTab(tabKeys[newIndex]);
    const nextButton = document.getElementById(
      `tab-deck-${tabKeys[newIndex]}`
    );
    nextButton?.focus();
  };

  return (
    <div data-testid="deck-view-tabs">
      <div
        role="tablist"
        aria-label="Deck view"
        className="mb-4 flex rounded-lg bg-slate-900 p-1"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isDisabled = tab.key === "analysis" && analysisDisabled;
          return (
            <button
              key={tab.key}
              id={`tab-deck-${tab.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-deck-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => !isDisabled && setActiveTab(tab.key)}
              onKeyDown={handleTabKeyDown}
              disabled={isDisabled}
              className={`flex-1 min-h-[44px] rounded-md px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-list"
        aria-labelledby="tab-deck-list"
        hidden={activeTab !== "list"}
      >
        {activeTab === "list" && (
          <DeckList
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-analysis"
        aria-labelledby="tab-deck-analysis"
        hidden={activeTab !== "analysis"}
      >
        {activeTab === "analysis" && cardMap && !enrichLoading && (
          <DeckAnalysis deck={deck} cardMap={cardMap} />
        )}
      </div>
    </div>
  );
}
