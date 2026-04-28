"use client";

import { useMemo } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import {
  AVAILABLE_TEMPLATES,
  computeCompositionScorecard,
} from "@/lib/deck-composition";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import SuggestionsPanel from "@/components/SuggestionsPanel";

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Healthy",
  "needs-attention": "Watch",
  "major-gaps": "Gaps",
};

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

  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!scorecard) return undefined;
    const lowCount = scorecard.categories.filter(
      (c) => c.status === "low" || c.status === "critical"
    ).length;
    const highCount = scorecard.categories.filter(
      (c) => c.status === "high"
    ).length;
    return [
      {
        label: "Health",
        value: HEALTH_LABEL[scorecard.overallHealth] ?? "—",
        sub: scorecard.templateName,
        accent: true,
      },
      {
        label: "Gaps",
        value: String(lowCount),
        sub: lowCount === 1 ? "category short" : "categories short",
      },
      {
        label: "Surplus",
        value: String(highCount),
        sub: highCount === 1 ? "category over" : "categories over",
      },
    ];
  }, [scorecard]);

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
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Recommendations"
        title="What to Cut, What to Add"
        tagline="Heuristic suggestions tuned to the deck's archetype, composition, and missing role coverage."
        stats={stats}
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
