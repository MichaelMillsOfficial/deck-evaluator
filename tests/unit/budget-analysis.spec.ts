import { test, expect } from "@playwright/test";
import {
  getCardTypeBucket,
  buildCardPriceList,
  computePriceDistribution,
  computePriceByType,
  computePriceByRole,
  computeMedianPrice,
  computeBudgetAnalysis,
  formatUSD,
  PRICE_BUCKETS,
} from "../../src/lib/budget-analysis";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// getCardTypeBucket
// ---------------------------------------------------------------------------

test.describe("getCardTypeBucket", () => {
  test('"Legendary Creature — Human Wizard" → "Creature"', () => {
    expect(getCardTypeBucket("Legendary Creature — Human Wizard")).toBe("Creature");
  });

  test('"Artifact Creature — Golem" → "Creature" (Creature priority)', () => {
    expect(getCardTypeBucket("Artifact Creature — Golem")).toBe("Creature");
  });

  test('"Artifact Land" → "Land" (Land priority over leftmost)', () => {
    expect(getCardTypeBucket("Artifact Land")).toBe("Land");
  });

  test('"Enchantment Artifact" → "Enchantment" (leftmost wins)', () => {
    expect(getCardTypeBucket("Enchantment Artifact")).toBe("Enchantment");
  });

  test('"Basic Land — Island" → "Land"', () => {
    expect(getCardTypeBucket("Basic Land — Island")).toBe("Land");
  });

  test('"Instant" → "Instant"', () => {
    expect(getCardTypeBucket("Instant")).toBe("Instant");
  });

  test('"Legendary Planeswalker — Jace" → "Planeswalker"', () => {
    expect(getCardTypeBucket("Legendary Planeswalker — Jace")).toBe("Planeswalker");
  });

  test('"Battle" → "Battle"', () => {
    expect(getCardTypeBucket("Battle")).toBe("Battle");
  });

  test('unknown/empty → "Other"', () => {
    expect(getCardTypeBucket("")).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// buildCardPriceList
// ---------------------------------------------------------------------------

test.describe("buildCardPriceList", () => {
  test("returns list sorted by totalPrice desc", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Cheap Card", quantity: 1 },
        { name: "Expensive Card", quantity: 1 },
      ],
    });
    const cardMap = {
      "Cheap Card": makeCard({ name: "Cheap Card", prices: { usd: 0.5, usdFoil: null, eur: null } }),
      "Expensive Card": makeCard({ name: "Expensive Card", prices: { usd: 10.0, usdFoil: null, eur: null } }),
    };
    const list = buildCardPriceList(deck, cardMap);
    expect(list[0].name).toBe("Expensive Card");
    expect(list[0].totalPrice).toBe(10.0);
    expect(list[1].name).toBe("Cheap Card");
    expect(list[1].totalPrice).toBe(0.5);
  });

  test("quantity multiplication: 4x card at $2.00 → totalPrice 8.00", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 4 }],
    });
    const cardMap = {
      "Sol Ring": makeCard({ name: "Sol Ring", prices: { usd: 2.0, usdFoil: null, eur: null } }),
    };
    const list = buildCardPriceList(deck, cardMap);
    expect(list[0].totalPrice).toBe(8.0);
    expect(list[0].unitPrice).toBe(2.0);
    expect(list[0].quantity).toBe(4);
  });

  test("null price cards are excluded from the list", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Priced Card", quantity: 1 },
        { name: "No Price Card", quantity: 1 },
      ],
    });
    const cardMap = {
      "Priced Card": makeCard({ name: "Priced Card", prices: { usd: 1.0, usdFoil: null, eur: null } }),
      "No Price Card": makeCard({ name: "No Price Card", prices: { usd: null, usdFoil: null, eur: null } }),
    };
    const list = buildCardPriceList(deck, cardMap);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Priced Card");
  });

  test("includes commanders and sideboard", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [{ name: "Spell", quantity: 1 }],
      sideboard: [{ name: "Side Card", quantity: 1 }],
    });
    const cardMap = {
      Commander: makeCard({ name: "Commander", prices: { usd: 5.0, usdFoil: null, eur: null } }),
      Spell: makeCard({ name: "Spell", prices: { usd: 1.0, usdFoil: null, eur: null } }),
      "Side Card": makeCard({ name: "Side Card", prices: { usd: 2.0, usdFoil: null, eur: null } }),
    };
    const list = buildCardPriceList(deck, cardMap);
    expect(list).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// computePriceDistribution
// ---------------------------------------------------------------------------

