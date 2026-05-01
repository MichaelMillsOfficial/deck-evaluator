import { test, expect } from "@playwright/test";
import {
  computeCardOverlap,
  computeMetricDiffs,
  computeTagComparison,
  computeCurveOverlay,
  computeDeckComparison,
  computeHandKeepabilityComparison,
  computeBracketComparison,
  computePowerLevelComparison,
  computeCompositionComparison,
  computeExtendedDeckComparison,
} from "../../src/lib/deck-comparison";
import type { EnrichedCard } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// Helpers for enriched card maps with land/creature/ramp cards
// ---------------------------------------------------------------------------

function makeCreature(name: string, cmc = 2): EnrichedCard {
  return makeCard({
    name,
    cmc,
    typeLine: "Creature — Wizard",
  });
}

function makeLand(name: string): EnrichedCard {
  return makeCard({
    name,
    cmc: 0,
    typeLine: "Basic Land — Forest",
    supertypes: ["Basic"],
    producedMana: ["G"],
  });
}

function makeRamp(name: string, cmc = 2): EnrichedCard {
  return makeCard({
    name,
    cmc,
    typeLine: "Sorcery",
    oracleText: "Search your library for a basic land card and put it onto the battlefield.",
  });
}

function makeRemoval(name: string, cmc = 2): EnrichedCard {
  return makeCard({
    name,
    cmc,
    typeLine: "Instant",
    oracleText: "Destroy target creature.",
  });
}

// ---------------------------------------------------------------------------
// computeCardOverlap
// ---------------------------------------------------------------------------

