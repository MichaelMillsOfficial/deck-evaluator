"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
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

  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!analysisResults?.synergyAnalysis) return undefined;
    const synergy = analysisResults.synergyAnalysis;
    const topTheme = synergy.deckThemes[0];
    return [
      {
        label: "Top Theme",
        value: topTheme?.axisName ?? "Goodstuff",
        sub: topTheme
          ? `${topTheme.cardCount} cards`
          : "no dominant theme",
        accent: true,
      },
      {
        label: "Synergies",
        value: String(synergy.topSynergies.length),
        sub: "pairs found",
      },
      {
        label: "Combos",
        value: String(synergy.knownCombos.length),
        sub: synergy.antiSynergies.length
          ? `${synergy.antiSynergies.length} anti`
          : "verified",
      },
    ];
  }, [analysisResults]);

  if (!payload?.cardMap || !analysisResults?.synergyAnalysis) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-synergy"
      aria-labelledby="tab-deck-synergy"
    >
      <SectionHeader
        slug="synergy"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Synergies"
        title="How the Cards Read Together"
        tagline="Top synergies, anti-synergies, and verified combos drawn from oracle text and Commander Spellbook."
        stats={stats}
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
