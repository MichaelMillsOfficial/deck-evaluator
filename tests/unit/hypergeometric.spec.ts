import { test, expect } from "@playwright/test";
import {
  logChoose,
  hypergeometricPmf,
  hypergeometricCdf,
  computeProbabilityCurve,
  countCardsByTag,
  getDeckSize,
  countCardsByName,
  computePrecomputedQueries,
  getAvailableCategories,
} from "../../src/lib/hypergeometric";
import type { EnrichedCard } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// logChoose
// ---------------------------------------------------------------------------

test.describe("logChoose", () => {
  test("C(0,0) = 1 (log = 0)", () => {
    expect(Math.round(Math.exp(logChoose(0, 0)))).toBe(1);
  });

  test("C(5,0) = 1 (log = 0)", () => {
    expect(Math.round(Math.exp(logChoose(5, 0)))).toBe(1);
  });

  test("C(5,5) = 1 (log = 0)", () => {
    expect(Math.round(Math.exp(logChoose(5, 5)))).toBe(1);
  });

  test("C(10,3) = 120", () => {
    const result = Math.exp(logChoose(10, 3));
    expect(Math.round(result)).toBe(120);
  });

  test("C(99,7) is a finite positive number (no overflow)", () => {
    const logVal = logChoose(99, 7);
    expect(isFinite(logVal)).toBe(true);
    expect(logVal).toBeGreaterThan(0);
    // C(99,7) = 14,887,031,544 ≈ 1.49e10
    const val = Math.exp(logVal);
    expect(val).toBeGreaterThan(1e9);
    expect(val).toBeLessThan(1e11);
  });

  test("k > n returns -Infinity (impossible)", () => {
    expect(logChoose(5, 6)).toBe(-Infinity);
    expect(logChoose(0, 1)).toBe(-Infinity);
  });

  test("k < 0 returns -Infinity", () => {
    expect(logChoose(5, -1)).toBe(-Infinity);
  });
});

// ---------------------------------------------------------------------------
// hypergeometricPmf
// ---------------------------------------------------------------------------

test.describe("hypergeometricPmf", () => {
  test("K=0, k=0: probability is 1 (must draw 0 successes)", () => {
    // N=10 cards, K=0 successes in deck, draw 5, want 0
    const p = hypergeometricPmf(10, 0, 5, 0);
    expect(p).toBeCloseTo(1.0, 5);
  });

  test("K=0, k=1: probability is 0 (cannot draw success when none exist)", () => {
    const p = hypergeometricPmf(10, 0, 5, 1);
    expect(p).toBeCloseTo(0.0, 5);
  });

  test("k > K returns 0", () => {
    // Can't draw 5 successes if only 3 exist
    const p = hypergeometricPmf(10, 3, 5, 5);
    expect(p).toBeCloseTo(0.0, 5);
  });

  test("known simple case: N=10, K=3, n=5, k=2", () => {
    // P(X=2) = C(3,2)*C(7,3)/C(10,5)
    // = 3 * 35 / 252 = 105/252 ≈ 0.4167
    const p = hypergeometricPmf(10, 3, 5, 2);
    expect(p).toBeCloseTo(105 / 252, 4);
  });

  test("all K cards in deck, draw n = K: P(X=K)=1", () => {
    // N=5, K=5, draw 5 — must get all 5
    const p = hypergeometricPmf(5, 5, 5, 5);
    expect(p).toBeCloseTo(1.0, 5);
  });

  test("n=0 and k=0: probability is 1", () => {
    const p = hypergeometricPmf(10, 3, 0, 0);
    expect(p).toBeCloseTo(1.0, 5);
  });

  test("n=0 and k>0: probability is 0", () => {
    const p = hypergeometricPmf(10, 3, 0, 1);
    expect(p).toBeCloseTo(0.0, 5);
  });
});

// ---------------------------------------------------------------------------
// hypergeometricCdf (P(X >= k))
// ---------------------------------------------------------------------------