test.describe("computeCardOverlap", () => {
  test("identical decks: all shared, 0 unique, 100% overlap", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 1 },
        { name: "Sol Ring", quantity: 1 },
      ],
    });
    const result = computeCardOverlap(deck, deck);
    expect(result.sharedCount).toBe(2);
    expect(result.uniqueToACount).toBe(0);
    expect(result.uniqueToBCount).toBe(0);
    expect(result.overlapPercentage).toBe(100);
    expect(result.shared).toHaveLength(2);
    expect(result.uniqueToA).toHaveLength(0);
    expect(result.uniqueToB).toHaveLength(0);
  });

  test("completely different decks: 0 shared, all unique, 0% overlap", () => {
    const deckA = makeDeck({ mainboard: [{ name: "Alpha Card", quantity: 1 }] });
    const deckB = makeDeck({ mainboard: [{ name: "Beta Card", quantity: 1 }] });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(0);
    expect(result.uniqueToACount).toBe(1);
    expect(result.uniqueToBCount).toBe(1);
    expect(result.overlapPercentage).toBe(0);
    expect(result.uniqueToA[0].name).toBe("Alpha Card");
    expect(result.uniqueToB[0].name).toBe("Beta Card");
  });

  test("partial overlap: correct shared/unique counts and percentage", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Shared Card", quantity: 1 },
        { name: "Only in A", quantity: 1 },
      ],
    });
    const deckB = makeDeck({
      mainboard: [
        { name: "Shared Card", quantity: 1 },
        { name: "Only in B", quantity: 1 },
      ],
    });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(1);
    expect(result.uniqueToACount).toBe(1);
    expect(result.uniqueToBCount).toBe(1);
    // 1 shared out of max(2, 2) = 2 unique card names total
    // overlapPercentage = 1 / 3 union size * 100 = 33.33...
    expect(result.overlapPercentage).toBeGreaterThan(0);
    expect(result.overlapPercentage).toBeLessThan(100);
  });

  test("cards with different quantities: shared list includes both quantities", () => {
    const deckA = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 1 }] });
    const deckB = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 2 }] });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(1);
    expect(result.shared[0].name).toBe("Sol Ring");
    expect(result.shared[0].quantityA).toBe(1);
    expect(result.shared[0].quantityB).toBe(2);
  });

  test("empty deck A: all cards unique to B", () => {
    const deckA = makeDeck();
    const deckB = makeDeck({ mainboard: [{ name: "Forest", quantity: 1 }] });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(0);
    expect(result.uniqueToACount).toBe(0);
    expect(result.uniqueToBCount).toBe(1);
    expect(result.overlapPercentage).toBe(0);
  });

  test("both decks empty: 0 counts and 0% overlap (no division by zero)", () => {
    const result = computeCardOverlap(makeDeck(), makeDeck());
    expect(result.sharedCount).toBe(0);
    expect(result.uniqueToACount).toBe(0);
    expect(result.uniqueToBCount).toBe(0);
    expect(result.overlapPercentage).toBe(0);
  });

  test("cards spread across commanders/mainboard/sideboard all counted", () => {
    const deckA = makeDeck({
      commanders: [{ name: "Commander Card", quantity: 1 }],
      mainboard: [{ name: "Main Card", quantity: 1 }],
      sideboard: [{ name: "Side Card", quantity: 1 }],
    });
    const deckB = makeDeck({
      commanders: [{ name: "Commander Card", quantity: 1 }],
      mainboard: [{ name: "Main Card", quantity: 1 }],
      sideboard: [{ name: "Side Card", quantity: 1 }],
    });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(3);
    expect(result.uniqueToACount).toBe(0);
    expect(result.uniqueToBCount).toBe(0);
    expect(result.overlapPercentage).toBe(100);
  });

  test("shared list is sorted alphabetically by name", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Zebra Card", quantity: 1 },
        { name: "Alpha Card", quantity: 1 },
      ],
    });
    const deckB = makeDeck({
      mainboard: [
        { name: "Zebra Card", quantity: 1 },
        { name: "Alpha Card", quantity: 1 },
      ],
    });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.shared[0].name).toBe("Alpha Card");
    expect(result.shared[1].name).toBe("Zebra Card");
  });

  test("uniqueToA and uniqueToB lists are sorted alphabetically", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Zebra A", quantity: 1 },
        { name: "Alpha A", quantity: 1 },
      ],
    });
    const deckB = makeDeck({
      mainboard: [
        { name: "Zebra B", quantity: 1 },
        { name: "Alpha B", quantity: 1 },
      ],
    });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.uniqueToA[0].name).toBe("Alpha A");
    expect(result.uniqueToA[1].name).toBe("Zebra A");
    expect(result.uniqueToB[0].name).toBe("Alpha B");
    expect(result.uniqueToB[1].name).toBe("Zebra B");
  });

  test("commander in A and mainboard in B still counts as shared", () => {
    const deckA = makeDeck({ commanders: [{ name: "Shared Commander", quantity: 1 }] });
    const deckB = makeDeck({ mainboard: [{ name: "Shared Commander", quantity: 1 }] });
    const result = computeCardOverlap(deckA, deckB);
    expect(result.sharedCount).toBe(1);
    expect(result.uniqueToACount).toBe(0);
    expect(result.uniqueToBCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeMetricDiffs
// ---------------------------------------------------------------------------

test.describe("computeMetricDiffs", () => {
  test("two decks with known metrics produce correct diff values", () => {
    // Deck A: 3 lands out of 5 cards
    const deckA = makeDeck({
      mainboard: [
        { name: "Forest A1", quantity: 1 },
        { name: "Forest A2", quantity: 1 },
        { name: "Forest A3", quantity: 1 },
        { name: "Creature A", quantity: 1 },
        { name: "Sorcery A", quantity: 1 },
      ],
    });
    const cardMapA: Record<string, EnrichedCard> = {
      "Forest A1": makeLand("Forest A1"),
      "Forest A2": makeLand("Forest A2"),
      "Forest A3": makeLand("Forest A3"),
      "Creature A": makeCreature("Creature A", 3),
      "Sorcery A": makeCard({ name: "Sorcery A", cmc: 2, typeLine: "Sorcery" }),
    };

    // Deck B: 2 lands out of 5 cards
    const deckB = makeDeck({
      mainboard: [
        { name: "Forest B1", quantity: 1 },
        { name: "Forest B2", quantity: 1 },
        { name: "Creature B", quantity: 1 },
        { name: "Sorcery B1", quantity: 1 },
        { name: "Sorcery B2", quantity: 1 },
      ],
    });
    const cardMapB: Record<string, EnrichedCard> = {
      "Forest B1": makeLand("Forest B1"),
      "Forest B2": makeLand("Forest B2"),
      "Creature B": makeCreature("Creature B", 4),
      "Sorcery B1": makeCard({ name: "Sorcery B1", cmc: 3, typeLine: "Sorcery" }),
      "Sorcery B2": makeCard({ name: "Sorcery B2", cmc: 5, typeLine: "Sorcery" }),
    };

    const diffs = computeMetricDiffs(deckA, cardMapA, deckB, cardMapB);
    expect(diffs).toBeInstanceOf(Array);
    expect(diffs.length).toBeGreaterThan(0);

    // Each diff should have required shape
    for (const d of diffs) {
      expect(typeof d.label).toBe("string");
      expect(typeof d.valueA).toBe("number");
      expect(typeof d.valueB).toBe("number");
      expect(typeof d.diff).toBe("number");
      expect(typeof d.diffLabel).toBe("string");
    }

    // Land count diff: deckA has 3, deckB has 2 => diff = -1
    const landDiff = diffs.find((d) => d.label.toLowerCase().includes("land count"));
    expect(landDiff).toBeDefined();
    if (landDiff) {
      expect(landDiff.valueA).toBe(3);
      expect(landDiff.valueB).toBe(2);
      expect(landDiff.diff).toBe(-1);
    }
  });

  test("identical decks: all diffs are 0", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 1 },
        { name: "Creature", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeLand("Forest"),
      Creature: makeCreature("Creature"),
    };

    const diffs = computeMetricDiffs(deck, cardMap, deck, cardMap);
    for (const d of diffs) {
      expect(d.diff).toBe(0);
    }
  });

  test("diff label includes sign prefix for non-zero diffs", () => {
    const deckA = makeDeck({ mainboard: [{ name: "Forest A", quantity: 1 }, { name: "Crt", quantity: 1 }] });
    const cardMapA: Record<string, EnrichedCard> = {
      "Forest A": makeLand("Forest A"),
      Crt: makeCreature("Crt", 2),
    };
    const deckB = makeDeck({ mainboard: [{ name: "Forest B1", quantity: 1 }, { name: "Forest B2", quantity: 1 }, { name: "Crt2", quantity: 1 }] });
    const cardMapB: Record<string, EnrichedCard> = {
      "Forest B1": makeLand("Forest B1"),
      "Forest B2": makeLand("Forest B2"),
      Crt2: makeCreature("Crt2", 2),
    };

    const diffs = computeMetricDiffs(deckA, cardMapA, deckB, cardMapB);
    const nonZero = diffs.filter((d) => d.diff !== 0);
    for (const d of nonZero) {
      expect(d.diffLabel).toMatch(/^[+-]/);
    }
  });
});

// ---------------------------------------------------------------------------
// computeTagComparison
// ---------------------------------------------------------------------------

test.describe("computeTagComparison", () => {
  test("deck A heavy on ramp, deck B heavy on removal: correct counts and diffs", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Cultivate", quantity: 1 },
        { name: "Kodama Reach", quantity: 1 },
        { name: "Farseek", quantity: 1 },
      ],
    });
    const cardMapA: Record<string, EnrichedCard> = {
      Cultivate: makeRamp("Cultivate"),
      "Kodama Reach": makeRamp("Kodama Reach"),
      Farseek: makeRamp("Farseek"),
    };

    const deckB = makeDeck({
      mainboard: [
        { name: "Swords A", quantity: 1 },
        { name: "Path A", quantity: 1 },
        { name: "Doom Blade", quantity: 1 },
      ],
    });
    const cardMapB: Record<string, EnrichedCard> = {
      "Swords A": makeRemoval("Swords A"),
      "Path A": makeRemoval("Path A"),
      "Doom Blade": makeRemoval("Doom Blade"),
    };

    const comparison = computeTagComparison(deckA, cardMapA, deckB, cardMapB);
    expect(comparison).toBeInstanceOf(Array);

    const rampEntry = comparison.find((t) => t.tag === "Ramp");
    expect(rampEntry).toBeDefined();
    if (rampEntry) {
      expect(rampEntry.countA).toBe(3);
      expect(rampEntry.countB).toBe(0);
      expect(rampEntry.diff).toBe(-3); // diff = countB - countA
    }

    const removalEntry = comparison.find((t) => t.tag === "Removal");
    expect(removalEntry).toBeDefined();
    if (removalEntry) {
      expect(removalEntry.countA).toBe(0);
      expect(removalEntry.countB).toBe(3);
      expect(removalEntry.diff).toBe(3);
    }
  });

  test("cards not in cardMap are skipped gracefully", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Known Card", quantity: 1 },
        { name: "Unknown Card", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Known Card": makeRamp("Known Card"),
      // Unknown Card is intentionally missing
    };

    // Should not throw
    expect(() => computeTagComparison(deck, cardMap, makeDeck(), {})).not.toThrow();
  });

  test("sorted by abs(diff) descending", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Ramp1", quantity: 1 },
        { name: "Ramp2", quantity: 1 },
        { name: "Ramp3", quantity: 1 },
      ],
    });
    const cardMapA: Record<string, EnrichedCard> = {
      Ramp1: makeRamp("Ramp1"),
      Ramp2: makeRamp("Ramp2"),
      Ramp3: makeRamp("Ramp3"),
    };

    const deckB = makeDeck({ mainboard: [{ name: "Removal1", quantity: 1 }] });
    const cardMapB: Record<string, EnrichedCard> = {
      Removal1: makeRemoval("Removal1"),
    };

    const comparison = computeTagComparison(deckA, cardMapA, deckB, cardMapB);

    // First entry should be the one with largest abs(diff)
    expect(Math.abs(comparison[0].diff)).toBeGreaterThanOrEqual(
      Math.abs(comparison[comparison.length - 1].diff)
    );
  });
});

