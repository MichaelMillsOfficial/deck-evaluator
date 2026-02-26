import { test, expect } from "@playwright/test";
import {
  buildPool,
  drawHand,
  evaluateHandQuality,
  getVerdict,
  generateReasoning,
  runSimulation,
} from "../../src/lib/opening-hand";
import type { HandCard } from "../../src/lib/opening-hand";
import type { DeckData, EnrichedCard } from "../../src/lib/types";

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

// ---------------------------------------------------------------------------
// buildPool
// ---------------------------------------------------------------------------

test.describe("buildPool", () => {
  test("flattens mainboard card quantities into pool", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 3 }],
    });
    const cardMap = {
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(3);
    expect(pool.every((c) => c.name === "Sol Ring")).toBe(true);
  });

  test("includes commanders in pool", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa", quantity: 1 }],
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap = {
      Atraxa: makeCard({ name: "Atraxa", typeLine: "Legendary Creature" }),
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(2);
    expect(pool.some((c) => c.name === "Atraxa")).toBe(true);
    expect(pool.some((c) => c.name === "Sol Ring")).toBe(true);
  });

  test("excludes sideboard from pool", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
      sideboard: [{ name: "Rest in Peace", quantity: 1 }],
    });
    const cardMap = {
      "Sol Ring": makeCard({ name: "Sol Ring" }),
      "Rest in Peace": makeCard({ name: "Rest in Peace" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(1);
    expect(pool[0].name).toBe("Sol Ring");
  });

  test("skips cards missing from cardMap without crashing", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Known Card", quantity: 1 },
        { name: "Unknown Card", quantity: 2 },
      ],
    });
    const cardMap = {
      "Known Card": makeCard({ name: "Known Card" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(1);
    expect(pool[0].name).toBe("Known Card");
  });

  test("returns empty pool for empty deck", () => {
    const pool = buildPool(makeDeck(), {});
    expect(pool).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// drawHand
// ---------------------------------------------------------------------------

test.describe("drawHand", () => {
  test("returns correct count of cards", () => {
    const pool: HandCard[] = Array.from({ length: 99 }, (_, i) => ({
      name: `Card ${i}`,
      quantity: 1,
      enriched: makeCard({ name: `Card ${i}` }),
    }));
    const hand = drawHand(pool, 7);
    expect(hand).toHaveLength(7);
  });

  test("all drawn cards come from the pool", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const pool: HandCard[] = names.map((n) => ({
      name: n,
      quantity: 1,
      enriched: makeCard({ name: n }),
    }));
    const hand = drawHand(pool, 7);
    for (const card of hand) {
      expect(names).toContain(card.name);
    }
  });

  test("does not mutate the original pool", () => {
    const pool: HandCard[] = Array.from({ length: 10 }, (_, i) => ({
      name: `Card ${i}`,
      quantity: 1,
      enriched: makeCard({ name: `Card ${i}` }),
    }));
    const originalOrder = pool.map((c) => c.name);
    drawHand(pool, 5);
    expect(pool.map((c) => c.name)).toEqual(originalOrder);
  });

  test("handles pool smaller than requested count", () => {
    const pool: HandCard[] = [
      { name: "A", quantity: 1, enriched: makeCard({ name: "A" }) },
      { name: "B", quantity: 1, enriched: makeCard({ name: "B" }) },
    ];
    const hand = drawHand(pool, 7);
    expect(hand).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// evaluateHandQuality
// ---------------------------------------------------------------------------

test.describe("evaluateHandQuality", () => {
  test("ideal hand with 3 lands, ramp, and playable curve is Strong Keep", () => {
    const hand: HandCard[] = [
      {
        name: "Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Forest",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 2",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 2",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 3",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 3",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Sol Ring",
        quantity: 1,
        enriched: makeCard({
          name: "Sol Ring",
          typeLine: "Artifact",
          cmc: 1,
          manaCost: "{1}",
          oracleText: "{T}: Add {C}{C}.",
          producedMana: ["C"],
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        }),
      },
      {
        name: "Llanowar Elves",
        quantity: 1,
        enriched: makeCard({
          name: "Llanowar Elves",
          typeLine: "Creature — Elf Druid",
          cmc: 1,
          manaCost: "{G}",
          oracleText: "{T}: Add {G}.",
          producedMana: ["G"],
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      },
      {
        name: "Cultivate",
        quantity: 1,
        enriched: makeCard({
          name: "Cultivate",
          typeLine: "Sorcery",
          cmc: 3,
          manaCost: "{2}{G}",
          oracleText:
            "Search your library for up to two basic land cards, reveal those cards, and put one onto the battlefield tapped and the other into your hand.",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      },
      {
        name: "Beast Within",
        quantity: 1,
        enriched: makeCard({
          name: "Beast Within",
          typeLine: "Instant",
          cmc: 3,
          manaCost: "{2}{G}",
          oracleText: "Destroy target permanent.",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      },
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    expect(result.verdict).toBe("Strong Keep");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test("0 lands hand is Mulligan", () => {
    const hand: HandCard[] = Array.from({ length: 7 }, (_, i) => ({
      name: `Spell ${i}`,
      quantity: 1,
      enriched: makeCard({
        name: `Spell ${i}`,
        typeLine: "Creature",
        cmc: i + 1,
        manaCost: `{${i + 1}}`,
      }),
    }));
    const result = evaluateHandQuality(hand, 0, new Set(["W"]));
    expect(result.verdict).toBe("Mulligan");
    expect(result.score).toBeLessThan(40);
  });

  test("7 lands hand (all lands, no spells) is Mulligan", () => {
    const hand: HandCard[] = Array.from({ length: 7 }, (_, i) => ({
      name: `Land ${i}`,
      quantity: 1,
      enriched: makeCard({
        name: `Land ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        cmc: 0,
      }),
    }));
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    expect(result.verdict).toBe("Mulligan");
    expect(result.score).toBeLessThan(40);
  });

  test("1 land with ramp is Marginal at best", () => {
    const hand: HandCard[] = [
      {
        name: "Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Forest",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Sol Ring",
        quantity: 1,
        enriched: makeCard({
          name: "Sol Ring",
          typeLine: "Artifact",
          cmc: 1,
          manaCost: "{1}",
          oracleText: "{T}: Add {C}{C}.",
          producedMana: ["C"],
        }),
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        name: `Creature ${i}`,
        quantity: 1,
        enriched: makeCard({
          name: `Creature ${i}`,
          typeLine: "Creature",
          cmc: 4,
          manaCost: "{3}{G}",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      })),
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    // 1 land is below ideal even with ramp; should be at best Marginal
    expect(result.score).toBeLessThan(80);
  });

  test("wrong-color lands produce low color coverage score", () => {
    // Deck needs W/U but only has G lands
    const hand: HandCard[] = [
      {
        name: "Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Forest",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 2",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 2",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 3",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 3",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      ...Array.from({ length: 4 }, (_, i) => ({
        name: `White Spell ${i}`,
        quantity: 1,
        enriched: makeCard({
          name: `White Spell ${i}`,
          typeLine: "Creature",
          cmc: 2,
          manaCost: "{1}{W}",
          manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
          colors: ["W"],
        }),
      })),
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["W", "G"]));
    // Wrong colors should hurt score
    expect(result.score).toBeLessThan(80);
  });

  test("6-card hand (mulligan 1) adjusts land expectations", () => {
    // 2 lands in 6 is still acceptable
    const hand: HandCard[] = [
      {
        name: "Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Forest",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 2",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 2",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      ...Array.from({ length: 4 }, (_, i) => ({
        name: `Elf ${i}`,
        quantity: 1,
        enriched: makeCard({
          name: `Elf ${i}`,
          typeLine: "Creature — Elf",
          cmc: 1,
          manaCost: "{G}",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      })),
    ];
    const result = evaluateHandQuality(hand, 1, new Set(["G"]));
    // Should still be reasonable with 2 lands in 6 cards
    expect(result.score).toBeGreaterThan(40);
  });

  test("5-card hand (mulligan 2) adjusts land expectations", () => {
    const hand: HandCard[] = [
      {
        name: "Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Forest",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      {
        name: "Forest 2",
        quantity: 1,
        enriched: makeCard({
          name: "Forest 2",
          typeLine: "Basic Land — Forest",
          supertypes: ["Basic"],
          producedMana: ["G"],
          cmc: 0,
        }),
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        name: `Spell ${i}`,
        quantity: 1,
        enriched: makeCard({
          name: `Spell ${i}`,
          typeLine: "Creature",
          cmc: 2,
          manaCost: "{1}{G}",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      })),
    ];
    const result = evaluateHandQuality(hand, 2, new Set(["G"]));
    // 2 lands in 5 is ok
    expect(result.score).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// getVerdict
// ---------------------------------------------------------------------------

test.describe("getVerdict", () => {
  test("score >= 80 is Strong Keep", () => {
    expect(getVerdict(80)).toBe("Strong Keep");
    expect(getVerdict(100)).toBe("Strong Keep");
    expect(getVerdict(95)).toBe("Strong Keep");
  });

  test("score 60-79 is Keepable", () => {
    expect(getVerdict(60)).toBe("Keepable");
    expect(getVerdict(79)).toBe("Keepable");
    expect(getVerdict(70)).toBe("Keepable");
  });

  test("score 40-59 is Marginal", () => {
    expect(getVerdict(40)).toBe("Marginal");
    expect(getVerdict(59)).toBe("Marginal");
    expect(getVerdict(50)).toBe("Marginal");
  });

  test("score 0-39 is Mulligan", () => {
    expect(getVerdict(0)).toBe("Mulligan");
    expect(getVerdict(39)).toBe("Mulligan");
    expect(getVerdict(20)).toBe("Mulligan");
  });
});

// ---------------------------------------------------------------------------
// generateReasoning
// ---------------------------------------------------------------------------

test.describe("generateReasoning", () => {
  test("returns an array of strings", () => {
    const factors = {
      landCount: 3,
      rampCount: 1,
      playableTurns: [true, true, false],
      colorCoverage: 1.0,
      curvePlayability: 0.8,
    };
    const reasoning = generateReasoning(factors, 0);
    expect(Array.isArray(reasoning)).toBe(true);
    expect(reasoning.length).toBeGreaterThan(0);
    for (const r of reasoning) {
      expect(typeof r).toBe("string");
    }
  });

  test("includes land count assessment", () => {
    const factors = {
      landCount: 3,
      rampCount: 0,
      playableTurns: [true, true, false],
      colorCoverage: 1.0,
      curvePlayability: 0.5,
    };
    const reasoning = generateReasoning(factors, 0);
    expect(reasoning.some((r) => /land/i.test(r))).toBe(true);
  });

  test("includes ramp assessment when ramp present", () => {
    const factors = {
      landCount: 3,
      rampCount: 2,
      playableTurns: [true, true, false],
      colorCoverage: 1.0,
      curvePlayability: 0.5,
    };
    const reasoning = generateReasoning(factors, 0);
    expect(reasoning.some((r) => /ramp/i.test(r))).toBe(true);
  });

  test("includes color assessment", () => {
    const factors = {
      landCount: 3,
      rampCount: 0,
      playableTurns: [false, false, false],
      colorCoverage: 0.3,
      curvePlayability: 0.0,
    };
    const reasoning = generateReasoning(factors, 0);
    expect(reasoning.some((r) => /color/i.test(r))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

test.describe("runSimulation", () => {
  const standardDeck = makeDeck({
    mainboard: [
      ...Array.from({ length: 37 }, (_, i) => ({
        name: `Land ${i}`,
        quantity: 1,
      })),
      ...Array.from({ length: 62 }, (_, i) => ({
        name: `Spell ${i}`,
        quantity: 1,
      })),
    ],
  });

  const standardCardMap: Record<string, EnrichedCard> = {};
  for (let i = 0; i < 37; i++) {
    standardCardMap[`Land ${i}`] = makeCard({
      name: `Land ${i}`,
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      producedMana: ["G"],
      cmc: 0,
    });
  }
  for (let i = 0; i < 62; i++) {
    standardCardMap[`Spell ${i}`] = makeCard({
      name: `Spell ${i}`,
      typeLine: "Creature",
      cmc: (i % 6) + 1,
      manaCost: `{${(i % 6) + 1}}`,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
  }

  test("returns correct iteration count", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 100);
    expect(stats.totalSimulations).toBe(100);
  });

  test("keepableRate is between 0 and 1", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 100);
    expect(stats.keepableRate).toBeGreaterThanOrEqual(0);
    expect(stats.keepableRate).toBeLessThanOrEqual(1);
  });

  test("avgLandsInOpener is reasonable for 37-land deck", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 500);
    // Expected average: 37/99 * 7 ≈ 2.62
    expect(stats.avgLandsInOpener).toBeGreaterThan(1);
    expect(stats.avgLandsInOpener).toBeLessThan(5);
  });

  test("avgScore is between 0 and 100", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 100);
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    expect(stats.avgScore).toBeLessThanOrEqual(100);
  });

  test("verdict distribution sums to total simulations", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 200);
    const sum =
      stats.verdictDistribution["Strong Keep"] +
      stats.verdictDistribution["Keepable"] +
      stats.verdictDistribution["Marginal"] +
      stats.verdictDistribution["Mulligan"];
    expect(sum).toBe(200);
  });

  test("all-land deck has very low keepable rate", () => {
    const allLandDeck = makeDeck({
      mainboard: Array.from({ length: 99 }, (_, i) => ({
        name: `Land ${i}`,
        quantity: 1,
      })),
    });
    const allLandMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 99; i++) {
      allLandMap[`Land ${i}`] = makeCard({
        name: `Land ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        cmc: 0,
      });
    }
    const stats = runSimulation(allLandDeck, allLandMap, 200);
    // All-land hands should almost always be Mulligan
    expect(stats.keepableRate).toBeLessThan(0.1);
  });

  test("probT1Play and probT2Play are between 0 and 1", () => {
    const stats = runSimulation(standardDeck, standardCardMap, 100);
    expect(stats.probT1Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT1Play).toBeLessThanOrEqual(1);
    expect(stats.probT2Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT2Play).toBeLessThanOrEqual(1);
    expect(stats.probT3Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT3Play).toBeLessThanOrEqual(1);
  });
});
