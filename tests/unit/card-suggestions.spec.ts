import { test, expect } from "@playwright/test";
import {
  identifyWeakCards,
  buildScryfallSearchQuery,
  selectUpgradeCandidates,
  deriveGapsFromScorecard,
  WEAK_CARD_THRESHOLD,
  MAX_WEAK_CARDS,
  UPGRADE_SCORE_MIN,
  UPGRADE_SCORE_MAX,
  MAX_UPGRADE_CANDIDATES,
  MAX_QUERY_EXCLUSIONS,
} from "../../src/lib/card-suggestions";
import type { DeckData, EnrichedCard, CardSynergyScore } from "../../src/lib/types";
import type { CompositionScorecardResult, CategoryResult } from "../../src/lib/deck-composition";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScore(
  cardName: string,
  score: number,
  overrides: Partial<CardSynergyScore> = {}
): CardSynergyScore {
  return {
    cardName,
    score,
    axes: [],
    pairs: [],
    ...overrides,
  };
}

function makeCategoryResult(
  tag: string,
  status: "good" | "low" | "high" | "critical",
  count = 3,
  min = 7,
  max = 9
): CategoryResult {
  return {
    tag,
    label: tag,
    count,
    min,
    max,
    status,
    statusMessage: status === "good" ? "On target" : "Need more",
    cards: [],
  };
}

function makeScorecard(
  categories: CategoryResult[],
  overrides: Partial<CompositionScorecardResult> = {}
): CompositionScorecardResult {
  return {
    templateId: "command-zone",
    templateName: "Command Zone Template",
    categories,
    overallHealth: "healthy",
    healthSummary: "All categories on target",
    untaggedCount: 0,
    untaggedCards: [],
    ...overrides,
  };
}

function makeEnrichedCard(
  name: string,
  overrides: Partial<EnrichedCard> = {}
): EnrichedCard {
  return makeCard({ name, ...overrides });
}

function makeDeckWithCards(
  mainboard: string[],
  commanders: string[] = []
): DeckData {
  return makeDeck({
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: mainboard.map((name) => ({ name, quantity: 1 })),
  });
}

// ---------------------------------------------------------------------------
// identifyWeakCards tests
// ---------------------------------------------------------------------------