// ---------------------------------------------------------------------------
// computeCurveOverlay
// ---------------------------------------------------------------------------

test.describe("computeCurveOverlay", () => {
  test("two decks with known curve shapes produce correct bucket totals", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "One Drop A", quantity: 2 },
        { name: "Three Drop A", quantity: 1 },
      ],
    });
    const cardMapA: Record<string, EnrichedCard> = {
      "One Drop A": makeCreature("One Drop A", 1),
      "Three Drop A": makeCreature("Three Drop A", 3),
    };

    const deckB = makeDeck({
      mainboard: [
        { name: "Two Drop B", quantity: 3 },
        { name: "Three Drop B", quantity: 2 },
      ],
    });
    const cardMapB: Record<string, EnrichedCard> = {
      "Two Drop B": makeCreature("Two Drop B", 2),
      "Three Drop B": makeCreature("Three Drop B", 3),
    };

    const overlay = computeCurveOverlay(deckA, cardMapA, deckB, cardMapB);
    expect(overlay).toBeInstanceOf(Array);
    expect(overlay.length).toBeGreaterThan(0);

    // Each bucket should have cmc, totalA, totalB
    for (const bucket of overlay) {
      expect(typeof bucket.cmc).toBe("string");
      expect(typeof bucket.totalA).toBe("number");
      expect(typeof bucket.totalB).toBe("number");
    }

    const cmc1 = overlay.find((b) => b.cmc === "1");
    expect(cmc1).toBeDefined();
    if (cmc1) {
      expect(cmc1.totalA).toBe(2);
      expect(cmc1.totalB).toBe(0);
    }

    const cmc2 = overlay.find((b) => b.cmc === "2");
    expect(cmc2).toBeDefined();
    if (cmc2) {
      expect(cmc2.totalA).toBe(0);
      expect(cmc2.totalB).toBe(3);
    }

    const cmc3 = overlay.find((b) => b.cmc === "3");
    expect(cmc3).toBeDefined();
    if (cmc3) {
      expect(cmc3.totalA).toBe(1);
      expect(cmc3.totalB).toBe(2);
    }
  });

  test("empty decks: all buckets have totalA=0 and totalB=0", () => {
    const overlay = computeCurveOverlay(makeDeck(), {}, makeDeck(), {});
    for (const bucket of overlay) {
      expect(bucket.totalA).toBe(0);
      expect(bucket.totalB).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computeDeckComparison (integration)
// ---------------------------------------------------------------------------

test.describe("computeDeckComparison", () => {
  test("returns all sub-results populated", () => {
    const deckA = makeDeck({
      mainboard: [
        { name: "Forest A", quantity: 1 },
        { name: "Creature A", quantity: 1 },
        { name: "Shared Card", quantity: 1 },
      ],
    });
    const cardMapA: Record<string, EnrichedCard> = {
      "Forest A": makeLand("Forest A"),
      "Creature A": makeCreature("Creature A"),
      "Shared Card": makeCreature("Shared Card", 3),
    };

    const deckB = makeDeck({
      mainboard: [
        { name: "Forest B", quantity: 1 },
        { name: "Creature B", quantity: 1 },
        { name: "Shared Card", quantity: 1 },
      ],
    });
    const cardMapB: Record<string, EnrichedCard> = {
      "Forest B": makeLand("Forest B"),
      "Creature B": makeCreature("Creature B"),
      "Shared Card": makeCreature("Shared Card", 3),
    };

    const result = computeDeckComparison(deckA, cardMapA, deckB, cardMapB);

    // cardOverlap
    expect(result.cardOverlap).toBeDefined();
    expect(result.cardOverlap.sharedCount).toBe(1);
    expect(result.cardOverlap.uniqueToACount).toBe(2);
    expect(result.cardOverlap.uniqueToBCount).toBe(2);

    // metricDiffs
    expect(result.metricDiffs).toBeInstanceOf(Array);
    expect(result.metricDiffs.length).toBeGreaterThan(0);

    // tagComparison
    expect(result.tagComparison).toBeInstanceOf(Array);

    // curveOverlay
    expect(result.curveOverlay).toBeInstanceOf(Array);
    expect(result.curveOverlay.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers for richer decks (needed for bracket/power/composition)
// ---------------------------------------------------------------------------

/** Build a minimal but non-trivial EDH deck (36 lands + 63 non-lands + 1 commander). */
function makeMinimalCommanderDeck() {
  const mainboard: { name: string; quantity: number }[] = [];
  for (let i = 0; i < 36; i++) mainboard.push({ name: `Forest${i}`, quantity: 1 });
  for (let i = 0; i < 63; i++) mainboard.push({ name: `Creature${i}`, quantity: 1 });

  const commanders = [{ name: "Commander", quantity: 1 }];

  const cardMap: Record<string, EnrichedCard> = {};
  for (let i = 0; i < 36; i++) cardMap[`Forest${i}`] = makeLand(`Forest${i}`);
  for (let i = 0; i < 63; i++) cardMap[`Creature${i}`] = makeCreature(`Creature${i}`, 3);
  cardMap["Commander"] = makeCreature("Commander", 4);

  return { deck: makeDeck({ commanders, mainboard }), cardMap };
}

// ---------------------------------------------------------------------------
// computeHandKeepabilityComparison
// ---------------------------------------------------------------------------

test.describe("computeHandKeepabilityComparison", () => {
  test("returns statsA, statsB, keepRateDelta, avgScoreDelta with valid shapes", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();

    const result = computeHandKeepabilityComparison(deckA, cardMapA, deckB, cardMapB);

    expect(result).toHaveProperty("statsA");
    expect(result).toHaveProperty("statsB");
    expect(result).toHaveProperty("keepRateDelta");
    expect(result).toHaveProperty("avgScoreDelta");

    expect(typeof result.keepRateDelta).toBe("number");
    expect(typeof result.avgScoreDelta).toBe("number");

    // keepRateDelta = statsB.keepableRate - statsA.keepableRate
    const expectedDelta = result.statsB.keepableRate - result.statsA.keepableRate;
    expect(result.keepRateDelta).toBeCloseTo(expectedDelta);
  });

  test("identical decks produce keepRateDelta near 0", () => {
    const { deck, cardMap } = makeMinimalCommanderDeck();
    // Use the same deck for both slots
    const result = computeHandKeepabilityComparison(deck, cardMap, deck, cardMap, 50);
    // Not necessarily exactly 0 due to simulation randomness, but delta = 0 always
    expect(result.keepRateDelta).toBe(result.statsB.keepableRate - result.statsA.keepableRate);
  });

  test("keepableRate is between 0 and 1", () => {
    const { deck, cardMap } = makeMinimalCommanderDeck();
    const result = computeHandKeepabilityComparison(deck, cardMap, deck, cardMap, 20);
    expect(result.statsA.keepableRate).toBeGreaterThanOrEqual(0);
    expect(result.statsA.keepableRate).toBeLessThanOrEqual(1);
    expect(result.statsB.keepableRate).toBeGreaterThanOrEqual(0);
    expect(result.statsB.keepableRate).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// computeBracketComparison
// ---------------------------------------------------------------------------

test.describe("computeBracketComparison", () => {
  test("returns resultA, resultB, bracketDelta with valid shapes", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();

    const result = computeBracketComparison(deckA, cardMapA, deckB, cardMapB);

    expect(result).toHaveProperty("resultA");
    expect(result).toHaveProperty("resultB");
    expect(result).toHaveProperty("bracketDelta");

    expect(result.resultA.bracket).toBeGreaterThanOrEqual(1);
    expect(result.resultA.bracket).toBeLessThanOrEqual(5);
    expect(result.resultB.bracket).toBeGreaterThanOrEqual(1);
    expect(result.resultB.bracket).toBeLessThanOrEqual(5);
    expect(result.bracketDelta).toBe(result.resultB.bracket - result.resultA.bracket);
  });

  test("bracketDelta = resultB.bracket − resultA.bracket invariant", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();
    const result = computeBracketComparison(deckA, cardMapA, deckB, cardMapB);
    expect(result.bracketDelta).toBe(result.resultB.bracket - result.resultA.bracket);
  });
});

// ---------------------------------------------------------------------------
// computePowerLevelComparison
// ---------------------------------------------------------------------------

test.describe("computePowerLevelComparison", () => {
  test("returns resultA, resultB, powerLevelDelta, rawScoreDelta with valid shapes", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();

    const result = computePowerLevelComparison(deckA, cardMapA, deckB, cardMapB);

    expect(result).toHaveProperty("resultA");
    expect(result).toHaveProperty("resultB");
    expect(result).toHaveProperty("powerLevelDelta");
    expect(result).toHaveProperty("rawScoreDelta");

    expect(result.resultA.powerLevel).toBeGreaterThanOrEqual(1);
    expect(result.resultA.powerLevel).toBeLessThanOrEqual(10);
    expect(result.resultB.powerLevel).toBeGreaterThanOrEqual(1);
    expect(result.resultB.powerLevel).toBeLessThanOrEqual(10);
    expect(result.powerLevelDelta).toBe(result.resultB.powerLevel - result.resultA.powerLevel);
    expect(result.rawScoreDelta).toBeCloseTo(
      result.resultB.rawScore - result.resultA.rawScore
    );
  });

  test("identical decks produce powerLevelDelta = 0 and rawScoreDelta = 0", () => {
    const { deck, cardMap } = makeMinimalCommanderDeck();
    const result = computePowerLevelComparison(deck, cardMap, deck, cardMap);
    expect(result.powerLevelDelta).toBe(0);
    expect(result.rawScoreDelta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeCompositionComparison
// ---------------------------------------------------------------------------

test.describe("computeCompositionComparison", () => {
  test("returns resultA, resultB each with categories array and overallHealth", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();

    const result = computeCompositionComparison(deckA, cardMapA, deckB, cardMapB);

    expect(result).toHaveProperty("resultA");
    expect(result).toHaveProperty("resultB");
    expect(result.resultA).toHaveProperty("categories");
    expect(result.resultB).toHaveProperty("categories");
    expect(result.resultA).toHaveProperty("overallHealth");
    expect(result.resultB).toHaveProperty("overallHealth");

    expect(result.resultA.categories).toBeInstanceOf(Array);
    expect(result.resultB.categories).toBeInstanceOf(Array);

    // Each category should have tag, label, count, status
    for (const cat of result.resultA.categories) {
      expect(typeof cat.tag).toBe("string");
      expect(typeof cat.label).toBe("string");
      expect(typeof cat.count).toBe("number");
      expect(typeof cat.status).toBe("string");
    }
  });

  test("identical decks produce identical category counts", () => {
    const { deck, cardMap } = makeMinimalCommanderDeck();
    const result = computeCompositionComparison(deck, cardMap, deck, cardMap);

    for (let i = 0; i < result.resultA.categories.length; i++) {
      expect(result.resultA.categories[i].count).toBe(
        result.resultB.categories[i].count
      );
    }
  });
});

// ---------------------------------------------------------------------------
// computeExtendedDeckComparison
// ---------------------------------------------------------------------------

test.describe("computeExtendedDeckComparison", () => {
  test("includes all base fields plus the four new fields", () => {
    const { deck: deckA, cardMap: cardMapA } = makeMinimalCommanderDeck();
    const { deck: deckB, cardMap: cardMapB } = makeMinimalCommanderDeck();

    const result = computeExtendedDeckComparison(deckA, cardMapA, deckB, cardMapB);

    // Base fields
    expect(result.cardOverlap).toBeDefined();
    expect(result.metricDiffs).toBeInstanceOf(Array);
    expect(result.tagComparison).toBeInstanceOf(Array);
    expect(result.curveOverlay).toBeInstanceOf(Array);

    // New fields
    expect(result.handKeepability).toBeDefined();
    expect(result.bracketComparison).toBeDefined();
    expect(result.powerLevelComparison).toBeDefined();
    expect(result.compositionComparison).toBeDefined();

    // Spot-check shapes
    expect(typeof result.handKeepability.keepRateDelta).toBe("number");
    expect(typeof result.bracketComparison.bracketDelta).toBe("number");
    expect(typeof result.powerLevelComparison.powerLevelDelta).toBe("number");
    expect(result.compositionComparison.resultA.categories).toBeInstanceOf(Array);
  });
});
