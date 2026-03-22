import { test, expect } from "@playwright/test";
import {
  compareGoldfishResults,
  type GoldfishComparison,
} from "../../src/lib/goldfish-comparison";
import type { GoldfishResult, GoldfishAggregateStats } from "../../src/lib/goldfish-simulator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<GoldfishAggregateStats> = {}): GoldfishAggregateStats {
  return {
    avgManaByTurn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    avgManaUsedByTurn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    avgSpellsByTurn: [0, 0.5, 1, 1.5, 2, 2, 2, 2, 2, 2],
    avgHandSizeByTurn: [7, 6, 5, 5, 5, 5, 5, 5, 5, 5],
    medianManaByTurn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    commanderCastRate: 0.8,
    avgCommanderTurn: 4.0,
    rampAcceleration: 2.0,
    avgTotalSpellsCast: 15.0,
    rampSources: [],
    ...overrides,
  };
}

function makeResult(statsOverrides: Partial<GoldfishAggregateStats> = {}): GoldfishResult {
  return {
    games: [],
    stats: makeStats(statsOverrides),
    gameSummaries: [],
    notableGames: [],
    pool: [],
    commandZone: [],
  };
}

// ---------------------------------------------------------------------------
// Tests: Basic delta computation
// ---------------------------------------------------------------------------

