"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import HandSimulator from "@/components/HandSimulator";

export default function HandsPage() {
  const { payload, analysisResults } = useDeckSession();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const toggle = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo<SectionStat[] | undefined>(() => {
    const sim = analysisResults?.simulationStats;
    if (!sim) return undefined;
    return [
      {
        label: "Keepable",
        value: `${Math.round(sim.keepableRate * 100)}%`,
        sub: `${sim.totalSimulations} hands`,
        accent: true,
      },
      {
        label: "Avg Lands",
        value: sim.avgLandsInOpener.toFixed(1),
        sub: "in opener",
      },
      {
        label: "T2 Play",
        value: `${Math.round(sim.probT2Play * 100)}%`,
        sub: "spell on curve",
      },
    ];
  }, [analysisResults]);

  if (!payload?.cardMap) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-hands"
      aria-labelledby="tab-deck-hands"
    >
      <SectionHeader
        slug="hands"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Opening Hands"
        title="The First Seven"
        tagline="Draw sample opening hands, evaluate keepability, and tune your mulligan instincts."
        stats={stats}
      />
      <h2 id="hands-heading" className="sr-only">
        Opening Hand Simulator
      </h2>
      <HandSimulator
        deck={payload.deck}
        cardMap={payload.cardMap}
        deckThemes={analysisResults?.synergyAnalysis.deckThemes ?? []}
        expandedSections={expandedSections}
        onToggleSection={toggle}
      />
    </section>
  );
}
