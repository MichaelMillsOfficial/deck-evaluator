/**
 * Interaction Centrality
 *
 * Computes per-card centrality scores from an InteractionAnalysis result.
 * Centrality measures how "important" each card is to the deck's interaction
 * graph — engine pieces score high, isolated cards score zero.
 *
 * All computation is pure and synchronous, O(I + C + L + E) where I =
 * interactions, C = chains, L = loops, E = enablers.
 */

import type {
  InteractionAnalysis,
  InteractionType,
} from "@/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type CentralityCategory =
  | "engine"
  | "contributor"
  | "peripheral"
  | "isolated";

export interface CentralityScore {
  cardName: string;
  /** Total number of interactions this card participates in */
  interactionCount: number;
  /** Weighted score combining type weights, chain/loop/enabler bonuses */
  weightedScore: number;
  /** Interactions where this card is cards[0] (source) */
  asSource: number;
  /** Interactions where this card is cards[1] (target) */
  asTarget: number;
  /** Number of chains this card participates in */
  chainCount: number;
  /** Number of loops this card participates in */
  loopCount: number;
  /** Number of interactions this card enables (via InteractionEnabler) */
  enablerOf: number;
  /** 1-indexed rank (1 = highest centrality) */
  rank: number;
  /** Category based on score relative to max/median */
  category: CentralityCategory;
}

export interface CentralityResult {
  scores: CentralityScore[];
  maxScore: number;
  medianScore: number;
}

// ═══════════════════════════════════════════════════════════════
// WEIGHTS
// ═══════════════════════════════════════════════════════════════

const TYPE_WEIGHTS: Record<InteractionType, number> = {
  loops_with: 1.0,
  enables: 0.9,
  triggers: 0.8,
  reduces_cost: 0.7,
  amplifies: 0.7,
  recurs: 0.6,
  protects: 0.5,
  tutors_for: 0.5,
  blocks: -0.3,
  conflicts: -0.5,
};

const CHAIN_BONUS = 2.0;
const LOOP_BONUS = 5.0;
const ENABLER_BONUS = 1.5;

// ═══════════════════════════════════════════════════════════════
// COMPUTATION
// ═══════════════════════════════════════════════════════════════

/**
 * Compute centrality scores for all cards in the analysis.
 *
 * Algorithm:
 * 1. Initialize a score entry for every card in analysis.profiles
 * 2. Accumulate weighted interaction scores
 * 3. Add chain, loop, and enabler bonuses
 * 4. Sort descending, assign ranks
 * 5. Compute maxScore and medianScore
 * 6. Assign categories
 */
export function computeCentrality(
  analysis: InteractionAnalysis
): CentralityResult {
  const cardNames = Object.keys(analysis.profiles);

  if (cardNames.length === 0) {
    return { scores: [], maxScore: 0, medianScore: 0 };
  }

  // Initialize accumulators for every card
  const accum = new Map<
    string,
    {
      interactionCount: number;
      weightedSum: number;
      asSource: number;
      asTarget: number;
      chainCount: number;
      loopCount: number;
      enablerOf: number;
    }
  >();

  for (const name of cardNames) {
    accum.set(name, {
      interactionCount: 0,
      weightedSum: 0,
      asSource: 0,
      asTarget: 0,
      chainCount: 0,
      loopCount: 0,
      enablerOf: 0,
    });
  }

  // Accumulate interaction weights
  for (const interaction of analysis.interactions) {
    const [source, target] = interaction.cards;
    const weight = TYPE_WEIGHTS[interaction.type] ?? 0;
    const contribution = interaction.strength * weight;

    const srcEntry = accum.get(source);
    if (srcEntry) {
      srcEntry.interactionCount++;
      srcEntry.weightedSum += contribution;
      srcEntry.asSource++;
    }

    const tgtEntry = accum.get(target);
    if (tgtEntry) {
      tgtEntry.interactionCount++;
      tgtEntry.weightedSum += contribution;
      tgtEntry.asTarget++;
    }
  }

  // Chain bonuses — every card in a chain gets CHAIN_BONUS
  for (const chain of analysis.chains) {
    for (const cardName of chain.cards) {
      const entry = accum.get(cardName);
      if (entry) {
        entry.chainCount++;
        entry.weightedSum += CHAIN_BONUS;
      }
    }
  }

  // Loop bonuses — every card in a loop gets LOOP_BONUS
  for (const loop of analysis.loops) {
    for (const cardName of loop.cards) {
      const entry = accum.get(cardName);
      if (entry) {
        entry.loopCount++;
        entry.weightedSum += LOOP_BONUS;
      }
    }
  }

  // Enabler bonuses — the enabler card gets ENABLER_BONUS per enabled interaction
  for (const enabler of analysis.enablers) {
    const entry = accum.get(enabler.enabler);
    if (entry) {
      const count = enabler.enabledInteractions.length;
      entry.enablerOf += count;
      entry.weightedSum += count * ENABLER_BONUS;
    }
  }

  // Build unsorted score objects
  const unsorted: Omit<CentralityScore, "rank" | "category">[] = [];
  for (const [cardName, data] of accum) {
    unsorted.push({
      cardName,
      interactionCount: data.interactionCount,
      weightedScore: data.weightedSum,
      asSource: data.asSource,
      asTarget: data.asTarget,
      chainCount: data.chainCount,
      loopCount: data.loopCount,
      enablerOf: data.enablerOf,
    });
  }

  // Sort descending by weightedScore, then alphabetically for stability
  unsorted.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    return a.cardName.localeCompare(b.cardName);
  });

  // Compute maxScore and medianScore from weighted scores
  const weightedScores = unsorted.map((s) => s.weightedScore);
  const maxScore = weightedScores.length > 0 ? weightedScores[0] : 0;
  const medianScore = computeMedian(weightedScores);

  // Assign ranks and categories
  const scores: CentralityScore[] = unsorted.map((s, i) => ({
    ...s,
    rank: i + 1,
    category: categorizeCentrality(s.weightedScore, maxScore, medianScore),
  }));

  return { scores, maxScore, medianScore };
}

/**
 * Categorize a card's centrality based on its weighted score.
 *
 * @param weightedScore  The card's weighted score
 * @param maxScore       Maximum score in the deck
 * @param medianScore    Median score across all cards
 */
export function categorizeCentrality(
  weightedScore: number,
  maxScore: number,
  medianScore: number
): CentralityCategory {
  if (weightedScore <= 0) return "isolated";
  if (maxScore > 0 && weightedScore >= maxScore * 0.6) return "engine";
  if (weightedScore >= medianScore) return "contributor";
  return "peripheral";
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function computeMedian(sortedDescValues: number[]): number {
  if (sortedDescValues.length === 0) return 0;
  const mid = Math.floor(sortedDescValues.length / 2);
  if (sortedDescValues.length % 2 === 1) {
    return sortedDescValues[mid];
  }
  return (sortedDescValues[mid - 1] + sortedDescValues[mid]) / 2;
}