test.describe("compareGoldfishResults - delta computation", () => {
  test("computes avgManaByTurn deltas (B minus A)", () => {
    const resultA = makeResult({ avgManaByTurn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const resultB = makeResult({ avgManaByTurn: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    // Each delta should be +1 (B has 1 more mana per turn)
    expect(comparison.deltas.avgManaByTurn).toHaveLength(10);
    for (const delta of comparison.deltas.avgManaByTurn) {
      expect(delta).toBeCloseTo(1, 2);
    }
  });

  test("computes avgSpellsByTurn deltas", () => {
    const resultA = makeResult({ avgSpellsByTurn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    const resultB = makeResult({ avgSpellsByTurn: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    for (const delta of comparison.deltas.avgSpellsByTurn) {
      expect(delta).toBeCloseTo(0, 2);
    }
  });

  test("computes commanderCastRate delta", () => {
    const resultA = makeResult({ commanderCastRate: 0.7 });
    const resultB = makeResult({ commanderCastRate: 0.9 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    expect(comparison.deltas.commanderCastRate).toBeCloseTo(0.2, 2);
  });

  test("computes rampAcceleration delta", () => {
    const resultA = makeResult({ rampAcceleration: 1.5 });
    const resultB = makeResult({ rampAcceleration: 3.0 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    expect(comparison.deltas.rampAcceleration).toBeCloseTo(1.5, 2);
  });

  test("computes avgTotalSpellsCast delta", () => {
    const resultA = makeResult({ avgTotalSpellsCast: 12.0 });
    const resultB = makeResult({ avgTotalSpellsCast: 15.5 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    expect(comparison.deltas.avgTotalSpellsCast).toBeCloseTo(3.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Tests: Advantage detection
// ---------------------------------------------------------------------------

test.describe("compareGoldfishResults - advantage detection", () => {
  test("identifies winner as A when A is better for a metric", () => {
    const resultA = makeResult({ avgTotalSpellsCast: 20.0 });
    const resultB = makeResult({ avgTotalSpellsCast: 10.0 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    const spellsAdvantage = comparison.advantages.find(
      (a) => a.metric === "avgTotalSpellsCast"
    );
    expect(spellsAdvantage?.winner).toBe("A");
  });

  test("identifies winner as B when B is better for a metric", () => {
    const resultA = makeResult({ commanderCastRate: 0.5 });
    const resultB = makeResult({ commanderCastRate: 0.9 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    const cmdAdvantage = comparison.advantages.find(
      (a) => a.metric === "commanderCastRate"
    );
    expect(cmdAdvantage?.winner).toBe("B");
  });

  test("identifies tie when metrics are equal", () => {
    const resultA = makeResult({ rampAcceleration: 2.0 });
    const resultB = makeResult({ rampAcceleration: 2.0 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    const rampAdvantage = comparison.advantages.find(
      (a) => a.metric === "rampAcceleration"
    );
    expect(rampAdvantage?.winner).toBe("tie");
  });

  test("magnitude reflects absolute difference", () => {
    const resultA = makeResult({ avgTotalSpellsCast: 10.0 });
    const resultB = makeResult({ avgTotalSpellsCast: 15.0 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    const spellsAdvantage = comparison.advantages.find(
      (a) => a.metric === "avgTotalSpellsCast"
    );
    expect(spellsAdvantage?.magnitude).toBeCloseTo(5.0, 1);
  });

  test("advantages array is non-empty", () => {
    const resultA = makeResult();
    const resultB = makeResult();

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    expect(comparison.advantages.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Result structure
// ---------------------------------------------------------------------------

test.describe("compareGoldfishResults - result structure", () => {
  test("includes deckA and deckB labels in result", () => {
    const resultA = makeResult();
    const resultB = makeResult();

    const comparison = compareGoldfishResults(resultA, "My Deck", resultB, "Reference Deck");
    expect(comparison.deckA.name).toBe("My Deck");
    expect(comparison.deckB.name).toBe("Reference Deck");
  });

  test("includes stats in deckA and deckB", () => {
    const resultA = makeResult({ avgTotalSpellsCast: 10 });
    const resultB = makeResult({ avgTotalSpellsCast: 20 });

    const comparison = compareGoldfishResults(resultA, "Deck A", resultB, "Deck B");
    expect(comparison.deckA.stats.avgTotalSpellsCast).toBe(10);
    expect(comparison.deckB.stats.avgTotalSpellsCast).toBe(20);
  });

  test("deltas array lengths match turn count of longer result", () => {
    const resultA = makeResult({
      avgManaByTurn: [1, 2, 3, 4, 5],
      avgSpellsByTurn: [0, 1, 2, 3, 4],
    });
    const resultB = makeResult({
      avgManaByTurn: [1, 2, 3, 4, 5],
      avgSpellsByTurn: [0, 1, 2, 3, 4],
    });

    const comparison = compareGoldfishResults(resultA, "A", resultB, "B");
    expect(comparison.deltas.avgManaByTurn).toHaveLength(5);
    expect(comparison.deltas.avgSpellsByTurn).toHaveLength(5);
  });

  test("handles empty mana arrays gracefully", () => {
    const resultA = makeResult({ avgManaByTurn: [], avgSpellsByTurn: [] });
    const resultB = makeResult({ avgManaByTurn: [], avgSpellsByTurn: [] });

    expect(() => compareGoldfishResults(resultA, "A", resultB, "B")).not.toThrow();
    const comparison = compareGoldfishResults(resultA, "A", resultB, "B");
    expect(comparison.deltas.avgManaByTurn).toHaveLength(0);
  });

  test("overlay data provided as part of comparison for chart rendering", () => {
    const resultA = makeResult({
      avgManaByTurn: [1, 2, 3, 4, 5],
    });
    const resultB = makeResult({
      avgManaByTurn: [2, 3, 4, 5, 6],
    });

    const comparison = compareGoldfishResults(resultA, "A", resultB, "B");
    // Verify we have the data needed for chart rendering
    expect(comparison.deckA.stats.avgManaByTurn).toBeDefined();
    expect(comparison.deckB.stats.avgManaByTurn).toBeDefined();
    expect(Array.isArray(comparison.deltas.avgManaByTurn)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge cases
// ---------------------------------------------------------------------------

test.describe("compareGoldfishResults - edge cases", () => {
  test("handles identical decks (all ties)", () => {
    const stats = makeStats();
    const resultA: GoldfishResult = { games: [], stats, gameSummaries: [], notableGames: [], pool: [], commandZone: [] };
    const resultB: GoldfishResult = { games: [], stats, gameSummaries: [], notableGames: [], pool: [], commandZone: [] };

    const comparison = compareGoldfishResults(resultA, "A", resultB, "B");
    const nonTies = comparison.advantages.filter((a) => a.winner !== "tie");
    expect(nonTies).toHaveLength(0);
  });

  test("handles decks with different turn counts in arrays", () => {
    const resultA = makeResult({ avgManaByTurn: [1, 2, 3] });
    const resultB = makeResult({ avgManaByTurn: [1, 2, 3, 4, 5] });

    expect(() => compareGoldfishResults(resultA, "A", resultB, "B")).not.toThrow();
  });
});
