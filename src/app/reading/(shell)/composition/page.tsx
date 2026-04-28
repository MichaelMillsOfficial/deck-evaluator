"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import DeckAnalysis from "@/components/DeckAnalysis";

type ColorKey = "W" | "U" | "B" | "R" | "G";
const COLOR_ORDER: ColorKey[] = ["W", "U", "B", "R", "G"];

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
    const {
      bracketResult,
      powerLevel,
      landEfficiency,
      colorDistribution,
      manaCurve,
    } = analysisResults;

    // Color identity — letters present in the pip count, in WUBRG order.
    const presentColors = COLOR_ORDER.filter(
      (c) => colorDistribution.pips[c] > 0
    );
    const colorLabel = presentColors.length
      ? presentColors.join(" · ")
      : "Colorless";

    // Curve peak — bucket with the highest combined permanent + spell count.
    let peakBucket = manaCurve[0];
    let peakCount = 0;
    for (const bucket of manaCurve) {
      const total = bucket.permanents + bucket.nonPermanents;
      if (total > peakCount) {
        peakCount = total;
        peakBucket = bucket;
      }
    }

    return [
      {
        label: "Bracket",
        value: `B${bracketResult.bracket}`,
        sub: bracketResult.bracketName,
      },
      {
        label: "Power Level",
        value: `PL${powerLevel.powerLevel}`,
        sub: powerLevel.bandLabel,
        accent: true,
      },
      {
        label: "Land Base",
        value: String(landEfficiency.overallScore),
        sub: landEfficiency.scoreLabel,
      },
      {
        label: "Colors",
        value: String(presentColors.length || 0),
        sub: colorLabel,
      },
      {
        label: "Curve Peak",
        value: peakBucket?.cmc ?? "—",
        sub: peakCount > 0 ? `${peakCount} cards` : "no spells",
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
