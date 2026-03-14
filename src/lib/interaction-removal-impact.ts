/**
 * Interaction Removal Impact
 *
 * Computes the impact of removing a specific card from the deck by
 * examining which interactions, chains, and loops would be disrupted.
 *
 * Uses pre-built index maps for O(1) lookups so that computing impacts
 * for all cards in a deck runs in O(I + C + L + B + n) time.
 */

import type {
  InteractionAnalysis,
  Interaction,
  InteractionChain,
  InteractionLoop,
  RemovalImpact,
} from "@/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// INDEX STRUCTURES
// ═══════════════════════════════════════════════════════════════

interface RemovalIndex {
  /** interactions keyed by card name (card is source or target) */
  interactionsByCard: Map<string, Interaction[]>;
  /** interactions that would be unblocked if blocker card is removed */
  unblockedByBlocker: Map<string, Interaction[]>;
  /** chains keyed by card name */
  chainsByCard: Map<string, InteractionChain[]>;
  /** loops keyed by card name */
  loopsByCard: Map<string, InteractionLoop[]>;
}

function buildRemovalIndex(analysis: InteractionAnalysis): RemovalIndex {
  const interactionsByCard = new Map<string, Interaction[]>();
  const unblockedByBlocker = new Map<string, Interaction[]>();
  const chainsByCard = new Map<string, InteractionChain[]>();
  const loopsByCard = new Map<string, InteractionLoop[]>();

  // Index interactions by participant cards
  for (const interaction of analysis.interactions) {
    for (const cardName of interaction.cards) {
      if (!interactionsByCard.has(cardName)) {
        interactionsByCard.set(cardName, []);
      }
      interactionsByCard.get(cardName)!.push(interaction);
    }
  }

  // Index blocked interactions by blocker card
  for (const blocker of analysis.blockers) {
    if (!unblockedByBlocker.has(blocker.blocker)) {
      unblockedByBlocker.set(blocker.blocker, []);
    }
    for (const blockedInteraction of blocker.blockedInteractions) {
      unblockedByBlocker.get(blocker.blocker)!.push(blockedInteraction);
    }
  }

  // Index chains by participant cards
  for (const chain of analysis.chains) {
    for (const cardName of chain.cards) {
      if (!chainsByCard.has(cardName)) {
        chainsByCard.set(cardName, []);
      }
      chainsByCard.get(cardName)!.push(chain);
    }
  }

  // Index loops by participant cards
  for (const loop of analysis.loops) {
    for (const cardName of loop.cards) {
      if (!loopsByCard.has(cardName)) {
        loopsByCard.set(cardName, []);
      }
      loopsByCard.get(cardName)!.push(loop);
    }
  }

  return { interactionsByCard, unblockedByBlocker, chainsByCard, loopsByCard };
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the impact of removing a single card from the deck.
 *
 * **Performance note:** This rebuilds the full index on every call (O(I+C+L+B)).
 * For computing impacts for multiple cards, use `computeAllRemovalImpacts` instead,
 * which builds the index once and reuses it.
 *
 * @param cardName  The card being removed
 * @param analysis  Full interaction analysis result
 */
export function computeRemovalImpact(
  cardName: string,
  analysis: InteractionAnalysis
): RemovalImpact {
  const index = buildRemovalIndex(analysis);
  return computeRemovalImpactFromIndex(cardName, index);
}

/**
 * Pre-compute removal impacts for every card in the analysis.
 * Uses a single shared index for efficiency.
 *
 * @param analysis  Full interaction analysis result
 * @returns Map from card name to RemovalImpact
 */
export function computeAllRemovalImpacts(
  analysis: InteractionAnalysis
): Map<string, RemovalImpact> {
  const index = buildRemovalIndex(analysis);
  const result = new Map<string, RemovalImpact>();

  for (const cardName of Object.keys(analysis.profiles)) {
    result.set(cardName, computeRemovalImpactFromIndex(cardName, index));
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL
// ═══════════════════════════════════════════════════════════════

function computeRemovalImpactFromIndex(
  cardName: string,
  index: RemovalIndex
): RemovalImpact {
  const interactionsLost = index.interactionsByCard.get(cardName) ?? [];
  const interactionsUnblocked = index.unblockedByBlocker.get(cardName) ?? [];
  const chainsDisrupted = index.chainsByCard.get(cardName) ?? [];
  const loopsDisrupted = index.loopsByCard.get(cardName) ?? [];

  const description = buildDescription(
    cardName,
    interactionsLost,
    chainsDisrupted,
    loopsDisrupted
  );

  return {
    removedCard: cardName,
    interactionsLost,
    interactionsUnblocked,
    chainsDisrupted,
    loopsDisrupted,
    description,
  };
}

function buildDescription(
  cardName: string,
  interactionsLost: Interaction[],
  chainsDisrupted: InteractionChain[],
  loopsDisrupted: InteractionLoop[]
): string {
  if (
    interactionsLost.length === 0 &&
    chainsDisrupted.length === 0 &&
    loopsDisrupted.length === 0
  ) {
    return `Removing ${cardName} loses no interactions.`;
  }

  const parts: string[] = [];

  if (interactionsLost.length > 0) {
    const n = interactionsLost.length;
    parts.push(`${n} interaction${n !== 1 ? "s" : ""}`);
  }

  if (chainsDisrupted.length > 0) {
    const n = chainsDisrupted.length;
    parts.push(`${n} chain${n !== 1 ? "s" : ""}`);
  }

  if (loopsDisrupted.length > 0) {
    const n = loopsDisrupted.length;
    parts.push(`${n} loop${n !== 1 ? "s" : ""}`);
  }

  return `Removing ${cardName} disrupts ${parts.join(", ")}.`;
}
