import { test, expect } from "@playwright/test";
import { EXAMPLE_DECKLIST } from "../../src/lib/example-deck";
import { parseDecklist } from "../../src/lib/decklist-parser";
import { validateCommanderDeck } from "../../src/lib/commander-validation";

test.describe("EXAMPLE_DECKLIST (Load Example)", () => {
  test("parses into exactly one commander and a 99-card mainboard", () => {
    const { deck, warnings } = parseDecklist(EXAMPLE_DECKLIST);

    expect(warnings).toEqual([]);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Atraxa, Praetors' Voice");

    const mainCount = deck.mainboard.reduce((s, c) => s + c.quantity, 0);
    expect(mainCount).toBe(99);
  });

  test("is a legal 100-card singleton Commander deck", () => {
    const { deck } = parseDecklist(EXAMPLE_DECKLIST);

    // Count + singleton legality do not depend on enrichment data, so an
    // empty cardMap / banned set / game-changer set is sufficient here.
    const result = validateCommanderDeck(deck, {}, new Set(), new Set());

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });
});
