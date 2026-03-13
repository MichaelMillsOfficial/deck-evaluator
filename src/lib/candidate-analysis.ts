import type {
  DeckData,
  EnrichedCard,
  DeckSynergyAnalysis,
  CardAxisScore,
  SynergyPair,
} from "./types";
import type { ColorCounts } from "./color-distribution";
import {
  computeManaBaseMetrics,
  resolveCommanderIdentity,
  MTG_COLORS,
} from "./color-distribution";
import { analyzeDeckSynergy } from "./synergy-engine";
import { getTagsCached } from "./card-tags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmcImpact {
  currentAvgCmc: number;
  projectedAvgCmc: number;
  delta: number;
}

export interface ManaBaseImpact {
  currentRatios: ColorCounts;
  projectedRatios: ColorCounts;
  stressedColors: string[];
}

export interface ReplacementCandidate {
  cardName: string;
  reason: string;
  synergyScore: number;
  sharedTags: string[];
  cmcDifference: number;
  priceUsd: number | null;
}

export interface CandidateAnalysis {
  synergyScore: number;
  cmcImpact: CmcImpact;
  manaBaseImpact: ManaBaseImpact;
  replacements: ReplacementCandidate[];
  tags: string[];
  axes: CardAxisScore[];
  pairs: SynergyPair[];
  offIdentityColors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STRESSED_RATIO_THRESHOLD = 1.0;
const MAX_REPLACEMENTS = 5;

function isLand(typeLine: string): boolean {
  return /\bLand\b/.test(typeLine);
}

function computeAvgCmc(
  cards: { name: string; quantity: number }[],
  cardMap: Record<string, EnrichedCard>
): number {
  let totalCmc = 0;
  let nonLandCount = 0;

  for (const card of cards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    if (isLand(enriched.typeLine)) continue;
    totalCmc += enriched.cmc * card.quantity;
    nonLandCount += card.quantity;
  }

  return nonLandCount > 0 ? totalCmc / nonLandCount : 0;
}

// ---------------------------------------------------------------------------
// computeCmcImpact
// ---------------------------------------------------------------------------

export function computeCmcImpact(
  candidate: EnrichedCard,
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): CmcImpact {
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
  const currentAvgCmc = computeAvgCmc(allCards, cardMap);

  // If candidate is a land, it doesn't change the average
  if (isLand(candidate.typeLine)) {
    return { currentAvgCmc, projectedAvgCmc: currentAvgCmc, delta: 0 };
  }

  // Add candidate to the pool
  const withCandidate = [
    ...allCards,
    { name: candidate.name, quantity: 1 },
  ];
  const extendedMap = { ...cardMap, [candidate.name]: candidate };
  const projectedAvgCmc = computeAvgCmc(withCandidate, extendedMap);

  return {
    currentAvgCmc,
    projectedAvgCmc,
    delta: projectedAvgCmc - currentAvgCmc,
  };
}

// ---------------------------------------------------------------------------
// computeManaBaseImpact
// ---------------------------------------------------------------------------

export function computeManaBaseImpact(
  candidate: EnrichedCard,
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaBaseImpact {
  const currentMetrics = computeManaBaseMetrics(deck, cardMap);
  const currentRatios = { ...currentMetrics.sourceToDemandRatio };

  // Build projected deck with candidate added to mainboard
  const projectedDeck: DeckData = {
    ...deck,
    mainboard: [...deck.mainboard, { name: candidate.name, quantity: 1 }],
  };
  const extendedMap = { ...cardMap, [candidate.name]: candidate };
  const projectedMetrics = computeManaBaseMetrics(projectedDeck, extendedMap);
  const projectedRatios = { ...projectedMetrics.sourceToDemandRatio };

  // Identify stressed colors: where projected ratio < threshold AND there is demand.
  // Skip for mono-color / colorless decks — stress is only meaningful when colors compete.
  const stressedColors: string[] = [];
  const identity = resolveCommanderIdentity(deck, cardMap);
  if (identity.size > 1) {
    for (const color of MTG_COLORS) {
      const ratio = projectedRatios[color];
      // Only flag colors that have demand (ratio is finite and < threshold)
      if (
        isFinite(ratio) &&
        ratio > 0 &&
        ratio < STRESSED_RATIO_THRESHOLD &&
        candidate.manaPips[color] > 0
      ) {
        stressedColors.push(color);
      }
    }
  }

  return { currentRatios, projectedRatios, stressedColors };
}

// ---------------------------------------------------------------------------
// findReplacementCandidates
// ---------------------------------------------------------------------------

export function findReplacementCandidates(
  candidate: EnrichedCard,
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  synergyAnalysis: DeckSynergyAnalysis
): ReplacementCandidate[] {
  const commanderNames = new Set(deck.commanders.map((c) => c.name));
  const candidateTags = getTagsCached(candidate);

  // Eligible: mainboard, non-commander, non-land
  const eligible = deck.mainboard.filter((card) => {
    if (commanderNames.has(card.name)) return false;
    const enriched = cardMap[card.name];
    if (!enriched) return false;
    if (isLand(enriched.typeLine)) return false;
    return true;
  });

  // Tier 1: cards sharing tags with the candidate
  const tier1: ReplacementCandidate[] = [];
  const tier1Names = new Set<string>();

  for (const card of eligible) {
    const enriched = cardMap[card.name]!;
    const cardTags = getTagsCached(enriched);
    const shared = candidateTags.filter((t) => cardTags.includes(t));

    if (shared.length === 0) continue;

    const score =
      synergyAnalysis.cardScores[card.name]?.score ?? 50;
    const tagLabel = shared.join(", ");

    tier1.push({
      cardName: card.name,
      reason: `Same role (${tagLabel})`,
      synergyScore: score,
      sharedTags: shared,
      cmcDifference: candidate.cmc - enriched.cmc,
      priceUsd: enriched.prices.usd,
    });
    tier1Names.add(card.name);
  }

  // Sort Tier 1: synergy ascending, then shared tag count descending
  tier1.sort((a, b) => {
    if (a.synergyScore !== b.synergyScore) {
      return a.synergyScore - b.synergyScore;
    }
    return b.sharedTags.length - a.sharedTags.length;
  });

  // Tier 2: backfill with weakest synergy cards not in Tier 1
  const tier2: ReplacementCandidate[] = [];

  if (tier1.length < MAX_REPLACEMENTS) {
    const remaining = eligible.filter((c) => !tier1Names.has(c.name));

    for (const card of remaining) {
      const enriched = cardMap[card.name]!;
      const score =
        synergyAnalysis.cardScores[card.name]?.score ?? 50;

      tier2.push({
        cardName: card.name,
        reason: "Lowest synergy in deck",
        synergyScore: score,
        sharedTags: [],
        cmcDifference: candidate.cmc - enriched.cmc,
        priceUsd: enriched.prices.usd,
      });
    }

    // Sort Tier 2 by synergy ascending
    tier2.sort((a, b) => a.synergyScore - b.synergyScore);
  }

  // Combine: Tier 1 first, then backfill from Tier 2
  const combined = [...tier1, ...tier2];
  return combined.slice(0, MAX_REPLACEMENTS);
}

// ---------------------------------------------------------------------------
// analyzeCandidateCard
// ---------------------------------------------------------------------------

export function analyzeCandidateCard(
  candidate: EnrichedCard,
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  synergyAnalysis: DeckSynergyAnalysis
): CandidateAnalysis {
  // Compute synergy score by running analysis with candidate included
  const augmentedDeck: DeckData = {
    ...deck,
    mainboard: [...deck.mainboard, { name: candidate.name, quantity: 1 }],
  };
  const augmentedMap = { ...cardMap, [candidate.name]: candidate };
  const augmentedAnalysis = analyzeDeckSynergy(augmentedDeck, augmentedMap, undefined, { reasoning: true });
  const cardScore = augmentedAnalysis.cardScores[candidate.name];

  const synergyScore = cardScore?.score ?? 50;
  const axes = cardScore?.axes ?? [];
  const pairs = cardScore?.pairs ?? [];

  // CMC impact
  const cmcImpact = computeCmcImpact(candidate, deck, cardMap);

  // Mana base impact
  const manaBaseImpact = computeManaBaseImpact(candidate, deck, cardMap);

  // Replacement candidates (using original synergy analysis, not augmented)
  const replacements = findReplacementCandidates(
    candidate,
    deck,
    cardMap,
    synergyAnalysis
  );

  // Tags
  const tags = getTagsCached(candidate);

  // Off-identity check
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  let offIdentityColors: string[] = [];
  if (commanderIdentity.size > 0) {
    offIdentityColors = candidate.colorIdentity.filter(
      (c) => !commanderIdentity.has(c as typeof MTG_COLORS[number])
    );
  }

  return {
    synergyScore,
    cmcImpact,
    manaBaseImpact,
    replacements,
    tags,
    axes,
    pairs,
    offIdentityColors,
  };
}
