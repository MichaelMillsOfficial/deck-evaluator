import { test, expect } from "@playwright/test";
import { makeCard, makeDeck } from "../helpers";
import { computeAllAnalyses } from "../../src/lib/deck-analysis-aggregate";
import { formatJsonReport } from "../../src/lib/export-report";

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

// Sample interaction data matching the new extended parameter shape
const sampleInteractions = {
  totalCount: 12,
  byType: { Removal: 3, Counterspell: 2, Ramp: 4, Draw: 3 },
  chains: [
    {
      cards: ["Sol Ring", "Arcane Signet"],
      description: "Mana acceleration chain",
    },
  ],
  loops: [
    {
      cards: ["Palinchron", "High Tide"],
      description: "Infinite mana loop",
      isInfinite: true,
    },
  ],
  topCards: [
    {
      name: "Sol Ring",
      centrality: 0.85,
      category: "Ramp",
    },
    {
      name: "Command Tower",
      centrality: 0.72,
      category: "Mana Fixing",
    },
  ],
};

// Sample goldfish data
const sampleGoldfish = {
  avgManaByTurn: [1.0, 2.2, 3.5, 4.8, 6.1, 7.4, 8.7, 10.0],
  commanderCastRate: 0.82,
  avgCommanderTurn: 3.5,
  rampAcceleration: 1.3,
};

test.describe("formatJsonReport with interaction data", () => {
  test("includes interactions section when provided", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { interactions: sampleInteractions });
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("interactions");
    expect(parsed.interactions.totalCount).toBe(12);
    expect(parsed.interactions).toHaveProperty("byType");
    expect(parsed.interactions).toHaveProperty("chains");
    expect(parsed.interactions).toHaveProperty("loops");
    expect(parsed.interactions).toHaveProperty("topCards");
  });

  test("interactions.byType contains correct type counts", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { interactions: sampleInteractions });
    const parsed = JSON.parse(json);

    expect(parsed.interactions.byType.Removal).toBe(3);
    expect(parsed.interactions.byType.Counterspell).toBe(2);
    expect(parsed.interactions.byType.Ramp).toBe(4);
  });

  test("interactions.chains is an array of card arrays with descriptions", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { interactions: sampleInteractions });
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed.interactions.chains)).toBe(true);
    expect(parsed.interactions.chains[0].cards).toContain("Sol Ring");
    expect(typeof parsed.interactions.chains[0].description).toBe("string");
  });

  test("interactions.loops includes isInfinite flag", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { interactions: sampleInteractions });
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed.interactions.loops)).toBe(true);
    expect(parsed.interactions.loops[0].isInfinite).toBe(true);
  });

  test("interactions.topCards includes name, centrality, category", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { interactions: sampleInteractions });
    const parsed = JSON.parse(json);

    expect(parsed.interactions.topCards[0].name).toBe("Sol Ring");
    expect(typeof parsed.interactions.topCards[0].centrality).toBe("number");
    expect(typeof parsed.interactions.topCards[0].category).toBe("string");
  });
});

test.describe("formatJsonReport with goldfish data", () => {
  test("includes goldfish section when provided", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { goldfish: sampleGoldfish });
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("goldfish");
    expect(parsed.goldfish.commanderCastRate).toBe(0.82);
    expect(parsed.goldfish.avgCommanderTurn).toBe(3.5);
    expect(parsed.goldfish.rampAcceleration).toBe(1.3);
  });

  test("goldfish.avgManaByTurn is an array of numbers", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { goldfish: sampleGoldfish });
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed.goldfish.avgManaByTurn)).toBe(true);
    expect(parsed.goldfish.avgManaByTurn.length).toBe(8);
    expect(typeof parsed.goldfish.avgManaByTurn[0]).toBe("number");
  });

  test("goldfish.avgCommanderTurn can be null", () => {
    const { deck, results } = buildTestResults();
    const goldfishNoCommander = { ...sampleGoldfish, avgCommanderTurn: null };
    const json = formatJsonReport(results, deck, { goldfish: goldfishNoCommander });
    const parsed = JSON.parse(json);

    expect(parsed.goldfish.avgCommanderTurn).toBeNull();
  });
});

test.describe("formatJsonReport with both interaction and goldfish data", () => {
  test("includes both sections simultaneously", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, {
      interactions: sampleInteractions,
      goldfish: sampleGoldfish,
    });
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("interactions");
    expect(parsed).toHaveProperty("goldfish");
  });
});

test.describe("formatJsonReport without optional data (backward compat)", () => {
  test("omits interactions key when not provided", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck);
    const parsed = JSON.parse(json);

    expect(parsed).not.toHaveProperty("interactions");
  });

  test("omits goldfish key when not provided", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck);
    const parsed = JSON.parse(json);

    expect(parsed).not.toHaveProperty("goldfish");
  });

  test("still contains all original keys when called without options", () => {
    const { deck, results } = buildTestResults();
    const parsed = JSON.parse(formatJsonReport(results, deck));

    // Original required keys must all still be present
    expect(parsed).toHaveProperty("deckName");
    expect(parsed).toHaveProperty("commanders");
    expect(parsed).toHaveProperty("bracketResult");
    expect(parsed).toHaveProperty("powerLevel");
    expect(parsed).toHaveProperty("manaCurve");
    expect(parsed).toHaveProperty("colorDistribution");
    expect(parsed).toHaveProperty("landEfficiency");
    expect(parsed).toHaveProperty("budgetAnalysis");
    expect(parsed).toHaveProperty("synergyThemes");
    expect(parsed).toHaveProperty("compositionHealth");
  });

  test("budgetAnalysis does not include mostExpensive prices in share-safe mode", () => {
    // When excludePrices option is set, budget section should be minimal
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck, { excludePrices: true });
    const parsed = JSON.parse(json);

    // With excludePrices, budgetAnalysis should not have mostExpensive price details
    expect(parsed.budgetAnalysis).not.toHaveProperty("mostExpensive");
  });
});
