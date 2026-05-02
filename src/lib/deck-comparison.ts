import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  MTG_COLORS,
  type MtgColor,
} from "@/lib/color-distribution";
import { computeLandBaseEfficiency } from "@/lib/land-base-efficiency";
import { generateTags } from "@/lib/card-tags";
import { computeManaCurve } from "@/lib/mana-curve";
import {
  runSimulation,
  buildPool,
  buildCommandZone,
  type SimulationStats,
} from "@/lib/opening-hand";
import {
  computeBracketEstimate,
  type BracketResult,
} from "@/lib/bracket-estimator";
import { computePowerLevel, type PowerLevelResult } from "@/lib/power-level";
import {
  computeCompositionScorecard,
  TEMPLATE_8X8,
  type CompositionScorecardResult,
} from "@/lib/deck-composition";
import { STATIC_CEDH_STAPLES } from "@/lib/cedh-staples";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedCard {
  name: string;
  quantityA: number;
  quantityB: number;
}

export interface UniqueCard {
  name: string;
  quantity: number;
}

export interface CardOverlap {
  shared: SharedCard[];
  uniqueToA: UniqueCard[];
  uniqueToB: UniqueCard[];
  sharedCount: number;
  uniqueToACount: number;
  uniqueToBCount: number;
  overlapPercentage: number;
}

export interface MetricDiff {
  label: string;
  valueA: number;
  valueB: number;
  diff: number;
  diffLabel: string;
  unit?: string;
}

export interface TagComparison {
  tag: string;
  countA: number;
  countB: number;
  diff: number;
}

export interface ManaCurveOverlayBucket {
  cmc: string;
  totalA: number;
  totalB: number;
}

