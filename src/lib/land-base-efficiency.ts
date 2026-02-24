import type { DeckData, EnrichedCard } from "./types";
import {
  computeColorDistribution,
  resolveCommanderIdentity,
  MTG_COLORS,
} from "./color-distribution";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LandClassification = "untapped" | "conditional" | "tapped";

export interface EfficiencyFactor {
  name: string;
  score: number; // 0–100
  weight: number; // 0–1, all weights sum to 1
  description: string;
}

export interface LandBaseEfficiencyResult {
  overallScore: number; // 0–100
  scoreLabel: string;
  factors: EfficiencyFactor[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLand(typeLine: string): boolean {
  return typeLine.includes("Land");
}

function getAllCards(deck: DeckData) {
  return [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
}

/** Regex patterns for conditional ETB-tapped lands */
const CONDITIONAL_PATTERNS = [
  /enters the battlefield tapped unless/i,
  /you may pay 2 life\. if you don't, it enters the battlefield tapped/i,
  /you may pay \d+ life\. if you don't,? it enters/i,
  /if you control two or fewer other lands/i,
  /you may reveal .+ from your hand\. if you don't,? .+ enters the battlefield tapped/i,
  /enters tapped unless/i,
];

// ---------------------------------------------------------------------------
// Land classification
// ---------------------------------------------------------------------------

/**
 * Classify a land card as untapped, conditional (can enter untapped with a cost/condition),
 * or tapped (always enters tapped).
 * Non-land cards return "untapped" as they are not scored as lands.
 */
export function classifyLandEntry(card: EnrichedCard): LandClassification {
  if (!isLand(card.typeLine)) return "untapped";

  // Basic lands always enter untapped
  if (card.supertypes.includes("Basic")) return "untapped";

  const text = card.oracleText.toLowerCase();

  // Check for any ETB-tapped mention
  const hasTappedText =
    text.includes("enters the battlefield tapped") || text.includes("enters tapped");

  if (!hasTappedText) return "untapped";

  // Check conditional patterns
  for (const pattern of CONDITIONAL_PATTERNS) {
    if (pattern.test(card.oracleText)) return "conditional";
  }

  // Unconditional tapped
  return "tapped";
}

// ---------------------------------------------------------------------------
// Factor 1: Untapped Ratio (weight 0.25)
// ---------------------------------------------------------------------------

/**
 * Score 0–100 based on the percentage of lands that can enter untapped.
 * Conditional lands count as 0.5.
 */
export function computeUntappedRatio(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  const allCards = getAllCards(deck);
  let totalLands = 0;
  let effectiveUntapped = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;

    totalLands += card.quantity;
    const classification = classifyLandEntry(enriched);
    if (classification === "untapped") {
      effectiveUntapped += card.quantity;
    } else if (classification === "conditional") {
      effectiveUntapped += card.quantity * 0.5;
    }
  }

  if (totalLands === 0) return 0;
  return Math.round((effectiveUntapped / totalLands) * 100);
}

// ---------------------------------------------------------------------------
// Factor 2: Color Coverage (weight 0.25)
// ---------------------------------------------------------------------------

/**
 * Score 0–100 based on how well mana sources cover pip demand per color.
 * Colors with no demand are excluded from the score.
 */
export function computeColorCoverage(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  const { sources, pips } = computeColorDistribution(deck, cardMap);

  // Find colors that have demand
  const demandedColors = MTG_COLORS.filter((c) => pips[c] > 0);
  if (demandedColors.length === 0) return 100;

  let totalScore = 0;
  for (const color of demandedColors) {
    const ratio = sources[color] / pips[color];
    // A ratio of 1.0+ means full coverage; scale linearly below that
    // Cap at 1.0 so excess sources don't inflate the score beyond 100
    totalScore += Math.min(ratio, 1.0);
  }

  return Math.round((totalScore / demandedColors.length) * 100);
}

// ---------------------------------------------------------------------------
// Factor 3: Land Drop Consistency (weight 0.20)
// ---------------------------------------------------------------------------

/**
 * Score 0–100 based on land count relative to deck size.
 * The ideal land ratio for Commander is ~37/99 (~37.4%).
 * Scores drop off as you move away from the ideal in either direction.
 */
export function computeLandDropConsistency(
  landCount: number,
  deckSize: number
): number {
  if (deckSize === 0 || landCount === 0) return 0;

  const landRatio = landCount / deckSize;
  const idealRatio = 0.374; // ~37 lands in 99 cards

  // Deviation from ideal — asymmetric: too few lands is worse than too many
  const deviation = landRatio - idealRatio;
  let penaltyFactor: number;
  if (deviation < 0) {
    // Too few lands: penalize more aggressively
    penaltyFactor = Math.abs(deviation) / 0.12; // 0 at ideal, 1.0 at ~25 lands
  } else {
    // Too many lands: gentler penalty
    penaltyFactor = deviation / 0.30; // 0 at ideal, 1.0 at ~67 lands
  }

  const score = Math.max(0, 100 * (1 - penaltyFactor ** 1.5));
  return Math.round(Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Factor 4: Mana Fixing Quality (weight 0.15)
// ---------------------------------------------------------------------------

/**
 * Score 0–100 based on the proportion of lands that produce 2+ colors.
 */
export function computeManaFixingQuality(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  const allCards = getAllCards(deck);
  let totalLands = 0;
  let multiColorLands = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;

    totalLands += card.quantity;
    const colorCount = enriched.producedMana.filter((c) => c !== "C").length;
    if (colorCount >= 2) {
      multiColorLands += card.quantity;
    }
  }

  if (totalLands === 0) return 0;
  return Math.round((multiColorLands / totalLands) * 100);
}

// ---------------------------------------------------------------------------
// Factor 5: Basic Land Ratio (weight 0.15)
// ---------------------------------------------------------------------------

/**
 * Score 0–100 evaluating whether the basic land count is appropriate.
 * Mono-color decks want more basics; multi-color decks need fewer basics
 * but enough to support fetch lands and search effects.
 */
export function computeBasicLandRatio(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  const allCards = getAllCards(deck);
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  const colorCount = Math.max(commanderIdentity.size, 1);

  let totalLands = 0;
  let basicLands = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;

    totalLands += card.quantity;
    if (enriched.supertypes.includes("Basic")) {
      basicLands += card.quantity;
    }
  }

  if (totalLands === 0) return 50; // neutral score when no lands

  const basicRatio = basicLands / totalLands;

  // Ideal basic ratio depends on color count:
  // 1 color: ~70-90% basics is fine (ideal ~0.8)
  // 2 colors: ~30-50% basics (ideal ~0.4)
  // 3 colors: ~20-35% basics (ideal ~0.28)
  // 4 colors: ~15-25% basics (ideal ~0.2)
  // 5 colors: ~10-20% basics (ideal ~0.15)
  // For mono-color, having all basics is perfectly fine (ideal ~0.9)
  // For multi-color, you want fewer basics and more duals/fetches
  const idealBasicRatio =
    colorCount === 1 ? 0.9 : Math.max(0.15, 0.7 - colorCount * 0.13);

  // Score based on distance from ideal
  const deviation = Math.abs(basicRatio - idealBasicRatio);
  // Wider tolerance for fewer colors since basics are more acceptable
  const tolerance = colorCount <= 2 ? 0.5 : 0.35;
  const score = Math.max(0, 100 * (1 - (deviation / tolerance) ** 2));

  return Math.round(Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Aggregate score
// ---------------------------------------------------------------------------

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Work";
  return "Poor";
}

/**
 * Compute the overall land base efficiency score with factor breakdown.
 */
export function computeLandBaseEfficiency(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): LandBaseEfficiencyResult {
  // Count lands and deck size
  const allCards = getAllCards(deck);
  let landCount = 0;
  let totalCards = 0;
  for (const card of allCards) {
    totalCards += card.quantity;
    const enriched = cardMap[card.name];
    if (enriched && isLand(enriched.typeLine)) {
      landCount += card.quantity;
    }
  }

  const factors: EfficiencyFactor[] = [
    {
      name: "Untapped Ratio",
      score: computeUntappedRatio(deck, cardMap),
      weight: 0.25,
      description: "Percentage of lands that can enter the battlefield untapped",
    },
    {
      name: "Color Coverage",
      score: computeColorCoverage(deck, cardMap),
      weight: 0.25,
      description: "How well mana sources cover the deck's color pip demand",
    },
    {
      name: "Land Drop Consistency",
      score: computeLandDropConsistency(landCount, totalCards),
      weight: 0.2,
      description:
        "Probability of making land drops on turns 1–4",
    },
    {
      name: "Mana Fixing",
      score: computeManaFixingQuality(deck, cardMap),
      weight: 0.15,
      description: "Proportion of lands that produce two or more colors",
    },
    {
      name: "Basic Land Ratio",
      score: computeBasicLandRatio(deck, cardMap),
      weight: 0.15,
      description:
        "Whether basic land count is appropriate for the deck's color count",
    },
  ];

  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  return {
    overallScore,
    scoreLabel: getScoreLabel(overallScore),
    factors,
  };
}
