import { test, expect } from "@playwright/test";
import {
  computeCardOverlap,
  computeMetricDiffs,
  computeTagComparison,
  computeCurveOverlay,
  computeDeckComparison,
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
