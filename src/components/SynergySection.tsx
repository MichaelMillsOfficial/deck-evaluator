"use client";

import type { DeckSynergyAnalysis, EnrichedCard } from "@/lib/types";
import DeckThemes from "@/components/DeckThemes";
import SynergyStats from "@/components/SynergyStats";
import SynergyPairList from "@/components/SynergyPairList";
import CardSynergyTable from "@/components/CardSynergyTable";

interface SynergySectionProps {
  analysis: DeckSynergyAnalysis;
  cardMap: Record<string, EnrichedCard>;
}

export default function SynergySection({ analysis, cardMap }: SynergySectionProps) {
  // Separate combos from heuristic synergies for display
  const heuristicSynergies = analysis.topSynergies.filter(
    (p) => p.type !== "combo"
  );
  const combos = analysis.topSynergies.filter((p) => p.type === "combo");

  return (
    <>
      <DeckThemes themes={analysis.deckThemes} />
      <SynergyStats analysis={analysis} />

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

      {/* Ensure synergy-pairs testId exists even if only heuristic synergies */}
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

      <CardSynergyTable cardScores={analysis.cardScores} />
    </>
  );
}
