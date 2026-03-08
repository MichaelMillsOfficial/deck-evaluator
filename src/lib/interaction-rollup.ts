/**
 * Interaction Rollup — groups repetitive interactions into rolled-up entries.
 *
 * When one card has the same interaction type with many others (e.g., a
 * recursion spell that can recur every creature), this module compacts
 * N individual interactions into a single rolled-up group with an
 * expandable target list.
 *
 * This is purely a display concern — the interaction detector continues
 * producing individual Interaction[] entries for chains/loops/enablers.
 */

import type {
  Interaction,
  InteractionType,
  CardProfile,
} from "@/lib/interaction-engine/types";
import { PERMANENT_TYPES } from "@/lib/interaction-engine/game-model";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RolledUpGroup {
  kind: "rollup";
  /** The card that appears in every interaction of this group */
  anchorCard: string;
  /** Whether the anchor is cards[0] (source) or cards[1] (target) */
  anchorRole: "source" | "target";
  /** Interaction type shared by all grouped interactions */
  type: InteractionType;
  /** The individual interactions in this group */
  interactions: Interaction[];
  /** The "other" cards (not the anchor) */
  targetCards: string[];
  /** Human-readable summary, e.g. "No One Left Behind recurs 15 creatures" */
  summaryText: string;
  /** The classified noun, e.g. "creatures", "Slivers", "cards" */
  targetNoun: string;
  /** Highest strength in the group */
  maxStrength: number;
  /** Average strength across the group */
  avgStrength: number;
}

export interface IndividualInteraction {
  kind: "individual";
  interaction: Interaction;
}

export type DisplayInteractionItem = RolledUpGroup | IndividualInteraction;

// ═══════════════════════════════════════════════════════════════
// VERB MAP
// ═══════════════════════════════════════════════════════════════

export const INTERACTION_VERBS: Record<
  string,
  { sourceVerb: string; targetVerb: string }
> = {
  enables: { sourceVerb: "enables", targetVerb: "is enabled by" },
  triggers: { sourceVerb: "triggers", targetVerb: "is triggered by" },
  amplifies: { sourceVerb: "amplifies", targetVerb: "is amplified by" },
  protects: { sourceVerb: "protects", targetVerb: "is protected by" },
  recurs: { sourceVerb: "recurs", targetVerb: "is recurred by" },
  reduces_cost: {
    sourceVerb: "reduces cost of",
    targetVerb: "has cost reduced by",
  },
  tutors_for: { sourceVerb: "tutors for", targetVerb: "is tutored by" },
  blocks: { sourceVerb: "blocks", targetVerb: "is blocked by" },
  conflicts: { sourceVerb: "conflicts with", targetVerb: "conflicts with" },
  loops_with: { sourceVerb: "loops with", targetVerb: "loops with" },
};

// ═══════════════════════════════════════════════════════════════
// ROLLUP ALGORITHM
// ═══════════════════════════════════════════════════════════════

const ROLLUP_THRESHOLD = 3;

/**
 * Group repetitive interactions into rolled-up entries.
 *
 * Algorithm:
 * 1. For each interaction, compute two candidate group keys:
 *    source-anchored (cards[0] + type) and target-anchored (cards[1] + type)
 * 2. Find all candidate groups with >= ROLLUP_THRESHOLD interactions
 * 3. Process candidates largest-first (greedy); mark consumed interactions
 * 4. Remaining interactions become IndividualInteraction entries
 * 5. Sort: rollups first (by count desc), then individuals (by strength desc)
 */
