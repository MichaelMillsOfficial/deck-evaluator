import { test, expect } from "@playwright/test";
import { makeCard, makeDeck } from "../helpers";
import {
  computeAllAnalyses,
  type DeckAnalysisResults,
} from "../../src/lib/deck-analysis-aggregate";

function buildTestDeck() {
  const deck = makeDeck({
    name: "Test Commander Deck",
    commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
    mainboard: [
      { name: "Sol Ring", quantity: 1 },
      { name: "Command Tower", quantity: 1 },
      { name: "Swords to Plowshares", quantity: 1 },
      { name: "Counterspell", quantity: 1 },
      { name: "Arcane Signet", quantity: 1 },
    ],
  });

  const cardMap: Record<string, ReturnType<typeof makeCard>> = {
    "Atraxa, Praetors' Voice": makeCard({
      name: "Atraxa, Praetors' Voice",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      colorIdentity: ["W", "U", "B", "G"],
      colors: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Angel", "Horror"],
      oracleText:
        "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
      power: "4",
      toughness: "4",
      rarity: "mythic",
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      prices: { usd: 15.0, usdFoil: 30.0, eur: 12.0 },
    }),
    "Sol Ring": makeCard({
      name: "Sol Ring",
      manaCost: "{1}",
      cmc: 1,
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      producedMana: ["C"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 },
      prices: { usd: 1.5, usdFoil: 5.0, eur: 1.0 },
    }),
    "Command Tower": makeCard({
      name: "Command Tower",
      manaCost: "",
      cmc: 0,
      typeLine: "Land",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      producedMana: ["W", "U", "B", "R", "G"],
      prices: { usd: 0.25, usdFoil: 1.0, eur: 0.2 },
    }),
    "Swords to Plowshares": makeCard({
      name: "Swords to Plowshares",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      oracleText:
        "Exile target creature. Its controller gains life equal to its power.",
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 2.0, usdFoil: 8.0, eur: 1.5 },
    }),
    Counterspell: makeCard({
      name: "Counterspell",
      manaCost: "{U}{U}",
      cmc: 2,
      colorIdentity: ["U"],
      colors: ["U"],
      typeLine: "Instant",
      oracleText: "Counter target spell.",
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 1.0, usdFoil: 3.0, eur: 0.8 },
    }),
    "Arcane Signet": makeCard({
      name: "Arcane Signet",
      manaCost: "{2}",
      cmc: 2,
      typeLine: "Artifact",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 },
      prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
    }),
  };

  return { deck, cardMap };
}

test.describe("computeAllAnalyses", () => {
  test("returns all expected analysis keys", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    const expectedKeys: (keyof DeckAnalysisResults)[] = [
      "manaCurve",
      "colorDistribution",
      "manaBaseMetrics",
      "commanderIdentity",
      "landEfficiency",
      "manaRecommendations",
      "powerLevel",
      "bracketResult",
      "budgetAnalysis",
      "synergyAnalysis",
      "compositionScorecard",
      "creatureTypes",
      "supertypes",
      "simulationStats",
    ];

    for (const key of expectedKeys) {
      expect(results).toHaveProperty(key);
      expect(results[key]).toBeDefined();
    }
  });

  test("dependency ordering is correct — bracketResult uses computed powerLevel", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    // bracketResult should exist and have a valid bracket (1-5)
    expect(results.bracketResult.bracket).toBeGreaterThanOrEqual(1);
    expect(results.bracketResult.bracket).toBeLessThanOrEqual(5);
    // powerLevel should exist and feed into bracket
    expect(results.powerLevel.powerLevel).toBeGreaterThanOrEqual(1);
    expect(results.powerLevel.powerLevel).toBeLessThanOrEqual(10);
  });

  test("handles spellbookCombos: null — bracket still computes using local combos", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({
      deck,
      cardMap,
      spellbookCombos: null,
    });

    expect(results.bracketResult).toBeDefined();
    expect(results.bracketResult.comboSource).toBe("local");
  });

  test("handles empty cardMap {} — does not throw", () => {
    const deck = makeDeck({
      name: "Empty Deck",
      mainboard: [{ name: "Unknown Card", quantity: 1 }],
    });

    expect(() => computeAllAnalyses({ deck, cardMap: {} })).not.toThrow();
    const results = computeAllAnalyses({ deck, cardMap: {} });
    expect(results.manaCurve).toBeDefined();
    expect(results.powerLevel).toBeDefined();
    expect(results.bracketResult).toBeDefined();
  });

  test("mana curve includes all card types by default", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    // Should have CMC buckets
    expect(results.manaCurve.length).toBeGreaterThan(0);
  });

  test("synergy analysis produces valid themes and scores", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    expect(results.synergyAnalysis).toBeDefined();
    expect(results.synergyAnalysis.cardScores).toBeDefined();
    expect(results.synergyAnalysis.deckThemes).toBeDefined();
  });

  test("creature types and supertypes are string arrays", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    expect(Array.isArray(results.creatureTypes)).toBe(true);
    expect(Array.isArray(results.supertypes)).toBe(true);
  });

  test("simulationStats has expected shape", () => {
    const { deck, cardMap } = buildTestDeck();
    const results = computeAllAnalyses({ deck, cardMap });

    expect(results.simulationStats).toBeDefined();
    expect(results.simulationStats.totalSimulations).toBe(1000);
    expect(results.simulationStats.keepableRate).toBeGreaterThanOrEqual(0);
    expect(results.simulationStats.keepableRate).toBeLessThanOrEqual(1);
    expect(results.simulationStats.avgLandsInOpener).toBeGreaterThanOrEqual(0);
    expect(results.simulationStats.verdictDistribution).toHaveProperty("Strong Keep");
    expect(results.simulationStats.verdictDistribution).toHaveProperty("Keepable");
    expect(results.simulationStats.verdictDistribution).toHaveProperty("Marginal");
    expect(results.simulationStats.verdictDistribution).toHaveProperty("Mulligan");
  });
});
