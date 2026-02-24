import { test, expect } from "@playwright/test";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  resolveCommanderIdentity,
  MTG_COLORS,
} from "../src/lib/color-distribution";
import type { DeckData, EnrichedCard } from "../src/lib/types";

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

const ZERO_COUNTS = { W: 0, U: 0, B: 0, R: 0, G: 0 };

test.describe("computeColorDistribution", () => {
  test("returns zero counts when cardMap is empty", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 1 }],
    });
    const result = computeColorDistribution(deck, {});
    expect(result.sources).toEqual(ZERO_COUNTS);
    expect(result.pips).toEqual(ZERO_COUNTS);
    expect(result.colorlessSources).toBe(0);
  });

  test("counts basic lands correctly", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 4 },
        { name: "Island", quantity: 3 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        producedMana: ["U"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.G).toBe(4);
    expect(result.sources.U).toBe(3);
    expect(result.sources.W).toBe(0);
    expect(result.sources.B).toBe(0);
    expect(result.sources.R).toBe(0);
  });

  test("counts dual lands producing multiple colors", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Hallowed Fountain", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Hallowed Fountain": makeCard({
        name: "Hallowed Fountain",
        typeLine: "Land — Plains Island",
        producedMana: ["W", "U"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.W).toBe(1);
    expect(result.sources.U).toBe(1);
    expect(result.sources.B).toBe(0);
  });

  test("counts non-land mana producers", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Birds of Paradise", quantity: 1 },
        { name: "Sol Ring", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Birds of Paradise": makeCard({
        name: "Birds of Paradise",
        typeLine: "Creature — Bird",
        producedMana: ["W", "U", "B", "R", "G"],
      }),
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        producedMana: ["C"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.W).toBe(1);
    expect(result.sources.U).toBe(1);
    expect(result.sources.B).toBe(1);
    expect(result.sources.R).toBe(1);
    expect(result.sources.G).toBe(1);
    expect(result.colorlessSources).toBe(1);
  });

  test("multiplies DeckCard.quantity into source counts", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 10 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.G).toBe(10);
  });

  test("skips cards not found in cardMap", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Unknown Card", quantity: 1 },
        { name: "Forest", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.G).toBe(1);
  });

  test("scopes 5-color producers to commander identity", () => {
    const deck = makeDeck({
      commanders: [{ name: "Azorius Commander", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Azorius Commander": makeCard({
        name: "Azorius Commander",
        colorIdentity: ["W", "U"],
        typeLine: "Legendary Creature",
      }),
      "Command Tower": makeCard({
        name: "Command Tower",
        typeLine: "Land",
        producedMana: ["W", "U", "B", "R", "G"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.W).toBe(1);
    expect(result.sources.U).toBe(1);
    expect(result.sources.B).toBe(0);
    expect(result.sources.R).toBe(0);
    expect(result.sources.G).toBe(0);
  });

  test("does not scope fixed-subset producers to commander identity", () => {
    const deck = makeDeck({
      commanders: [{ name: "Mono White Commander", quantity: 1 }],
      mainboard: [{ name: "Breeding Pool", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Mono White Commander": makeCard({
        name: "Mono White Commander",
        colorIdentity: ["W"],
        typeLine: "Legendary Creature",
      }),
      "Breeding Pool": makeCard({
        name: "Breeding Pool",
        typeLine: "Land — Forest Island",
        producedMana: ["G", "U"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.sources.G).toBe(1);
    expect(result.sources.U).toBe(1);
  });

  test("colorless sources tracked separately", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 2 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        producedMana: ["C"],
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.colorlessSources).toBe(2);
    // Sol Ring should not count toward any color
    expect(result.sources).toEqual(ZERO_COUNTS);
  });

  test("sums pip demand correctly across all cards", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Counterspell", quantity: 2 },
        { name: "Cultivate", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Counterspell: makeCard({
        name: "Counterspell",
        manaCost: "{U}{U}",
        typeLine: "Instant",
        manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      }),
      Cultivate: makeCard({
        name: "Cultivate",
        manaCost: "{2}{G}",
        typeLine: "Sorcery",
        manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.pips.U).toBe(4); // 2 pips * qty 2
    expect(result.pips.G).toBe(1); // 1 pip * qty 1
    expect(result.pips.W).toBe(0);
  });

  test("includes commanders and sideboard in pip demand", () => {
    const deck = makeDeck({
      commanders: [{ name: "Blue Commander", quantity: 1 }],
      sideboard: [{ name: "Red Spell", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Blue Commander": makeCard({
        name: "Blue Commander",
        manaPips: { W: 0, U: 3, B: 0, R: 0, G: 0, C: 0 },
        typeLine: "Legendary Creature",
      }),
      "Red Spell": makeCard({
        name: "Red Spell",
        manaPips: { W: 0, U: 0, B: 0, R: 2, G: 0, C: 0 },
        typeLine: "Instant",
      }),
    };
    const result = computeColorDistribution(deck, cardMap);
    expect(result.pips.U).toBe(3);
    expect(result.pips.R).toBe(2);
  });
});

test.describe("resolveCommanderIdentity", () => {
  test("returns empty set when no commanders", () => {
    const deck = makeDeck();
    const result = resolveCommanderIdentity(deck, {});
    expect(result.size).toBe(0);
  });

  test("returns union of all commander color identities", () => {
    const deck = makeDeck({
      commanders: [
        { name: "Cmd A", quantity: 1 },
        { name: "Cmd B", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Cmd A": makeCard({ name: "Cmd A", colorIdentity: ["W", "U"] }),
      "Cmd B": makeCard({ name: "Cmd B", colorIdentity: ["B", "R"] }),
    };
    const result = resolveCommanderIdentity(deck, cardMap);
    expect(result).toEqual(new Set(["W", "U", "B", "R"]));
  });
});

test.describe("computeManaBaseMetrics", () => {
  test("returns land count, total cards, and land percentage", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 10 },
        { name: "Creature", quantity: 20 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
      Creature: makeCard({ name: "Creature", typeLine: "Creature", cmc: 3 }),
    };
    const result = computeManaBaseMetrics(deck, cardMap);
    expect(result.landCount).toBe(10);
    expect(result.totalCards).toBe(30);
    expect(result.landPercentage).toBeCloseTo(33.3, 0);
  });

  test("returns average CMC excluding lands", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 5 },
        { name: "Spell A", quantity: 2 },
        { name: "Spell B", quantity: 3 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({ name: "Forest", typeLine: "Basic Land", cmc: 0 }),
      "Spell A": makeCard({ name: "Spell A", typeLine: "Creature", cmc: 2 }),
      "Spell B": makeCard({ name: "Spell B", typeLine: "Instant", cmc: 4 }),
    };
    const result = computeManaBaseMetrics(deck, cardMap);
    // (2*2 + 4*3) / (2+3) = 16/5 = 3.2
    expect(result.averageCmc).toBeCloseTo(3.2, 1);
  });

  test("returns per-color source-to-demand ratio", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 8 },
        { name: "Green Spell", quantity: 4 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land",
        producedMana: ["G"],
      }),
      "Green Spell": makeCard({
        name: "Green Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { W: 0, U: 0, B: 0, R: 0, G: 2, C: 0 },
      }),
    };
    const result = computeManaBaseMetrics(deck, cardMap);
    // 8 sources / 8 pips (2*4) = 1.0
    expect(result.sourceToDemandRatio.G).toBeCloseTo(1.0, 1);
  });

  test("handles zero-demand colors with Infinity ratio", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 5 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land",
        producedMana: ["G"],
      }),
    };
    const result = computeManaBaseMetrics(deck, cardMap);
    expect(result.sourceToDemandRatio.G).toBe(Infinity);
    expect(result.sourceToDemandRatio.W).toBe(0);
  });

  test("returns colorless source count", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        producedMana: ["C"],
      }),
    };
    const result = computeManaBaseMetrics(deck, cardMap);
    expect(result.colorlessSources).toBe(1);
  });
});