test.describe("computePriceDistribution", () => {
  test("assigns to correct buckets", () => {
    const list = [
      { name: "A", quantity: 1, unitPrice: 0.25, totalPrice: 0.25 },
      { name: "B", quantity: 1, unitPrice: 3.5, totalPrice: 3.5 },
      { name: "C", quantity: 1, unitPrice: 50, totalPrice: 50 },
    ];
    const buckets = computePriceDistribution(list);
    // $0.25 → $0-1 bucket
    const bucket01 = buckets.find((b) => b.label === "$0-1");
    expect(bucket01?.count).toBe(1);
    // $3.50 → $1-5 bucket
    const bucket15 = buckets.find((b) => b.label === "$1-5");
    expect(bucket15?.count).toBe(1);
    // $50 → $50+ bucket
    const bucket50 = buckets.find((b) => b.label === "$50+");
    expect(bucket50?.count).toBe(1);
  });

  test("empty list returns all-zero buckets", () => {
    const buckets = computePriceDistribution([]);
    expect(buckets).toHaveLength(PRICE_BUCKETS.length);
    for (const b of buckets) {
      expect(b.count).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computePriceByType
// ---------------------------------------------------------------------------

test.describe("computePriceByType", () => {
  test("mutually exclusive bucketing with Creature priority", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Artifact Creature", quantity: 1 },
        { name: "Pure Artifact", quantity: 1 },
      ],
    });
    const cardMap = {
      "Artifact Creature": makeCard({
        name: "Artifact Creature",
        typeLine: "Artifact Creature — Golem",
        prices: { usd: 5.0, usdFoil: null, eur: null },
      }),
      "Pure Artifact": makeCard({
        name: "Pure Artifact",
        typeLine: "Artifact",
        prices: { usd: 3.0, usdFoil: null, eur: null },
      }),
    };
    const result = computePriceByType(deck, cardMap);
    const creature = result.find((r) => r.type === "Creature");
    const artifact = result.find((r) => r.type === "Artifact");
    expect(creature?.totalCost).toBe(5.0);
    expect(creature?.cardCount).toBe(1);
    expect(artifact?.totalCost).toBe(3.0);
    expect(artifact?.cardCount).toBe(1);
  });

  test("Land priority over leftmost", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Artifact Land", quantity: 1 }],
    });
    const cardMap = {
      "Artifact Land": makeCard({
        name: "Artifact Land",
        typeLine: "Artifact Land",
        prices: { usd: 2.0, usdFoil: null, eur: null },
      }),
    };
    const result = computePriceByType(deck, cardMap);
    const land = result.find((r) => r.type === "Land");
    expect(land?.totalCost).toBe(2.0);
    const artifact = result.find((r) => r.type === "Artifact");
    expect(artifact).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computePriceByRole
// ---------------------------------------------------------------------------

test.describe("computePriceByRole", () => {
  test("tag-based grouping via generateTags(), overlap for multi-tagged", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Wrath of God", quantity: 1 }],
    });
    const cardMap = {
      "Wrath of God": makeCard({
        name: "Wrath of God",
        typeLine: "Sorcery",
        oracleText: "Destroy all creatures.",
        prices: { usd: 10.0, usdFoil: null, eur: null },
      }),
    };
    const result = computePriceByRole(deck, cardMap);
    // Wrath of God should be tagged as both Board Wipe and Removal
    const boardWipe = result.find((r) => r.tag === "Board Wipe");
    const removal = result.find((r) => r.tag === "Removal");
    expect(boardWipe?.totalCost).toBe(10.0);
    expect(removal?.totalCost).toBe(10.0);
  });

  test("cards with no tags are excluded", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Grizzly Bears", quantity: 1 }],
    });
    const cardMap = {
      "Grizzly Bears": makeCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        oracleText: "",
        prices: { usd: 0.1, usdFoil: null, eur: null },
      }),
    };
    const result = computePriceByRole(deck, cardMap);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeMedianPrice
// ---------------------------------------------------------------------------

