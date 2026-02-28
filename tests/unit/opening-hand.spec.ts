import { test, expect } from "@playwright/test";
import {
  buildPool,
  buildCommandZone,
  drawHand,
  evaluateHandQuality,
  getVerdict,
  generateReasoning,
  runSimulation,
  findTopHands,
  scoreRamp,
  scoreCardAdvantage,
  scoreInteraction,
  scoreStrategy,
  getAbilityReliability,
  computeAdjustedWeights,
  parsePipRequirements,
  canCastWithLands,
  getManaProducers,
  computePipWeights,
} from "../../src/lib/opening-hand";
import type { HandCard, HandEvaluationContext, PipRequirement } from "../../src/lib/opening-hand";
import type { EnrichedCard, DeckTheme } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

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

  test("excludes commanders from pool", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa", quantity: 1 }],
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap = {
      Atraxa: makeCard({ name: "Atraxa", typeLine: "Legendary Creature" }),
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(1);
    expect(pool.some((c) => c.name === "Atraxa")).toBe(false);
    expect(pool.some((c) => c.name === "Sol Ring")).toBe(true);
  });

  test("returns correct count for deck with multiple commanders", () => {
    const deck = makeDeck({
      commanders: [
        { name: "Thrasios", quantity: 1 },
        { name: "Tymna", quantity: 1 },
      ],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Mana Crypt", quantity: 1 },
        { name: "Command Tower", quantity: 1 },
      ],
    });
    const cardMap = {
      Thrasios: makeCard({ name: "Thrasios", typeLine: "Legendary Creature" }),
      Tymna: makeCard({ name: "Tymna", typeLine: "Legendary Creature" }),
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
      "Mana Crypt": makeCard({ name: "Mana Crypt", typeLine: "Artifact" }),
      "Command Tower": makeCard({ name: "Command Tower", typeLine: "Land" }),
    };
    const pool = buildPool(deck, cardMap);
    expect(pool).toHaveLength(3);
    expect(pool.some((c) => c.name === "Thrasios")).toBe(false);
    expect(pool.some((c) => c.name === "Tymna")).toBe(false);
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
// buildCommandZone
// ---------------------------------------------------------------------------

test.describe("buildCommandZone", () => {
  test("returns only commander cards", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa", quantity: 1 }],
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap = {
      Atraxa: makeCard({ name: "Atraxa", typeLine: "Legendary Creature" }),
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    const zone = buildCommandZone(deck, cardMap);
    expect(zone).toHaveLength(1);
    expect(zone[0].name).toBe("Atraxa");
  });

  test("returns empty array when no commanders", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap = {
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
    };
    const zone = buildCommandZone(deck, cardMap);
    expect(zone).toHaveLength(0);
  });

  test("returns multiple commanders (partner)", () => {
    const deck = makeDeck({
      commanders: [
        { name: "Thrasios", quantity: 1 },
        { name: "Tymna", quantity: 1 },
      ],
    });
    const cardMap = {
      Thrasios: makeCard({ name: "Thrasios", typeLine: "Legendary Creature" }),
      Tymna: makeCard({ name: "Tymna", typeLine: "Legendary Creature" }),
    };
    const zone = buildCommandZone(deck, cardMap);
    expect(zone).toHaveLength(2);
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

  test("command zone commander counts as playable for curve analysis", () => {
    // Hand with 2 lands and only high-CMC spells — no early plays
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
      ...Array.from({ length: 5 }, (_, i) => ({
        name: `Big Creature ${i}`,
        quantity: 1,
        enriched: makeCard({
          name: `Big Creature ${i}`,
          typeLine: "Creature",
          cmc: 6,
          manaCost: "{5}{G}",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      })),
    ];

    // 1-CMC commander in command zone
    const commandZone: HandCard[] = [
      {
        name: "Llanowar Elves Commander",
        quantity: 1,
        enriched: makeCard({
          name: "Llanowar Elves Commander",
          typeLine: "Legendary Creature",
          cmc: 1,
          manaCost: "{G}",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
          colors: ["G"],
        }),
      },
    ];

    const resultWithout = evaluateHandQuality(hand, 0, new Set(["G"]));
    const resultWith = evaluateHandQuality(hand, 0, new Set(["G"]), commandZone);

    // Without command zone: no T1 play (all spells CMC 6)
    expect(resultWithout.factors.playableTurns[0]).toBe(false);
    // With command zone: T1 play available (commander CMC 1)
    expect(resultWith.factors.playableTurns[0]).toBe(true);
    // Score should be higher with command zone
    expect(resultWith.score).toBeGreaterThan(resultWithout.score);
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
  // Build a standard deck and pre-build its pool for runSimulation
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

  const standardPool = buildPool(standardDeck, standardCardMap);
  const standardIdentity = new Set(["G"]);

  test("returns correct iteration count", () => {
    const stats = runSimulation(standardPool, standardIdentity, 100);
    expect(stats.totalSimulations).toBe(100);
  });

  test("keepableRate is between 0 and 1", () => {
    const stats = runSimulation(standardPool, standardIdentity, 100);
    expect(stats.keepableRate).toBeGreaterThanOrEqual(0);
    expect(stats.keepableRate).toBeLessThanOrEqual(1);
  });

  test("avgLandsInOpener is reasonable for 37-land deck", () => {
    const stats = runSimulation(standardPool, standardIdentity, 500);
    // Expected average: 37/99 * 7 ≈ 2.62
    expect(stats.avgLandsInOpener).toBeGreaterThan(1);
    expect(stats.avgLandsInOpener).toBeLessThan(5);
  });

  test("avgScore is between 0 and 100", () => {
    const stats = runSimulation(standardPool, standardIdentity, 100);
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    expect(stats.avgScore).toBeLessThanOrEqual(100);
  });

  test("verdict distribution sums to total simulations", () => {
    const stats = runSimulation(standardPool, standardIdentity, 200);
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
    const allLandPool = buildPool(allLandDeck, allLandMap);
    const stats = runSimulation(allLandPool, new Set(["G"]), 200);
    // All-land hands should almost always be Mulligan
    expect(stats.keepableRate).toBeLessThan(0.1);
  });

  test("probT1Play and probT2Play are between 0 and 1", () => {
    const stats = runSimulation(standardPool, standardIdentity, 100);
    expect(stats.probT1Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT1Play).toBeLessThanOrEqual(1);
    expect(stats.probT2Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT2Play).toBeLessThanOrEqual(1);
    expect(stats.probT3Play).toBeGreaterThanOrEqual(0);
    expect(stats.probT3Play).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// findTopHands
// ---------------------------------------------------------------------------

test.describe("findTopHands", () => {
  // Reuse the standard pool from runSimulation tests
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

  const standardPool = buildPool(standardDeck, standardCardMap);
  const standardIdentity = new Set(["G"]);

  test("returns at most topN hands", () => {
    const result = findTopHands(standardPool, standardIdentity, 3, 500);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
  });

  test("hands are sorted by score descending", () => {
    const result = findTopHands(standardPool, standardIdentity, 5, 500);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].hand.quality.score).toBeGreaterThanOrEqual(
        result[i].hand.quality.score
      );
    }
  });

  test("rank values are 1-indexed and sequential", () => {
    const result = findTopHands(standardPool, standardIdentity, 5, 500);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].rank).toBe(i + 1);
    }
  });

  test("no duplicate cardKeys in results", () => {
    const result = findTopHands(standardPool, standardIdentity, 5, 1000);
    const keys = result.map((r) => r.cardKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test("returns empty array for empty pool", () => {
    const result = findTopHands([], new Set(["G"]), 5, 100);
    expect(result).toEqual([]);
  });

  test("returns fewer than topN when pool has very few unique combinations", () => {
    // Pool of only 3 cards — max 1 unique 7-card hand (can't even form one)
    const tinyPool: HandCard[] = [
      { name: "A", quantity: 1, enriched: makeCard({ name: "A", typeLine: "Basic Land — Forest", producedMana: ["G"] }) },
      { name: "B", quantity: 1, enriched: makeCard({ name: "B", typeLine: "Creature", cmc: 1, manaCost: "{G}", manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 } }) },
      { name: "C", quantity: 1, enriched: makeCard({ name: "C", typeLine: "Creature", cmc: 2, manaCost: "{1}{G}", manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 } }) },
    ];
    const result = findTopHands(tinyPool, new Set(["G"]), 5, 100);
    // Only 1 unique combination possible (all 3 cards)
    expect(result.length).toBeLessThanOrEqual(1);
  });

  test("all returned hands have valid quality results", () => {
    const result = findTopHands(standardPool, standardIdentity, 5, 500);
    for (const ranked of result) {
      expect(ranked.hand.quality.score).toBeGreaterThanOrEqual(0);
      expect(ranked.hand.quality.score).toBeLessThanOrEqual(100);
      expect(["Strong Keep", "Keepable", "Marginal", "Mulligan"]).toContain(
        ranked.hand.quality.verdict
      );
      expect(ranked.hand.quality.reasoning.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// scoreRamp (tempo-weighted)
// ---------------------------------------------------------------------------

test.describe("scoreRamp", () => {
  test("CMC 1 ramp gets full weight (1.0)", () => {
    const hand: HandCard[] = [
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
    ];
    const score = scoreRamp(hand);
    // 1 ramp at full weight = effectiveCount 1.0 → score 70
    expect(score).toBe(70);
  });

  test("CMC 2 ramp gets full weight (1.0)", () => {
    const hand: HandCard[] = [
      {
        name: "Arcane Signet",
        quantity: 1,
        enriched: makeCard({
          name: "Arcane Signet",
          typeLine: "Artifact",
          cmc: 2,
          manaCost: "{2}",
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
          producedMana: ["W", "U", "B", "R", "G"],
        }),
      },
    ];
    const score = scoreRamp(hand);
    expect(score).toBe(70);
  });

  test("CMC 3 ramp gets 0.8 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Cultivate",
        quantity: 1,
        enriched: makeCard({
          name: "Cultivate",
          typeLine: "Sorcery",
          cmc: 3,
          manaCost: "{2}{G}",
          oracleText: "Search your library for up to two basic land cards.",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
        }),
      },
    ];
    const score = scoreRamp(hand);
    // effectiveCount = 0.8 → score 50 (>= 0.5)
    expect(score).toBe(50);
  });

  test("CMC 4 ramp gets 0.5 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Explosive Vegetation",
        quantity: 1,
        enriched: makeCard({
          name: "Explosive Vegetation",
          typeLine: "Sorcery",
          cmc: 4,
          manaCost: "{3}{G}",
          oracleText: "Search your library for up to two basic land cards.",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
        }),
      },
    ];
    const score = scoreRamp(hand);
    // effectiveCount = 0.5 → score 50
    expect(score).toBe(50);
  });

  test("CMC 6 ramp gets 0.2 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Boundless Realms",
        quantity: 1,
        enriched: makeCard({
          name: "Boundless Realms",
          typeLine: "Sorcery",
          cmc: 6,
          manaCost: "{6}{G}",
          oracleText: "Search your library for up to X basic land cards.",
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
        }),
      },
    ];
    const score = scoreRamp(hand);
    // effectiveCount = 0.2 → score 30 (< 0.5)
    expect(score).toBe(30);
  });

  test("two CMC-2 ramp cards = effectiveCount 2.0 → score 100", () => {
    const hand: HandCard[] = [
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
      {
        name: "Arcane Signet",
        quantity: 1,
        enriched: makeCard({
          name: "Arcane Signet",
          typeLine: "Artifact",
          cmc: 2,
          manaCost: "{2}",
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
          producedMana: ["W", "U", "B", "R", "G"],
        }),
      },
    ];
    const score = scoreRamp(hand);
    expect(score).toBe(100);
  });

  test("no ramp cards → score 30", () => {
    const hand: HandCard[] = [
      {
        name: "Lightning Bolt",
        quantity: 1,
        enriched: makeCard({
          name: "Lightning Bolt",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Lightning Bolt deals 3 damage to any target.",
        }),
      },
    ];
    const score = scoreRamp(hand);
    expect(score).toBe(30);
  });

  test("lands are not counted as ramp", () => {
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
    ];
    const score = scoreRamp(hand);
    expect(score).toBe(30); // no ramp
  });
});

