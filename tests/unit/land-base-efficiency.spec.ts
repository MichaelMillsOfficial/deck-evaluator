import { test, expect } from "@playwright/test";
import {
  classifyLandEntry,
  computeUntappedRatio,
  computeColorCoverage,
  computeLandDropConsistency,
  computeManaFixingQuality,
  computeBasicLandRatio,
  computeLandBaseEfficiency,
  type LandClassification,
} from "../../src/lib/land-base-efficiency";
import type { EnrichedCard, ManaPips } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

const ZERO_PIPS: ManaPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

// ---------------------------------------------------------------------------
// classifyLandEntry
// ---------------------------------------------------------------------------

test.describe("classifyLandEntry", () => {
  test("basic lands are classified as untapped", () => {
    const card = makeCard({
      name: "Forest",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      oracleText: "({T}: Add {G}.)",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("untapped");
  });

  test("lands with no ETB-tapped text are untapped", () => {
    const card = makeCard({
      name: "Mana Confluence",
      typeLine: "Land",
      oracleText: "{T}, Pay 1 life: Add one mana of any color.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("untapped");
  });

  test("lands with unconditional ETB-tapped are tapped", () => {
    const card = makeCard({
      name: "Dimir Guildgate",
      typeLine: "Land — Gate",
      oracleText:
        "Dimir Guildgate enters the battlefield tapped.\n{T}: Add {U} or {B}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("tapped");
  });

  test("shock lands are classified as conditional", () => {
    const card = makeCard({
      name: "Hallowed Fountain",
      typeLine: "Land — Plains Island",
      oracleText:
        "({T}: Add {W} or {U}.)\nAs Hallowed Fountain enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("conditional");
  });

  test("check lands are classified as conditional", () => {
    const card = makeCard({
      name: "Glacial Fortress",
      typeLine: "Land",
      oracleText:
        "Glacial Fortress enters the battlefield tapped unless you control a Plains or an Island.\n{T}: Add {W} or {U}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("conditional");
  });

  test("fast lands are classified as conditional", () => {
    const card = makeCard({
      name: "Seachrome Coast",
      typeLine: "Land",
      oracleText:
        "Seachrome Coast enters the battlefield tapped unless you control two or fewer other lands.\n{T}: Add {W} or {U}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("conditional");
  });

  test("reveal lands are classified as conditional", () => {
    const card = makeCard({
      name: "Port Town",
      typeLine: "Land",
      oracleText:
        "As Port Town enters the battlefield, you may reveal a Plains or Island card from your hand. If you don't, Port Town enters the battlefield tapped.\n{T}: Add {W} or {U}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("conditional");
  });

  test("temples (scry lands) are classified as tapped", () => {
    const card = makeCard({
      name: "Temple of Enlightenment",
      typeLine: "Land",
      oracleText:
        "Temple of Enlightenment enters the battlefield tapped.\nWhen Temple of Enlightenment enters the battlefield, scry 1.\n{T}: Add {W} or {U}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("tapped");
  });

  test("fetch lands are classified as untapped", () => {
    const card = makeCard({
      name: "Flooded Strand",
      typeLine: "Land",
      oracleText:
        "{T}, Pay 1 life, Sacrifice Flooded Strand: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("untapped");
  });

  test("non-land cards return untapped (not scored as lands)", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
    });
    expect(classifyLandEntry(card)).toBe<LandClassification>("untapped");
  });
});

// ---------------------------------------------------------------------------
// computeUntappedRatio
// ---------------------------------------------------------------------------

test.describe("computeUntappedRatio", () => {
  test("returns 100 when all lands are untapped", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 10 },
        { name: "Island", quantity: 10 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {U}.)",
        producedMana: ["U"],
      }),
    };
    expect(computeUntappedRatio(deck, cardMap)).toBe(100);
  });

  test("returns 0 when all lands are tapped", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Guildgate", quantity: 10 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Guildgate: makeCard({
        name: "Guildgate",
        typeLine: "Land — Gate",
        oracleText:
          "Dimir Guildgate enters the battlefield tapped.\n{T}: Add {U} or {B}.",
        producedMana: ["U", "B"],
      }),
    };
    expect(computeUntappedRatio(deck, cardMap)).toBe(0);
  });

  test("conditional lands count as 0.5", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Shock Land", quantity: 4 },
        { name: "Basic", quantity: 4 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Shock Land": makeCard({
        name: "Shock Land",
        typeLine: "Land — Plains Island",
        oracleText:
          "As Hallowed Fountain enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
        producedMana: ["W", "U"],
      }),
      Basic: makeCard({
        name: "Basic",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
    };
    // (4 untapped + 4 * 0.5 conditional) / 8 total = 6/8 = 75
    expect(computeUntappedRatio(deck, cardMap)).toBe(75);
  });

  test("returns 0 when deck has no lands", () => {
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
    expect(computeUntappedRatio(deck, cardMap)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeColorCoverage
// ---------------------------------------------------------------------------

test.describe("computeColorCoverage", () => {
  test("returns 100 when sources match or exceed demand for all colors", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 15 },
        { name: "Green Spell", quantity: 10 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
      "Green Spell": makeCard({
        name: "Green Spell",
        typeLine: "Creature",
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    expect(computeColorCoverage(deck, cardMap)).toBe(100);
  });

  test("returns lower score when a demanded color has few sources", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 15 },
        { name: "Blue Spell", quantity: 10 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
      "Blue Spell": makeCard({
        name: "Blue Spell",
        typeLine: "Instant",
        manaPips: { ...ZERO_PIPS, U: 2 },
      }),
    };
    // No blue sources but heavy blue demand → score should be low
    const score = computeColorCoverage(deck, cardMap);
    expect(score).toBeLessThan(50);
  });

  test("returns 100 when no colored pips are demanded", () => {
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
    expect(computeColorCoverage(deck, cardMap)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeLandDropConsistency
// ---------------------------------------------------------------------------

test.describe("computeLandDropConsistency", () => {
  test("37 lands in 99-card deck gives good consistency score", () => {
    const score = computeLandDropConsistency(37, 99);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("25 lands in 99-card deck gives lower score", () => {
    const score = computeLandDropConsistency(25, 99);
    expect(score).toBeLessThan(computeLandDropConsistency(37, 99));
  });

  test("45 lands in 99-card deck gives high score", () => {
    const score = computeLandDropConsistency(45, 99);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test("0 lands returns 0", () => {
    expect(computeLandDropConsistency(0, 99)).toBe(0);
  });

  test("returns 0 for empty deck", () => {
    expect(computeLandDropConsistency(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeManaFixingQuality
// ---------------------------------------------------------------------------

test.describe("computeManaFixingQuality", () => {
  test("returns 0 when all lands are mono-color basics", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 20 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
    };
    expect(computeManaFixingQuality(deck, cardMap)).toBe(0);
  });

  test("returns high score when most lands produce multiple colors", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Dual", quantity: 15 },
        { name: "Basic", quantity: 5 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Dual: makeCard({
        name: "Dual",
        typeLine: "Land — Plains Island",
        producedMana: ["W", "U"],
      }),
      Basic: makeCard({
        name: "Basic",
        typeLine: "Basic Land — Forest",
        producedMana: ["G"],
      }),
    };
    // 15/20 = 75% multi-color lands
    const score = computeManaFixingQuality(deck, cardMap);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test("returns 0 when deck has no lands", () => {
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
    expect(computeManaFixingQuality(deck, cardMap)).toBe(0);
  });

  test("any-color lands count as multi-color", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Command Tower": makeCard({
        name: "Command Tower",
        typeLine: "Land",
        producedMana: ["W", "U", "B", "R", "G"],
      }),
    };
    expect(computeManaFixingQuality(deck, cardMap)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeBasicLandRatio
// ---------------------------------------------------------------------------

test.describe("computeBasicLandRatio", () => {
  test("mono-color deck with mostly basics scores high", () => {
    const deck = makeDeck({
      commanders: [{ name: "Cmd", quantity: 1 }],
      mainboard: [{ name: "Forest", quantity: 35 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Cmd: makeCard({
        name: "Cmd",
        colorIdentity: ["G"],
        typeLine: "Legendary Creature",
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
      }),
    };
    const score = computeBasicLandRatio(deck, cardMap);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  test("5-color deck with all basics scores lower", () => {
    const deck = makeDeck({
      commanders: [{ name: "Cmd", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 7 },
        { name: "Island", quantity: 7 },
        { name: "Swamp", quantity: 7 },
        { name: "Mountain", quantity: 7 },
        { name: "Plains", quantity: 7 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Cmd: makeCard({
        name: "Cmd",
        colorIdentity: ["W", "U", "B", "R", "G"],
        typeLine: "Legendary Creature",
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        producedMana: ["U"],
      }),
      Swamp: makeCard({
        name: "Swamp",
        typeLine: "Basic Land — Swamp",
        supertypes: ["Basic"],
        producedMana: ["B"],
      }),
      Mountain: makeCard({
        name: "Mountain",
        typeLine: "Basic Land — Mountain",
        supertypes: ["Basic"],
        producedMana: ["R"],
      }),
      Plains: makeCard({
        name: "Plains",
        typeLine: "Basic Land — Plains",
        supertypes: ["Basic"],
        producedMana: ["W"],
      }),
    };
    // 5-color all-basic → needs more fixing, score should be moderate/low
    const score = computeBasicLandRatio(deck, cardMap);
    expect(score).toBeLessThanOrEqual(70);
  });

  test("returns reasonable score when no lands present", () => {
    const deck = makeDeck({ mainboard: [] });
    const cardMap: Record<string, EnrichedCard> = {};
    const score = computeBasicLandRatio(deck, cardMap);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// computeLandBaseEfficiency (aggregate)
// ---------------------------------------------------------------------------

test.describe("computeLandBaseEfficiency", () => {
  test("returns a score between 0 and 100", () => {
    const deck = makeDeck({
      commanders: [{ name: "Cmd", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 20 },
        { name: "Island", quantity: 15 },
        { name: "Spell", quantity: 63 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Cmd: makeCard({
        name: "Cmd",
        colorIdentity: ["G", "U"],
        typeLine: "Legendary Creature",
        manaPips: { ...ZERO_PIPS, G: 1, U: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {U}.)",
        producedMana: ["U"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeLandBaseEfficiency(deck, cardMap);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  test("returns exactly 5 factors", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 37 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
    };
    const result = computeLandBaseEfficiency(deck, cardMap);
    expect(result.factors).toHaveLength(5);
  });

  test("each factor has name, score, weight, and description", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 37 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
    };
    const result = computeLandBaseEfficiency(deck, cardMap);
    for (const factor of result.factors) {
      expect(factor.name).toBeTruthy();
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
      expect(factor.weight).toBeGreaterThan(0);
      expect(factor.weight).toBeLessThanOrEqual(1);
      expect(factor.description).toBeTruthy();
    }
  });

  test("factor weights sum to 1", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 37 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
    };
    const result = computeLandBaseEfficiency(deck, cardMap);
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  test("optimized deck scores higher than unoptimized", () => {
    // Well-built 2-color deck
    const goodDeck = makeDeck({
      commanders: [{ name: "Cmd", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 10 },
        { name: "Island", quantity: 10 },
        { name: "Dual", quantity: 8 },
        { name: "Fetch", quantity: 7 },
        { name: "Spell", quantity: 63 },
      ],
    });
    const goodMap: Record<string, EnrichedCard> = {
      Cmd: makeCard({
        name: "Cmd",
        colorIdentity: ["G", "U"],
        typeLine: "Legendary Creature",
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {U}.)",
        producedMana: ["U"],
      }),
      Dual: makeCard({
        name: "Dual",
        typeLine: "Land — Forest Island",
        oracleText:
          "As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
        producedMana: ["G", "U"],
      }),
      Fetch: makeCard({
        name: "Fetch",
        typeLine: "Land",
        oracleText:
          "{T}, Pay 1 life, Sacrifice: Search your library for a Forest or Island card, put it onto the battlefield, then shuffle.",
        producedMana: [],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };

    // Bad deck: all tapped lands, poor fixing
    const badDeck = makeDeck({
      commanders: [{ name: "Cmd5", quantity: 1 }],
      mainboard: [
        { name: "Gate", quantity: 35 },
        { name: "Spell2", quantity: 63 },
      ],
    });
    const badMap: Record<string, EnrichedCard> = {
      Cmd5: makeCard({
        name: "Cmd5",
        colorIdentity: ["W", "U", "B", "R", "G"],
        typeLine: "Legendary Creature",
      }),
      Gate: makeCard({
        name: "Gate",
        typeLine: "Land — Gate",
        oracleText:
          "Dimir Guildgate enters the battlefield tapped.\n{T}: Add {U} or {B}.",
        producedMana: ["U", "B"],
      }),
      Spell2: makeCard({
        name: "Spell2",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, W: 1, R: 1, G: 1 },
      }),
    };

    const goodResult = computeLandBaseEfficiency(goodDeck, goodMap);
    const badResult = computeLandBaseEfficiency(badDeck, badMap);
    expect(goodResult.overallScore).toBeGreaterThan(badResult.overallScore);
  });

  test("returns a scoreLabel string", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 37 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        oracleText: "({T}: Add {G}.)",
        producedMana: ["G"],
      }),
    };
    const result = computeLandBaseEfficiency(deck, cardMap);
    expect(typeof result.scoreLabel).toBe("string");
    expect(result.scoreLabel.length).toBeGreaterThan(0);
  });
});