test.describe("hypergeometricCdf", () => {
  test("P(X >= 0) = 1.0 always", () => {
    expect(hypergeometricCdf(99, 37, 7, 0)).toBeCloseTo(1.0, 5);
    expect(hypergeometricCdf(10, 3, 5, 0)).toBeCloseTo(1.0, 5);
  });

  test("P(X >= 1) with K=0 = 0 (no successes in deck)", () => {
    const p = hypergeometricCdf(10, 0, 5, 1);
    expect(p).toBeCloseTo(0.0, 5);
  });

  test("known verification: 37 lands in 99-card deck, draw 7, P(X>=2) ≈ 0.81", () => {
    // Canonical Commander probability: P(at least 2 lands in opening 7)
    // with 37 lands in 99-card library
    const p = hypergeometricCdf(99, 37, 7, 2);
    expect(p).toBeGreaterThan(0.78);
    expect(p).toBeLessThan(0.86);
    expect(p).toBeCloseTo(0.81, 1);
  });

  test("37 lands in 99-card deck, draw 7, P(X>=3) ≈ 0.52", () => {
    // P(at least 3 lands) is lower — about 52%
    const p = hypergeometricCdf(99, 37, 7, 3);
    expect(p).toBeGreaterThan(0.48);
    expect(p).toBeLessThan(0.56);
    expect(p).toBeCloseTo(0.52, 1);
  });

  test("P(X >= k) is non-negative and at most 1", () => {
    for (let k = 0; k <= 5; k++) {
      const p = hypergeometricCdf(99, 37, 7, k);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  test("P(X >= k) is non-increasing as k increases", () => {
    let prev = 1.0;
    for (let k = 1; k <= 8; k++) {
      const p = hypergeometricCdf(99, 37, 7, k);
      expect(p).toBeLessThanOrEqual(prev + 1e-10);
      prev = p;
    }
  });

  test("k > K: probability is 0 (impossible to draw more than exist)", () => {
    // Only 3 successes in deck, cannot draw 5 of them
    const p = hypergeometricCdf(10, 3, 7, 4);
    expect(p).toBeCloseTo(0.0, 5);
  });
});

// ---------------------------------------------------------------------------
// computeProbabilityCurve
// ---------------------------------------------------------------------------

test.describe("computeProbabilityCurve", () => {
  test("returns maxTurns points", () => {
    const curve = computeProbabilityCurve(99, 37, 3, 10, 7);
    expect(curve).toHaveLength(10);
  });

  test("turn numbers are 1 through maxTurns", () => {
    const curve = computeProbabilityCurve(99, 37, 3, 10, 7);
    for (let i = 0; i < 10; i++) {
      expect(curve[i].turn).toBe(i + 1);
    }
  });

  test("turn 1 matches direct cdf call with openingHandSize draws", () => {
    // Turn 1: you draw your opening hand (7 cards), then no additional draws yet
    const curve = computeProbabilityCurve(99, 37, 3, 5, 7);
    const directCdf = hypergeometricCdf(99, 37, 7, 3);
    expect(curve[0].probability).toBeCloseTo(directCdf, 5);
  });

  test("probability is non-decreasing across turns (more draws = more likely)", () => {
    const curve = computeProbabilityCurve(99, 37, 1, 10, 7);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].probability).toBeGreaterThanOrEqual(
        curve[i - 1].probability - 1e-10
      );
    }
  });

  test("probabilities are in [0, 1]", () => {
    const curve = computeProbabilityCurve(99, 37, 3, 10, 7);
    for (const point of curve) {
      expect(point.probability).toBeGreaterThanOrEqual(0);
      expect(point.probability).toBeLessThanOrEqual(1);
    }
  });

  test("K=0 produces all-zero curve", () => {
    const curve = computeProbabilityCurve(99, 0, 1, 5, 7);
    for (const point of curve) {
      expect(point.probability).toBeCloseTo(0, 5);
    }
  });

  test("turn 2 draws openingHandSize + 1 cards", () => {
    // Turn 2: opened 7, drew 1 more = 8 draws
    const curve = computeProbabilityCurve(99, 37, 3, 5, 7);
    const directCdf = hypergeometricCdf(99, 37, 8, 3);
    expect(curve[1].probability).toBeCloseTo(directCdf, 5);
  });
});

// ---------------------------------------------------------------------------
// countCardsByTag
// ---------------------------------------------------------------------------

