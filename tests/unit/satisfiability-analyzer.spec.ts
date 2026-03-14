import { test, expect } from "@playwright/test";
import { analyzeSatisfiability, adjustInteractionStrengths } from "../../src/lib/interaction-engine/satisfiability-analyzer";
import type { Condition } from "../../src/lib/interaction-engine/types";
import type { EnrichedCard } from "../../src/lib/types";
import { makeCard } from "../helpers";

// ─── Card factories ──────────────────────────────────────────────

function makeCreature(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return makeCard({
    typeLine: "Creature — Human",
    ...overrides,
  });
}

function makeArtifact(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return makeCard({
    typeLine: "Artifact",
    ...overrides,
  });
}

function makeEnchantment(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return makeCard({
    typeLine: "Enchantment",
    ...overrides,
  });
}

function makeLand(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return makeCard({
    typeLine: "Land",
    ...overrides,
  });
}

function makeDesertLand(name = "Desert"): EnrichedCard {
  return makeCard({
    name,
    typeLine: "Land — Desert",
    subtypes: ["Desert"],
  });
}

/** Build a deck of N creatures and filler non-creature cards. */
function makeDeckWithCreatures(
  creatureCount: number,
  totalCards = 99
): EnrichedCard[] {
  const deck: EnrichedCard[] = [];
  for (let i = 0; i < creatureCount; i++) {
    deck.push(makeCreature({ name: `Creature ${i}` }));
  }
  // Fill the rest with non-creature cards (instants)
  for (let i = creatureCount; i < totalCards; i++) {
    deck.push(
      makeCard({
        name: `Instant ${i}`,
        typeLine: "Instant",
      })
    );
  }
  return deck;
}

// ─── Condition builders ─────────────────────────────────────────

function makeCondition(structured: NonNullable<Condition["structured"]>): Condition {
  return {
    type: "if",
    predicate: "test predicate",
    structured,
  };
}