export function rollUpInteractions(
  interactions: Interaction[],
  profiles: Record<string, CardProfile>
): DisplayInteractionItem[] {
  if (interactions.length === 0) return [];

  // Step 1: Build candidate groups in both directions
  const sourceGroups = new Map<string, Interaction[]>();
  const targetGroups = new Map<string, Interaction[]>();

  for (const inter of interactions) {
    const sourceKey = `source:${inter.type}:${inter.cards[0]}`;
    const targetKey = `target:${inter.type}:${inter.cards[1]}`;

    if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
    sourceGroups.get(sourceKey)!.push(inter);

    if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
    targetGroups.get(targetKey)!.push(inter);
  }

  // Step 2: Collect all candidates above threshold
  interface Candidate {
    key: string;
    anchorCard: string;
    anchorRole: "source" | "target";
    type: InteractionType;
    interactions: Interaction[];
  }

  const candidates: Candidate[] = [];

  for (const [key, ints] of sourceGroups) {
    if (ints.length >= ROLLUP_THRESHOLD) {
      const [, type, ...nameParts] = key.split(":");
      candidates.push({
        key,
        anchorCard: nameParts.join(":"), // handle card names with colons
        anchorRole: "source",
        type: type as InteractionType,
        interactions: ints,
      });
    }
  }

  for (const [key, ints] of targetGroups) {
    if (ints.length >= ROLLUP_THRESHOLD) {
      const [, type, ...nameParts] = key.split(":");
      candidates.push({
        key,
        anchorCard: nameParts.join(":"),
        anchorRole: "target",
        type: type as InteractionType,
        interactions: ints,
      });
    }
  }

  // Sort candidates by size (descending) for greedy assignment
  candidates.sort((a, b) => b.interactions.length - a.interactions.length);

  // Step 3: Greedy assignment — each interaction consumed by at most one rollup
  const consumed = new Set<Interaction>();
  const rollups: RolledUpGroup[] = [];

  for (const candidate of candidates) {
    // Filter out already-consumed interactions
    const available = candidate.interactions.filter((i) => !consumed.has(i));
    if (available.length < ROLLUP_THRESHOLD) continue;

    // Consume these interactions
    for (const inter of available) {
      consumed.add(inter);
    }

    // Build the rollup — sort first so targetCards stays in sync
    const sorted = [...available].sort((a, b) => b.strength - a.strength);
    const targetCards = sorted.map((inter) =>
      candidate.anchorRole === "source" ? inter.cards[1] : inter.cards[0]
    );
    const maxStrength = sorted.reduce((max, i) => Math.max(max, i.strength), 0);
    const avgStrength = sorted.reduce((sum, i) => sum + i.strength, 0) / sorted.length;
    const targetNoun = classifyTargets(targetCards, profiles);
    const verb =
      candidate.anchorRole === "source"
        ? INTERACTION_VERBS[candidate.type]?.sourceVerb ?? candidate.type
        : INTERACTION_VERBS[candidate.type]?.targetVerb ?? candidate.type;
    const summaryText = `${candidate.anchorCard} ${verb} ${sorted.length} ${targetNoun}`;

    rollups.push({
      kind: "rollup",
      anchorCard: candidate.anchorCard,
      anchorRole: candidate.anchorRole,
      type: candidate.type,
      interactions: sorted,
      targetCards,
      summaryText,
      targetNoun,
      maxStrength,
      avgStrength,
    });
  }

  // Step 4: Remaining interactions become individual entries
  const individuals: IndividualInteraction[] = interactions
    .filter((i) => !consumed.has(i))
    .sort((a, b) => b.strength - a.strength)
    .map((interaction) => ({ kind: "individual" as const, interaction }));

  // Step 5: Rollups first (by count desc), then individuals
  const result: DisplayInteractionItem[] = [
    ...rollups.sort((a, b) => b.interactions.length - a.interactions.length),
    ...individuals,
  ];

  return result;
}

// ═══════════════════════════════════════════════════════════════
// TARGET CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Classify what a group of target cards are: "creatures", "Slivers",
 * "permanents", "cards", etc.
 */
export function classifyTargets(
  targetCards: string[],
  profiles: Record<string, CardProfile>
): string {
  const targetProfiles = targetCards
    .map((name) => profiles[name])
    .filter(Boolean);

  if (targetProfiles.length === 0) return "cards";

  // Check for dominant shared subtype (tribal decks)
  const subtypeCounts: Record<string, number> = {};
  for (const p of targetProfiles) {
    if (p.subtypes) {
      for (const st of p.subtypes) {
        subtypeCounts[st] = (subtypeCounts[st] || 0) + 1;
      }
    }
  }
  const sortedSubtypes = Object.entries(subtypeCounts).sort(
    ([, a], [, b]) => b - a
  );
  if (
    sortedSubtypes.length > 0 &&
    sortedSubtypes[0][1] >= targetProfiles.length * 0.8
  ) {
    return pluralize(sortedSubtypes[0][0]);
  }

  // Check if all share a single card type
  const allCreatures = targetProfiles.every((p) =>
    p.cardTypes.includes("creature")
  );
  if (allCreatures) return "creatures";

  const allArtifacts = targetProfiles.every((p) =>
    p.cardTypes.includes("artifact")
  );
  if (allArtifacts) return "artifacts";

  const allEnchantments = targetProfiles.every((p) =>
    p.cardTypes.includes("enchantment")
  );
  if (allEnchantments) return "enchantments";

  const allLands = targetProfiles.every((p) => p.cardTypes.includes("land"));
  if (allLands) return "lands";

  // Check if all are permanents
  const allPermanent = targetProfiles.every((p) =>
    p.cardTypes.some((t) =>
      (PERMANENT_TYPES as readonly string[]).includes(t)
    )
  );
  if (allPermanent) return "permanents";

  return "cards";
}

/**
 * Simple English pluralization for common MTG type nouns.
 */
function pluralize(noun: string): string {
  if (!noun) return "cards";
  const lower = noun.toLowerCase();
  // Already plural
  if (lower.endsWith("s")) return noun;
  // Irregular
  if (lower === "elf") return "Elves";
  if (lower === "dwarf") return "Dwarves";
  if (lower === "wolf") return "Wolves";
  if (lower === "sphinx") return "Sphinxes";
  // Standard
  if (
    lower.endsWith("ch") ||
    lower.endsWith("sh") ||
    lower.endsWith("x") ||
    lower.endsWith("z")
  ) {
    return noun + "es";
  }
  return noun + "s";
}
