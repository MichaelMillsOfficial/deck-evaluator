import { test, expect } from "@playwright/test";
import {
  STATIC_CEDH_STAPLES,
  buildStapleSet,
  computeStapleOverlap,
} from "../../src/lib/cedh-staples";
import type { EnrichedCard } from "../../src/lib/types";
import type { DeckData } from "../../src/lib/types";

function mockCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
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
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    ...overrides,
  };
}

function mockDeck(mainboard: string[], commanders: string[] = []): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: mainboard.map((name) => ({ name, quantity: 1 })),
    sideboard: [],
  };
}

// ---------------------------------------------------------------------------
// STATIC_CEDH_STAPLES
// ---------------------------------------------------------------------------

test.describe("STATIC_CEDH_STAPLES", () => {
  test("contains expected staples", () => {
    expect(STATIC_CEDH_STAPLES.has("Sol Ring")).toBe(true);
    expect(STATIC_CEDH_STAPLES.has("Chrome Mox")).toBe(true);
    expect(STATIC_CEDH_STAPLES.has("Mana Vault")).toBe(true);
    expect(STATIC_CEDH_STAPLES.has("Demonic Tutor")).toBe(true);
  });

  test("does NOT contain common non-staples", () => {
    expect(STATIC_CEDH_STAPLES.has("Lightning Bolt")).toBe(false);
    expect(STATIC_CEDH_STAPLES.has("Plains")).toBe(false);
    expect(STATIC_CEDH_STAPLES.has("Forest")).toBe(false);
    expect(STATIC_CEDH_STAPLES.has("Mountain")).toBe(false);
    expect(STATIC_CEDH_STAPLES.has("Swamp")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildStapleSet
// ---------------------------------------------------------------------------

test.describe("buildStapleSet", () => {
  test("filters to cards with percent >= 20", () => {
    const cardsJson: Record<
      string,
      { name: string; percent: number }
    > = {
      "sol-ring": { name: "Sol Ring", percent: 95 },
      "lightning-bolt": { name: "Lightning Bolt", percent: 5 },
      "mana-vault": { name: "Mana Vault", percent: 60 },
      "borderline-card": { name: "Borderline Card", percent: 20 },
      "just-under": { name: "Just Under", percent: 19 },
    };
    const result = buildStapleSet(cardsJson);
    expect(result.has("Sol Ring")).toBe(true);
    expect(result.has("Mana Vault")).toBe(true);
    expect(result.has("Borderline Card")).toBe(true);
    expect(result.has("Lightning Bolt")).toBe(false);
    expect(result.has("Just Under")).toBe(false);
  });

  test("returns card names as a Set", () => {
    const cardsJson: Record<
      string,
      { name: string; percent: number }
    > = {
      "sol-ring": { name: "Sol Ring", percent: 95 },
      "chrome-mox": { name: "Chrome Mox", percent: 40 },
    };
    const result = buildStapleSet(cardsJson);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeStapleOverlap
// ---------------------------------------------------------------------------

test.describe("computeStapleOverlap", () => {
  const staples = new Set(["Sol Ring", "Mana Vault", "Chrome Mox", "Ad Nauseam"]);

  test("returns 0 for deck with no staples", () => {
    const deck = mockDeck(["Grizzly Bears", "Lightning Bolt", "Cancel"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Grizzly Bears": mockCard({ name: "Grizzly Bears", typeLine: "Creature" }),
      "Lightning Bolt": mockCard({ name: "Lightning Bolt", typeLine: "Instant" }),
      Cancel: mockCard({ name: "Cancel", typeLine: "Instant" }),
    };
    expect(computeStapleOverlap(deck, cardMap, staples)).toBe(0);
  });

  test("returns 100 for deck where all non-land cards are staples", () => {
    const deck = mockDeck(["Sol Ring", "Mana Vault", "Chrome Mox"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": mockCard({ name: "Sol Ring", typeLine: "Artifact" }),
      "Mana Vault": mockCard({ name: "Mana Vault", typeLine: "Artifact" }),
      "Chrome Mox": mockCard({ name: "Chrome Mox", typeLine: "Artifact" }),
    };
    expect(computeStapleOverlap(deck, cardMap, staples)).toBe(100);
  });

  test("excludes lands from calculation", () => {
    // Deck: 2 non-land staples + 1 land that happens to be in staples set
    const staplesWithLand = new Set([
      "Sol Ring",
      "Mana Vault",
      "Command Tower",
    ]);
    const deck = mockDeck(["Sol Ring", "Mana Vault", "Command Tower", "Grizzly Bears"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": mockCard({ name: "Sol Ring", typeLine: "Artifact" }),
      "Mana Vault": mockCard({ name: "Mana Vault", typeLine: "Artifact" }),
      "Command Tower": mockCard({ name: "Command Tower", typeLine: "Land" }),
      "Grizzly Bears": mockCard({ name: "Grizzly Bears", typeLine: "Creature" }),
    };
    // Non-land cards: Sol Ring, Mana Vault, Grizzly Bears (3 total)
    // Staple non-land cards: Sol Ring, Mana Vault (2 of 3)
    const result = computeStapleOverlap(deck, cardMap, staplesWithLand);
    expect(result).toBeCloseTo(66.67, 0);
  });

  test("handles empty deck (returns 0, no divide-by-zero)", () => {
    const deck = mockDeck([]);
    const cardMap: Record<string, EnrichedCard> = {};
    expect(computeStapleOverlap(deck, cardMap, staples)).toBe(0);
  });

  test("includes commanders and sideboard in calculation", () => {
    const deck: DeckData = {
      name: "Test Deck",
      source: "text",
      url: "",
      commanders: [{ name: "Ad Nauseam", quantity: 1 }],
      mainboard: [{ name: "Grizzly Bears", quantity: 1 }],
      sideboard: [{ name: "Sol Ring", quantity: 1 }],
    };
    const cardMap: Record<string, EnrichedCard> = {
      "Ad Nauseam": mockCard({ name: "Ad Nauseam", typeLine: "Instant" }),
      "Grizzly Bears": mockCard({ name: "Grizzly Bears", typeLine: "Creature" }),
      "Sol Ring": mockCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    // 3 non-land cards, 2 are staples = 66.67%
    const result = computeStapleOverlap(deck, cardMap, staples);
    expect(result).toBeCloseTo(66.67, 0);
  });

  test("cards not in cardMap are treated as non-land non-staples", () => {
    const deck = mockDeck(["Sol Ring", "Unknown Card"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": mockCard({ name: "Sol Ring", typeLine: "Artifact" }),
      // "Unknown Card" not in cardMap
    };
    // 2 non-land cards (Unknown Card has no typeLine, so treated as non-land)
    // 1 staple out of 2 = 50%
    const result = computeStapleOverlap(deck, cardMap, staples);
    expect(result).toBe(50);
  });
});