test.describe("identifyWeakCards", () => {
  test("2.2 - flags low-synergy card with no unique functional role", () => {
    const cardName = "Vanilla Creature";
    const deck = makeDeckWithCards([cardName]);
    const cardMap: Record<string, EnrichedCard> = {
      [cardName]: makeEnrichedCard(cardName, {
        typeLine: "Creature — Human",
        oracleText: "",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [cardName]: makeScore(cardName, 20),
    };
    const scorecard = makeScorecard([
      makeCategoryResult("Ramp", "good"),
    ]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result.some((w) => w.cardName === cardName)).toBe(true);
  });

  test("2.3 - preserves sole provider of a critical category", () => {
    const soloRamp = "Sol Ring";
    const deck = makeDeckWithCards([soloRamp]);
    const cardMap: Record<string, EnrichedCard> = {
      [soloRamp]: makeEnrichedCard(soloRamp, {
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [soloRamp]: makeScore(soloRamp, 15),
    };
    // Sol Ring is the sole card in a critical Ramp category
    const rampCategory = makeCategoryResult("Ramp", "critical", 1, 7, 9);
    rampCategory.cards = [{ name: soloRamp, quantity: 1 }];

    const scorecard = makeScorecard([rampCategory]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result.some((w) => w.cardName === soloRamp)).toBe(false);
  });

  test("2.4 - preserves combo piece regardless of score", () => {
    // Thassa's Oracle + Demonic Consultation is a known combo.
    // Both cards must be present for the combo to be detected.
    const comboPiece = "Thassa's Oracle";
    const comboPartner = "Demonic Consultation";
    const deck = makeDeckWithCards([comboPiece, comboPartner]);
    const cardMap: Record<string, EnrichedCard> = {
      [comboPiece]: makeEnrichedCard(comboPiece, {
        typeLine: "Creature — Merfolk Wizard",
        oracleText: "When Thassa's Oracle enters the battlefield, look at the top X cards of your library...",
      }),
      [comboPartner]: makeEnrichedCard(comboPartner, {
        typeLine: "Instant",
        oracleText: "Name a card, then exile cards from the top of your library until you exile a card with that name.",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [comboPiece]: makeScore(comboPiece, 10),
      [comboPartner]: makeScore(comboPartner, 8),
    };
    const scorecard = makeScorecard([makeCategoryResult("Ramp", "good")]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result.some((w) => w.cardName === comboPiece)).toBe(false);
    expect(result.some((w) => w.cardName === comboPartner)).toBe(false);
  });

  test("2.5 - commanders never flagged", () => {
    const cmdName = "Atraxa, Praetors' Voice";
    const deck = makeDeckWithCards([], [cmdName]);
    const cardMap: Record<string, EnrichedCard> = {
      [cmdName]: makeEnrichedCard(cmdName, {
        typeLine: "Legendary Creature — Phyrexian Angel Horror",
        supertypes: ["Legendary"],
        oracleText: "Flying, vigilance, deathtouch, lifelink. Proliferate.",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [cmdName]: makeScore(cmdName, 5),
    };
    const scorecard = makeScorecard([makeCategoryResult("Ramp", "good")]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result.some((w) => w.cardName === cmdName)).toBe(false);
  });

  test("2.6 - lands never flagged", () => {
    const landName = "Forest";
    const deck = makeDeckWithCards([landName]);
    const cardMap: Record<string, EnrichedCard> = {
      [landName]: makeEnrichedCard(landName, {
        typeLine: "Basic Land — Forest",
        oracleText: "{T}: Add {G}.",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [landName]: makeScore(landName, 0),
    };
    const scorecard = makeScorecard([makeCategoryResult("Lands", "good")]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result.some((w) => w.cardName === landName)).toBe(false);
  });

  test("2.7 - sorted by score ascending, capped at MAX_WEAK_CARDS", () => {
    // Create 15 weak cards with different scores
    const names = Array.from({ length: 15 }, (_, i) => `Weak Card ${i}`);
    const deck = makeDeckWithCards(names);
    const cardMap: Record<string, EnrichedCard> = {};
    const cardScores: Record<string, CardSynergyScore> = {};

    names.forEach((name, i) => {
      cardMap[name] = makeEnrichedCard(name, {
        typeLine: "Creature",
        oracleText: "",
      });
      // Scores 0–14, all below threshold
      cardScores[name] = makeScore(name, i);
    });

    const scorecard = makeScorecard([makeCategoryResult("Ramp", "good")]);
    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);

    expect(result.length).toBeLessThanOrEqual(MAX_WEAK_CARDS);
    // First element should have lowest score
    if (result.length > 1) {
      expect(result[0].synergyScore).toBeLessThanOrEqual(result[1].synergyScore);
    }
  });

  test("2.8 - card not in cardScores/cardMap silently skipped", () => {
    const missingCard = "Missing Card";
    const deck = makeDeckWithCards([missingCard]);
    const cardMap: Record<string, EnrichedCard> = {};
    const cardScores: Record<string, CardSynergyScore> = {};
    const scorecard = makeScorecard([makeCategoryResult("Ramp", "good")]);

    // Should not throw
    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result).toHaveLength(0);
  });

  test("2.9 - empty deck returns empty array", () => {
    const deck = makeDeckWithCards([]);
    const cardMap: Record<string, EnrichedCard> = {};
    const cardScores: Record<string, CardSynergyScore> = {};
    const scorecard = makeScorecard([]);

    const result = identifyWeakCards(deck, cardMap, cardScores, scorecard);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildScryfallSearchQuery tests
// ---------------------------------------------------------------------------

test.describe("buildScryfallSearchQuery", () => {
  test("2.10 - correct color identity filter for Sultai (BUG)", () => {
    const query = buildScryfallSearchQuery("Ramp", ["B", "U", "G"], []);
    expect(query).toContain("id<=BUG");
  });

  test("2.11 - excludes deck card names", () => {
    const excludeNames = ["Sol Ring", "Arcane Signet"];
    const query = buildScryfallSearchQuery("Ramp", ["G"], excludeNames);
    expect(query).toContain('-!"Sol Ring"');
    expect(query).toContain('-!"Arcane Signet"');
  });

  test("2.12 - caps exclusions at MAX_QUERY_EXCLUSIONS", () => {
    const manyNames = Array.from({ length: 30 }, (_, i) => `Card ${i}`);
    const query = buildScryfallSearchQuery("Ramp", ["G"], manyNames);

    // Count the number of -!"..." exclusions
    const exclusions = query.match(/-!"[^"]+"/g) ?? [];
    expect(exclusions.length).toBeLessThanOrEqual(MAX_QUERY_EXCLUSIONS);
  });

  test("2.13 - unknown tag returns empty string", () => {
    const query = buildScryfallSearchQuery("Unknown Tag That Doesnt Exist", ["G"], []);
    expect(query).toBe("");
  });

  test("2.14 - colorless commander uses id<=C", () => {
    const query = buildScryfallSearchQuery("Ramp", [], []);
    expect(query).toContain("id<=C");
  });

  test("2.15 - appends format:commander", () => {
    const query = buildScryfallSearchQuery("Ramp", ["G"], []);
    expect(query).toContain("format:commander");
  });
});

// ---------------------------------------------------------------------------
// selectUpgradeCandidates tests
// ---------------------------------------------------------------------------

test.describe("selectUpgradeCandidates", () => {
  test("2.16 - selects cards in score range with tags", () => {
    const cardName = "Divination";
    const deck = makeDeckWithCards([cardName]);
    const cardMap: Record<string, EnrichedCard> = {
      [cardName]: makeEnrichedCard(cardName, {
        typeLine: "Sorcery",
        oracleText: "Draw two cards.",
        cmc: 3,
        manaCost: "{2}{U}",
      }),
    };
    // Score in range [35, 55]
    const cardScores: Record<string, CardSynergyScore> = {
      [cardName]: makeScore(cardName, 42),
    };

    const result = selectUpgradeCandidates(deck, cardMap, cardScores);
    expect(result.some((c) => c.cardName === cardName)).toBe(true);
  });

  test("2.17 - excludes cards with no functional tags", () => {
    const cardName = "Ambiguity Card";
    const deck = makeDeckWithCards([cardName]);
    const cardMap: Record<string, EnrichedCard> = {
      [cardName]: makeEnrichedCard(cardName, {
        typeLine: "Creature",
        oracleText: "This card has no recognizable tags.",
        cmc: 3,
        manaCost: "{2}{G}",
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [cardName]: makeScore(cardName, 45),
    };

    const result = selectUpgradeCandidates(deck, cardMap, cardScores);
    expect(result.some((c) => c.cardName === cardName)).toBe(false);
  });

  test("2.18 - excludes commanders and lands", () => {
    const cmdName = "Test Commander";
    const landName = "Forest";
    const deck = makeDeckWithCards([landName], [cmdName]);
    const cardMap: Record<string, EnrichedCard> = {
      [cmdName]: makeEnrichedCard(cmdName, {
        typeLine: "Legendary Creature",
        supertypes: ["Legendary"],
        oracleText: "Draw a card.",
        cmc: 4,
        manaCost: "{2}{U}{U}",
      }),
      [landName]: makeEnrichedCard(landName, {
        typeLine: "Basic Land — Forest",
        oracleText: "{T}: Add {G}.",
        cmc: 0,
      }),
    };
    const cardScores: Record<string, CardSynergyScore> = {
      [cmdName]: makeScore(cmdName, 45),
      [landName]: makeScore(landName, 45),
    };

    const result = selectUpgradeCandidates(deck, cardMap, cardScores);
    expect(result.some((c) => c.cardName === cmdName)).toBe(false);
    expect(result.some((c) => c.cardName === landName)).toBe(false);
  });

  test("2.19 - sorted ascending, capped at MAX_UPGRADE_CANDIDATES", () => {
    // Create 10 upgrade candidates all in range
    const names = Array.from({ length: 10 }, (_, i) => `Upgrade Card ${i}`);
    const deck = makeDeckWithCards(names);
    const cardMap: Record<string, EnrichedCard> = {};
    const cardScores: Record<string, CardSynergyScore> = {};

    names.forEach((name, i) => {
      cardMap[name] = makeEnrichedCard(name, {
        typeLine: "Sorcery",
        oracleText: "Draw two cards.",
        cmc: 3,
        manaCost: "{2}{U}",
      });
      // Scores spread across upgrade range
      cardScores[name] = makeScore(name, UPGRADE_SCORE_MIN + i);
    });

    const result = selectUpgradeCandidates(deck, cardMap, cardScores);
    expect(result.length).toBeLessThanOrEqual(MAX_UPGRADE_CANDIDATES);
    if (result.length > 1) {
      expect(result[0].score).toBeLessThanOrEqual(result[1].score);
    }
  });

  test("2.20 - empty deck returns empty array", () => {
    const deck = makeDeckWithCards([]);
    const result = selectUpgradeCandidates(deck, {}, {});
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deriveGapsFromScorecard tests
// ---------------------------------------------------------------------------

test.describe("deriveGapsFromScorecard", () => {
  test("2.21 - returns only 'low' and 'critical' categories", () => {
    const scorecard = makeScorecard([
      makeCategoryResult("Ramp", "critical", 2, 10, 12),
      makeCategoryResult("Card Draw", "low", 6, 10, 12),
      makeCategoryResult("Removal", "good", 7, 5, 8),
      makeCategoryResult("Board Wipe", "high", 5, 3, 4),
    ]);

    const gaps = deriveGapsFromScorecard(scorecard);
    const gapTags = gaps.map((g) => g.tag);

    expect(gapTags).toContain("Ramp");
    expect(gapTags).toContain("Card Draw");
    expect(gapTags).not.toContain("Removal");
    expect(gapTags).not.toContain("Board Wipe");
  });

  test("2.22 - excludes 'Lands' tag", () => {
    const scorecard = makeScorecard([
      makeCategoryResult("Lands", "critical", 20, 36, 38),
      makeCategoryResult("Ramp", "critical", 2, 10, 12),
    ]);

    const gaps = deriveGapsFromScorecard(scorecard);
    const gapTags = gaps.map((g) => g.tag);

    expect(gapTags).not.toContain("Lands");
    expect(gapTags).toContain("Ramp");
  });

  test("2.23 - returns empty when all categories 'good' or 'high'", () => {
    const scorecard = makeScorecard([
      makeCategoryResult("Ramp", "good"),
      makeCategoryResult("Card Draw", "high", 12, 7, 9),
      makeCategoryResult("Removal", "good"),
    ]);

    const gaps = deriveGapsFromScorecard(scorecard);
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------

test.describe("constants", () => {
  test("WEAK_CARD_THRESHOLD is 35", () => {
    expect(WEAK_CARD_THRESHOLD).toBe(35);
  });

  test("MAX_WEAK_CARDS is 10", () => {
    expect(MAX_WEAK_CARDS).toBe(10);
  });

  test("UPGRADE_SCORE_MIN is 35, UPGRADE_SCORE_MAX is 55", () => {
    expect(UPGRADE_SCORE_MIN).toBe(35);
    expect(UPGRADE_SCORE_MAX).toBe(55);
  });

  test("MAX_UPGRADE_CANDIDATES is 8", () => {
    expect(MAX_UPGRADE_CANDIDATES).toBe(8);
  });

  test("MAX_QUERY_EXCLUSIONS is 20", () => {
    expect(MAX_QUERY_EXCLUSIONS).toBe(20);
  });
});
