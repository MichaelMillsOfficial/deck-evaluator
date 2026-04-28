"use client";

import { useCallback, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import SectionHeader from "@/components/reading/SectionHeader";
import DeckAnalysis from "@/components/DeckAnalysis";

export default function CompositionPage() {
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
    <div role="tabpanel" id="tabpanel-deck-analysis" aria-labelledby="tab-deck-analysis">
      <SectionHeader
        slug="composition"
        eyebrow="Composition"
        title="The Shape of the Deck"
        tagline="Mana curve, color distribution, land base efficiency, draw odds, and budget."
      />
      <DeckAnalysis
        deck={payload.deck}
        cardMap={payload.cardMap}
        expandedSections={expandedSections}
        onToggleSection={toggle}
        spellbookCombos={payload.spellbookCombos}
        analysisResults={analysisResults ?? undefined}
      />
    </div>
  );
}
