"use client";

import { useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeManaCurve,
  extractCardType,
  CARD_TYPES,
  type CardType,
} from "@/lib/mana-curve";
import ManaCurveChart from "@/components/ManaCurveChart";
import TypeFilterBar from "@/components/TypeFilterBar";

interface DeckAnalysisProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

export default function DeckAnalysis({ deck, cardMap }: DeckAnalysisProps) {
  const [enabledTypes, setEnabledTypes] = useState<Set<CardType>>(
    () => new Set(CARD_TYPES)
  );

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
    </div>
  );
}
