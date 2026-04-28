"use client";

import { useCallback, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import SectionHeader from "@/components/reading/SectionHeader";
import SynergySection from "@/components/SynergySection";

export default function SynergyPage() {
  const { payload, analysisResults, spellbookLoading } = useDeckSession();
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

  if (!payload?.cardMap || !analysisResults?.synergyAnalysis) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-synergy"
      aria-labelledby="tab-deck-synergy"
    >
      <SectionHeader
        slug="synergy"
        eyebrow="Synergies"
        title="How the Cards Read Together"
        tagline="Top synergies, anti-synergies, and verified combos drawn from oracle text and Commander Spellbook."
      />
      <h2 id="synergy-heading" className="sr-only">
        Card Synergy
      </h2>
      <SynergySection
        deck={payload.deck}
        analysis={analysisResults.synergyAnalysis}
        cardMap={payload.cardMap}
        expandedSections={expandedSections}
        onToggleSection={toggle}
        spellbookCombos={payload.spellbookCombos}
        spellbookLoading={spellbookLoading}
      />
    </section>
  );
}