// ═══════════════════════════════════════════════════════════════════
// creature_count checks
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — creature_count", () => {
  test("high creature deck (30/99) with count=5 → score near 1.0", () => {
    const deck = makeDeckWithCreatures(30, 99);
    const condition = makeCondition({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.check).toBe("creature_count");
    expect(result.score).toBeGreaterThanOrEqual(0.9);
    expect(result.satisfiable).toBe("yes");
  });

  test("low creature deck (5/99) with count=5 → partial score (~0.5)", () => {
    const deck = makeDeckWithCreatures(5, 99);
    const condition = makeCondition({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.check).toBe("creature_count");
    // Should be between floor (0.3) and high (≥0.9)
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.score).toBeLessThan(0.9);
  });

  test("zero creature deck with count=5 → score at floor (0.3)", () => {
    const deck = makeDeckWithCreatures(0, 99);
    const condition = makeCondition({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.check).toBe("creature_count");
    expect(result.score).toBe(0.3);
    expect(result.satisfiable).toBe("no");
  });

  test("deck with exactly 15 creatures and count=5 → score 1.0 (15 = 5*3)", () => {
    const deck = makeDeckWithCreatures(15, 99);
    const condition = makeCondition({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// artifact_count checks
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — artifact_count", () => {
  test("deck with 12 artifacts and count=4 → score 1.0", () => {
    const deck: EnrichedCard[] = [];
    for (let i = 0; i < 12; i++) {
      deck.push(makeArtifact({ name: `Artifact ${i}` }));
    }
    for (let i = 12; i < 99; i++) {
      deck.push(makeCard({ name: `Filler ${i}`, typeLine: "Sorcery" }));
    }
    const condition = makeCondition({
      check: "artifact_count",
      count: 4,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(1.0);
  });

  test("deck with 0 artifacts and count=1 → score at floor", () => {
    const deck = makeDeckWithCreatures(30, 99); // all creatures, no artifacts
    const condition = makeCondition({
      check: "artifact_count",
      count: 1,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(0.3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// devotion checks
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — devotion", () => {
  test("deck with many black pips and devotion B ≥ 5 → high score", () => {
    // Each creature has 2 black pips; 15 creatures = 30 pips total; need 5
    const deck: EnrichedCard[] = [];
    for (let i = 0; i < 15; i++) {
      deck.push(
        makeCreature({
          name: `Black Creature ${i}`,
          manaPips: { W: 0, U: 0, B: 2, R: 0, G: 0, C: 0 },
        })
      );
    }
    for (let i = 15; i < 99; i++) {
      deck.push(makeCard({ name: `Filler ${i}`, typeLine: "Land" }));
    }

    const condition = makeCondition({
      check: "devotion",
      devotionColors: ["B"],
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(1.0);
    expect(result.satisfiable).toBe("yes");
  });

  test("deck with no black pips and devotion B ≥ 5 → low score", () => {
    // All white pips, no black
    const deck: EnrichedCard[] = [];
    for (let i = 0; i < 30; i++) {
      deck.push(
        makeCreature({
          name: `White Creature ${i}`,
          manaPips: { W: 2, U: 0, B: 0, R: 0, G: 0, C: 0 },
        })
      );
    }
    for (let i = 30; i < 99; i++) {
      deck.push(makeCard({ name: `Filler ${i}`, typeLine: "Land" }));
    }

    const condition = makeCondition({
      check: "devotion",
      devotionColors: ["B"],
      count: 5,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(0.3);
    expect(result.satisfiable).toBe("no");
  });
});

// ═══════════════════════════════════════════════════════════════════
// graveyard_card_types (delirium)
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — graveyard_card_types", () => {
  test("deck with 5 distinct card types → high score for delirium ≥ 4", () => {
    const deck: EnrichedCard[] = [
      makeCreature({ name: "Creature A" }),
      makeArtifact({ name: "Artifact A" }),
      makeEnchantment({ name: "Enchantment A" }),
      makeLand({ name: "Land A" }),
      makeCard({ name: "Instant A", typeLine: "Instant" }),
      makeCard({ name: "Sorcery A", typeLine: "Sorcery" }),
    ];
    // Fill rest
    for (let i = 6; i < 99; i++) {
      deck.push(makeCreature({ name: `Creature ${i}` }));
    }

    const condition = makeCondition({
      check: "graveyard_card_types",
      count: 4,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.satisfiable).toBe("yes");
  });

  test("single-type deck (all creatures) → low score for delirium ≥ 4", () => {
    const deck = makeDeckWithCreatures(99, 99);
    const condition = makeCondition({
      check: "graveyard_card_types",
      count: 4,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    // Only 1 type in deck, needs 4 → low score
    expect(result.score).toBeLessThan(0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════
// graveyard_size (threshold)
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — graveyard_size", () => {
  test("deck with self-mill cards → partial/yes for threshold", () => {
    const deck: EnrichedCard[] = [
      makeCard({
        name: "Mesmeric Orb",
        typeLine: "Artifact",
        oracleText: "Whenever a permanent becomes untapped, that permanent's controller mills a card.",
      }),
      makeCard({
        name: "Traumatize",
        typeLine: "Sorcery",
        oracleText: "Target player mills half their library, rounded down.",
      }),
    ];
    for (let i = 2; i < 99; i++) {
      deck.push(makeCreature({ name: `Creature ${i}` }));
    }
    const condition = makeCondition({
      check: "graveyard_size",
      count: 7,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    // Self-mill support → at least partial
    expect(result.score).toBeGreaterThan(0.3);
  });

  test("deck with no self-mill → lower score for graveyard_size", () => {
    const deck = makeDeckWithCreatures(30, 99);
    const condition = makeCondition({
      check: "graveyard_size",
      count: 7,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    // No graveyard support → low score
    expect(result.score).toBeLessThanOrEqual(0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════
// life_total checks
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — life_total", () => {
  test("deck with many lifegain cards → higher score for 40+ life", () => {
    const deck: EnrichedCard[] = [];
    for (let i = 0; i < 20; i++) {
      deck.push(
        makeCard({
          name: `Lifegain ${i}`,
          typeLine: "Sorcery",
          oracleText: "You gain 3 life.",
        })
      );
    }
    for (let i = 20; i < 99; i++) {
      deck.push(makeCreature({ name: `Creature ${i}` }));
    }
    const condition = makeCondition({
      check: "life_total",
      count: 40,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBeGreaterThan(0.5);
  });

  test("deck with no lifegain → lower score for 40+ life", () => {
    const deck = makeDeckWithCreatures(40, 99);
    const condition = makeCondition({
      check: "life_total",
      count: 40,
      comparison: "greater_equal",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBeLessThanOrEqual(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// land_subtype checks
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — land_subtype", () => {
  test("deck with Desert lands → high score for land_subtype Desert", () => {
    const deck: EnrichedCard[] = [
      makeDesertLand("Desert A"),
      makeDesertLand("Desert B"),
      makeDesertLand("Desert C"),
    ];
    for (let i = 3; i < 99; i++) {
      deck.push(makeCreature({ name: `Creature ${i}` }));
    }
    const condition = makeCondition({
      check: "land_subtype",
      subtypeRequired: "Desert",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.satisfiable).toBe("yes");
  });

  test("deck with no Desert lands → low score", () => {
    const deck = makeDeckWithCreatures(30, 99);
    const condition = makeCondition({
      check: "land_subtype",
      subtypeRequired: "Desert",
    });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.score).toBe(0.3);
    expect(result.satisfiable).toBe("no");
  });
});

// ═══════════════════════════════════════════════════════════════════
// runtime — no penalty
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — runtime", () => {
  test("runtime check → score 1.0, unknown satisfiability", () => {
    const deck = makeDeckWithCreatures(10, 99);
    const condition = makeCondition({ check: "runtime" });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.check).toBe("runtime");
    expect(result.score).toBe(1.0);
    expect(result.satisfiable).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// unknown — no penalty
// ═══════════════════════════════════════════════════════════════════

test.describe("analyzeSatisfiability — unknown", () => {
  test("unknown check → score 1.0, unknown satisfiability", () => {
    const deck = makeDeckWithCreatures(10, 99);
    const condition = makeCondition({ check: "unknown" });
    const result = analyzeSatisfiability(condition, deck);
    expect(result.check).toBe("unknown");
    expect(result.score).toBe(1.0);
    expect(result.satisfiable).toBe("unknown");
  });

  test("no structured field → score 1.0", () => {
    const condition: Condition = {
      type: "if",
      predicate: "some text",
    };
    const result = analyzeSatisfiability(condition, []);
    expect(result.score).toBe(1.0);
    expect(result.satisfiable).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════
// adjustInteractionStrengths integration
// ═══════════════════════════════════════════════════════════════════

test.describe("adjustInteractionStrengths", () => {
  test("creature-heavy deck preserves high strength for creature_count condition", () => {
    const deck = makeDeckWithCreatures(30, 99);

    // Import types needed
    type CardProfile = import("../../src/lib/interaction-engine/types").CardProfile;
    type Interaction = import("../../src/lib/interaction-engine/types").Interaction;

    const condition: Condition = {
      type: "if",
      predicate: "you control five or more creatures",
      structured: {
        check: "creature_count",
        count: 5,
        comparison: "greater_equal",
      },
    };

    const mockProfiles: Record<string, CardProfile> = {
      "Card A": {
        cardName: "Card A",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [condition],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
      "Card B": {
        cardName: "Card B",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
    };

    const interactions: Interaction[] = [
      {
        cards: ["Card A", "Card B"],
        type: "enables",
        strength: 0.8,
        mechanical: "Card A enables Card B when you control 5+ creatures",
        events: [],
      },
    ];

    const adjusted = adjustInteractionStrengths(interactions, mockProfiles, deck);
    // Creature-heavy deck → condition likely satisfied → strength preserved
    expect(adjusted[0].strength).toBeGreaterThanOrEqual(0.7);
  });

  test("spell-heavy deck reduces strength for creature_count condition", () => {
    // 0 creatures, all instants/sorceries
    const deck = makeDeckWithCreatures(0, 99);

    type CardProfile = import("../../src/lib/interaction-engine/types").CardProfile;
    type Interaction = import("../../src/lib/interaction-engine/types").Interaction;

    const condition: Condition = {
      type: "if",
      predicate: "you control five or more creatures",
      structured: {
        check: "creature_count",
        count: 5,
        comparison: "greater_equal",
      },
    };

    const mockProfiles: Record<string, CardProfile> = {
      "Card A": {
        cardName: "Card A",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [condition],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
      "Card B": {
        cardName: "Card B",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
    };

    const interactions: Interaction[] = [
      {
        cards: ["Card A", "Card B"],
        type: "enables",
        strength: 0.8,
        mechanical: "Card A enables Card B when you control 5+ creatures",
        events: [],
      },
    ];

    const adjusted = adjustInteractionStrengths(interactions, mockProfiles, deck);
    // Spell-heavy deck → condition very unlikely → strength reduced
    expect(adjusted[0].strength).toBeLessThan(0.5);
  });

  test("interaction with no conditions is unchanged", () => {
    const deck = makeDeckWithCreatures(10, 99);

    type CardProfile = import("../../src/lib/interaction-engine/types").CardProfile;
    type Interaction = import("../../src/lib/interaction-engine/types").Interaction;

    const mockProfiles: Record<string, CardProfile> = {
      "Card A": {
        cardName: "Card A",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
      "Card B": {
        cardName: "Card B",
        cardTypes: [],
        supertypes: [],
        subtypes: [],
        abilities: [],
        layout: "normal",
        produces: [],
        consumes: [],
        triggersOn: [],
        causesEvents: [],
        grants: [],
        replacements: [],
        linkedEffects: [],
        requires: [],
        staticEffects: [],
        restrictions: [],
        copies: [],
        zoneCastPermissions: [],
        speeds: [],
        zoneAbilities: [],
        designations: [],
        typeChanges: [],
        winConditions: [],
        costSubstitutions: [],
        extraTurns: [],
        playerControl: [],
      },
    };

    const interactions: Interaction[] = [
      {
        cards: ["Card A", "Card B"],
        type: "enables",
        strength: 0.8,
        mechanical: "Card A enables Card B unconditionally",
        events: [],
      },
    ];

    const adjusted = adjustInteractionStrengths(interactions, mockProfiles, deck);
    expect(adjusted[0].strength).toBe(0.8);
  });
});