export interface DeckComparisonResult {
  cardOverlap: CardOverlap;
  metricDiffs: MetricDiff[];
  tagComparison: TagComparison[];
  curveOverlay: ManaCurveOverlayBucket[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllCards(deck: DeckData) {
  return [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
}

function buildQuantityMap(deck: DeckData): Map<string, number> {
  const map = new Map<string, number>();
  for (const card of getAllCards(deck)) {
    map.set(card.name, (map.get(card.name) ?? 0) + card.quantity);
  }
  return map;
}

function formatDiffLabel(diff: number, decimals = 2): string {
  const rounded = parseFloat(diff.toFixed(decimals));
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

// ---------------------------------------------------------------------------
// computeCardOverlap
// ---------------------------------------------------------------------------

/**
 * Computes card overlap between two decks.
 * Cards in different zones (commander vs mainboard) still count as shared.
 * overlapPercentage = shared.length / unionSize * 100
 */
export function computeCardOverlap(deckA: DeckData, deckB: DeckData): CardOverlap {
  const mapA = buildQuantityMap(deckA);
  const mapB = buildQuantityMap(deckB);

  // Union of all card names
  const allNames = new Set<string>([...mapA.keys(), ...mapB.keys()]);

  if (allNames.size === 0) {
    return {
      shared: [],
      uniqueToA: [],
      uniqueToB: [],
      sharedCount: 0,
      uniqueToACount: 0,
      uniqueToBCount: 0,
      overlapPercentage: 0,
    };
  }

  const shared: SharedCard[] = [];
  const uniqueToA: UniqueCard[] = [];
  const uniqueToB: UniqueCard[] = [];

  for (const name of allNames) {
    const inA = mapA.has(name);
    const inB = mapB.has(name);

    if (inA && inB) {
      shared.push({ name, quantityA: mapA.get(name)!, quantityB: mapB.get(name)! });
    } else if (inA) {
      uniqueToA.push({ name, quantity: mapA.get(name)! });
    } else {
      uniqueToB.push({ name, quantity: mapB.get(name)! });
    }
  }

  // Sort alphabetically
  shared.sort((a, b) => a.name.localeCompare(b.name));
  uniqueToA.sort((a, b) => a.name.localeCompare(b.name));
  uniqueToB.sort((a, b) => a.name.localeCompare(b.name));

  const unionSize = allNames.size;
  const overlapPercentage = (shared.length / unionSize) * 100;

  return {
    shared,
    uniqueToA,
    uniqueToB,
    sharedCount: shared.length,
    uniqueToACount: uniqueToA.length,
    uniqueToBCount: uniqueToB.length,
    overlapPercentage,
  };
}

// ---------------------------------------------------------------------------
// computeMetricDiffs
// ---------------------------------------------------------------------------

/**
 * Computes metric differences between two decks.
 * Uses computeManaBaseMetrics and computeLandBaseEfficiency for each deck.
 */
export function computeMetricDiffs(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): MetricDiff[] {
  const metricsA = computeManaBaseMetrics(deckA, cardMapA);
  const metricsB = computeManaBaseMetrics(deckB, cardMapB);
  const efficiencyA = computeLandBaseEfficiency(deckA, cardMapA);
  const efficiencyB = computeLandBaseEfficiency(deckB, cardMapB);

  const diffs: MetricDiff[] = [];

  // Land count
  const landCountDiff = metricsB.landCount - metricsA.landCount;
  diffs.push({
    label: "Land Count",
    valueA: metricsA.landCount,
    valueB: metricsB.landCount,
    diff: landCountDiff,
    diffLabel: formatDiffLabel(landCountDiff, 0),
    unit: "lands",
  });

  // Land percentage
  const landPctDiff = metricsB.landPercentage - metricsA.landPercentage;
  diffs.push({
    label: "Land Percentage",
    valueA: parseFloat(metricsA.landPercentage.toFixed(1)),
    valueB: parseFloat(metricsB.landPercentage.toFixed(1)),
    diff: parseFloat(landPctDiff.toFixed(1)),
    diffLabel: formatDiffLabel(landPctDiff, 1),
    unit: "%",
  });

  // Average CMC
  const avgCmcDiff = metricsB.averageCmc - metricsA.averageCmc;
  diffs.push({
    label: "Average CMC",
    valueA: parseFloat(metricsA.averageCmc.toFixed(2)),
    valueB: parseFloat(metricsB.averageCmc.toFixed(2)),
    diff: parseFloat(avgCmcDiff.toFixed(2)),
    diffLabel: formatDiffLabel(avgCmcDiff, 2),
  });

  // Land base efficiency overall score
  const effDiff = efficiencyB.overallScore - efficiencyA.overallScore;
  diffs.push({
    label: "Land Base Efficiency",
    valueA: efficiencyA.overallScore,
    valueB: efficiencyB.overallScore,
    diff: effDiff,
    diffLabel: formatDiffLabel(effDiff, 0),
    unit: "/ 100",
  });

  return diffs;
}

// ---------------------------------------------------------------------------
// computeTagComparison
// ---------------------------------------------------------------------------

/**
 * Computes tag count comparison between two decks.
 * Cards not in cardMap are skipped gracefully.
 * Returns sorted by abs(diff) descending, then alphabetically for ties.
 */
export function computeTagComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): TagComparison[] {
  function accumulateTags(
    deck: DeckData,
    cardMap: Record<string, EnrichedCard>
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const card of getAllCards(deck)) {
      const enriched = cardMap[card.name];
      if (!enriched) continue;
      const tags = generateTags(enriched);
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + card.quantity);
      }
    }
    return counts;
  }

  const countsA = accumulateTags(deckA, cardMapA);
  const countsB = accumulateTags(deckB, cardMapB);

  // Union of all tags
  const allTags = new Set<string>([...countsA.keys(), ...countsB.keys()]);

  const result: TagComparison[] = [];
  for (const tag of allTags) {
    const countA = countsA.get(tag) ?? 0;
    const countB = countsB.get(tag) ?? 0;
    result.push({ tag, countA, countB, diff: countB - countA });
  }

