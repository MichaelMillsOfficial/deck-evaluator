"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import { analyzeDeckSynergy } from "@/lib/synergy-engine";
import DeckList from "@/components/DeckList";
import DeckAnalysis from "@/components/DeckAnalysis";
import SynergySection from "@/components/SynergySection";
import HandSimulator from "@/components/HandSimulator";

interface DeckViewTabsProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
}

type ViewTab = "list" | "analysis" | "synergy" | "hands";

const tabs: { key: ViewTab; label: string }[] = [
  { key: "list", label: "Deck List" },
  { key: "analysis", label: "Analysis" },
  { key: "synergy", label: "Synergy" },
  { key: "hands", label: "Hands" },
];

export default function DeckViewTabs({
  deck,
  cardMap,
  enrichLoading,
}: DeckViewTabsProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("list");

  // Expanded section state persists across tab switches
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({
    analysis: new Set<string>(),
    synergy: new Set<string>(),
    hands: new Set<string>(),
  });

  const analysisDisabled = !cardMap || enrichLoading;

  const synergyAnalysis = useMemo(
    () => (cardMap ? analyzeDeckSynergy(deck, cardMap) : null),
    [deck, cardMap]
  );

  const handleToggleSection = useCallback(
    (tab: string, sectionId: string) => {
      setExpandedSections((prev) => {
        const current = prev[tab] ?? new Set<string>();
        const next = new Set(current);
        if (next.has(sectionId)) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        return { ...prev, [tab]: next };
      });
    },
    []
  );

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

    // Skip disabled tabs (analysis, synergy, and hands need cardMap)
    const targetTab = tabs[newIndex];
    if (
      (targetTab.key === "analysis" || targetTab.key === "synergy" || targetTab.key === "hands") &&
      analysisDisabled
    )
      return;

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
          const isDisabled =
            (tab.key === "analysis" || tab.key === "synergy" || tab.key === "hands") &&
            analysisDisabled;
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
          <DeckAnalysis
            deck={deck}
            cardMap={cardMap}
            expandedSections={expandedSections.analysis}
            onToggleSection={(id) => handleToggleSection("analysis", id)}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-synergy"
        aria-labelledby="tab-deck-synergy"
        hidden={activeTab !== "synergy"}
      >
        {activeTab === "synergy" && cardMap && synergyAnalysis && (
          <section aria-labelledby="synergy-heading">
            <h3
              id="synergy-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Card Synergy
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Synergy analysis, known combos, and anti-synergy warnings
            </p>
            <SynergySection
              analysis={synergyAnalysis}
              cardMap={cardMap}
              expandedSections={expandedSections.synergy}
              onToggleSection={(id) => handleToggleSection("synergy", id)}
            />
          </section>
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-hands"
        aria-labelledby="tab-deck-hands"
        hidden={activeTab !== "hands"}
      >
        {activeTab === "hands" && cardMap && !enrichLoading && (
          <section aria-labelledby="hands-heading">
            <h3
              id="hands-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Opening Hand Simulator
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Draw sample opening hands, evaluate quality, and view aggregate
              statistics
            </p>
            <HandSimulator deck={deck} cardMap={cardMap} />
          </section>
        )}
      </div>
    </div>
  );
}
