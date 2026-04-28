"use client";

import { useCallback, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import SectionHeader from "@/components/reading/SectionHeader";
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

  if (!payload?.cardMap) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-hands"
      aria-labelledby="tab-deck-hands"
    >
      <SectionHeader
        slug="hands"
        eyebrow="Opening Hands"
        title="The First Seven"
        tagline="Draw sample opening hands, evaluate keepability, and tune your mulligan instincts."
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
