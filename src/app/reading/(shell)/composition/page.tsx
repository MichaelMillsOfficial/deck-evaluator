"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import DeckAnalysis from "@/components/DeckAnalysis";

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Healthy",
  "needs-attention": "Watch",
  "major-gaps": "Gaps",
};

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

  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!analysisResults) return undefined;
    const { compositionScorecard, manaBaseMetrics } = analysisResults;
    if (compositionScorecard.categories.length === 0) return undefined;
    const healthLabel =
      HEALTH_LABEL[compositionScorecard.overallHealth] ?? "—";
    const rampCategory = compositionScorecard.categories.find(
      (c) => c.tag === "Ramp"
    );
    const drawCategory = compositionScorecard.categories.find(
      (c) => c.tag === "Card Draw"
    );
    return [
      { label: "Health", value: healthLabel, sub: "scorecard", accent: true },
      {
        label: "Lands",
        value: String(manaBaseMetrics.landCount),
        sub: `${manaBaseMetrics.landPercentage.toFixed(0)}% of deck`,
      },
      {
        label: "Ramp",
        value: rampCategory ? String(rampCategory.count) : "—",
        sub: drawCategory ? `${drawCategory.count} draw` : "ramp pieces",
      },
    ];
  }, [analysisResults]);

  if (!payload?.cardMap) return null;

  return (
    <div role="tabpanel" id="tabpanel-deck-analysis" aria-labelledby="tab-deck-analysis">
      <SectionHeader
        slug="composition"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Composition"
        title="The Shape of the Deck"
        tagline="Mana curve, color distribution, land base efficiency, draw odds, and budget — the structure underneath every game."
        stats={stats}
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
