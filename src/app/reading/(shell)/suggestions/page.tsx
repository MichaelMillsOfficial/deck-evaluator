"use client";

import { useMemo } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import {
  AVAILABLE_TEMPLATES,
  computeCompositionScorecard,
} from "@/lib/deck-composition";
import SectionHeader from "@/components/reading/SectionHeader";
import SuggestionsPanel from "@/components/SuggestionsPanel";

export default function SuggestionsPage() {
  const { payload, analysisResults } = useDeckSession();

  const scorecard = useMemo(() => {
    if (!payload?.cardMap) return null;
    return computeCompositionScorecard(
      payload.deck,
      payload.cardMap,
      AVAILABLE_TEMPLATES[0]
    );
  }, [payload]);

  if (
    !payload?.cardMap ||
    !analysisResults?.synergyAnalysis ||
    !scorecard
  ) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-suggestions"
      aria-labelledby="tab-deck-suggestions"
    >
      <SectionHeader
        slug="suggestions"
        eyebrow="Recommendations"
        title="What to Cut, What to Add"
        tagline="Heuristic suggestions tuned to the deck's archetype, composition, and missing role coverage."
      />
      <SuggestionsPanel
        deck={payload.deck}
        cardMap={payload.cardMap}
        synergyAnalysis={analysisResults.synergyAnalysis}
        scorecard={scorecard}
      />
    </div>
  );
}
