"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeManaCurve,
  countMdfcLands,
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
import { computeBracketEstimate } from "@/lib/bracket-estimator";
import { STATIC_CEDH_STAPLES } from "@/lib/cedh-staples";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import { computeBudgetAnalysis } from "@/lib/budget-analysis";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import ManaCurveChart from "@/components/ManaCurveChart";
import TypeFilterBar from "@/components/TypeFilterBar";
import ColorDistributionChart from "@/components/ColorDistributionChart";
import ManaBaseStats from "@/components/ManaBaseStats";
import CommanderSection from "@/components/CommanderSection";
import LandBaseEfficiency from "@/components/LandBaseEfficiency";
import DeckCompositionScorecard from "@/components/DeckCompositionScorecard";
import HypergeometricCalculator from "@/components/HypergeometricCalculator";
import DeckClassification from "@/components/DeckClassification";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SectionNav from "@/components/SectionNav";
import BudgetStats from "@/components/BudgetStats";
import PriceDistributionChart from "@/components/PriceDistributionChart";
import TopExpensiveCardsTable from "@/components/TopExpensiveCardsTable";
import PriceByCategoryChart from "@/components/PriceByCategoryChart";
import CreatureTypeBreakdown from "@/components/CreatureTypeBreakdown";
import SupertypeBreakdown from "@/components/SupertypeBreakdown";

const ANALYSIS_SECTIONS = [
  { id: "commander", label: "Commander" },
  { id: "composition", label: "Composition" },
  { id: "creature-types", label: "Creature Types" },
  { id: "supertypes", label: "Supertypes" },
  { id: "deck-classification", label: "Classification" },
  { id: "mana-curve", label: "Mana Curve" },
  { id: "color-distribution", label: "Color Dist." },
  { id: "land-efficiency", label: "Land Efficiency" },
  { id: "hypergeometric", label: "Draw Odds" },
  { id: "budget", label: "Budget" },
] as const;

interface DeckAnalysisProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  spellbookCombos?: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
  analysisResults?: DeckAnalysisResults;
}

export default function DeckAnalysis({
  deck,
  cardMap,
  expandedSections,
  onToggleSection,
  spellbookCombos,
  analysisResults,
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

  const mdfcLandCount = useMemo(
    () => countMdfcLands(deck, cardMap),
    [deck, cardMap]
  );

  const colorDistribution = useMemo(
    () => analysisResults?.colorDistribution ?? computeColorDistribution(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const metrics = useMemo(
    () => analysisResults?.manaBaseMetrics ?? computeManaBaseMetrics(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const commanderIdentity = useMemo(
    () => analysisResults?.commanderIdentity ?? resolveCommanderIdentity(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const landEfficiency = useMemo(
    () => analysisResults?.landEfficiency ?? computeLandBaseEfficiency(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const manaRecommendations = useMemo(
    () => analysisResults?.manaRecommendations ?? computeManaBaseRecommendations(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const powerLevel = useMemo(
    () => analysisResults?.powerLevel ?? computePowerLevel(deck, cardMap),
    [deck, cardMap, analysisResults]
  );

  const bracketResult = useMemo(
    () =>
      analysisResults?.bracketResult ??
      computeBracketEstimate(
        deck,
        cardMap,
        powerLevel,
        STATIC_CEDH_STAPLES,
        spellbookCombos?.exactCombos ?? null
      ),
    [deck, cardMap, powerLevel, spellbookCombos, analysisResults]
  );

  const budgetAnalysis = useMemo(
    () => analysisResults?.budgetAnalysis ?? computeBudgetAnalysis(deck, cardMap),
    [deck, cardMap, analysisResults]
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
        id="creature-types"
        title="Creature Types"
        expanded={expandedSections.has("creature-types")}
        onToggle={() => onToggleSection("creature-types")}
      >
        <CreatureTypeBreakdown deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="supertypes"
        title="Supertypes"
        expanded={expandedSections.has("supertypes")}
        onToggle={() => onToggleSection("supertypes")}
      >
        <SupertypeBreakdown deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="deck-classification"
        title="Deck Classification"
        expanded={expandedSections.has("deck-classification")}
        onToggle={() => onToggleSection("deck-classification")}
        summary={
          <span
            data-testid="classification-summary-badge"
            className="rounded border px-1.5 py-0.5 text-xs font-semibold bg-slate-700/50 border-slate-600 text-slate-300"
          >
            B{bracketResult.bracket} | PL{powerLevel.powerLevel}
          </span>
        }
      >
        <DeckClassification bracketResult={bracketResult} powerLevel={powerLevel} />
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
          <ManaCurveChart data={curveData} totalSpells={filteredSpells} mdfcLandCount={mdfcLandCount} />
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
        <LandBaseEfficiency result={landEfficiency} recommendations={manaRecommendations} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="hypergeometric"
        title="Draw Probability"
        expanded={expandedSections.has("hypergeometric")}
        onToggle={() => onToggleSection("hypergeometric")}
      >
        <HypergeometricCalculator deck={deck} cardMap={cardMap} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="budget"
        title="Budget Analysis"
        summary={budgetAnalysis.totalCostFormatted}
        expanded={expandedSections.has("budget")}
        onToggle={() => onToggleSection("budget")}
      >
        <div className="space-y-6">
          <BudgetStats result={budgetAnalysis} />
          <PriceDistributionChart data={budgetAnalysis.distribution} />
          <TopExpensiveCardsTable cards={budgetAnalysis.mostExpensive} />
          <PriceByCategoryChart byType={budgetAnalysis.byType} byRole={budgetAnalysis.byRole} />
        </div>
      </CollapsiblePanel>
    </div>
  );
}