test.describe("computeMedianPrice", () => {
  test("odd count", () => {
    const list = [
      { name: "A", quantity: 1, unitPrice: 1, totalPrice: 1 },
      { name: "B", quantity: 1, unitPrice: 3, totalPrice: 3 },
      { name: "C", quantity: 1, unitPrice: 5, totalPrice: 5 },
    ];
    expect(computeMedianPrice(list)).toBe(3);
  });

  test("even count", () => {
    const list = [
      { name: "A", quantity: 1, unitPrice: 1, totalPrice: 1 },
      { name: "B", quantity: 1, unitPrice: 3, totalPrice: 3 },
      { name: "C", quantity: 1, unitPrice: 5, totalPrice: 5 },
      { name: "D", quantity: 1, unitPrice: 7, totalPrice: 7 },
    ];
    expect(computeMedianPrice(list)).toBe(4);
  });

  test("empty list returns 0", () => {
    expect(computeMedianPrice([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatUSD
// ---------------------------------------------------------------------------

test.describe("formatUSD", () => {
  test('0 → "$0.00"', () => {
    expect(formatUSD(0)).toBe("$0.00");
  });

  test('1.5 → "$1.50"', () => {
    expect(formatUSD(1.5)).toBe("$1.50");
  });

  test('1234.99 → "$1,234.99"', () => {
    expect(formatUSD(1234.99)).toBe("$1,234.99");
  });
});

// ---------------------------------------------------------------------------
// computeBudgetAnalysis (end-to-end)
// ---------------------------------------------------------------------------

test.describe("computeBudgetAnalysis", () => {
  test("empty deck returns zero totals", () => {
    const result = computeBudgetAnalysis(makeDeck(), {});
    expect(result.totalCost).toBe(0);
    expect(result.averagePricePerCard).toBe(0);
    expect(result.medianPricePerCard).toBe(0);
    expect(result.totalCostFormatted).toBe("$0.00");
    expect(result.unknownPriceCount).toBe(0);
    expect(result.mostExpensive).toHaveLength(0);
  });

  test("3-card deck with mixed prices", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "A", quantity: 1 },
        { name: "B", quantity: 1 },
        { name: "C", quantity: 1 },
      ],
    });
    const cardMap = {
      A: makeCard({ name: "A", typeLine: "Creature", prices: { usd: 1.0, usdFoil: null, eur: null } }),
      B: makeCard({ name: "B", typeLine: "Instant", prices: { usd: 5.0, usdFoil: null, eur: null } }),
      C: makeCard({ name: "C", typeLine: "Sorcery", prices: { usd: 3.0, usdFoil: null, eur: null } }),
    };
    const result = computeBudgetAnalysis(deck, cardMap);
    expect(result.totalCost).toBe(9.0);
    expect(result.averagePricePerCard).toBe(3.0);
    expect(result.medianPricePerCard).toBe(3.0);
    expect(result.totalCostFormatted).toBe("$9.00");
    expect(result.unknownPriceCount).toBe(0);
    expect(result.mostExpensive[0].name).toBe("B");
  });

  test("all-null prices", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "A", quantity: 1 },
        { name: "B", quantity: 1 },
      ],
    });
    const cardMap = {
      A: makeCard({ name: "A", prices: { usd: null, usdFoil: null, eur: null } }),
      B: makeCard({ name: "B", prices: { usd: null, usdFoil: null, eur: null } }),
    };
    const result = computeBudgetAnalysis(deck, cardMap);
    expect(result.totalCost).toBe(0);
    expect(result.unknownPriceCount).toBe(2);
    expect(result.mostExpensive).toHaveLength(0);
  });

  test("quantity: 4x card at $2.00 contributes $8 to totals", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 4 }],
    });
    const cardMap = {
      "Sol Ring": makeCard({ name: "Sol Ring", prices: { usd: 2.0, usdFoil: null, eur: null } }),
    };
    const result = computeBudgetAnalysis(deck, cardMap);
    expect(result.totalCost).toBe(8.0);
    expect(result.mostExpensive[0].totalPrice).toBe(8.0);
  });

  test("single card deck", () => {
    const deck = makeDeck({
      mainboard: [{ name: "A", quantity: 1 }],
    });
    const cardMap = {
      A: makeCard({ name: "A", prices: { usd: 5.0, usdFoil: null, eur: null } }),
    };
    const result = computeBudgetAnalysis(deck, cardMap);
    expect(result.totalCost).toBe(5.0);
    expect(result.averagePricePerCard).toBe(5.0);
    expect(result.medianPricePerCard).toBe(5.0);
  });

  test("distribution, byType, and byRole are populated", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Counterspell", quantity: 1 },
      ],
    });
    const cardMap = {
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
        prices: { usd: 1.5, usdFoil: null, eur: null },
      }),
      Counterspell: makeCard({
        name: "Counterspell",
        typeLine: "Instant",
        oracleText: "Counter target spell.",
        prices: { usd: 1.25, usdFoil: null, eur: null },
      }),
    };
    const result = computeBudgetAnalysis(deck, cardMap);
    expect(result.distribution.length).toBe(PRICE_BUCKETS.length);
    expect(result.byType.length).toBeGreaterThan(0);
    expect(result.byRole.length).toBeGreaterThan(0);
  });
});
