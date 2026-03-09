import type { DeckData, EnrichedCard, DeckSynergyAnalysis } from "./types";
import type { SpellbookCombo } from "./commander-spellbook";
import type { ManaCurveBucket } from "./mana-curve";
import type {
  ColorDistribution,
  ManaBaseMetrics,
  MtgColor,
} from "./color-distribution";
import type { LandBaseEfficiencyResult } from "./land-base-efficiency";
import type { ManaBaseRecommendationsResult } from "./mana-recommendations";
import type { PowerLevelResult } from "./power-level";
import type { BracketResult } from "./bracket-estimator";
import type { BudgetAnalysisResult } from "./budget-analysis";
import type { CompositionScorecardResult } from "./deck-composition";
import type { SimulationStats } from "./opening-hand";

import { computeManaCurve } from "./mana-curve";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  resolveCommanderIdentity,
} from "./color-distribution";
import { computeLandBaseEfficiency } from "./land-base-efficiency";
import { computeManaBaseRecommendations } from "./mana-recommendations";
import { computePowerLevel } from "./power-level";
import { computeBracketEstimate } from "./bracket-estimator";
import { STATIC_CEDH_STAPLES } from "./cedh-staples";
import { computeBudgetAnalysis } from "./budget-analysis";
import { analyzeDeckSynergy } from "./synergy-engine";
import {
  computeCompositionScorecard,
  TEMPLATE_COMMAND_ZONE,
} from "./deck-composition";
import { computeCreatureTypeBreakdown } from "./creature-types";
import { computeSupertypeBreakdown } from "./supertypes";
import {
  buildPool,
  buildCommandZone,
  buildCardCache,
  runSimulation,
  computePipWeights,
} from "./opening-hand";
import { buildTagCache } from "./card-tags";

export interface DeckAnalysisResults {
  manaCurve: ManaCurveBucket[];
  colorDistribution: ColorDistribution;
  manaBaseMetrics: ManaBaseMetrics;
  commanderIdentity: Set<MtgColor>;
  landEfficiency: LandBaseEfficiencyResult;
  manaRecommendations: ManaBaseRecommendationsResult;
  powerLevel: PowerLevelResult;
  bracketResult: BracketResult;
  budgetAnalysis: BudgetAnalysisResult;
  synergyAnalysis: DeckSynergyAnalysis;
  compositionScorecard: CompositionScorecardResult;
  creatureTypes: string[];
  supertypes: string[];
  simulationStats: SimulationStats;
}

export interface ComputeAllAnalysesInput {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
  spellbookCombos?: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
}

export function getAllCardNames(deck: DeckData): string[] {
  return [
    ...deck.commanders.map((c) => c.name),
    ...deck.mainboard.map((c) => c.name),
    ...deck.sideboard.map((c) => c.name),
  ];
}

export function computeAllAnalyses(
  input: ComputeAllAnalysesInput
): DeckAnalysisResults {
  const { deck, cardMap, spellbookCombos } = input;

  // Pre-compute tag cache once for all analysis modules
  const tagCache = buildTagCache(cardMap);

  // Phase 1: No dependencies
  const colorDistribution = computeColorDistribution(deck, cardMap);
  const manaBaseMetrics = computeManaBaseMetrics(deck, cardMap);
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);

  // Phase 2: Mana curve (all card types enabled for export)
  const manaCurve = computeManaCurve(deck, cardMap);

  // Phase 3: Land analysis
  const landEfficiency = computeLandBaseEfficiency(deck, cardMap);
  const manaRecommendations = computeManaBaseRecommendations(deck, cardMap, tagCache);

  // Phase 4: Power level
  const powerLevel = computePowerLevel(deck, cardMap, tagCache);

  // Phase 5: Bracket (depends on powerLevel)
  const bracketResult = computeBracketEstimate(
    deck,
    cardMap,
    powerLevel,
    STATIC_CEDH_STAPLES,
    spellbookCombos?.exactCombos ?? null,
    tagCache
  );

  // Phase 6: Budget & Synergy
  const budgetAnalysis = computeBudgetAnalysis(deck, cardMap, tagCache);
  const synergyAnalysis = analyzeDeckSynergy(deck, cardMap, tagCache);

  // Phase 7: Composition
  const compositionScorecard = computeCompositionScorecard(
    deck,
    cardMap,
    TEMPLATE_COMMAND_ZONE,
    tagCache
  );

  // Phase 8: Creature types & supertypes
  const allCardNames = getAllCardNames(deck);
  const creatureTypeMap = computeCreatureTypeBreakdown(allCardNames, cardMap);
  const supertypeMap = computeSupertypeBreakdown(allCardNames, cardMap);

  const creatureTypes = Array.from(creatureTypeMap.keys());
  const supertypes = Array.from(supertypeMap.keys());

  // Phase 9: Opening hand simulation
  const pool = buildPool(deck, cardMap);
  const commandZone = buildCommandZone(deck, cardMap);
  const pipWeights = computePipWeights(
    { ...colorDistribution.pips },
    commanderIdentity
  );
  const simulationStats = runSimulation(pool, commanderIdentity, 1000, commandZone, {
    deckThemes: synergyAnalysis.deckThemes,
    cardCache: buildCardCache(pool),
    pipWeights,
  });

  return {
    manaCurve,
    colorDistribution,
    manaBaseMetrics,
    commanderIdentity,
    landEfficiency,
    manaRecommendations,
    powerLevel,
    bracketResult,
    budgetAnalysis,
    synergyAnalysis,
    compositionScorecard,
    creatureTypes,
    supertypes,
    simulationStats,
  };
}
