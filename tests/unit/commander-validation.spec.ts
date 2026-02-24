import { test, expect } from "@playwright/test";
import {
  isSingletonExempt,
  getMaxQuantity,
  validateCommanderDeck,
  buildEdhrecUrl,
  BASIC_LAND_NAMES,
} from "../../src/lib/commander-validation";
import type { DeckData, EnrichedCard } from "../../src/lib/types";

function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Creature",
    supertypes: [],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    ...overrides,
  };
}

function makeDeck(overrides: Partial<DeckData> = {}): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: [],
    mainboard: [],
    sideboard: [],
    ...overrides,
  };
}

// --- isSingletonExempt ---

test.describe("isSingletonExempt", () => {
  const gameChangerNames = new Set(["Relentless Rats", "Rat Colony", "Seven Dwarves"]);

  test("basic lands are exempt", () => {
    for (const land of BASIC_LAND_NAMES) {
      expect(isSingletonExempt(land, {}, gameChangerNames)).toBe(true);
    }
  });

  test("game changer cards are exempt", () => {
    expect(isSingletonExempt("Relentless Rats", {}, gameChangerNames)).toBe(true);
    expect(isSingletonExempt("Rat Colony", {}, gameChangerNames)).toBe(true);
  });

  test("normal cards are not exempt", () => {
    expect(isSingletonExempt("Sol Ring", {}, gameChangerNames)).toBe(false);
    expect(isSingletonExempt("Lightning Bolt", {}, gameChangerNames)).toBe(false);
  });
});

// --- getMaxQuantity ---

test.describe("getMaxQuantity", () => {
  const gameChangerNames = new Set(["Relentless Rats", "Rat Colony", "Seven Dwarves"]);

  test("returns Infinity for basic lands", () => {
    expect(getMaxQuantity("Plains", {}, gameChangerNames)).toBe(Infinity);
    expect(getMaxQuantity("Forest", {}, gameChangerNames)).toBe(Infinity);
  });

  test("returns Infinity for most game changers", () => {
    expect(getMaxQuantity("Relentless Rats", {}, gameChangerNames)).toBe(Infinity);
    expect(getMaxQuantity("Rat Colony", {}, gameChangerNames)).toBe(Infinity);
  });

  test("returns 7 for Seven Dwarves", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Seven Dwarves": makeCard({
        name: "Seven Dwarves",
        oracleText:
          "A deck can have up to seven cards named Seven Dwarves.",
      }),
    };
    expect(getMaxQuantity("Seven Dwarves", cardMap, gameChangerNames)).toBe(7);
  });

  test("returns 1 for normal cards", () => {
    expect(getMaxQuantity("Sol Ring", {}, gameChangerNames)).toBe(1);
  });
});

// --- validateCommanderDeck ---

test.describe("validateCommanderDeck", () => {
  const bannedSet = new Set(["Flash", "Paradox Engine"]);
  const gameChangerNames = new Set(["Relentless Rats"]);

  test("no commander → hasCommander false, errors about no commander", () => {
    const deck = makeDeck({ commanders: [], mainboard: [] });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.hasCommander).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /commander/i.test(e.message))).toBe(true);
  });

  test("valid 100-card deck with commander", () => {
    const commanders = [{ name: "Atraxa, Praetors' Voice", quantity: 1 }];
    // 99 unique cards in mainboard
    const mainboard = Array.from({ length: 99 }, (_, i) => ({
      name: `Card ${i + 1}`,
      quantity: 1,
    }));
    const deck = makeDeck({ commanders, mainboard });
    const cardMap: Record<string, EnrichedCard> = {};
    const result = validateCommanderDeck(deck, cardMap, bannedSet, gameChangerNames);
    expect(result.hasCommander).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("wrong card count → error", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = Array.from({ length: 80 }, (_, i) => ({
      name: `Card ${i + 1}`,
      quantity: 1,
    }));
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /card count/i.test(e.message) || /100/i.test(e.message))).toBe(true);
  });

  test("duplicate non-exempt cards → error listing the card names", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Sol Ring", quantity: 2 },
      ...Array.from({ length: 97 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) => /singleton/i.test(e.message) || /duplicate/i.test(e.message)
      )
    ).toBe(true);
    expect(result.errors.some((e) => e.cards?.includes("Sol Ring"))).toBe(true);
  });

  test("banned cards → error listing banned card names", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Flash", quantity: 1 },
      ...Array.from({ length: 98 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /banned/i.test(e.message))).toBe(true);
    expect(result.errors.some((e) => e.cards?.includes("Flash"))).toBe(true);
  });

  test("multiple errors are all reported", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Flash", quantity: 2 }, // banned AND duplicate
      ...Array.from({ length: 80 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    // Should have at least: card count error, singleton error, banned error
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("basic lands and game changers are allowed in multiples", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Plains", quantity: 30 },
      { name: "Relentless Rats", quantity: 60 },
      ...Array.from({ length: 9 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    // Should be valid (100 cards total, no singleton violations)
    expect(result.isValid).toBe(true);
  });
});

// --- buildEdhrecUrl ---

test.describe("buildEdhrecUrl", () => {
  test("single commander", () => {
    const url = buildEdhrecUrl(["Atraxa, Praetors' Voice"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/atraxa-praetors-voice"
    );
  });

  test("partner commanders", () => {
    const url = buildEdhrecUrl(["Thrasios, Triton Hero", "Tymna the Weaver"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/thrasios-triton-hero-tymna-the-weaver"
    );
  });

  test("special characters are stripped", () => {
    const url = buildEdhrecUrl(["Uro, Titan of Nature's Wrath"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/uro-titan-of-natures-wrath"
    );
  });
});
