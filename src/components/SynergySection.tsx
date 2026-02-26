"use client";

import { useCallback } from "react";
import type { DeckSynergyAnalysis, EnrichedCard } from "@/lib/types";
import DeckThemes from "@/components/DeckThemes";
import SynergyStats from "@/components/SynergyStats";
import SynergyPairList from "@/components/SynergyPairList";
import CardSynergyTable from "@/components/CardSynergyTable";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SectionNav from "@/components/SectionNav";

const SYNERGY_SECTIONS = [
  { id: "themes", label: "Themes" },
  { id: "synergy-stats", label: "Stats" },
  { id: "synergy-pairs", label: "Synergies" },
  { id: "anti-synergies", label: "Anti-Synergies" },
  { id: "card-scores", label: "Card Scores" },
] as const;

interface SynergySectionProps {
  analysis: DeckSynergyAnalysis;
  cardMap: Record<string, EnrichedCard>;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
}

export default function SynergySection({
  analysis,
  cardMap,
  expandedSections,
  onToggleSection,
}: SynergySectionProps) {
  // Separate combos from heuristic synergies for display
  const heuristicSynergies = analysis.topSynergies.filter(
    (p) => p.type !== "combo"
  );
  const combos = analysis.topSynergies.filter((p) => p.type === "combo");

  const handleSelectSection = useCallback(
    (id: string) => {
      if (!expandedSections.has(id)) {
        onToggleSection(id);
      }
    },
    [expandedSections, onToggleSection]
  );

  return (
    <div className="space-y-3">
      <SectionNav
        sections={SYNERGY_SECTIONS}
        expandedSections={expandedSections}
        onSelectSection={handleSelectSection}
      />

      <CollapsiblePanel
        id="themes"
        title="Deck Themes"
        expanded={expandedSections.has("themes")}
        onToggle={() => onToggleSection("themes")}
      >
        <DeckThemes themes={analysis.deckThemes} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="synergy-stats"
        title="Synergy Stats"
        expanded={expandedSections.has("synergy-stats")}
        onToggle={() => onToggleSection("synergy-stats")}
      >
        <SynergyStats analysis={analysis} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="synergy-pairs"
        title="Synergies & Combos"
        expanded={expandedSections.has("synergy-pairs")}
        onToggle={() => onToggleSection("synergy-pairs")}
      >
        {combos.length > 0 && (
          <SynergyPairList
            pairs={combos}
            variant="synergy"
            title="Known Combos"
            testId="synergy-pairs"
            cardMap={cardMap}
          />
        )}

        {heuristicSynergies.length > 0 && (
          <SynergyPairList
            pairs={heuristicSynergies}
            variant="synergy"
            title={combos.length > 0 ? "Top Synergies" : "Known Combos & Synergies"}
            testId={combos.length > 0 ? "heuristic-synergies" : "synergy-pairs"}
            cardMap={cardMap}
          />
        )}

        {combos.length === 0 && heuristicSynergies.length === 0 && (
          <div data-testid="synergy-pairs" className="mb-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Top Synergies
            </h4>
            <p className="text-xs text-slate-500">
              No significant synergy pairs detected.
            </p>
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        id="anti-synergies"
        title="Anti-Synergy Warnings"
        expanded={expandedSections.has("anti-synergies")}
        onToggle={() => onToggleSection("anti-synergies")}
      >
        <SynergyPairList
          pairs={analysis.antiSynergies}
          variant="anti-synergy"
          title="Anti-Synergy Warnings"
          testId="anti-synergy-pairs"
          cardMap={cardMap}
        />

        {analysis.antiSynergies.length === 0 && (
          <div data-testid="anti-synergy-pairs" className="mb-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Anti-Synergy Warnings
            </h4>
            <p className="text-xs text-slate-500">
              No anti-synergies detected.
            </p>
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        id="card-scores"
        title="Card Synergy Scores"
        expanded={expandedSections.has("card-scores")}
        onToggle={() => onToggleSection("card-scores")}
      >
        <CardSynergyTable cardScores={analysis.cardScores} />
      </CollapsiblePanel>
    </div>
  );
}
