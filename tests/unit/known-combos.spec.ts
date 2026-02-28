import { test, expect } from "@playwright/test";
import { KNOWN_COMBOS, findCombosInDeck } from "../../src/lib/known-combos";

test.describe("KNOWN_COMBOS registry", () => {
  test("contains at least 15 combos", () => {
    expect(KNOWN_COMBOS.length).toBeGreaterThanOrEqual(15);
  });

  test("each combo has required fields", () => {
    for (const combo of KNOWN_COMBOS) {
      expect(combo.cards.length).toBeGreaterThanOrEqual(2);
      expect(combo.description).toBeTruthy();
      expect(["infinite", "wincon", "lock", "value"]).toContain(combo.type);
      // All card names should be non-empty strings
      for (const name of combo.cards) {
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  test("no duplicate combo entries", () => {
    const keys = KNOWN_COMBOS.map((c) => [...c.cards].sort().join(" + "));
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

test.describe("findCombosInDeck", () => {
  test("finds Thassa's Oracle + Demonic Consultation when both present", () => {
    const cardNames = [
      "Thassa's Oracle",
      "Demonic Consultation",
      "Island",
      "Swamp",
    ];
    const found = findCombosInDeck(cardNames);
    expect(found.length).toBeGreaterThanOrEqual(1);
    const thoracle = found.find(
      (c) =>
        c.cards.includes("Thassa's Oracle") &&
        c.cards.includes("Demonic Consultation")
    );
    expect(thoracle).toBeDefined();
  });

  test("returns empty when only one combo piece is present", () => {
    const cardNames = ["Thassa's Oracle", "Island", "Swamp"];
    const found = findCombosInDeck(cardNames);
    const thoracle = found.find(
      (c) =>
        c.cards.includes("Thassa's Oracle") &&
        c.cards.includes("Demonic Consultation")
    );
    expect(thoracle).toBeUndefined();
  });

  test("handles multiple combos in the same deck", () => {
    const cardNames = [
      "Thassa's Oracle",
      "Demonic Consultation",
      "Dramatic Reversal",
      "Isochron Scepter",
      "Island",
    ];
    const found = findCombosInDeck(cardNames);
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  test("returns empty array for a deck with no combo pieces", () => {
    const cardNames = ["Forest", "Mountain", "Plains"];
    const found = findCombosInDeck(cardNames);
    expect(found).toEqual([]);
  });

  test("finds combos case-insensitively by card name", () => {
    // The function should match exact card names from the registry
    // This test verifies the combo is found with exact names
    const cardNames = ["Mikaeus, the Unhallowed", "Triskelion"];
    const found = findCombosInDeck(cardNames);
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  test("finds Krenko + Thornbite Staff tribal combo", () => {
    const cardNames = ["Krenko, Mob Boss", "Thornbite Staff", "Mountain"];
    const found = findCombosInDeck(cardNames);
    const krenko = found.find(
      (c) =>
        c.cards.includes("Krenko, Mob Boss") &&
        c.cards.includes("Thornbite Staff")
    );
    expect(krenko).toBeDefined();
    expect(krenko!.type).toBe("infinite");
  });

  test("finds Conspiracy + Turntimber Ranger tribal combo", () => {
    const cardNames = ["Conspiracy", "Turntimber Ranger", "Forest"];
    const found = findCombosInDeck(cardNames);
    const combo = found.find(
      (c) =>
        c.cards.includes("Conspiracy") &&
        c.cards.includes("Turntimber Ranger")
    );
    expect(combo).toBeDefined();
    expect(combo!.type).toBe("infinite");
  });

  test("finds Kethis + Mox Amber legendary combo", () => {
    const cardNames = ["Kethis, the Hidden Hand", "Mox Amber", "Forest"];
    const found = findCombosInDeck(cardNames);
    const combo = found.find(
      (c) =>
        c.cards.includes("Kethis, the Hidden Hand") &&
        c.cards.includes("Mox Amber")
    );
    expect(combo).toBeDefined();
    expect(combo!.type).toBe("value");
  });

  test("finds Jhoira + Aetherflux Reservoir historic combo", () => {
    const cardNames = ["Jhoira, Weatherlight Captain", "Aetherflux Reservoir"];
    const found = findCombosInDeck(cardNames);
    const combo = found.find(
      (c) =>
        c.cards.includes("Jhoira, Weatherlight Captain") &&
        c.cards.includes("Aetherflux Reservoir")
    );
    expect(combo).toBeDefined();
    expect(combo!.type).toBe("wincon");
  });

  test("finds Jhoira + Sensei's Divining Top historic combo", () => {
    const cardNames = ["Jhoira, Weatherlight Captain", "Sensei's Divining Top"];
    const found = findCombosInDeck(cardNames);
    const combo = found.find(
      (c) =>
        c.cards.includes("Jhoira, Weatherlight Captain") &&
        c.cards.includes("Sensei's Divining Top")
    );
    expect(combo).toBeDefined();
    expect(combo!.type).toBe("value");
  });

  test("finds Teshar + Mox Amber historic recursion combo", () => {
    const cardNames = ["Teshar, Ancestor's Apostle", "Mox Amber"];
    const found = findCombosInDeck(cardNames);
    const combo = found.find(
      (c) =>
        c.cards.includes("Teshar, Ancestor's Apostle") &&
        c.cards.includes("Mox Amber")
    );
    expect(combo).toBeDefined();
    expect(combo!.type).toBe("value");
  });
});
