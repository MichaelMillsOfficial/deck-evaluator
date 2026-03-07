import { test, expect } from "@playwright/test";
import {
  isPermanentType,
  isSpellType,
  matchesCompositeType,
  PERMANENT_TYPES,
  ZONE_PROPERTIES,
  COMPOSITE_TYPES,
} from "../../src/lib/interaction-engine/game-model";
import type {
  CardType,
  Supertype,
  Subtype,
} from "../../src/lib/interaction-engine/game-model";

// ═══════════════════════════════════════════════════════════════════
// isPermanentType
// ═══════════════════════════════════════════════════════════════════

test.describe("isPermanentType", () => {
  test("creature is a permanent type", () => {
    expect(isPermanentType("creature")).toBe(true);
  });

  test("artifact is a permanent type", () => {
    expect(isPermanentType("artifact")).toBe(true);
  });

  test("enchantment is a permanent type", () => {
    expect(isPermanentType("enchantment")).toBe(true);
  });

  test("planeswalker is a permanent type", () => {
    expect(isPermanentType("planeswalker")).toBe(true);
  });

  test("land is a permanent type", () => {
    expect(isPermanentType("land")).toBe(true);
  });

  test("battle is a permanent type", () => {
    expect(isPermanentType("battle")).toBe(true);
  });

  test("instant is NOT a permanent type", () => {
    expect(isPermanentType("instant")).toBe(false);
  });

  test("sorcery is NOT a permanent type", () => {
    expect(isPermanentType("sorcery")).toBe(false);
  });

  test("kindred is NOT a permanent type", () => {
    expect(isPermanentType("kindred")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isSpellType
// ═══════════════════════════════════════════════════════════════════

test.describe("isSpellType", () => {
  test("creature is a spell type (when cast)", () => {
    expect(isSpellType("creature")).toBe(true);
  });

  test("instant is a spell type", () => {
    expect(isSpellType("instant")).toBe(true);
  });

  test("sorcery is a spell type", () => {
    expect(isSpellType("sorcery")).toBe(true);
  });

  test("artifact is a spell type", () => {
    expect(isSpellType("artifact")).toBe(true);
  });

  test("land is NOT a spell type (played, not cast)", () => {
    expect(isSpellType("land")).toBe(false);
  });

  test("kindred is a spell type (Kindred Instant is a spell)", () => {
    expect(isSpellType("kindred")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PERMANENT_TYPES constant
// ═══════════════════════════════════════════════════════════════════

test.describe("PERMANENT_TYPES", () => {
  test("contains exactly the 6 permanent types", () => {
    expect(PERMANENT_TYPES).toHaveLength(6);
    expect(PERMANENT_TYPES).toContain("creature");
    expect(PERMANENT_TYPES).toContain("artifact");
    expect(PERMANENT_TYPES).toContain("enchantment");
    expect(PERMANENT_TYPES).toContain("planeswalker");
    expect(PERMANENT_TYPES).toContain("land");
    expect(PERMANENT_TYPES).toContain("battle");
  });

  test("does not contain instant, sorcery, or kindred", () => {
    expect(PERMANENT_TYPES).not.toContain("instant");
    expect(PERMANENT_TYPES).not.toContain("sorcery");
    expect(PERMANENT_TYPES).not.toContain("kindred");
  });
});

// ═══════════════════════════════════════════════════════════════════
// ZONE_PROPERTIES
// ═══════════════════════════════════════════════════════════════════

test.describe("ZONE_PROPERTIES", () => {
  test("battlefield is public with controllers", () => {
    const bf = ZONE_PROPERTIES.battlefield;
    expect(bf.isPublic).toBe(true);
    expect(bf.objectsHaveControllers).toBe(true);
    expect(bf.isOrdered).toBe(false);
  });

  test("library is private and ordered", () => {
    const lib = ZONE_PROPERTIES.library;
    expect(lib.isPublic).toBe(false);
    expect(lib.isOrdered).toBe(true);
    expect(lib.objectsHaveControllers).toBe(false);
  });

  test("hand is private", () => {
    expect(ZONE_PROPERTIES.hand.isPublic).toBe(false);
  });

  test("graveyard is public and ordered", () => {
    const gy = ZONE_PROPERTIES.graveyard;
    expect(gy.isPublic).toBe(true);
    expect(gy.isOrdered).toBe(true);
  });

  test("stack has controllers", () => {
    expect(ZONE_PROPERTIES.stack.objectsHaveControllers).toBe(true);
  });

  test("exile is public without controllers", () => {
    const exile = ZONE_PROPERTIES.exile;
    expect(exile.isPublic).toBe(true);
    expect(exile.objectsHaveControllers).toBe(false);
  });

  test("all 8 zones are defined", () => {
    const zones = Object.keys(ZONE_PROPERTIES);
    expect(zones).toHaveLength(8);
    expect(zones).toContain("battlefield");
    expect(zones).toContain("graveyard");
    expect(zones).toContain("hand");
    expect(zones).toContain("library");
    expect(zones).toContain("exile");
    expect(zones).toContain("stack");
    expect(zones).toContain("command");
    expect(zones).toContain("outside_the_game");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Composite Type Matching
// ═══════════════════════════════════════════════════════════════════

test.describe("matchesCompositeType — Historic", () => {
  test("legendary creature is historic", () => {
    expect(
      matchesCompositeType("historic", {
        types: ["creature"] as CardType[],
        supertypes: ["legendary"] as Supertype[],
        subtypes: [] as Subtype[],
      })
    ).toBe(true);
  });

  test("artifact is historic", () => {
    expect(
      matchesCompositeType("historic", {
        types: ["artifact"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: [] as Subtype[],
      })
    ).toBe(true);
  });

  test("Saga enchantment is historic", () => {
    expect(
      matchesCompositeType("historic", {
        types: ["enchantment"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Saga"] as Subtype[],
      })
    ).toBe(true);
  });

  test("non-legendary creature is NOT historic", () => {
    expect(
      matchesCompositeType("historic", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Elf"] as Subtype[],
      })
    ).toBe(false);
  });

  test("non-legendary enchantment without Saga is NOT historic", () => {
    expect(
      matchesCompositeType("historic", {
        types: ["enchantment"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Aura"] as Subtype[],
      })
    ).toBe(false);
  });
});

test.describe("matchesCompositeType — Outlaw", () => {
  test("Rogue is an outlaw", () => {
    expect(
      matchesCompositeType("outlaw", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Rogue"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Pirate is an outlaw", () => {
    expect(
      matchesCompositeType("outlaw", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Pirate"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Assassin is an outlaw", () => {
    expect(
      matchesCompositeType("outlaw", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Assassin"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Elf Warrior is NOT an outlaw", () => {
    expect(
      matchesCompositeType("outlaw", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Elf", "Warrior"] as Subtype[],
      })
    ).toBe(false);
  });
});

test.describe("matchesCompositeType — Party", () => {
  test("Wizard is a party member", () => {
    expect(
      matchesCompositeType("party", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Wizard"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Cleric is a party member", () => {
    expect(
      matchesCompositeType("party", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Cleric"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Warrior is a party member", () => {
    expect(
      matchesCompositeType("party", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Warrior"] as Subtype[],
      })
    ).toBe(true);
  });

  test("Goblin is NOT a party member", () => {
    expect(
      matchesCompositeType("party", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: ["Goblin"] as Subtype[],
      })
    ).toBe(false);
  });
});

test.describe("matchesCompositeType — unknown composite", () => {
  test("unknown composite type returns false", () => {
    expect(
      matchesCompositeType("nonexistent", {
        types: ["creature"] as CardType[],
        supertypes: [] as Supertype[],
        subtypes: [] as Subtype[],
      })
    ).toBe(false);
  });
});
