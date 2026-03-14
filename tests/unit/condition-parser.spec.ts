import { test, expect } from "@playwright/test";
import { parseConditionStructured } from "../../src/lib/interaction-engine/condition-parser";

// ═══════════════════════════════════════════════════════════════════
// Creature count checks
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — creature_count", () => {
  test("'you control five or more creatures' → creature_count ≥ 5", () => {
    const result = parseConditionStructured("you control five or more creatures");
    expect(result).toMatchObject({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
  });

  test("'you control three or more creatures' → creature_count ≥ 3", () => {
    const result = parseConditionStructured("you control three or more creatures");
    expect(result).toMatchObject({
      check: "creature_count",
      count: 3,
      comparison: "greater_equal",
    });
  });

  test("'you control an enchantment' → enchantment_count ≥ 1", () => {
    const result = parseConditionStructured("you control an enchantment");
    expect(result).toMatchObject({
      check: "enchantment_count",
      count: 1,
      comparison: "greater_equal",
    });
  });

  test("'you control a creature' → creature_count ≥ 1", () => {
    const result = parseConditionStructured("you control a creature");
    expect(result).toMatchObject({
      check: "creature_count",
      count: 1,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Artifact count checks
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — artifact_count", () => {
  test("'you control three or more artifacts' → artifact_count ≥ 3", () => {
    const result = parseConditionStructured("you control three or more artifacts");
    expect(result).toMatchObject({
      check: "artifact_count",
      count: 3,
      comparison: "greater_equal",
    });
  });

  test("'you control an artifact' → artifact_count ≥ 1", () => {
    const result = parseConditionStructured("you control an artifact");
    expect(result).toMatchObject({
      check: "artifact_count",
      count: 1,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Devotion checks
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — devotion", () => {
  test("'your devotion to black is five or more' → devotion B ≥ 5", () => {
    const result = parseConditionStructured("your devotion to black is five or more");
    expect(result).toMatchObject({
      check: "devotion",
      devotionColors: ["B"],
      count: 5,
      comparison: "greater_equal",
    });
  });

  test("'your devotion to green and white is seven or more' → devotion G+W ≥ 7", () => {
    const result = parseConditionStructured(
      "your devotion to green and white is seven or more"
    );
    expect(result).toMatchObject({
      check: "devotion",
      count: 7,
      comparison: "greater_equal",
    });
    expect(result?.devotionColors).toContain("G");
    expect(result?.devotionColors).toContain("W");
  });

  test("'your devotion to red is three or more' → devotion R ≥ 3", () => {
    const result = parseConditionStructured("your devotion to red is three or more");
    expect(result).toMatchObject({
      check: "devotion",
      devotionColors: ["R"],
      count: 3,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Graveyard card types (delirium)
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — graveyard_card_types", () => {
  test("'there are four or more card types among cards in your graveyard' → graveyard_card_types ≥ 4", () => {
    const result = parseConditionStructured(
      "there are four or more card types among cards in your graveyard"
    );
    expect(result).toMatchObject({
      check: "graveyard_card_types",
      count: 4,
      comparison: "greater_equal",
    });
  });

  test("'there are three or more card types among cards in your graveyard' → graveyard_card_types ≥ 3", () => {
    const result = parseConditionStructured(
      "there are three or more card types among cards in your graveyard"
    );
    expect(result).toMatchObject({
      check: "graveyard_card_types",
      count: 3,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Graveyard size (threshold)
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — graveyard_size", () => {
  test("'seven or more cards are in your graveyard' → graveyard_size ≥ 7", () => {
    const result = parseConditionStructured(
      "seven or more cards are in your graveyard"
    );
    expect(result).toMatchObject({
      check: "graveyard_size",
      count: 7,
      comparison: "greater_equal",
    });
  });

  test("'ten or more cards are in your graveyard' → graveyard_size ≥ 10", () => {
    const result = parseConditionStructured(
      "ten or more cards are in your graveyard"
    );
    expect(result).toMatchObject({
      check: "graveyard_size",
      count: 10,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Life total
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — life_total", () => {
  test("'you have 40 or more life' → life_total ≥ 40", () => {
    const result = parseConditionStructured("you have 40 or more life");
    expect(result).toMatchObject({
      check: "life_total",
      count: 40,
      comparison: "greater_equal",
    });
  });

  test("'you have 10 or more life' → life_total ≥ 10", () => {
    const result = parseConditionStructured("you have 10 or more life");
    expect(result).toMatchObject({
      check: "life_total",
      count: 10,
      comparison: "greater_equal",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Land subtype
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — land_subtype", () => {
  test("'you control a desert' → land_subtype Desert", () => {
    const result = parseConditionStructured("you control a desert");
    expect(result).toMatchObject({
      check: "land_subtype",
      subtypeRequired: "Desert",
    });
  });

  test("'you control a swamp' → land_subtype Swamp", () => {
    const result = parseConditionStructured("you control a swamp");
    expect(result).toMatchObject({
      check: "land_subtype",
      subtypeRequired: "Swamp",
    });
  });

  test("'you control a forest' → land_subtype Forest", () => {
    const result = parseConditionStructured("you control a forest");
    expect(result).toMatchObject({
      check: "land_subtype",
      subtypeRequired: "Forest",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Runtime conditions (cannot evaluate statically)
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — runtime", () => {
  test("'it's your turn' → runtime", () => {
    const result = parseConditionStructured("it's your turn");
    expect(result).toMatchObject({ check: "runtime" });
  });

  test("'a creature died this turn' → runtime", () => {
    const result = parseConditionStructured("a creature died this turn");
    expect(result).toMatchObject({ check: "runtime" });
  });

  test("'it's not your turn' → runtime", () => {
    const result = parseConditionStructured("it's not your turn");
    expect(result).toMatchObject({ check: "runtime" });
  });

  test("'during your turn' → runtime", () => {
    const result = parseConditionStructured("during your turn");
    expect(result).toMatchObject({ check: "runtime" });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Unknown conditions
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — unknown", () => {
  test("'some weird text' → unknown", () => {
    const result = parseConditionStructured("some weird text");
    expect(result).toMatchObject({ check: "unknown" });
  });

  test("empty string → unknown", () => {
    const result = parseConditionStructured("");
    expect(result).toMatchObject({ check: "unknown" });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Digit number handling
// ═══════════════════════════════════════════════════════════════════

test.describe("parseConditionStructured — digit numbers", () => {
  test("'you control 5 or more creatures' → creature_count ≥ 5", () => {
    const result = parseConditionStructured("you control 5 or more creatures");
    expect(result).toMatchObject({
      check: "creature_count",
      count: 5,
      comparison: "greater_equal",
    });
  });

  test("'you control 1 or more artifacts' → artifact_count ≥ 1", () => {
    const result = parseConditionStructured("you control 1 or more artifacts");
    expect(result).toMatchObject({
      check: "artifact_count",
      count: 1,
      comparison: "greater_equal",
    });
  });
});