  // Sort by abs(diff) descending, then alphabetically for ties
  result.sort((a, b) => {
    const absDiff = Math.abs(b.diff) - Math.abs(a.diff);
    if (absDiff !== 0) return absDiff;
    return a.tag.localeCompare(b.tag);
  });

  return result;
}

// ---------------------------------------------------------------------------
// computeCurveOverlay
// ---------------------------------------------------------------------------

/**
 * Merges mana curve data for both decks into overlay buckets.
 * totalA and totalB are the combined (permanents + nonPermanents) for each bucket.
 */
export function computeCurveOverlay(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): ManaCurveOverlayBucket[] {
  const curveA = computeManaCurve(deckA, cardMapA);
  const curveB = computeManaCurve(deckB, cardMapB);

  // curveA and curveB have same buckets in same order (always 8 buckets)
  return curveA.map((bucketA, i) => ({
    cmc: bucketA.cmc,
    totalA: bucketA.permanents + bucketA.nonPermanents,
    totalB: (curveB[i]?.permanents ?? 0) + (curveB[i]?.nonPermanents ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// computeDeckComparison (orchestrator)
// ---------------------------------------------------------------------------

/**
 * Orchestrates all comparison computations and returns a complete result.
 */
export function computeDeckComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): DeckComparisonResult {
  return {
    cardOverlap: computeCardOverlap(deckA, deckB),
    metricDiffs: computeMetricDiffs(deckA, cardMapA, deckB, cardMapB),
    tagComparison: computeTagComparison(deckA, cardMapA, deckB, cardMapB),
    curveOverlay: computeCurveOverlay(deckA, cardMapA, deckB, cardMapB),
  };
}

// ---------------------------------------------------------------------------
// New comparison helpers for the four panels added in issue #119
// ---------------------------------------------------------------------------

// Re-export types for consumers
export type { SimulationStats, BracketResult, PowerLevelResult, CompositionScorecardResult };

export interface HandKeepabilityComparison {
  statsA: SimulationStats;
  statsB: SimulationStats;
  keepRateDelta: number; // statsB.keepableRate - statsA.keepableRate
  avgScoreDelta: number;
}

export interface BracketComparison {
  resultA: BracketResult;
  resultB: BracketResult;
  bracketDelta: number; // resultB.bracket - resultA.bracket
}

export interface PowerLevelComparison {
  resultA: PowerLevelResult;
  resultB: PowerLevelResult;
  powerLevelDelta: number; // resultB.powerLevel - resultA.powerLevel
  rawScoreDelta: number;
}

export interface CompositionComparison {
  resultA: CompositionScorecardResult;
  resultB: CompositionScorecardResult;
}

/**
 * Computes hand keepability comparison between two decks using opening-hand simulation.
 * Uses a reduced iteration count (200) to keep comparison fast in UI.
 */
export function computeHandKeepabilityComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>,
  iterations = 200
): HandKeepabilityComparison {
  const commanderIdentityA = new Set(
    deckA.commanders.flatMap((c) => cardMapA[c.name]?.colorIdentity ?? [])
  );
  const commanderIdentityB = new Set(
    deckB.commanders.flatMap((c) => cardMapB[c.name]?.colorIdentity ?? [])
  );

  const poolA = buildPool(deckA, cardMapA);
  const commandZoneA = buildCommandZone(deckA, cardMapA);
  const statsA = runSimulation(poolA, commanderIdentityA, iterations, commandZoneA);

  const poolB = buildPool(deckB, cardMapB);
  const commandZoneB = buildCommandZone(deckB, cardMapB);
  const statsB = runSimulation(poolB, commanderIdentityB, iterations, commandZoneB);

  return {
    statsA,
    statsB,
    keepRateDelta: statsB.keepableRate - statsA.keepableRate,
    avgScoreDelta: statsB.avgScore - statsA.avgScore,
  };
}

/**
 * Computes bracket estimate comparison between two decks.
 */
export function computeBracketComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): BracketComparison {
  const powerA = computePowerLevel(deckA, cardMapA);
  const powerB = computePowerLevel(deckB, cardMapB);

  const resultA = computeBracketEstimate(deckA, cardMapA, powerA, STATIC_CEDH_STAPLES, null);
  const resultB = computeBracketEstimate(deckB, cardMapB, powerB, STATIC_CEDH_STAPLES, null);

  return {
    resultA,
    resultB,
    bracketDelta: resultB.bracket - resultA.bracket,
  };
}

/**
 * Computes power level comparison between two decks.
 */
export function computePowerLevelComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): PowerLevelComparison {
  const resultA = computePowerLevel(deckA, cardMapA);
  const resultB = computePowerLevel(deckB, cardMapB);

  return {
    resultA,
    resultB,
    powerLevelDelta: resultB.powerLevel - resultA.powerLevel,
    rawScoreDelta: resultB.rawScore - resultA.rawScore,
  };
}

/**
 * Computes composition scorecard comparison between two decks using the 8×8 template.
 */
export function computeCompositionComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): CompositionComparison {
  const resultA = computeCompositionScorecard(deckA, cardMapA, TEMPLATE_8X8);
  const resultB = computeCompositionScorecard(deckB, cardMapB, TEMPLATE_8X8);

  return { resultA, resultB };
}

