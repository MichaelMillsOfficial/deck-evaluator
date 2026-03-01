"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "@/lib/deck-analysis-aggregate";
import type { ViewTab } from "@/components/DeckHeader";
import DeckList from "@/components/DeckList";
import DeckAnalysis from "@/components/DeckAnalysis";
import SynergySection from "@/components/SynergySection";
import HandSimulator from "@/components/HandSimulator";

interface DeckViewTabsProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  spellbookCombos: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
  spellbookLoading: boolean;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  analysisResults: DeckAnalysisResults | null;
}

export default function DeckViewTabs({
  deck,
  cardMap,
  enrichLoading,
  spellbookCombos,
  spellbookLoading,
  activeTab,
  analysisResults,
}: DeckViewTabsProps) {
  // Expanded section state persists across tab switches
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({
    analysis: new Set<string>(),
    synergy: new Set<string>(),
    hands: new Set<string>(),
  });

  const synergyAnalysis = analysisResults?.synergyAnalysis ?? null;

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

  return (
    <div data-testid="deck-view-tabs">
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
            spellbookCombos={spellbookCombos}
            analysisResults={analysisResults ?? undefined}
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
              deck={deck}
              analysis={synergyAnalysis}
              cardMap={cardMap}
              expandedSections={expandedSections.synergy}
              onToggleSection={(id) => handleToggleSection("synergy", id)}
              spellbookCombos={spellbookCombos}
              spellbookLoading={spellbookLoading}
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
            <HandSimulator
              deck={deck}
              cardMap={cardMap}
              deckThemes={synergyAnalysis?.deckThemes ?? []}
              expandedSections={expandedSections.hands ?? new Set<string>()}
              onToggleSection={(id) => handleToggleSection("hands", id)}
            />
          </section>
        )}
      </div>
    </div>
  );
}
