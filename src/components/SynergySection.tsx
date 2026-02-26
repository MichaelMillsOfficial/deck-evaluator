"use client";

import { useCallback, useMemo } from "react";
import type { DeckSynergyAnalysis, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import DeckThemes from "@/components/DeckThemes";
import SynergyStats from "@/components/SynergyStats";
import SynergyPairList from "@/components/SynergyPairList";
import CardSynergyTable from "@/components/CardSynergyTable";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SectionNav from "@/components/SectionNav";
import VerifiedCombos, { NearCombos } from "@/components/VerifiedCombos";

interface SynergySectionProps {
  analysis: DeckSynergyAnalysis;
  cardMap: Record<string, EnrichedCard>;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  spellbookCombos: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
  spellbookLoading: boolean;
}

export default function SynergySection({
  analysis,
  cardMap,
  expandedSections,
  onToggleSection,
  spellbookCombos,
  spellbookLoading,
}: SynergySectionProps) {
  // Separate combos from heuristic synergies for display
  const heuristicSynergies = analysis.topSynergies.filter(
    (p) => p.type !== "combo"
  );
  const combos = analysis.topSynergies.filter((p) => p.type === "combo");

  // Determine if spellbook has exact combos to adjust local combo label
  const hasSpellbookExact =
    spellbookCombos !== null && spellbookCombos.exactCombos.length > 0;
  const hasNearCombos =
    spellbookCombos !== null && spellbookCombos.nearCombos.length > 0;

  // Build dynamic sections array: include verified/near combos panels
  const synergySections = useMemo(() => {
    const sections: { id: string; label: string }[] = [
      { id: "themes", label: "Themes" },
      { id: "synergy-stats", label: "Stats" },
      { id: "verified-combos", label: "Verified Combos" },
    ];
    if (hasNearCombos || spellbookLoading) {
      sections.push({ id: "near-combos", label: "Near Combos" });
    }
    sections.push(
      { id: "synergy-pairs", label: "Synergies" },
      { id: "anti-synergies", label: "Anti-Synergies" },
      { id: "card-scores", label: "Card Scores" },
    );
    return sections;
  }, [hasNearCombos, spellbookLoading]);

  const handleSelectSection = useCallback(
    (id: string) => {
      onToggleSection(id);
    },
    [onToggleSection]
  );

  // Determine local combos section title
  const localCombosTitle = hasSpellbookExact ? "Local Combos" : "Known Combos";

  return (
    <div className="space-y-3">
      <SectionNav
        sections={synergySections}
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
        <SynergyStats
          analysis={analysis}
          spellbookComboCount={spellbookCombos?.exactCombos.length ?? null}
          spellbookNearComboCount={spellbookCombos?.nearCombos.length ?? null}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="verified-combos"
        title="Verified Combos"
        summary={
          spellbookCombos && !spellbookLoading
            ? `${spellbookCombos.exactCombos.length} found`
            : undefined
        }
        expanded={expandedSections.has("verified-combos")}
        onToggle={() => onToggleSection("verified-combos")}
      >
        <VerifiedCombos
          exactCombos={spellbookCombos?.exactCombos ?? []}
          nearCombos={spellbookCombos?.nearCombos ?? []}
          loading={spellbookLoading}
          cardMap={cardMap}
        />
      </CollapsiblePanel>

      {(hasNearCombos || spellbookLoading) && (
        <CollapsiblePanel
          id="near-combos"
          title="Near Combos"
          summary={
            spellbookCombos && !spellbookLoading
              ? `${spellbookCombos.nearCombos.length} found`
              : undefined
          }
          expanded={expandedSections.has("near-combos")}
          onToggle={() => onToggleSection("near-combos")}
        >
          <NearCombos
            nearCombos={spellbookCombos?.nearCombos ?? []}
            loading={spellbookLoading}
            cardMap={cardMap}
          />
        </CollapsiblePanel>
      )}

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
            title={localCombosTitle}
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