// ---------------------------------------------------------------------------
// Mana pressure: per-color pip vs source delta
// ---------------------------------------------------------------------------

/**
 * One color's pip-vs-source picture across both decks.
 *
 * verdict semantics (only emitted when at least one side has demand):
 *   - "improved":    pip-per-source ratio improved or sources increased to keep pace
 *   - "pressure":    pips went up but sources did not — the user's exact concern
 *   - "underserved": post-swap ratio below the safe threshold (sources/pips < 0.45)
 *                    even when pips didn't move; flags a baseline-bad mana base
 *   - "neutral":     ratio movement is small or both sides are zero
 */
export type ManaPressureVerdict =
  | "improved"
  | "pressure"
  | "underserved"
  | "neutral";

export interface ColorPressure {
  color: MtgColor;
  pipsA: number;
  pipsB: number;
  pipsDelta: number;
  sourcesA: number;
  sourcesB: number;
  sourcesDelta: number;
  /** sources / pips; Infinity when no demand on either side, 0 when no sources */
  ratioA: number;
  ratioB: number;
  verdict: ManaPressureVerdict;
}

export interface ManaPressureComparison {
  byColor: ColorPressure[];
  /** Color with the worst regression (largest negative ratio delta with non-zero pips). null if none. */
  worstColor: MtgColor | null;
  /** Whether any color is flagged "pressure" or "underserved" in slot B. */
  anyPressure: boolean;
}

/** Threshold below which a color is considered structurally under-supported. */
const UNDERSERVED_RATIO_THRESHOLD = 0.45;
/** Ratio delta within this band counts as "neutral" (avoids noise). */
const NEUTRAL_RATIO_DELTA = 0.05;

function computeRatio(sources: number, pips: number): number {
  if (pips === 0) return sources > 0 ? Infinity : 0;
  return sources / pips;
}

function classifyVerdict(p: Omit<ColorPressure, "verdict">): ManaPressureVerdict {
  if (p.pipsA === 0 && p.pipsB === 0) return "neutral";

  // Both sides have demand and post-swap ratio is below the floor → underserved
  if (p.pipsB > 0 && p.ratioB < UNDERSERVED_RATIO_THRESHOLD) {
    if (p.pipsB > p.pipsA && p.sourcesDelta <= 0) return "pressure";
    return "underserved";
  }

  // Pips went up but sources did not keep pace → pressure (user's exact case)
  if (p.pipsB > p.pipsA && p.sourcesDelta <= 0) return "pressure";

  // Use ratio delta when both sides had demand
  if (p.pipsA > 0 && p.pipsB > 0) {
    const delta = p.ratioB - p.ratioA;
    if (delta > NEUTRAL_RATIO_DELTA) return "improved";
    if (delta < -NEUTRAL_RATIO_DELTA) return "pressure";
  }

  // Going from no demand to demand: only "improved" when sources cover 1:1+;
  // a 0.5 ratio is technically supported but practically tight, so it counts
  // as pressure even though the prior ratio was undefined.
  if (p.pipsA === 0 && p.pipsB > 0) {
    if (p.ratioB >= 1) return "improved";
    if (p.ratioB >= UNDERSERVED_RATIO_THRESHOLD) return "pressure";
    return "underserved";
  }

  return "neutral";
}

