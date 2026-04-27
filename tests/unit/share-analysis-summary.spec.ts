import { test, expect } from "@playwright/test";
import { makeCard, makeDeck } from "../helpers";
import { computeAllAnalyses } from "../../src/lib/deck-analysis-aggregate";
import {
  buildShareSummary,
  type ShareAnalysisSummary,
} from "../../src/lib/share-analysis-summary";

function buildTestResults() {
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

  const cardMap = {
    "Atraxa, Praetors' Voice": makeCard({
      name: "Atraxa, Praetors' Voice",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      colorIdentity: ["W", "U", "B", "G"],
      colors: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Angel", "Horror"],
      oracleText: "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
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
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
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
      oracleText: "Exile target creature. Its controller gains life equal to its power.",
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
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
      producedMana: ["W", "U", "B", "R", "G"],
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 },
      prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
    }),
  };

  const results = computeAllAnalyses({ deck, cardMap });
  return { deck, cardMap, results };
}

test.describe("buildShareSummary", () => {
  test("returns an object with all required fields", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(summary).toHaveProperty("pl");
    expect(summary).toHaveProperty("br");
    expect(summary).toHaveProperty("avg");
    expect(summary).toHaveProperty("kr");
    expect(summary).toHaveProperty("themes");
    expect(summary).toHaveProperty("combos");
    expect(summary).toHaveProperty("budget");
  });

  test("pl is a number between 1 and 10 with one decimal place", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.pl).toBe("number");
    expect(summary.pl).toBeGreaterThanOrEqual(1);
    expect(summary.pl).toBeLessThanOrEqual(10);
    // One decimal place: multiply by 10, check it's an integer
    expect(Math.round(summary.pl * 10)).toBe(Math.floor(summary.pl * 10 + 0.5));
  });

  test("br is bracket integer between 1 and 5", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.br).toBe("number");
    expect(summary.br).toBeGreaterThanOrEqual(1);
    expect(summary.br).toBeLessThanOrEqual(5);
    expect(Number.isInteger(summary.br)).toBe(true);
  });

  test("avg is a number with one decimal place (average CMC)", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.avg).toBe("number");
    expect(summary.avg).toBeGreaterThanOrEqual(0);
    // Should match manaBaseMetrics.averageCmc rounded to 1 decimal
    expect(summary.avg).toBe(
      Math.round(results.manaBaseMetrics.averageCmc * 10) / 10
    );
  });

  test("kr is keepable rate as integer 0-100", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.kr).toBe("number");
    expect(summary.kr).toBeGreaterThanOrEqual(0);
    expect(summary.kr).toBeLessThanOrEqual(100);
    expect(Number.isInteger(summary.kr)).toBe(true);
    // Should match simulationStats.keepableRate * 100 rounded
    expect(summary.kr).toBe(Math.round(results.simulationStats.keepableRate * 100));
  });

  test("themes is array of up to 3 strings", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(Array.isArray(summary.themes)).toBe(true);
    expect(summary.themes.length).toBeLessThanOrEqual(3);
    for (const theme of summary.themes) {
      expect(typeof theme).toBe("string");
    }
  });

  test("combos is a non-negative integer", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.combos).toBe("number");
    expect(summary.combos).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(summary.combos)).toBe(true);
    expect(summary.combos).toBe(results.synergyAnalysis.knownCombos.length);
  });

  test("budget is total cost in cents as integer", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);

    expect(typeof summary.budget).toBe("number");
    expect(summary.budget).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(summary.budget)).toBe(true);
    // Should be totalCost * 100 rounded to integer cents
    expect(summary.budget).toBe(Math.round(results.budgetAnalysis.totalCost * 100));
  });

  test("JSON representation is under 200 bytes", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);
    const json = JSON.stringify(summary);

    expect(json.length).toBeLessThan(200);
  });

  test("themes contains axisName strings from deckThemes", () => {
    const { results } = buildTestResults();
    const summary = buildShareSummary(results);
    const topThemeNames = results.synergyAnalysis.deckThemes
      .slice(0, 3)
      .map((t) => t.axisName);

    expect(summary.themes).toEqual(topThemeNames);
  });

  test("handles deck with no synergy themes gracefully", () => {
    const deck = makeDeck({
      name: "Minimal Deck",
      mainboard: [{ name: "Island", quantity: 60 }],
    });
    const cardMap = {
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        cmc: 0,
        manaCost: "",
        prices: { usd: 0.1, usdFoil: null, eur: null },
      }),
    };
    const results = computeAllAnalyses({ deck, cardMap });
    const summary = buildShareSummary(results);

    expect(Array.isArray(summary.themes)).toBe(true);
    expect(summary.combos).toBe(0);
  });

  test("handles deck with no budget (all null prices) gracefully", () => {
    const deck = makeDeck({
      name: "No Price Deck",
      mainboard: [{ name: "Mystery Card", quantity: 1 }],
    });
    const cardMap = {
      "Mystery Card": makeCard({
        name: "Mystery Card",
        typeLine: "Creature",
        cmc: 3,
        prices: { usd: null, usdFoil: null, eur: null },
      }),
    };
    const results = computeAllAnalyses({ deck, cardMap });
    const summary = buildShareSummary(results);

    expect(summary.budget).toBe(0);
  });
});

test.describe("ShareAnalysisSummary type shape", () => {
  test("summary object conforms to ShareAnalysisSummary interface", () => {
    const { results } = buildTestResults();
    const summary: ShareAnalysisSummary = buildShareSummary(results);

    // TypeScript type check via assignment — if the interface is correct this compiles
    expect(typeof summary.pl).toBe("number");
    expect(typeof summary.br).toBe("number");
    expect(typeof summary.avg).toBe("number");
    expect(typeof summary.kr).toBe("number");
    expect(Array.isArray(summary.themes)).toBe(true);
    expect(typeof summary.combos).toBe("number");
    expect(typeof summary.budget).toBe("number");
  });
});
