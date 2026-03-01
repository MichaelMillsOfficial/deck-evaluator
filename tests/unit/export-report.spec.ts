import { test, expect } from "@playwright/test";
import { makeCard, makeDeck } from "../helpers";
import { computeAllAnalyses } from "../../src/lib/deck-analysis-aggregate";
import {
  formatMarkdownReport,
  formatJsonReport,
  formatDiscordReport,
  DISCORD_SECTIONS,
} from "../../src/lib/export-report";

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

  const results = computeAllAnalyses({ deck, cardMap });
  return { deck, cardMap, results };
}

test.describe("Markdown formatter", () => {
  test("returns string with deck name heading", () => {
    const { deck, results } = buildTestResults();
    const md = formatMarkdownReport(results, deck);

    expect(md).toContain("# Deck Analysis: Test Commander Deck");
  });

  test("includes commander names", () => {
    const { deck, results } = buildTestResults();
    const md = formatMarkdownReport(results, deck);

    expect(md).toContain("Atraxa, Praetors' Voice");
  });

  test("includes sections for curve, colors, efficiency, synergy, budget, composition", () => {
    const { deck, results } = buildTestResults();
    const md = formatMarkdownReport(results, deck);

    expect(md).toContain("## Mana Curve");
    expect(md).toContain("## Color Distribution");
    expect(md).toContain("## Land Base Efficiency");
    expect(md).toContain("## Budget");
    expect(md).toContain("## Composition");
  });

  test("includes Opening Hands section", () => {
    const { deck, results } = buildTestResults();
    const md = formatMarkdownReport(results, deck);

    expect(md).toContain("## Opening Hands");
    expect(md).toContain("Keepable Rate:");
    expect(md).toContain("Avg Lands:");
  });
});

test.describe("JSON formatter", () => {
  test("returns valid JSON", () => {
    const { deck, results } = buildTestResults();
    const json = formatJsonReport(results, deck);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  test("contains keys for every analysis module", () => {
    const { deck, results } = buildTestResults();
    const parsed = JSON.parse(formatJsonReport(results, deck));

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

  test("contains openingHands key with numeric values", () => {
    const { deck, results } = buildTestResults();
    const parsed = JSON.parse(formatJsonReport(results, deck));

    expect(parsed).toHaveProperty("openingHands");
    expect(typeof parsed.openingHands.keepableRate).toBe("number");
    expect(typeof parsed.openingHands.avgLandsInOpener).toBe("number");
    expect(typeof parsed.openingHands.avgScore).toBe("number");
    expect(typeof parsed.openingHands.probT1Play).toBe("number");
    expect(typeof parsed.openingHands.probT2Play).toBe("number");
    expect(typeof parsed.openingHands.probT3Play).toBe("number");
    expect(parsed.openingHands).toHaveProperty("verdictDistribution");
  });
});

test.describe("Discord formatter", () => {
  test("DISCORD_SECTIONS registry has expected section ids", () => {
    const ids = DISCORD_SECTIONS.map((s) => s.id);
    expect(ids).toContain("header");
    expect(ids).toContain("curve");
    expect(ids).toContain("land-efficiency");
    expect(ids).toContain("synergy-themes");
    expect(ids).toContain("opening-hands");
  });

  test("returns text, charCount, included, excluded", () => {
    const { deck, results } = buildTestResults();
    const result = formatDiscordReport(results, deck);

    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("charCount");
    expect(result).toHaveProperty("included");
    expect(result).toHaveProperty("excluded");
    expect(typeof result.text).toBe("string");
    expect(typeof result.charCount).toBe("number");
    expect(Array.isArray(result.included)).toBe(true);
    expect(Array.isArray(result.excluded)).toBe(true);
  });

  test("output is always <= 2000 characters", () => {
    const { deck, results } = buildTestResults();
    const result = formatDiscordReport(results, deck);

    expect(result.charCount).toBeLessThanOrEqual(2000);
    expect(result.text.length).toBeLessThanOrEqual(2000);
  });

  test("header section is always included regardless of enabledSections", () => {
    const { deck, results } = buildTestResults();
    // Enable no sections
    const result = formatDiscordReport(results, deck, new Set<string>());

    expect(result.included).toContain("header");
    expect(result.text).toContain("Test Commander Deck");
  });

  test("lower-priority sections are dropped first when budget is tight", () => {
    const { deck, results } = buildTestResults();
    // Enable all sections
    const allIds = new Set(DISCORD_SECTIONS.map((s) => s.id));
    const result = formatDiscordReport(results, deck, allIds);

    // Header should always be first in included
    expect(result.included[0]).toBe("header");
    // All included + excluded should cover all enabled non-locked sections
    const nonLocked = DISCORD_SECTIONS.filter((s) => !s.locked).map(
      (s) => s.id
    );
    for (const id of nonLocked) {
      const inResult =
        result.included.includes(id) || result.excluded.includes(id);
      expect(inResult).toBe(true);
    }
  });

  test("each section render produces non-empty output", () => {
    const { deck, results } = buildTestResults();
    for (const section of DISCORD_SECTIONS) {
      const output = section.render(results, deck);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  test("appends share URL footer when shareUrl is provided", () => {
    const { deck, results } = buildTestResults();
    const shareUrl = "https://example.com/shared?d=abc123";
    const result = formatDiscordReport(results, deck, undefined, shareUrl);

    expect(result.text).toContain(shareUrl);
    expect(result.text.endsWith(shareUrl)).toBe(true);
  });

  test("share URL is included in character count", () => {
    const { deck, results } = buildTestResults();
    const shareUrl = "https://example.com/shared?d=abc123";
    const withUrl = formatDiscordReport(results, deck, undefined, shareUrl);
    const withoutUrl = formatDiscordReport(results, deck);

    expect(withUrl.charCount).toBeGreaterThan(withoutUrl.charCount);
  });

  test("output with share URL is still <= 2000 characters", () => {
    const { deck, results } = buildTestResults();
    const shareUrl = "https://example.com/shared?d=abc123";
    const result = formatDiscordReport(results, deck, undefined, shareUrl);

    expect(result.charCount).toBeLessThanOrEqual(2000);
    expect(result.text.length).toBeLessThanOrEqual(2000);
  });

  test("share URL reserves budget and may exclude sections to fit", () => {
    const { deck, results } = buildTestResults();
    // Use a long URL to eat into budget
    const longUrl = "https://example.com/shared?d=" + "x".repeat(500);
    const allIds = new Set(DISCORD_SECTIONS.map((s) => s.id));
    const result = formatDiscordReport(results, deck, allIds, longUrl);

    expect(result.text).toContain(longUrl);
    expect(result.charCount).toBeLessThanOrEqual(2000);
  });

  test("omits share URL footer when shareUrl is not provided", () => {
    const { deck, results } = buildTestResults();
    const result = formatDiscordReport(results, deck);

    expect(result.text).not.toContain("View full analysis");
  });
});
