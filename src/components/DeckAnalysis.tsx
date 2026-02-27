"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeManaCurve,
  extractCardType,
  CARD_TYPES,
  type CardType,
} from "@/lib/mana-curve";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  resolveCommanderIdentity,
} from "@/lib/color-distribution";
import { computeLandBaseEfficiency } from "@/lib/land-base-efficiency";
import { computeManaBaseRecommendations } from "@/lib/mana-recommendations";
import { computePowerLevel } from "@/lib/power-level";
import ManaCurveChart from "@/components/ManaCurveChart";
import TypeFilterBar from "@/components/TypeFilterBar";
import ColorDistributionChart from "@/components/ColorDistributionChart";
import ManaBaseStats from "@/components/ManaBaseStats";
import CommanderSection from "@/components/CommanderSection";
import LandBaseEfficiency from "@/components/LandBaseEfficiency";
import ManaBaseRecommendations from "@/components/ManaBaseRecommendations";
import DeckCompositionScorecard from "@/components/DeckCompositionScorecard";
import HypergeometricCalculator from "@/components/HypergeometricCalculator";
import PowerLevelEstimator from "@/components/PowerLevelEstimator";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SectionNav from "@/components/SectionNav";

const ANALYSIS_SECTIONS = [
  { id: "commander", label: "Commander" },
  { id: "composition", label: "Composition" },
  { id: "power-level", label: "Power Level" },
  { id: "mana-curve", label: "Mana Curve" },
  { id: "color-distribution", label: "Color Dist." },
  { id: "land-efficiency", label: "Land Efficiency" },
  { id: "mana-recommendations", label: "Mana Recs" },
  { id: "hypergeometric", label: "Draw Odds" },
] as const;

interface DeckAnalysisProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
}

export default function DeckAnalysis({
  deck,
  cardMap,
  expandedSections,
  onToggleSection,
}: DeckAnalysisProps) {
  const [enabledTypes, setEnabledTypes] = useState<Set<CardType>>(
    () => new Set(CARD_TYPES)
  );
  const [showColorless, setShowColorless] = useState(false);

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(
      CARD_TYPES.map((t) => [t, 0])
    ) as Record<CardType, number>;
    const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
    for (const card of allCards) {
      const enriched = cardMap[card.name];
      if (!enriched) continue;
      const cardType = extractCardType(enriched.typeLine);
      if (cardType) counts[cardType] += card.quantity;
    }
    return counts;
  }, [deck, cardMap]);

  const totalAllSpells = useMemo(
    () => CARD_TYPES.reduce((sum, t) => sum + typeCounts[t], 0),
    [typeCounts]
  );

  const curveData = useMemo(
    () => computeManaCurve(deck, cardMap, enabledTypes),
    [deck, cardMap, enabledTypes]
  );

  const colorDistribution = useMemo(
    () => computeColorDistribution(deck, cardMap),
    [deck, cardMap]
  );

  const metrics = useMemo(
    () => computeManaBaseMetrics(deck, cardMap),
    [deck, cardMap]
  );

  const commanderIdentity = useMemo(
    () => resolveCommanderIdentity(deck, cardMap),
    [deck, cardMap]
  );

  const landEfficiency = useMemo(
    () => computeLandBaseEfficiency(deck, cardMap),
    [deck, cardMap]
  );

  const manaRecommendations = useMemo(
    () => computeManaBaseRecommendations(deck, cardMap),
    [deck, cardMap]
  );

  const powerLevel = useMemo(
    () => computePowerLevel(deck, cardMap),
    [deck, cardMap]
  );

  const filteredSpells = curveData.reduce(
    (sum, b) => sum + b.permanents + b.nonPermanents,
    0
  );

  const allEnabled = enabledTypes.size === CARD_TYPES.length;

  function handleToggle(type: CardType) {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const handleSelectSection = useCallback(
    (id: string) => {
      onToggleSection(id);
    },
    [onToggleSection]
  );

  return (
    <div className="space-y-3">
      <SectionNav
        sections={ANALYSIS_SECTIONS}
        expandedSections={expandedSections}
        onSelectSection={handleSelectSection}
      />

      <CollapsiblePanel
        id="commander"
        title="Commander"
        expanded={expandedSections.has("commander")}
        onToggle={() => onToggleSection("commander")}
      >
        <CommanderSection deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="composition"
        title="Composition Scorecard"
        expanded={expandedSections.has("composition")}
        onToggle={() => onToggleSection("composition")}
      >
        <DeckCompositionScorecard deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="power-level"
        title="Power Level Estimator"
        expanded={expandedSections.has("power-level")}
        onToggle={() => onToggleSection("power-level")}
      >
        <PowerLevelEstimator result={powerLevel} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="mana-curve"
        title="Mana Curve"
        expanded={expandedSections.has("mana-curve")}
        onToggle={() => onToggleSection("mana-curve")}
      >
        <section aria-labelledby="mana-curve-heading">
          <h3
            id="mana-curve-heading"
            className="sr-only"
          >
            Mana Curve
          </h3>
          <p className="mb-4 text-xs text-slate-400" data-testid="curve-subtitle">
            {allEnabled
              ? `${totalAllSpells} non-land spells by converted mana cost`
              : `${filteredSpells} of ${totalAllSpells} non-land spells by converted mana cost`}
          </p>
          <div className="mb-4">
            <TypeFilterBar
              enabledTypes={enabledTypes}
              onToggle={handleToggle}
              typeCounts={typeCounts}
            />
          </div>
          <ManaCurveChart data={curveData} totalSpells={filteredSpells} />
        </section>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="color-distribution"
        title="Color Distribution"
        expanded={expandedSections.has("color-distribution")}
        onToggle={() => onToggleSection("color-distribution")}
      >
        <section aria-labelledby="color-distribution-heading">
          <h3
            id="color-distribution-heading"
            className="sr-only"
          >
            Color Distribution
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Mana sources versus pip demand by color
          </p>
          <ManaBaseStats metrics={metrics} />
          <ColorDistributionChart
            data={colorDistribution}
            commanderIdentity={commanderIdentity}
            showColorless={showColorless}
            onToggleColorless={() => setShowColorless((prev) => !prev)}
          />
        </section>
      </CollapsiblePanel>

      <CollapsiblePanel
        id="land-efficiency"
        title="Land Base Efficiency"
        expanded={expandedSections.has("land-efficiency")}
        onToggle={() => onToggleSection("land-efficiency")}
      >
        <LandBaseEfficiency result={landEfficiency} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="mana-recommendations"
        title="Mana Base Recommendations"
        summary={manaRecommendations.recommendations.length > 0
          ? `${manaRecommendations.recommendations.length} issue${manaRecommendations.recommendations.length === 1 ? "" : 's'}`
          : "No issues"}
        expanded={expandedSections.has("mana-recommendations")}
        onToggle={() => onToggleSection("mana-recommendations")}
      >
        <ManaBaseRecommendations result={manaRecommendations} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="hypergeometric"
        title="Draw Probability"
        expanded={expandedSections.has("hypergeometric")}
        onToggle={() => onToggleSection("hypergeometric")}
      >
        <HypergeometricCalculator deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>
    </div>
  );
}