test.describe("countCardsByTag", () => {
  const cardMap: Record<string, EnrichedCard> = {
    "Sol Ring": makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
    }),
    Counterspell: makeCard({
      name: "Counterspell",
      typeLine: "Instant",
      oracleText: "Counter target spell.",
    }),
    "Lightning Bolt": makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to target creature or player.",
    }),
  };

  test("counts Ramp cards (Sol Ring is Ramp)", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Counterspell", quantity: 2 },
      ],
    });
    const count = countCardsByTag(deck, cardMap, "Ramp");
    expect(count).toBe(1);
  });

  test("respects quantity in count", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 3 }],
    });
    const count = countCardsByTag(deck, cardMap, "Ramp");
    expect(count).toBe(3);
  });

  test("returns 0 for absent tag", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Counterspell", quantity: 2 }],
    });
    const count = countCardsByTag(deck, cardMap, "Ramp");
    expect(count).toBe(0);
  });

  test("excludes commanders from count (not in library)", () => {
    const cmdCardMap: Record<string, EnrichedCard> = {
      "Selvala, Heart of the Wilds": makeCard({
        name: "Selvala, Heart of the Wilds",
        typeLine: "Legendary Creature — Elf Scout",
        oracleText:
          "{T}: Add mana of any one color equal to the greatest power among creatures you control.",
      }),
    };
    const deck = makeDeck({
      commanders: [{ name: "Selvala, Heart of the Wilds", quantity: 1 }],
    });
    // Commander is in command zone, not library — should not count
    const count = countCardsByTag(deck, cmdCardMap, "Ramp");
    expect(count).toBe(0);
  });

  test("excludes sideboard cards", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
      sideboard: [{ name: "Sol Ring", quantity: 2 }],
    });
    const count = countCardsByTag(deck, cardMap, "Ramp");
    expect(count).toBe(1); // only mainboard quantity
  });

  test("returns 0 for Counterspell tag when no counters", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const count = countCardsByTag(deck, cardMap, "Counterspell");
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getDeckSize
// ---------------------------------------------------------------------------

test.describe("getDeckSize", () => {
  test("sums mainboard quantity only, excludes commanders and sideboard", () => {
    const deck = makeDeck({
      commanders: [{ name: "A", quantity: 1 }],
      mainboard: [
        { name: "B", quantity: 3 },
        { name: "C", quantity: 2 },
      ],
      sideboard: [{ name: "D", quantity: 10 }],
    });
    expect(getDeckSize(deck)).toBe(5); // 3 + 2, commanders + sideboard excluded
  });

  test("empty deck returns 0", () => {
    expect(getDeckSize(makeDeck())).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countCardsByName
// ---------------------------------------------------------------------------

test.describe("countCardsByName", () => {
  test("returns quantity from mainboard", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    expect(countCardsByName(deck, "Sol Ring")).toBe(1);
  });

  test("returns 0 when card not in deck", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    expect(countCardsByName(deck, "Counterspell")).toBe(0);
  });

  test("excludes commanders (not in library)", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa", quantity: 1 }],
    });
    expect(countCardsByName(deck, "Atraxa")).toBe(0);
  });

  test("excludes sideboard", () => {
    const deck = makeDeck({
      sideboard: [{ name: "Rest in Peace", quantity: 2 }],
    });
    expect(countCardsByName(deck, "Rest in Peace")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computePrecomputedQueries
// ---------------------------------------------------------------------------

test.describe("computePrecomputedQueries", () => {
  // Build a small Commander deck with lands and ramp
  const landCard = makeCard({
    typeLine: "Basic Land — Forest",
    supertypes: ["Basic"],
    subtypes: ["Forest"],
    oracleText: "({T}: Add {G}.)",
    producedMana: ["G"],
  });

  const rampCard = makeCard({
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    producedMana: ["C"],
  });

  const drawCard = makeCard({
    name: "Rhystic Study",
    typeLine: "Enchantment",
    oracleText:
      "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
  });

  const removalCard = makeCard({
    name: "Swords to Plowshares",
    typeLine: "Instant",
    oracleText: "Exile target creature. Its controller gains life equal to its power.",
  });

  const cardMap: Record<string, EnrichedCard> = {
    Forest: { ...landCard, name: "Forest" },
    "Sol Ring": rampCard,
    "Rhystic Study": drawCard,
    "Swords to Plowshares": removalCard,
  };

  const deck = makeDeck({
    commanders: [
      {
        name: "Omnath, Locus of Mana",
        quantity: 1,
      },
    ],
    mainboard: [
      { name: "Forest", quantity: 37 },
      { name: "Sol Ring", quantity: 1 },
      { name: "Rhystic Study", quantity: 1 },
      { name: "Swords to Plowshares", quantity: 1 },
    ],
  });

  test("returns non-empty array when deck has lands", () => {
    const queries = computePrecomputedQueries(deck, cardMap);
    expect(queries.length).toBeGreaterThan(0);
  });

  test("includes a land-related query", () => {
    const queries = computePrecomputedQueries(deck, cardMap);
    const landQuery = queries.find((q) =>
      q.label.toLowerCase().includes("land")
    );
    expect(landQuery).toBeDefined();
  });

  test("all probabilities are in [0, 1]", () => {
    const queries = computePrecomputedQueries(deck, cardMap);
    for (const q of queries) {
      expect(q.probability).toBeGreaterThanOrEqual(0);
      expect(q.probability).toBeLessThanOrEqual(1);
    }
  });

  test("skips queries where category count is 0 (no cards of that type)", () => {
    // Deck with only lands — no ramp/removal/draw
    const deckNoRamp = makeDeck({
      mainboard: [{ name: "Forest", quantity: 40 }],
    });
    const queries = computePrecomputedQueries(deckNoRamp, {
      Forest: { ...landCard, name: "Forest" },
    });
    // Land query should be present, ramp/removal/draw should be skipped
    const rampQuery = queries.find(
      (q) => q.category === "Ramp"
    );
    expect(rampQuery).toBeUndefined();
  });

  test("each query has required fields", () => {
    const queries = computePrecomputedQueries(deck, cardMap);
    for (const q of queries) {
      expect(typeof q.label).toBe("string");
      expect(q.label.length).toBeGreaterThan(0);
      expect(typeof q.description).toBe("string");
      expect(typeof q.probability).toBe("number");
      expect(typeof q.category).toBe("string");
      expect(typeof q.successCount).toBe("number");
      expect(typeof q.drawCount).toBe("number");
      expect(typeof q.desiredSuccesses).toBe("number");
    }
  });

  test("empty deck returns empty array", () => {
    const queries = computePrecomputedQueries(makeDeck(), {});
    expect(queries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getAvailableCategories
// ---------------------------------------------------------------------------

test.describe("getAvailableCategories", () => {
  const cardMap: Record<string, EnrichedCard> = {
    Forest: makeCard({
      name: "Forest",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      oracleText: "({T}: Add {G}.)",
      producedMana: ["G"],
    }),
    "Sol Ring": makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
    }),
    Counterspell: makeCard({
      name: "Counterspell",
      typeLine: "Instant",
      oracleText: "Counter target spell.",
    }),
  };

  test("includes Lands as a category", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 10 }],
    });
    const categories = getAvailableCategories(deck, cardMap);
    const landCat = categories.find((c) => c.label === "Lands");
    expect(landCat).toBeDefined();
    expect(landCat!.count).toBe(10);
  });

  test("excludes zero-count categories", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 5 }],
    });
    const categories = getAvailableCategories(deck, cardMap);
    // No ramp cards in this deck, so Ramp should not appear
    const rampCat = categories.find((c) => c.label === "Ramp");
    expect(rampCat).toBeUndefined();
  });

  test("sorted by count descending", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 10 },
        { name: "Sol Ring", quantity: 1 },
        { name: "Counterspell", quantity: 3 },
      ],
    });
    const categories = getAvailableCategories(deck, cardMap);
    for (let i = 1; i < categories.length; i++) {
      expect(categories[i].count).toBeLessThanOrEqual(categories[i - 1].count);
    }
  });

  test("empty deck returns empty array", () => {
    const categories = getAvailableCategories(makeDeck(), {});
    expect(categories).toHaveLength(0);
  });

  test("each category has label and count", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Counterspell", quantity: 4 }],
    });
    const categories = getAvailableCategories(deck, cardMap);
    for (const cat of categories) {
      expect(typeof cat.label).toBe("string");
      expect(cat.label.length).toBeGreaterThan(0);
      expect(typeof cat.count).toBe("number");
      expect(cat.count).toBeGreaterThan(0);
    }
  });
});
