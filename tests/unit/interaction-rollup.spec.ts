/**
 * Interaction Rollup Unit Tests
 *
 * Tests cover: rollUpInteractions() grouping algorithm, summary text
 * generation, threshold enforcement, bidirectional grouping, greedy
 * assignment, and sorting.
 */

import { test, expect } from "@playwright/test";
import type {
  Interaction,
  InteractionType,
  CardProfile,
} from "../../src/lib/interaction-engine/types";
import {
  rollUpInteractions,
  classifyTargets,
  type RolledUpGroup,
  type IndividualInteraction,
} from "../../src/lib/interaction-rollup";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function makeInteraction(
  source: string,
  target: string,
  type: InteractionType = "recurs",
  strength = 0.8
): Interaction {
  return {
    cards: [source, target],
    type,
    strength,
    mechanical: `${source} interacts with ${target}`,
    events: [],
  };
}

function makeProfile(
  name: string,
  cardTypes: string[] = ["creature"],
  subtypes: string[] = []
): CardProfile {
  return {
    cardName: name,
    cardTypes,
    subtypes,
    supertypes: [],
    abilities: [],
    produces: [],
    consumes: [],
    triggersOn: [],
    causesEvents: [],
    grants: [],
    replacements: [],
    exiles: [],
    staticEffects: [],
    restrictions: [],
    keywords: [],
  } as unknown as CardProfile;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("rollup threshold", () => {
  test("2 interactions with same anchor — no rollup (below threshold)", () => {
    const interactions = [
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell A", "Creature 2"),
    ];
    const result = rollUpInteractions(interactions, {});

    // All should be individual
    expect(result.every((r) => r.kind === "individual")).toBe(true);
    expect(result.length).toBe(2);
  });

  test("3+ interactions with same anchor + type → produces 1 rollup group", () => {
    const interactions = [
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell A", "Creature 2"),
      makeInteraction("Spell A", "Creature 3"),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
    };
    const result = rollUpInteractions(interactions, profiles);

    const rollups = result.filter((r) => r.kind === "rollup") as RolledUpGroup[];
    expect(rollups.length).toBe(1);
    expect(rollups[0].anchorCard).toBe("Spell A");
    expect(rollups[0].interactions.length).toBe(3);
    expect(rollups[0].targetCards).toContain("Creature 1");
    expect(rollups[0].targetCards).toContain("Creature 2");
    expect(rollups[0].targetCards).toContain("Creature 3");
  });

  test("empty interactions returns empty array", () => {
    expect(rollUpInteractions([], {}).length).toBe(0);
  });
});

test.describe("bidirectional grouping", () => {
  test("picks source direction when source has more interactions", () => {
    // Spell A recurs 4 creatures (source-anchored)
    const interactions = [
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell A", "Creature 2"),
      makeInteraction("Spell A", "Creature 3"),
      makeInteraction("Spell A", "Creature 4"),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
      "Creature 4": makeProfile("Creature 4"),
    };
    const result = rollUpInteractions(interactions, profiles);
    const rollup = result.find((r) => r.kind === "rollup") as RolledUpGroup;

    expect(rollup).toBeDefined();
    expect(rollup.anchorRole).toBe("source");
    expect(rollup.anchorCard).toBe("Spell A");
  });

  test("picks target direction when target has more interactions", () => {
    // 4 different spells all recur Creature A (target-anchored)
    const interactions = [
      makeInteraction("Spell 1", "Creature A"),
      makeInteraction("Spell 2", "Creature A"),
      makeInteraction("Spell 3", "Creature A"),
      makeInteraction("Spell 4", "Creature A"),
    ];
    const profiles: Record<string, CardProfile> = {};
    const result = rollUpInteractions(interactions, profiles);
    const rollup = result.find((r) => r.kind === "rollup") as RolledUpGroup;

    expect(rollup).toBeDefined();
    expect(rollup.anchorRole).toBe("target");
    expect(rollup.anchorCard).toBe("Creature A");
  });
});

test.describe("greedy assignment", () => {
  test("interaction consumed by one group does not appear in another", () => {
    // Spell A recurs 4 creatures, Spell B recurs 3 of the same creatures
    const interactions = [
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell A", "Creature 2"),
      makeInteraction("Spell A", "Creature 3"),
      makeInteraction("Spell A", "Creature 4"),
      makeInteraction("Spell B", "Creature 1"),
      makeInteraction("Spell B", "Creature 2"),
      makeInteraction("Spell B", "Creature 3"),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
      "Creature 4": makeProfile("Creature 4"),
    };
    const result = rollUpInteractions(interactions, profiles);

    // Total items displayed should account for all 7 interactions
    let totalCounted = 0;
    for (const item of result) {
      if (item.kind === "rollup") totalCounted += item.interactions.length;
      else totalCounted += 1;
    }
    expect(totalCounted).toBe(7);

    // No interaction should appear in two rollup groups
    const allRolledUpInteractions: Interaction[] = [];
    for (const item of result) {
      if (item.kind === "rollup") allRolledUpInteractions.push(...item.interactions);
    }
    const uniqueSet = new Set(allRolledUpInteractions);
    expect(uniqueSet.size).toBe(allRolledUpInteractions.length);
  });
});

test.describe("summary text generation", () => {
  test("all creatures → 'creatures'", () => {
    const profiles: Record<string, CardProfile> = {
      "Creature A": makeProfile("Creature A", ["creature"]),
      "Creature B": makeProfile("Creature B", ["creature"]),
      "Creature C": makeProfile("Creature C", ["creature"]),
    };
    const noun = classifyTargets(
      ["Creature A", "Creature B", "Creature C"],
      profiles
    );
    expect(noun).toBe("creatures");
  });

  test("all Slivers (≥80% subtype) → 'Slivers'", () => {
    const profiles: Record<string, CardProfile> = {
      "Sliver A": makeProfile("Sliver A", ["creature"], ["Sliver"]),
      "Sliver B": makeProfile("Sliver B", ["creature"], ["Sliver"]),
      "Sliver C": makeProfile("Sliver C", ["creature"], ["Sliver"]),
    };
    const noun = classifyTargets(
      ["Sliver A", "Sliver B", "Sliver C"],
      profiles
    );
    expect(noun).toBe("Slivers");
  });

  test("mixed types → 'cards'", () => {
    const profiles: Record<string, CardProfile> = {
      "Card A": makeProfile("Card A", ["creature"]),
      "Card B": makeProfile("Card B", ["instant"]),
      "Card C": makeProfile("Card C", ["sorcery"]),
    };
    const noun = classifyTargets(
      ["Card A", "Card B", "Card C"],
      profiles
    );
    expect(noun).toBe("cards");
  });

  test("all permanents (mixed types) → 'permanents'", () => {
    const profiles: Record<string, CardProfile> = {
      "Card A": makeProfile("Card A", ["creature"]),
      "Card B": makeProfile("Card B", ["artifact"]),
      "Card C": makeProfile("Card C", ["enchantment"]),
    };
    const noun = classifyTargets(
      ["Card A", "Card B", "Card C"],
      profiles
    );
    expect(noun).toBe("permanents");
  });

  test("unknown profiles → 'cards'", () => {
    const noun = classifyTargets(["Unknown A", "Unknown B"], {});
    expect(noun).toBe("cards");
  });
});

test.describe("strength computation", () => {
  test("maxStrength and avgStrength computed correctly", () => {
    const interactions = [
      makeInteraction("Spell A", "Creature 1", "recurs", 0.9),
      makeInteraction("Spell A", "Creature 2", "recurs", 0.7),
      makeInteraction("Spell A", "Creature 3", "recurs", 0.8),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
    };
    const result = rollUpInteractions(interactions, profiles);
    const rollup = result.find((r) => r.kind === "rollup") as RolledUpGroup;

    expect(rollup.maxStrength).toBe(0.9);
    expect(rollup.avgStrength).toBeCloseTo(0.8, 1);
  });
});

test.describe("sorting order", () => {
  test("rollup entries appear before individual entries", () => {
    const interactions = [
      // 3 that should roll up
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell A", "Creature 2"),
      makeInteraction("Spell A", "Creature 3"),
      // 1 individual
      makeInteraction("Spell B", "Creature 4"),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
    };
    const result = rollUpInteractions(interactions, profiles);

    expect(result[0].kind).toBe("rollup");
    expect(result[result.length - 1].kind).toBe("individual");
  });

  test("individual interactions not in any group remain as individual entries", () => {
    const interactions = [
      makeInteraction("Spell A", "Creature 1"),
      makeInteraction("Spell B", "Creature 2"),
    ];
    const result = rollUpInteractions(interactions, {});

    expect(result.length).toBe(2);
    expect(result.every((r) => r.kind === "individual")).toBe(true);
  });
});

test.describe("summary text format", () => {
  test("source-anchored rollup uses source verb", () => {
    const interactions = [
      makeInteraction("No One Left Behind", "Creature 1", "recurs"),
      makeInteraction("No One Left Behind", "Creature 2", "recurs"),
      makeInteraction("No One Left Behind", "Creature 3", "recurs"),
    ];
    const profiles: Record<string, CardProfile> = {
      "Creature 1": makeProfile("Creature 1"),
      "Creature 2": makeProfile("Creature 2"),
      "Creature 3": makeProfile("Creature 3"),
    };
    const result = rollUpInteractions(interactions, profiles);
    const rollup = result.find((r) => r.kind === "rollup") as RolledUpGroup;

    expect(rollup.summaryText).toBe(
      "No One Left Behind recurs 3 creatures"
    );
  });
});
