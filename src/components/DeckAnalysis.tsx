"use client";

import { useMemo, useState } from "react";
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
import ManaCurveChart from "@/components/ManaCurveChart";
import TypeFilterBar from "@/components/TypeFilterBar";
import ColorDistributionChart from "@/components/ColorDistributionChart";
import ManaBaseStats from "@/components/ManaBaseStats";
import CommanderSection from "@/components/CommanderSection";
import LandBaseEfficiency from "@/components/LandBaseEfficiency";
import HypergeometricCalculator from "@/components/HypergeometricCalculator";

interface DeckAnalysisProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

export default function DeckAnalysis({ deck, cardMap }: DeckAnalysisProps) {
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

  return (
    <div className="space-y-6">
      <CommanderSection deck={deck} cardMap={cardMap} />

      <section aria-labelledby="mana-curve-heading">
        <h3
          id="mana-curve-heading"
          className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
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

      <section aria-labelledby="color-distribution-heading">
        <h3
          id="color-distribution-heading"
          className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
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

      <LandBaseEfficiency result={landEfficiency} />

      <HypergeometricCalculator deck={deck} cardMap={cardMap} />
    </div>
  );
}