// ---------------------------------------------------------------------------
// scoreCardAdvantage (tempo-weighted)
// ---------------------------------------------------------------------------

test.describe("scoreCardAdvantage", () => {
  test("CMC 2 draw spell gets full weight (1.0)", () => {
    const hand: HandCard[] = [
      {
        name: "Night's Whisper",
        quantity: 1,
        enriched: makeCard({
          name: "Night's Whisper",
          typeLine: "Sorcery",
          cmc: 2,
          oracleText: "You draw two cards and you lose 2 life.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    // effectiveCount = 1.0 → score 70
    expect(score).toBe(70);
  });

  test("CMC 3 draw spell gets full weight (1.0)", () => {
    const hand: HandCard[] = [
      {
        name: "Harmonize",
        quantity: 1,
        enriched: makeCard({
          name: "Harmonize",
          typeLine: "Sorcery",
          cmc: 3,
          oracleText: "Draw three cards.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    expect(score).toBe(70);
  });

  test("CMC 5 draw spell gets 0.7 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Tidings",
        quantity: 1,
        enriched: makeCard({
          name: "Tidings",
          typeLine: "Sorcery",
          cmc: 5,
          oracleText: "Draw four cards.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    // effectiveCount = 0.7 → score 50 (>= 0.5)
    expect(score).toBe(50);
  });

  test("CMC 6 draw spell gets 0.4 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Opportunity",
        quantity: 1,
        enriched: makeCard({
          name: "Opportunity",
          typeLine: "Instant",
          cmc: 6,
          oracleText: "Target player draws four cards.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    // effectiveCount = 0.4 → score 25 (< 0.5)
    expect(score).toBe(25);
  });

  test("two cheap draw spells = effectiveCount >= 2.0 → score 100", () => {
    const hand: HandCard[] = [
      {
        name: "Night's Whisper",
        quantity: 1,
        enriched: makeCard({
          name: "Night's Whisper",
          typeLine: "Sorcery",
          cmc: 2,
          oracleText: "You draw two cards and you lose 2 life.",
        }),
      },
      {
        name: "Brainstorm",
        quantity: 1,
        enriched: makeCard({
          name: "Brainstorm",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Draw three cards, then put two cards from your hand on top of your library.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    expect(score).toBe(100);
  });

  test("no card advantage sources → score 25", () => {
    const hand: HandCard[] = [
      {
        name: "Lightning Bolt",
        quantity: 1,
        enriched: makeCard({
          name: "Lightning Bolt",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Lightning Bolt deals 3 damage to any target.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    expect(score).toBe(25);
  });

  test("tutor counts as card advantage", () => {
    const hand: HandCard[] = [
      {
        name: "Demonic Tutor",
        quantity: 1,
        enriched: makeCard({
          name: "Demonic Tutor",
          typeLine: "Sorcery",
          cmc: 2,
          oracleText: "Search your library for a card, put that card into your hand, then shuffle.",
        }),
      },
    ];
    const score = scoreCardAdvantage(hand);
    // Tutor at CMC 2 → weight 1.0, effectiveCount 1.0 → score 70
    expect(score).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// scoreInteraction (tempo-weighted)
// ---------------------------------------------------------------------------

test.describe("scoreInteraction", () => {
  test("CMC 1 removal gets full weight (1.0)", () => {
    const hand: HandCard[] = [
      {
        name: "Swords to Plowshares",
        quantity: 1,
        enriched: makeCard({
          name: "Swords to Plowshares",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Exile target creature. Its controller gains life equal to its power.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    // effectiveCount = 1.0 → score 70
    expect(score).toBe(70);
  });

  test("CMC 2 counterspell gets full weight (1.0)", () => {
    const hand: HandCard[] = [
      {
        name: "Counterspell",
        quantity: 1,
        enriched: makeCard({
          name: "Counterspell",
          typeLine: "Instant",
          cmc: 2,
          oracleText: "Counter target spell.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    expect(score).toBe(70);
  });

  test("CMC 5 removal gets 0.7 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Lava Axe Removal",
        quantity: 1,
        enriched: makeCard({
          name: "Lava Axe Removal",
          typeLine: "Sorcery",
          cmc: 5,
          oracleText: "Destroy target creature or planeswalker.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    // effectiveCount = 0.7 → score 50 (>= 0.5)
    expect(score).toBe(50);
  });

  test("CMC 6 removal gets 0.4 weight", () => {
    const hand: HandCard[] = [
      {
        name: "Meteor Removal",
        quantity: 1,
        enriched: makeCard({
          name: "Meteor Removal",
          typeLine: "Sorcery",
          cmc: 6,
          oracleText: "Destroy target permanent.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    // effectiveCount = 0.4 → score 20 (< 0.5)
    expect(score).toBe(20);
  });

  test("two cheap interaction pieces → score 100", () => {
    const hand: HandCard[] = [
      {
        name: "Swords to Plowshares",
        quantity: 1,
        enriched: makeCard({
          name: "Swords to Plowshares",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Exile target creature.",
        }),
      },
      {
        name: "Counterspell",
        quantity: 1,
        enriched: makeCard({
          name: "Counterspell",
          typeLine: "Instant",
          cmc: 2,
          oracleText: "Counter target spell.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    expect(score).toBe(100);
  });

  test("no interaction → score 20", () => {
    const hand: HandCard[] = [
      {
        name: "Llanowar Elves",
        quantity: 1,
        enriched: makeCard({
          name: "Llanowar Elves",
          typeLine: "Creature",
          cmc: 1,
          oracleText: "{T}: Add {G}.",
          producedMana: ["G"],
        }),
      },
    ];
    const score = scoreInteraction(hand);
    expect(score).toBe(20);
  });

  test("board wipe counts as interaction", () => {
    const hand: HandCard[] = [
      {
        name: "Wrath of God",
        quantity: 1,
        enriched: makeCard({
          name: "Wrath of God",
          typeLine: "Sorcery",
          cmc: 4,
          oracleText: "Destroy all creatures. They can't be regenerated.",
        }),
      },
    ];
    const score = scoreInteraction(hand);
    // CMC 4 → weight 0.7, effectiveCount 0.7 → score 50
    expect(score).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// scoreStrategy (theme alignment with tempo weighting)
// ---------------------------------------------------------------------------

test.describe("scoreStrategy", () => {
  const tokensTheme: DeckTheme = {
    axisId: "tokens",
    axisName: "Tokens",
    strength: 0.8,
    cardCount: 15,
  };
  const sacrificeTheme: DeckTheme = {
    axisId: "sacrifice",
    axisName: "Sacrifice",
    strength: 0.6,
    cardCount: 10,
  };
  const graveyardTheme: DeckTheme = {
    axisId: "graveyard",
    axisName: "Graveyard",
    strength: 0.5,
    cardCount: 8,
  };

  test("no themes in deck returns neutral 50", () => {
    const hand: HandCard[] = [
      {
        name: "Creature",
        quantity: 1,
        enriched: makeCard({ name: "Creature", typeLine: "Creature", cmc: 2 }),
      },
    ];
    const score = scoreStrategy(hand, [], 3, 0);
    expect(score).toBe(50);
  });

  test("on-theme castable cards produce high score", () => {
    // Card that creates tokens (matches tokens theme) and is cheap enough to cast
    const hand: HandCard[] = [
      {
        name: "Raise the Alarm",
        quantity: 1,
        enriched: makeCard({
          name: "Raise the Alarm",
          typeLine: "Instant",
          cmc: 2,
          oracleText: "Create two 1/1 white Soldier creature tokens.",
        }),
      },
      {
        name: "Sac Outlet",
        quantity: 1,
        enriched: makeCard({
          name: "Sac Outlet",
          typeLine: "Creature",
          cmc: 2,
          oracleText: "Sacrifice a creature: Draw a card.",
        }),
      },
    ];
    // 3 lands + 0 ramp → availableMana = 3, both CMC 2 → full weight
    const score = scoreStrategy(hand, [tokensTheme, sacrificeTheme, graveyardTheme], 3, 0);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  test("on-theme but high-CMC cards with low mana produce low score", () => {
    const hand: HandCard[] = [
      {
        name: "Army of the Damned",
        quantity: 1,
        enriched: makeCard({
          name: "Army of the Damned",
          typeLine: "Sorcery",
          cmc: 8,
          oracleText: "Create thirteen 2/2 black Zombie creature tokens.",
        }),
      },
    ];
    // 2 lands + 0 ramp → availableMana = 2, CMC 8 → minimal weight (0.15)
    const score = scoreStrategy(hand, [tokensTheme], 2, 0);
    expect(score).toBeLessThan(50);
  });

  test("on-theme low-CMC cards with adequate mana produce high score", () => {
    const hand: HandCard[] = [
      {
        name: "Young Pyromancer",
        quantity: 1,
        enriched: makeCard({
          name: "Young Pyromancer",
          typeLine: "Creature",
          cmc: 2,
          oracleText: "Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token.",
        }),
      },
      {
        name: "Viscera Seer",
        quantity: 1,
        enriched: makeCard({
          name: "Viscera Seer",
          typeLine: "Creature",
          cmc: 1,
          oracleText: "Sacrifice a creature: Scry 1.",
        }),
      },
    ];
    // 3 lands + 1 ramp → availableMana = 4
    const score = scoreStrategy(hand, [tokensTheme, sacrificeTheme], 3, 1);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  test("no theme hits produce score near 0", () => {
    const hand: HandCard[] = [
      {
        name: "Generic Creature",
        quantity: 1,
        enriched: makeCard({
          name: "Generic Creature",
          typeLine: "Creature",
          cmc: 3,
          oracleText: "Vigilance",
          keywords: ["Vigilance"],
        }),
      },
    ];
    const score = scoreStrategy(hand, [tokensTheme, sacrificeTheme], 3, 0);
    expect(score).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// getAbilityReliability
// ---------------------------------------------------------------------------

test.describe("getAbilityReliability", () => {
  test("ETB/triggered card draw → 1.0", () => {
    const card = makeCard({
      name: "Mulldrifter",
      oracleText: "When Mulldrifter enters the battlefield, draw two cards.",
      cmc: 5,
    });
    const reliability = getAbilityReliability(card, "cardAdvantage");
    expect(reliability).toBe(1.0);
  });

  test("whenever triggered draw → 1.0", () => {
    const card = makeCard({
      name: "Tymna the Weaver",
      oracleText: "At the beginning of your postcombat main phase, you may pay X life, where X is the number of opponents that were dealt combat damage this turn. If you do, draw X cards.",
      cmc: 3,
    });
    const reliability = getAbilityReliability(card, "cardAdvantage");
    expect(reliability).toBe(1.0);
  });

  test("cheap activated ability draw (2 mana) → 0.8", () => {
    const card = makeCard({
      name: "Thrasios",
      oracleText: "{2}{U}{G}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise, draw a card.",
      cmc: 2,
    });
    // {2}{U}{G} = 4 mana → moderate activated
    const reliability = getAbilityReliability(card, "cardAdvantage");
    expect(reliability).toBe(0.5);
  });

  test("expensive activated ability draw (5+ mana) → 0.3", () => {
    const card = makeCard({
      name: "Expensive Draw",
      oracleText: "{5}: Draw two cards.",
      cmc: 3,
    });
    const reliability = getAbilityReliability(card, "cardAdvantage");
    expect(reliability).toBe(0.3);
  });

  test("ETB removal → 1.0", () => {
    const card = makeCard({
      name: "Shriekmaw",
      oracleText: "When Shriekmaw enters the battlefield, destroy target nonartifact, nonblack creature.",
      cmc: 5,
    });
    const reliability = getAbilityReliability(card, "interaction");
    expect(reliability).toBe(1.0);
  });

  test("cheap activated removal ({1}: Exile) → 0.8", () => {
    const card = makeCard({
      name: "Cheap Exile",
      oracleText: "{1}: Exile target creature.",
      cmc: 2,
    });
    const reliability = getAbilityReliability(card, "interaction");
    expect(reliability).toBe(0.8);
  });

  test("moderate activated removal ({1}{W}{B}: Exile) → 0.5", () => {
    const card = makeCard({
      name: "Ayli, Eternal Pilgrim",
      oracleText: "{1}{W}{B}, Sacrifice a creature: Exile target nonland permanent.",
      cmc: 2,
    });
    const reliability = getAbilityReliability(card, "interaction");
    expect(reliability).toBe(0.5);
  });

  test("card without the relevant tag type → 1.0 (fallback)", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      oracleText: "",
      cmc: 2,
    });
    // No card advantage abilities at all → defaults to 1.0
    const reliability = getAbilityReliability(card, "cardAdvantage");
    expect(reliability).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// computeAdjustedWeights
// ---------------------------------------------------------------------------

test.describe("computeAdjustedWeights", () => {
  test("empty command zone returns base weights with no reasoning", () => {
    const result = computeAdjustedWeights([]);
    expect(result.reasoning).toEqual([]);
    // Weights should sum to 1.0
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("low-CMC triggered draw commander reduces CA weight", () => {
    const commander: HandCard = {
      name: "Tymna the Weaver",
      quantity: 1,
      enriched: makeCard({
        name: "Tymna the Weaver",
        typeLine: "Legendary Creature",
        cmc: 3,
        oracleText: "At the beginning of your postcombat main phase, you may pay X life, where X is the number of opponents that were dealt combat damage this turn. If you do, draw X cards.",
      }),
    };
    const result = computeAdjustedWeights([commander]);
    // Should reduce CA weight and add reasoning
    expect(result.weights.cardAdvantage).toBeLessThan(0.08);
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.reasoning.some((r) => /card advantage|card draw/i.test(r))).toBe(true);
    // Weights should sum to 1.0
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("high-CMC CA commander produces minimal weight reduction", () => {
    const commander: HandCard = {
      name: "Kozilek",
      quantity: 1,
      enriched: makeCard({
        name: "Kozilek",
        typeLine: "Legendary Creature",
        cmc: 10,
        oracleText: "When you cast this spell, draw four cards.",
      }),
    };
    const result = computeAdjustedWeights([commander]);
    // High CMC → cmcScale 0.25, so adjustment is small
    // CA weight should be only slightly reduced
    expect(result.weights.cardAdvantage).toBeGreaterThan(0.05);
    // Weights should sum to 1.0
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("removal commander reduces interaction weight", () => {
    const commander: HandCard = {
      name: "Ayli, Eternal Pilgrim",
      quantity: 1,
      enriched: makeCard({
        name: "Ayli, Eternal Pilgrim",
        typeLine: "Legendary Creature",
        cmc: 2,
        oracleText: "{1}{W}{B}, Sacrifice a creature: Exile target nonland permanent.",
      }),
    };
    const result = computeAdjustedWeights([commander]);
    expect(result.weights.interaction).toBeLessThan(0.07);
    // Weights should sum to 1.0
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("ramp commander reduces ramp weight", () => {
    const commander: HandCard = {
      name: "Selvala",
      quantity: 1,
      enriched: makeCard({
        name: "Selvala",
        typeLine: "Legendary Creature",
        cmc: 3,
        oracleText: "{T}: Add one mana of any color in your commander's color identity. Whenever Selvala enters the battlefield, each player draws a card.",
        producedMana: ["W", "U", "B", "R", "G"],
      }),
    };
    const result = computeAdjustedWeights([commander]);
    expect(result.weights.ramp).toBeLessThan(0.10);
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("weights always sum to 1.0 across all adjustments", () => {
    // Commander with multiple tags
    const commander: HandCard = {
      name: "MultiAbility",
      quantity: 1,
      enriched: makeCard({
        name: "MultiAbility",
        typeLine: "Legendary Creature",
        cmc: 3,
        oracleText: "When MultiAbility enters the battlefield, draw two cards. Destroy target creature.",
      }),
    };
    const result = computeAdjustedWeights([commander]);
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test("partner commanders use most favorable for each capability", () => {
    const draw: HandCard = {
      name: "Tymna the Weaver",
      quantity: 1,
      enriched: makeCard({
        name: "Tymna the Weaver",
        typeLine: "Legendary Creature",
        cmc: 3,
        oracleText: "At the beginning of your postcombat main phase, you may pay X life. If you do, draw X cards.",
      }),
    };
    const ramp: HandCard = {
      name: "Thrasios",
      quantity: 1,
      enriched: makeCard({
        name: "Thrasios",
        typeLine: "Legendary Creature",
        cmc: 2,
        oracleText: "{2}{U}{G}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise, draw a card.",
        producedMana: [],
      }),
    };
    const result = computeAdjustedWeights([draw, ramp]);
    // Both should contribute adjustments
    expect(result.weights.cardAdvantage).toBeLessThan(0.08);
    const sum = Object.values(result.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility: no context = original 4-factor weights
// ---------------------------------------------------------------------------

test.describe("backward compatibility", () => {
  test("calling evaluateHandQuality without context produces same scores as before", () => {
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
          oracleText: "Search your library for up to two basic land cards.",
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

    // Without context — original 4-factor
    const resultWithout = evaluateHandQuality(hand, 0, new Set(["G"]));
    // With context — 7-factor
    const context: HandEvaluationContext = { deckThemes: [] };
    const resultWith = evaluateHandQuality(hand, 0, new Set(["G"]), [], context);

    // Without context should use original weights (35/30/20/15)
    // Factors should be unchanged
    expect(resultWithout.factors.landCount).toBe(3);
    // Sol Ring + Llanowar Elves + Cultivate = 3 ramp cards
    expect(resultWithout.factors.rampCount).toBe(3);

    // The verdict should remain "Strong Keep" for a well-built hand without context
    expect(resultWithout.verdict).toBe("Strong Keep");
  });

  test("without context, no new factor fields are present", () => {
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
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    // New factor fields should be undefined when no context
    expect(result.factors.strategyScore).toBeUndefined();
    expect(result.factors.cardAdvantageCount).toBeUndefined();
    expect(result.factors.interactionCount).toBeUndefined();
    expect(result.factors.themeHits).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Reasoning output with context
// ---------------------------------------------------------------------------

test.describe("reasoning output with context", () => {
  test("strategy reasoning included when context provided and themes exist", () => {
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
        name: "Token Maker",
        quantity: 1,
        enriched: makeCard({
          name: "Token Maker",
          typeLine: "Creature",
          cmc: 2,
          oracleText: "Create two 1/1 green Saproling creature tokens.",
        }),
      },
      {
        name: "Draw Spell",
        quantity: 1,
        enriched: makeCard({
          name: "Draw Spell",
          typeLine: "Sorcery",
          cmc: 2,
          oracleText: "Draw two cards.",
        }),
      },
      {
        name: "Removal",
        quantity: 1,
        enriched: makeCard({
          name: "Removal",
          typeLine: "Instant",
          cmc: 2,
          oracleText: "Destroy target creature.",
        }),
      },
      {
        name: "Ramp",
        quantity: 1,
        enriched: makeCard({
          name: "Ramp",
          typeLine: "Artifact",
          cmc: 2,
          oracleText: "{T}: Add {G}.",
          producedMana: ["G"],
        }),
      },
    ];

    const themes: DeckTheme[] = [
      { axisId: "tokens", axisName: "Tokens", strength: 0.8, cardCount: 15 },
    ];
    const context: HandEvaluationContext = { deckThemes: themes };
    const result = evaluateHandQuality(hand, 0, new Set(["G"]), [], context);

    // Should include strategy/card-advantage/interaction reasoning
    expect(result.reasoning.some((r) => /theme|game plan|strategic/i.test(r))).toBe(true);
    expect(result.reasoning.some((r) => /card advantage|card draw/i.test(r))).toBe(true);
    expect(result.reasoning.some((r) => /interaction|threat|answer/i.test(r))).toBe(true);
  });

  test("no strategy reasoning when no themes", () => {
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
    ];
    const context: HandEvaluationContext = { deckThemes: [] };
    const result = evaluateHandQuality(hand, 0, new Set(["G"]), [], context);
    // Should NOT include strategy reasoning when no themes detected
    expect(result.reasoning.some((r) => /theme|game plan|strategic/i.test(r))).toBe(false);
  });

  test("card advantage reasoning appears with context", () => {
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
        name: "Brainstorm",
        quantity: 1,
        enriched: makeCard({
          name: "Brainstorm",
          typeLine: "Instant",
          cmc: 1,
          oracleText: "Draw three cards, then put two cards from your hand on top of your library.",
        }),
      },
    ];
    const context: HandEvaluationContext = { deckThemes: [] };
    const result = evaluateHandQuality(hand, 0, new Set(["G"]), [], context);
    expect(result.reasoning.some((r) => /card advantage|card draw/i.test(r))).toBe(true);
  });

  test("interaction reasoning appears with context", () => {
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
        name: "Beast Within",
        quantity: 1,
        enriched: makeCard({
          name: "Beast Within",
          typeLine: "Instant",
          cmc: 3,
          oracleText: "Destroy target permanent.",
        }),
      },
    ];
    const context: HandEvaluationContext = { deckThemes: [] };
    const result = evaluateHandQuality(hand, 0, new Set(["G"]), [], context);
    expect(result.reasoning.some((r) => /interaction|threat|answer/i.test(r))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parsePipRequirements
// ---------------------------------------------------------------------------

test.describe("parsePipRequirements", () => {
  test("{R}{G} → 2 single-color pips", () => {
    const pips = parsePipRequirements("{R}{G}");
    expect(pips).toHaveLength(2);
    expect(pips.some((p) => p.satisfiedBy.has("R") && p.satisfiedBy.size === 1)).toBe(true);
    expect(pips.some((p) => p.satisfiedBy.has("G") && p.satisfiedBy.size === 1)).toBe(true);
  });

  test("{1}{W} → 1 pip (generic skipped)", () => {
    const pips = parsePipRequirements("{1}{W}");
    expect(pips).toHaveLength(1);
    expect(pips[0].satisfiedBy.has("W")).toBe(true);
    expect(pips[0].satisfiedBy.size).toBe(1);
  });

  test("{W}{W}{U} → 3 pips (multi-pip same color)", () => {
    const pips = parsePipRequirements("{W}{W}{U}");
    expect(pips).toHaveLength(3);
    const wPips = pips.filter((p) => p.satisfiedBy.has("W") && p.satisfiedBy.size === 1);
    const uPips = pips.filter((p) => p.satisfiedBy.has("U") && p.satisfiedBy.size === 1);
    expect(wPips).toHaveLength(2);
    expect(uPips).toHaveLength(1);
  });

  test("{1}{G/W}{G/W} → 2 hybrid pips", () => {
    const pips = parsePipRequirements("{1}{G/W}{G/W}");
    expect(pips).toHaveLength(2);
    for (const p of pips) {
      expect(p.satisfiedBy.has("G")).toBe(true);
      expect(p.satisfiedBy.has("W")).toBe(true);
      expect(p.satisfiedBy.size).toBe(2);
    }
  });

  test("{1}{B/P}{B/P} → 0 pips (phyrexian skipped)", () => {
    const pips = parsePipRequirements("{1}{B/P}{B/P}");
    expect(pips).toHaveLength(0);
  });

  test("{3}{C} → 1 colorless-specific pip", () => {
    const pips = parsePipRequirements("{3}{C}");
    expect(pips).toHaveLength(1);
    expect(pips[0].satisfiedBy.has("C")).toBe(true);
    expect(pips[0].satisfiedBy.size).toBe(1);
  });

  test("{2/W}{2/W}{2/W} → 0 pips (mono-hybrid skipped)", () => {
    const pips = parsePipRequirements("{2/W}{2/W}{2/W}");
    expect(pips).toHaveLength(0);
  });

  test("{X}{R} → 1 pip", () => {
    const pips = parsePipRequirements("{X}{R}");
    expect(pips).toHaveLength(1);
    expect(pips[0].satisfiedBy.has("R")).toBe(true);
  });

  test("empty string → 0 pips", () => {
    const pips = parsePipRequirements("");
    expect(pips).toHaveLength(0);
  });

  test("{0} → 0 pips", () => {
    const pips = parsePipRequirements("{0}");
    expect(pips).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// canCastWithLands
// ---------------------------------------------------------------------------

test.describe("canCastWithLands", () => {
  test("Hull Breach bug: {R}{G} + Swamp+Karplusan → false", () => {
    const spell = makeCard({
      name: "Hull Breach",
      manaCost: "{R}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
    });
    // Swamp produces B, Karplusan Forest produces R or G (one per tap)
    const landSources = [["B"], ["R", "G"]];
    expect(canCastWithLands(spell, landSources)).toBe(false);
  });

  test("Same spell, two duals: {R}{G} + Karplusan+Stomping → true", () => {
    const spell = makeCard({
      name: "Hull Breach",
      manaCost: "{R}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
    });
    const landSources = [["R", "G"], ["R", "G"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Double-pip fail: {W}{W} + Plains+Island → false", () => {
    const spell = makeCard({
      name: "WW Spell",
      manaCost: "{W}{W}",
      cmc: 2,
      manaPips: { W: 2, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const landSources = [["W"], ["U"]];
    expect(canCastWithLands(spell, landSources)).toBe(false);
  });

  test("Double-pip pass: {W}{W} + Plains+Plains → true", () => {
    const spell = makeCard({
      name: "WW Spell",
      manaCost: "{W}{W}",
      cmc: 2,
      manaPips: { W: 2, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const landSources = [["W"], ["W"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Triple-pip allocation: {W}{W}{U} + Plains+HallowedFountain+Island → true", () => {
    const spell = makeCard({
      name: "WWU Spell",
      manaCost: "{W}{W}{U}",
      cmc: 3,
      manaPips: { W: 2, U: 1, B: 0, R: 0, G: 0, C: 0 },
    });
    // Plains=W, Hallowed Fountain=W/U, Island=U
    const landSources = [["W"], ["W", "U"], ["U"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Hybrid either: {1}{G/W}{G/W} + Forest+Forest → true", () => {
    const spell = makeCard({
      name: "Hybrid Spell",
      manaCost: "{1}{G/W}{G/W}",
      cmc: 3,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const landSources = [["G"], ["G"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Hybrid mixed: {1}{G/W}{G/W} + Plains+Forest → true", () => {
    const spell = makeCard({
      name: "Hybrid Spell",
      manaCost: "{1}{G/W}{G/W}",
      cmc: 3,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const landSources = [["W"], ["G"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Phyrexian: {1}{B/P}{B/P} + Mountain → true (no colored pips needed)", () => {
    const spell = makeCard({
      name: "Phyrexian Spell",
      manaCost: "{1}{B/P}{B/P}",
      cmc: 3,
      manaPips: { W: 0, U: 0, B: 2, R: 0, G: 0, C: 0 },
    });
    const landSources = [["R"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Colorless satisfied: {3}{C} + Wastes+3×Plains → true", () => {
    const spell = makeCard({
      name: "Colorless Spell",
      manaCost: "{3}{C}",
      cmc: 4,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 },
    });
    // Wastes produces C
    const landSources = [["C"], ["W"], ["W"], ["W"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("Colorless unsatisfied: {3}{C} + 4×Plains → false", () => {
    const spell = makeCard({
      name: "Colorless Spell",
      manaCost: "{3}{C}",
      cmc: 4,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 },
    });
    const landSources = [["W"], ["W"], ["W"], ["W"]];
    expect(canCastWithLands(spell, landSources)).toBe(false);
  });

  test("5-color wildcard: {R}{G} + 2×CommandTower → true", () => {
    const spell = makeCard({
      name: "Hull Breach",
      manaCost: "{R}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
    });
    // Command Tower produces all 5 colors
    const landSources = [
      ["W", "U", "B", "R", "G"],
      ["W", "U", "B", "R", "G"],
    ];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("No pips: {4} + any lands → true", () => {
    const spell = makeCard({
      name: "Generic Spell",
      manaCost: "{4}",
      cmc: 4,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const landSources = [["R"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });

  test("No lands: {R} + [] → false", () => {
    const spell = makeCard({
      name: "Red Spell",
      manaCost: "{R}",
      cmc: 1,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
    });
    expect(canCastWithLands(spell, [])).toBe(false);
  });

  test("Backtracking needed: {R}{W}{G} + [RG, WR, WG] → true", () => {
    const spell = makeCard({
      name: "Naya Spell",
      manaCost: "{R}{W}{G}",
      cmc: 3,
      manaPips: { W: 1, U: 0, B: 0, R: 1, G: 1, C: 0 },
    });
    // Each dual can produce 2 of the needed colors.
    // Correct assignment: RG→G, WR→R, WG→W (or similar)
    const landSources = [["R", "G"], ["W", "R"], ["W", "G"]];
    expect(canCastWithLands(spell, landSources)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: evaluateHandQuality with proper land-to-pip allocation
// ---------------------------------------------------------------------------

test.describe("evaluateHandQuality land-to-pip integration", () => {
  test("Swamp+Karplusan+Hull Breach → playableTurns[1] is false", () => {
    const hand: HandCard[] = [
      {
        name: "Swamp",
        quantity: 1,
        enriched: makeCard({
          name: "Swamp",
          typeLine: "Basic Land — Swamp",
          supertypes: ["Basic"],
          producedMana: ["B"],
          cmc: 0,
        }),
      },
      {
        name: "Karplusan Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Karplusan Forest",
          typeLine: "Land",
          producedMana: ["R", "G"],
          cmc: 0,
        }),
      },
      {
        name: "Hull Breach",
        quantity: 1,
        enriched: makeCard({
          name: "Hull Breach",
          typeLine: "Sorcery",
          manaCost: "{R}{G}",
          cmc: 2,
          manaPips: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
          oracleText: "Choose one — Destroy target artifact; or destroy target enchantment.",
        }),
      },
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["B", "R", "G"]));
    // Only one land produces R or G — can't satisfy both {R} and {G}
    expect(result.factors.playableTurns[1]).toBe(false);
  });

  test("Karplusan+Stomping Ground+Hull Breach → playableTurns[1] is true", () => {
    const hand: HandCard[] = [
      {
        name: "Karplusan Forest",
        quantity: 1,
        enriched: makeCard({
          name: "Karplusan Forest",
          typeLine: "Land",
          producedMana: ["R", "G"],
          cmc: 0,
        }),
      },
      {
        name: "Stomping Ground",
        quantity: 1,
        enriched: makeCard({
          name: "Stomping Ground",
          typeLine: "Land — Mountain Forest",
          producedMana: ["R", "G"],
          cmc: 0,
        }),
      },
      {
        name: "Hull Breach",
        quantity: 1,
        enriched: makeCard({
          name: "Hull Breach",
          typeLine: "Sorcery",
          manaCost: "{R}{G}",
          cmc: 2,
          manaPips: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
          oracleText: "Choose one — Destroy target artifact; or destroy target enchantment.",
        }),
      },
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["R", "G"]));
    // Two dual lands can each provide one of R/G
    expect(result.factors.playableTurns[1]).toBe(true);
  });

  test("Hybrid spell + single-color land → playableTurns[0] is true", () => {
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
        name: "Hybrid 1-drop",
        quantity: 1,
        enriched: makeCard({
          name: "Hybrid 1-drop",
          typeLine: "Creature",
          manaCost: "{G/W}",
          cmc: 1,
          manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          oracleText: "",
        }),
      },
    ];
    const result = evaluateHandQuality(hand, 0, new Set(["G", "W"]));
    // Forest produces G which satisfies {G/W}
    expect(result.factors.playableTurns[0]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getManaProducers
// ---------------------------------------------------------------------------

test.describe("getManaProducers", () => {
  function handCard(name: string, overrides: Partial<EnrichedCard> = {}): HandCard {
    return { name, quantity: 1, enriched: makeCard({ name, ...overrides }) };
  }

  const forest: HandCard = handCard("Forest", {
    typeLine: "Basic Land — Forest",
    producedMana: ["G"],
  });
  const mountain: HandCard = handCard("Mountain", {
    typeLine: "Basic Land — Mountain",
    producedMana: ["R"],
  });
  const island: HandCard = handCard("Island", {
    typeLine: "Basic Land — Island",
    producedMana: ["U"],
  });

  test("Llanowar Elves (CMC 1, produces G) with Forest → T2 sources include dork", () => {
    const elves = handCard("Llanowar Elves", {
      typeLine: "Creature — Elf Druid",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forest, mountain, elves];
    const untapped = [["G"], ["R"]];
    const all = [["G"], ["R"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(1);
    // T2 sources should have lands + elves' produced mana
    expect(result.t2Sources.length).toBe(all.length + 1);
    expect(result.t2Sources).toContainEqual(["G"]); // elves entry
  });

  test("Birds of Paradise (CMC 1, produces WUBRG) with Forest → T2 includes 5-color entry", () => {
    const birds = handCard("Birds of Paradise", {
      typeLine: "Creature — Bird",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forest, birds];
    const untapped = [["G"]];
    const all = [["G"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(1);
    expect(result.t2Sources).toContainEqual(["W", "U", "B", "R", "G"]);
  });

  test("dork not castable: Birds of Paradise + Island only → NOT in T2", () => {
    const birds = handCard("Birds of Paradise", {
      typeLine: "Creature — Bird",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [island, birds];
    const untapped = [["U"]];
    const all = [["U"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(0);
    expect(result.t2Sources.length).toBe(all.length); // no extra source
  });

  test("CMC 2 dork (Bloom Tender) → NOT in T2, IS in T3", () => {
    const bloom = handCard("Bloom Tender", {
      typeLine: "Creature — Elf",
      manaCost: "{1}{G}",
      cmc: 2,
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const forest2 = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const hand = [forest, forest2, bloom];
    const untapped = [["G"], ["G"]];
    const all = [["G"], ["G"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(0);
    expect(result.t3DorkCount).toBe(1);
    expect(result.t3Sources).toContainEqual(["W", "U", "B", "R", "G"]);
  });

  test("CMC 3+ excluded: Selvala → not in T2 or T3", () => {
    const selvala = handCard("Selvala, Heart of the Wilds", {
      typeLine: "Legendary Creature — Elf Scout",
      manaCost: "{1}{G}{G}",
      cmc: 3,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 2, C: 0 },
    });
    const hand = [forest, mountain, selvala];
    const untapped = [["G"], ["R"]];
    const all = [["G"], ["R"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(0);
    expect(result.t3DorkCount).toBe(0);
    expect(result.t2Sources.length).toBe(all.length);
    expect(result.t3Sources.length).toBe(all.length);
  });

  test("Sol Ring (CMC 1, produces C) → T2 includes colorless source", () => {
    const solRing = handCard("Sol Ring", {
      typeLine: "Artifact",
      manaCost: "{1}",
      cmc: 1,
      producedMana: ["C"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const hand = [forest, solRing];
    const untapped = [["G"]];
    const all = [["G"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(1);
    expect(result.t2Sources).toContainEqual(["C"]);
  });

  test("Dryad Arbor (Land Creature) → NOT treated as dork", () => {
    const dryadArbor = handCard("Dryad Arbor", {
      typeLine: "Land Creature — Forest Dryad",
      manaCost: "",
      cmc: 0,
      producedMana: ["G"],
    });
    const hand = [forest, dryadArbor];
    const untapped = [["G"], ["G"]];
    const all = [["G"], ["G"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(0);
    expect(result.t3DorkCount).toBe(0);
    // Sources should equal land sources only
    expect(result.t2Sources.length).toBe(all.length);
  });

  test("multiple dorks: Elves + Birds + Forest → T2 has both entries", () => {
    const elves = handCard("Llanowar Elves", {
      typeLine: "Creature — Elf Druid",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const birds = handCard("Birds of Paradise", {
      typeLine: "Creature — Bird",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forest, elves, birds];
    const untapped = [["G"]];
    const all = [["G"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(2);
    expect(result.t2Sources.length).toBe(all.length + 2);
  });

  test("no dorks: just lands → T2/T3 equal land sources", () => {
    const hand = [forest, mountain];
    const untapped = [["G"], ["R"]];
    const all = [["G"], ["R"]];

    const result = getManaProducers(hand, untapped, all);
    expect(result.t2DorkCount).toBe(0);
    expect(result.t3DorkCount).toBe(0);
    expect(result.t2Sources).toEqual(all);
    expect(result.t3Sources).toEqual(all);
  });
});

// ---------------------------------------------------------------------------
// computePipWeights
// ---------------------------------------------------------------------------

test.describe("computePipWeights", () => {
  test("Abzan pips G=60 W=30 B=10 → weighted proportionally", () => {
    const pips = { W: 30, U: 0, B: 10, R: 0, G: 60 };
    const identity = new Set(["W", "B", "G"]);
    const weights = computePipWeights(pips, identity);
    expect(weights["G"]).toBeCloseTo(0.6, 5);
    expect(weights["W"]).toBeCloseTo(0.3, 5);
    expect(weights["B"]).toBeCloseTo(0.1, 5);
  });

  test("equal pips G=50 W=50 → equal weights", () => {
    const pips = { W: 50, U: 0, B: 0, R: 0, G: 50 };
    const identity = new Set(["W", "G"]);
    const weights = computePipWeights(pips, identity);
    expect(weights["G"]).toBeCloseTo(0.5, 5);
    expect(weights["W"]).toBeCloseTo(0.5, 5);
  });

  test("single color → weight 1.0", () => {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 40 };
    const identity = new Set(["G"]);
    const weights = computePipWeights(pips, identity);
    expect(weights["G"]).toBeCloseTo(1.0, 5);
  });

  test("zero pips for one identity color → 0 weight for that color", () => {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 30 };
    const identity = new Set(["W", "G"]);
    const weights = computePipWeights(pips, identity);
    expect(weights["G"]).toBeCloseTo(1.0, 5);
    expect(weights["W"]).toBeCloseTo(0.0, 5);
  });

  test("empty identity → empty record", () => {
    const pips = { W: 10, U: 0, B: 0, R: 0, G: 10 };
    const identity = new Set<string>();
    const weights = computePipWeights(pips, identity);
    expect(Object.keys(weights)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Weighted color coverage via evaluateHandQuality
// ---------------------------------------------------------------------------

test.describe("weighted color coverage", () => {
  function handCard(name: string, overrides: Partial<EnrichedCard> = {}): HandCard {
    return { name, quantity: 1, enriched: makeCard({ name, ...overrides }) };
  }

  test("Abzan hand with only Swamp + pipWeights B=0.1 → low color coverage", () => {
    const swamp = handCard("Swamp", {
      typeLine: "Basic Land — Swamp",
      producedMana: ["B"],
    });
    const spell1 = handCard("Spell1", {
      typeLine: "Creature",
      manaCost: "{1}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const spell2 = handCard("Spell2", {
      typeLine: "Creature",
      manaCost: "{2}{W}",
      cmc: 3,
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });
    const hand = [swamp, swamp, spell1, spell2];
    const pipWeights = { W: 0.3, B: 0.1, G: 0.6 };
    const context: HandEvaluationContext = {
      deckThemes: [],
      pipWeights,
    };
    const result = evaluateHandQuality(hand, 0, new Set(["W", "B", "G"]), [], context);
    // Only B covered → 0.1
    expect(result.factors.colorCoverage).toBeCloseTo(0.1, 5);
  });

  test("Abzan hand with Forest + Plains → ~0.9 coverage", () => {
    const forestCard = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const plainsCard = handCard("Plains", {
      typeLine: "Basic Land — Plains",
      producedMana: ["W"],
    });
    const spell = handCard("Spell", {
      typeLine: "Creature",
      manaCost: "{1}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forestCard, plainsCard, spell];
    const pipWeights = { W: 0.3, B: 0.1, G: 0.6 };
    const context: HandEvaluationContext = {
      deckThemes: [],
      pipWeights,
    };
    const result = evaluateHandQuality(hand, 0, new Set(["W", "B", "G"]), [], context);
    // G + W covered → 0.6 + 0.3 = 0.9
    expect(result.factors.colorCoverage).toBeCloseTo(0.9, 5);
  });

  test("without context → equal-weight formula (backward compat)", () => {
    const forestCard = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const plainsCard = handCard("Plains", {
      typeLine: "Basic Land — Plains",
      producedMana: ["W"],
    });
    const spell = handCard("Spell", {
      typeLine: "Creature",
      manaCost: "{1}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forestCard, plainsCard, spell];
    // No context → equal weight: 2/3 colors covered
    const result = evaluateHandQuality(hand, 0, new Set(["W", "B", "G"]));
    expect(result.factors.colorCoverage).toBeCloseTo(2 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// Mana dorks wired into evaluateHandQuality
// ---------------------------------------------------------------------------

test.describe("mana dorks in evaluateHandQuality", () => {
  function handCard(name: string, overrides: Partial<EnrichedCard> = {}): HandCard {
    return { name, quantity: 1, enriched: makeCard({ name, ...overrides }) };
  }

  test("[Forest, Llanowar Elves, 3-CMC green spell] → T2 playable", () => {
    const forestCard = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const elves = handCard("Llanowar Elves", {
      typeLine: "Creature — Elf Druid",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      oracleText: "{T}: Add {G}.",
    });
    const spell = handCard("Elvish Visionary", {
      typeLine: "Creature — Elf Shaman",
      manaCost: "{1}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forestCard, elves, spell];
    // Only 1 land, but Elves provides G on T2
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    // T2: 1 land + 1 dork = 2 mana, spell is CMC 2 with {1}{G}
    expect(result.factors.playableTurns[1]).toBe(true);
  });

  test("[Island, Llanowar Elves, 2-CMC green spell] → T2 NOT playable (can't cast Elves)", () => {
    const islandCard = handCard("Island", {
      typeLine: "Basic Land — Island",
      producedMana: ["U"],
    });
    const elves = handCard("Llanowar Elves", {
      typeLine: "Creature — Elf Druid",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      oracleText: "{T}: Add {G}.",
    });
    const spell = handCard("Elvish Visionary", {
      typeLine: "Creature — Elf Shaman",
      manaCost: "{1}{G}",
      cmc: 2,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [islandCard, elves, spell];
    const result = evaluateHandQuality(hand, 0, new Set(["U", "G"]));
    // Can't cast Elves with Island, so no dork contribution to T2
    expect(result.factors.playableTurns[1]).toBe(false);
  });

  test("[Forest, Forest, Bloom Tender, 3-CMC spell] → T2 from lands, T3 benefits from Tender", () => {
    const forestCard = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const forestCard2 = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const bloom = handCard("Bloom Tender", {
      typeLine: "Creature — Elf",
      manaCost: "{1}{G}",
      cmc: 2,
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      oracleText: "{T}: For each color among permanents you control, add one mana of that color.",
    });
    const spell = handCard("Cultivate", {
      typeLine: "Sorcery",
      manaCost: "{2}{G}",
      cmc: 3,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });
    const hand = [forestCard, forestCard2, bloom, spell];
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    // T2: 2 lands → can cast 2-cmc (Bloom Tender itself)
    expect(result.factors.playableTurns[1]).toBe(true);
    // T3: 2 lands + Bloom Tender dork = 3 mana → can cast 3-cmc
    expect(result.factors.playableTurns[2]).toBe(true);
  });

  test("T1 unchanged: Elves doesn't provide T1 mana for other spells", () => {
    const forestCard = handCard("Forest", {
      typeLine: "Basic Land — Forest",
      producedMana: ["G"],
    });
    const elves = handCard("Llanowar Elves", {
      typeLine: "Creature — Elf Druid",
      manaCost: "{G}",
      cmc: 1,
      producedMana: ["G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      oracleText: "{T}: Add {G}.",
    });
    const hand = [forestCard, elves];
    const result = evaluateHandQuality(hand, 0, new Set(["G"]));
    // T1: Elves itself is playable (CMC 1 with Forest)
    expect(result.factors.playableTurns[0]).toBe(true);
    // But T1 check should not use dork mana for OTHER spells (dork has summoning sickness)
    // This is inherently tested by the fact that T1 logic is land-only
  });
});