/**
 * Computes per-color mana pressure between two decks.
 *
 * Surfaces the case the user described: adds increase pip demand for a color
 * (e.g. three RRR spells) without lifting that color's source count.
 */
export function computeManaPressureComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): ManaPressureComparison {
  const distA = computeColorDistribution(deckA, cardMapA);
  const distB = computeColorDistribution(deckB, cardMapB);

  const byColor: ColorPressure[] = MTG_COLORS.map((color) => {
    const pipsA = distA.pips[color];
    const pipsB = distB.pips[color];
    const sourcesA = distA.sources[color];
    const sourcesB = distB.sources[color];
    const ratioA = computeRatio(sourcesA, pipsA);
    const ratioB = computeRatio(sourcesB, pipsB);
    const base: Omit<ColorPressure, "verdict"> = {
      color,
      pipsA,
      pipsB,
      pipsDelta: pipsB - pipsA,
      sourcesA,
      sourcesB,
      sourcesDelta: sourcesB - sourcesA,
      ratioA,
      ratioB,
    };
    return { ...base, verdict: classifyVerdict(base) };
  });

  // Worst color: the pressured/underserved color whose post-swap mana base hurts
  // most. We score by (1 / ratioB) * pipsB — a low ratio with a lot of demand
  // is much worse than a low ratio with one off-color pip. ratioB == 0 (demand
  // with zero sources) gets the maximum penalty.
  let worstColor: MtgColor | null = null;
  let worstScore = 0;
  for (const c of byColor) {
    if (c.verdict !== "pressure" && c.verdict !== "underserved") continue;
    if (c.pipsB === 0) continue;
    const inverseRatio = c.ratioB > 0 ? 1 / c.ratioB : 1000;
    const score = inverseRatio * c.pipsB;
    if (score > worstScore) {
      worstScore = score;
      worstColor = c.color;
    }
  }

  const anyPressure = byColor.some(
    (c) => c.verdict === "pressure" || c.verdict === "underserved"
  );

  return { byColor, worstColor, anyPressure };
}

/** Union of all four new comparison results for the /reading/compare page. */
export interface ExtendedDeckComparisonResult extends DeckComparisonResult {
  handKeepability: HandKeepabilityComparison;
  bracketComparison: BracketComparison;
  powerLevelComparison: PowerLevelComparison;
  compositionComparison: CompositionComparison;
  manaPressure: ManaPressureComparison;
}

/**
 * Orchestrates all comparison computations including the four new metrics.
 * Superset of `computeDeckComparison`.
 */
export function computeExtendedDeckComparison(
  deckA: DeckData,
  cardMapA: Record<string, EnrichedCard>,
  deckB: DeckData,
  cardMapB: Record<string, EnrichedCard>
): ExtendedDeckComparisonResult {
  return {
    ...computeDeckComparison(deckA, cardMapA, deckB, cardMapB),
    handKeepability: computeHandKeepabilityComparison(deckA, cardMapA, deckB, cardMapB),
    bracketComparison: computeBracketComparison(deckA, cardMapA, deckB, cardMapB),
    powerLevelComparison: computePowerLevelComparison(deckA, cardMapA, deckB, cardMapB),
    compositionComparison: computeCompositionComparison(deckA, cardMapA, deckB, cardMapB),
    manaPressure: computeManaPressureComparison(deckA, cardMapA, deckB, cardMapB),
  };
}
