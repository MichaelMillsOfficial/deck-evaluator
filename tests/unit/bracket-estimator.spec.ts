import { test, expect } from "@playwright/test";
import {
  computeBracketEstimate,
  computeDowngradeRecommendations,
  findRestrictedKnownCombos,
  findRestrictedSpellbookCombos,
  mergeRestrictedCombos,
  BRACKET_NAMES,
  BRACKET_DESCRIPTIONS,
  type BracketConstraint,
} from "../../src/lib/bracket-estimator";
import type { DeckData, EnrichedCard } from "../../src/lib/types";
import type { PowerLevelResult } from "../../src/lib/power-level";
import type { SpellbookCombo } from "../../src/lib/commander-spellbook";
import type { KnownCombo } from "../../src/lib/known-combos";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card",
    manaCost: "{1}{U}",
    cmc: 2,
    colorIdentity: ["U"],
    colors: ["U"],
    typeLine: "Instant",
    supertypes: [],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    ...overrides,
  };
}

function makeDeck(
  cards: { name: string; quantity?: number }[],
  commanders: { name: string; quantity?: number }[] = []
): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: commanders.map((c) => ({ name: c.name, quantity: c.quantity ?? 1 })),
    mainboard: cards.map((c) => ({ name: c.name, quantity: c.quantity ?? 1 })),
    sideboard: [],
  };
}

function makePowerLevel(powerLevel: number): PowerLevelResult {
  return {
    powerLevel,
    rawScore: powerLevel * 10,
    bandLabel: `Band ${powerLevel}`,
    bandDescription: "Test band",
    factors: [],
  };
}

function makeCardMap(
  entries: { name: string; overrides?: Partial<EnrichedCard> }[]
): Record<string, EnrichedCard> {
  const map: Record<string, EnrichedCard> = {};
  for (const entry of entries) {
    map[entry.name] = makeCard({ name: entry.name, ...entry.overrides });
  }
  return map;
}

const EMPTY_STAPLES = new Set<string>();

// ---------------------------------------------------------------------------
// BRACKET_NAMES and BRACKET_DESCRIPTIONS
// ---------------------------------------------------------------------------

test.describe("BRACKET_NAMES and BRACKET_DESCRIPTIONS", () => {
  test("has entries for brackets 1-5", () => {
    for (let b = 1; b <= 5; b++) {
      expect(BRACKET_NAMES[b]).toBeTruthy();
      expect(BRACKET_DESCRIPTIONS[b]).toBeTruthy();
    }
  });

  test("bracket names are correct", () => {
    expect(BRACKET_NAMES[1]).toBe("Exhibition");
    expect(BRACKET_NAMES[2]).toBe("Core");
    expect(BRACKET_NAMES[3]).toBe("Upgraded");
    expect(BRACKET_NAMES[4]).toBe("Optimized");
    expect(BRACKET_NAMES[5]).toBe("cEDH");
  });

  test("bracket descriptions are non-empty strings", () => {
    for (let b = 1; b <= 5; b++) {
      expect(typeof BRACKET_DESCRIPTIONS[b]).toBe("string");
      expect(BRACKET_DESCRIPTIONS[b].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// findRestrictedKnownCombos
// ---------------------------------------------------------------------------

test.describe("findRestrictedKnownCombos", () => {
  test("finds 2-card infinite combos in card names", () => {
    const result = findRestrictedKnownCombos([
      "Dramatic Reversal",
      "Isochron Scepter",
      "Lightning Bolt",
    ]);
    expect(result.length).toBe(1);
    expect(result[0].cards).toEqual(
      expect.arrayContaining(["Dramatic Reversal", "Isochron Scepter"])
    );
  });

  test("finds 2-card wincon combos", () => {
    const result = findRestrictedKnownCombos([
      "Thassa's Oracle",
      "Demonic Consultation",
    ]);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("wincon");
  });

  test("finds 2-card lock combos", () => {
    const result = findRestrictedKnownCombos([
      "Knowledge Pool",
      "Drannith Magistrate",
    ]);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("lock");
  });

  test("excludes 3-card combos", () => {
    const result = findRestrictedKnownCombos([
      "Ghostly Flicker",
      "Archaeomancer",
      "Peregrine Drake",
    ]);
    expect(result.length).toBe(0);
  });

  test("excludes value-type combos", () => {
    const result = findRestrictedKnownCombos([
      "Sword of the Meek",
      "Thopter Foundry",
    ]);
    expect(result.length).toBe(0);
  });

  test("returns empty for cards with no combos", () => {
    const result = findRestrictedKnownCombos([
      "Lightning Bolt",
      "Counterspell",
    ]);
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// findRestrictedSpellbookCombos
// ---------------------------------------------------------------------------

test.describe("findRestrictedSpellbookCombos", () => {
  test("returns 2-card exact combos", () => {
    const combos: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Card A", "Card B"],
        description: "test combo",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UB",
        type: "exact",
      },
    ];
    const result = findRestrictedSpellbookCombos(combos);
    expect(result.length).toBe(1);
  });

  test("excludes 3+ card combos", () => {
    const combos: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Card A", "Card B", "Card C"],
        description: "3 card combo",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UBR",
        type: "exact",
      },
    ];
    const result = findRestrictedSpellbookCombos(combos);
    expect(result.length).toBe(0);
  });

  test("excludes near combos", () => {
    const combos: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Card A", "Card B"],
        description: "near combo",
        produces: ["Infinite mana"],
        missingCards: ["Card B"],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UB",
        type: "near",
      },
    ];
    const result = findRestrictedSpellbookCombos(combos);
    expect(result.length).toBe(0);
  });

  test("returns empty array for null input", () => {
    const result = findRestrictedSpellbookCombos(null);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeRestrictedCombos
// ---------------------------------------------------------------------------

test.describe("mergeRestrictedCombos", () => {
  test("merges combos from both sources", () => {
    const known: KnownCombo[] = [
      {
        cards: ["Dramatic Reversal", "Isochron Scepter"],
        description: "Infinite mana",
        type: "infinite",
      },
    ];
    const spellbook: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Card X", "Card Y"],
        description: "another combo",
        produces: [],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "",
        identity: "",
        type: "exact",
      },
    ];
    const result = mergeRestrictedCombos(known, spellbook);
    expect(result.length).toBe(2);
  });

  test("deduplicates same card pairs from both sources", () => {
    const known: KnownCombo[] = [
      {
        cards: ["Dramatic Reversal", "Isochron Scepter"],
        description: "Infinite mana",
        type: "infinite",
      },
    ];
    const spellbook: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Isochron Scepter", "Dramatic Reversal"],
        description: "Infinite mana from Spellbook",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UR",
        type: "exact",
      },
    ];
    const result = mergeRestrictedCombos(known, spellbook);
    expect(result.length).toBe(1);
  });

  test("handles empty known combos", () => {
    const spellbook: SpellbookCombo[] = [
      {
        id: "1",
        cards: ["Card A", "Card B"],
        description: "combo",
        produces: [],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "",
        identity: "",
        type: "exact",
      },
    ];
    const result = mergeRestrictedCombos([], spellbook);
    expect(result.length).toBe(1);
  });

  test("handles empty spellbook combos", () => {
    const known: KnownCombo[] = [
      {
        cards: ["Card A", "Card B"],
        description: "combo",
        type: "infinite",
      },
    ];
    const result = mergeRestrictedCombos(known, []);
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeBracketEstimate — Bracket floor tests
// ---------------------------------------------------------------------------

test.describe("computeBracketEstimate — bracket floor", () => {
  test("empty deck returns bracket 1", () => {
    const deck = makeDeck([]);
    const cardMap = {};
    const pl = makePowerLevel(1);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(1);
    expect(result.bracketName).toBe("Exhibition");
  });

  test("precon-like deck (PL 4, no violations) returns bracket 2", () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({
      name: `Card ${i}`,
    }));
    const cardMap = makeCardMap(
      cards.map((c) => ({ name: c.name }))
    );
    const deck = makeDeck(cards);
    const pl = makePowerLevel(4);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(2);
    expect(result.bracketName).toBe("Core");
  });

  test("theme deck (PL 2, no violations) returns bracket 1", () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({
      name: `Card ${i}`,
    }));
    const cardMap = makeCardMap(
      cards.map((c) => ({ name: c.name }))
    );
    const deck = makeDeck(cards);
    const pl = makePowerLevel(2);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(1);
    expect(result.bracketName).toBe("Exhibition");
  });

  test("deck with 1 Game Changer returns bracket 3", () => {
    const cardMap = makeCardMap([
      {
        name: "Cyclonic Rift",
        overrides: { isGameChanger: true, oracleText: "Return all nonland permanents you don't control to their owners' hands. Overload {6}{U}" },
      },
      { name: "Island" },
    ]);
    const deck = makeDeck([{ name: "Cyclonic Rift" }, { name: "Island" }]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(3);
    expect(result.gameChangerCount).toBe(1);
  });

  test("deck with 3 Game Changers returns bracket 3", () => {
    const gcCards = ["Cyclonic Rift", "Rhystic Study", "Demonic Tutor"];
    const cardMap = makeCardMap(
      gcCards.map((name) => ({
        name,
        overrides: { isGameChanger: true },
      }))
    );
    const deck = makeDeck(gcCards.map((name) => ({ name })));
    const pl = makePowerLevel(6);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(3);
    expect(result.gameChangerCount).toBe(3);
  });

  test("deck with 4+ Game Changers returns bracket 4", () => {
    const gcCards = [
      "Cyclonic Rift",
      "Rhystic Study",
      "Demonic Tutor",
      "Dockside Extortionist",
    ];
    const cardMap = makeCardMap(
      gcCards.map((name) => ({
        name,
        overrides: { isGameChanger: true },
      }))
    );
    const deck = makeDeck(gcCards.map((name) => ({ name })));
    const pl = makePowerLevel(7);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
    expect(result.gameChangerCount).toBe(4);
  });

  test("deck with 2-card infinite combo (known) returns bracket 4", () => {
    const cardMap = makeCardMap([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const deck = makeDeck([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const pl = makePowerLevel(7);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
    expect(result.twoCardComboCount).toBeGreaterThanOrEqual(1);
  });

  test("deck with 2-card wincon (Thoracle+Consult) returns bracket 4", () => {
    const cardMap = makeCardMap([
      { name: "Thassa's Oracle" },
      { name: "Demonic Consultation" },
    ]);
    const deck = makeDeck([
      { name: "Thassa's Oracle" },
      { name: "Demonic Consultation" },
    ]);
    const pl = makePowerLevel(8);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
  });

  test("deck with 2-card lock (Knowledge Pool + Magistrate) returns bracket 4", () => {
    const cardMap = makeCardMap([
      { name: "Knowledge Pool" },
      { name: "Drannith Magistrate" },
    ]);
    const deck = makeDeck([
      { name: "Knowledge Pool" },
      { name: "Drannith Magistrate" },
    ]);
    const pl = makePowerLevel(6);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
  });

  test("deck with 3-card combo only does NOT trigger combo restriction", () => {
    const cardMap = makeCardMap([
      { name: "Ghostly Flicker" },
      { name: "Archaeomancer" },
      { name: "Peregrine Drake" },
    ]);
    const deck = makeDeck([
      { name: "Ghostly Flicker" },
      { name: "Archaeomancer" },
      { name: "Peregrine Drake" },
    ]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.twoCardComboCount).toBe(0);
    // Bracket shouldn't be raised by combos
    expect(result.bracket).toBeLessThanOrEqual(2);
  });

  test("deck with 2-card value combo does NOT trigger combo restriction", () => {
    const cardMap = makeCardMap([
      { name: "Sword of the Meek" },
      { name: "Thopter Foundry" },
    ]);
    const deck = makeDeck([
      { name: "Sword of the Meek" },
      { name: "Thopter Foundry" },
    ]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.twoCardComboCount).toBe(0);
  });

  test("deck with Mass Land Denial card returns bracket 4", () => {
    const cardMap = makeCardMap([
      {
        name: "Armageddon",
        overrides: { oracleText: "Destroy all lands." },
      },
    ]);
    const deck = makeDeck([{ name: "Armageddon" }]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
    expect(result.hasMassLandDenial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeBracketEstimate — Extra turn granularity
// ---------------------------------------------------------------------------

test.describe("computeBracketEstimate — extra turn granularity", () => {
  test("0 extra turn cards → no extra turn constraint", () => {
    const cardMap = makeCardMap([{ name: "Lightning Bolt" }]);
    const deck = makeDeck([{ name: "Lightning Bolt" }]);
    const pl = makePowerLevel(4);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.extraTurnCount).toBe(0);
    expect(
      result.constraints.find((c) => c.type === "extra-turn")
    ).toBeUndefined();
  });

  test("1 extra turn card → minBracket 2", () => {
    const cardMap = makeCardMap([
      {
        name: "Time Warp",
        overrides: {
          oracleText: "Target player takes an extra turn after this one.",
        },
      },
    ]);
    const deck = makeDeck([{ name: "Time Warp" }]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.extraTurnCount).toBe(1);
    const etConstraint = result.constraints.find(
      (c) => c.type === "extra-turn"
    );
    expect(etConstraint).toBeDefined();
    expect(etConstraint!.minBracket).toBe(2);
  });

  test("2 extra turn cards → minBracket 3", () => {
    const cardMap = makeCardMap([
      {
        name: "Time Warp",
        overrides: {
          oracleText: "Target player takes an extra turn after this one.",
        },
      },
      {
        name: "Temporal Manipulation",
        overrides: {
          oracleText: "Take an extra turn after this one.",
        },
      },
    ]);
    const deck = makeDeck([
      { name: "Time Warp" },
      { name: "Temporal Manipulation" },
    ]);
    const pl = makePowerLevel(5);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.extraTurnCount).toBe(2);
    const etConstraint = result.constraints.find(
      (c) => c.type === "extra-turn"
    );
    expect(etConstraint).toBeDefined();
    expect(etConstraint!.minBracket).toBe(3);
  });

  test("3+ extra turn cards → minBracket 3", () => {
    const cardMap = makeCardMap([
      {
        name: "Time Warp",
        overrides: {
          oracleText: "Target player takes an extra turn after this one.",
        },
      },
      {
        name: "Temporal Manipulation",
        overrides: {
          oracleText: "Take an extra turn after this one.",
        },
      },
      {
        name: "Expropriate",
        overrides: {
          oracleText:
            "Council's dilemma — Starting with you, each player votes for time or money. For each time vote, take an extra turn after this one.",
        },
      },
    ]);
    const deck = makeDeck([
      { name: "Time Warp" },
      { name: "Temporal Manipulation" },
      { name: "Expropriate" },
    ]);
    const pl = makePowerLevel(6);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.extraTurnCount).toBe(3);
    const etConstraint = result.constraints.find(
      (c) => c.type === "extra-turn"
    );
    expect(etConstraint!.minBracket).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeBracketEstimate — Spellbook combo integration
// ---------------------------------------------------------------------------

test.describe("computeBracketEstimate — Spellbook combos", () => {
  test("Spellbook 2-card exact combo triggers bracket 4", () => {
    const cardMap = makeCardMap([
      { name: "Card A" },
      { name: "Card B" },
    ]);
    const deck = makeDeck([{ name: "Card A" }, { name: "Card B" }]);
    const pl = makePowerLevel(6);
    const spellbookCombos: SpellbookCombo[] = [
      {
        id: "sb-1",
        cards: ["Card A", "Card B"],
        description: "Infinite mana",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UB",
        type: "exact",
      },
    ];
    const result = computeBracketEstimate(
      deck,
      cardMap,
      pl,
      EMPTY_STAPLES,
      spellbookCombos
    );
    expect(result.bracket).toBe(4);
    expect(result.twoCardComboCount).toBeGreaterThanOrEqual(1);
    expect(result.comboSource).toBe("local+spellbook");
  });

  test("Spellbook 3-card exact combo does NOT trigger combo restriction", () => {
    const cardMap = makeCardMap([
      { name: "Card A" },
      { name: "Card B" },
      { name: "Card C" },
    ]);
    const deck = makeDeck([
      { name: "Card A" },
      { name: "Card B" },
      { name: "Card C" },
    ]);
    const pl = makePowerLevel(5);
    const spellbookCombos: SpellbookCombo[] = [
      {
        id: "sb-1",
        cards: ["Card A", "Card B", "Card C"],
        description: "3-card combo",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UBR",
        type: "exact",
      },
    ];
    const result = computeBracketEstimate(
      deck,
      cardMap,
      pl,
      EMPTY_STAPLES,
      spellbookCombos
    );
    expect(result.twoCardComboCount).toBe(0);
  });

  test("null spellbook data gracefully handled (uses known combos only)", () => {
    const cardMap = makeCardMap([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const deck = makeDeck([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const pl = makePowerLevel(7);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    expect(result.bracket).toBe(4);
    expect(result.comboSource).toBe("local");
  });

  test("duplicate combos from both sources are deduplicated", () => {
    const cardMap = makeCardMap([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const deck = makeDeck([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
    ]);
    const pl = makePowerLevel(7);
    const spellbookCombos: SpellbookCombo[] = [
      {
        id: "sb-1",
        cards: ["Isochron Scepter", "Dramatic Reversal"],
        description: "Infinite mana (spellbook)",
        produces: ["Infinite mana"],
        missingCards: [],
        templateRequirements: [],
        manaNeeded: "",
        bracketTag: "bracket4",
        identity: "UR",
        type: "exact",
      },
    ];
    const result = computeBracketEstimate(
      deck,
      cardMap,
      pl,
      EMPTY_STAPLES,
      spellbookCombos
    );
    // Should still count as 1 combo, not 2
    expect(result.twoCardComboCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeBracketEstimate — B4/B5 differentiation
// ---------------------------------------------------------------------------

test.describe("computeBracketEstimate — B4/B5 differentiation", () => {
  test("PL 9+, staple overlap > 40%, 2+ combos returns bracket 5", () => {
    // Build a deck where > 40% of non-land cards are cEDH staples
    const stapleNames = [
      "Ad Nauseam",
      "Demonic Tutor",
      "Vampiric Tutor",
      "Chrome Mox",
      "Mox Diamond",
      "Thassa's Oracle",
      "Demonic Consultation",
      "Dramatic Reversal",
      "Isochron Scepter",
      "Force of Will",
    ];
    const fillerNames = Array.from({ length: 5 }, (_, i) => `Filler ${i}`);
    const allNames = [...stapleNames, ...fillerNames];

    const cardMap = makeCardMap(
      allNames.map((name) => ({ name }))
    );
    const deck = makeDeck(allNames.map((name) => ({ name })));
    const pl = makePowerLevel(9);
    const cedhStaples = new Set(stapleNames);

    const result = computeBracketEstimate(deck, cardMap, pl, cedhStaples, null);
    expect(result.bracket).toBe(5);
    expect(result.bracketName).toBe("cEDH");
    expect(result.cedhStapleOverlap).toBeGreaterThan(40);
  });

  test("PL 9+ but low staple overlap returns bracket 4", () => {
    const cardMap = makeCardMap([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
      { name: "Filler A" },
      { name: "Filler B" },
      { name: "Filler C" },
    ]);
    const deck = makeDeck([
      { name: "Dramatic Reversal" },
      { name: "Isochron Scepter" },
      { name: "Filler A" },
      { name: "Filler B" },
      { name: "Filler C" },
    ]);
    const pl = makePowerLevel(9);
    // Only 1 staple out of 5 non-land cards = 20%
    const cedhStaples = new Set(["Dramatic Reversal"]);

    const result = computeBracketEstimate(deck, cardMap, pl, cedhStaples, null);
    expect(result.bracket).toBe(4);
  });

  test("high staple overlap but PL 7 returns bracket 4", () => {
    const stapleNames = [
      "Ad Nauseam",
      "Demonic Tutor",
      "Vampiric Tutor",
      "Chrome Mox",
      "Mox Diamond",
      "Thassa's Oracle",
      "Demonic Consultation",
      "Dramatic Reversal",
      "Isochron Scepter",
      "Force of Will",
    ];
    const cardMap = makeCardMap(
      stapleNames.map((name) => ({ name }))
    );
    const deck = makeDeck(stapleNames.map((name) => ({ name })));
    const pl = makePowerLevel(7); // Not 9+
    const cedhStaples = new Set(stapleNames);

    const result = computeBracketEstimate(deck, cardMap, pl, cedhStaples, null);
    expect(result.bracket).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// computeBracketEstimate — constraint details
// ---------------------------------------------------------------------------

test.describe("computeBracketEstimate — constraint details", () => {
  test("constraint details include all triggering cards", () => {
    const cardMap = makeCardMap([
      {
        name: "Cyclonic Rift",
        overrides: { isGameChanger: true },
      },
      {
        name: "Rhystic Study",
        overrides: { isGameChanger: true },
      },
    ]);
    const deck = makeDeck([
      { name: "Cyclonic Rift" },
      { name: "Rhystic Study" },
    ]);
    const pl = makePowerLevel(6);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);
    const gcConstraint = result.constraints.find(
      (c) => c.type === "game-changer"
    );
    expect(gcConstraint).toBeDefined();
    expect(gcConstraint!.cards).toContain("Cyclonic Rift");
    expect(gcConstraint!.cards).toContain("Rhystic Study");
  });

  test("each constraint has correct minBracket value", () => {
    const cardMap = makeCardMap([
      {
        name: "Cyclonic Rift",
        overrides: { isGameChanger: true },
      },
      {
        name: "Armageddon",
        overrides: { oracleText: "Destroy all lands." },
      },
      {
        name: "Time Warp",
        overrides: {
          oracleText: "Target player takes an extra turn after this one.",
        },
      },
    ]);
    const deck = makeDeck([
      { name: "Cyclonic Rift" },
      { name: "Armageddon" },
      { name: "Time Warp" },
    ]);
    const pl = makePowerLevel(7);
    const result = computeBracketEstimate(deck, cardMap, pl, EMPTY_STAPLES, null);

    const gcConstraint = result.constraints.find(
      (c) => c.type === "game-changer"
    );
    expect(gcConstraint!.minBracket).toBe(3);

    const mldConstraint = result.constraints.find(
      (c) => c.type === "mass-land-denial"
    );
    expect(mldConstraint!.minBracket).toBe(4);

    const etConstraint = result.constraints.find(
      (c) => c.type === "extra-turn"
    );
    expect(etConstraint!.minBracket).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeDowngradeRecommendations
// ---------------------------------------------------------------------------

test.describe("computeDowngradeRecommendations", () => {
  test("returns empty for bracket 1", () => {
    const result = computeDowngradeRecommendations(1, [], 2);
    expect(result).toEqual([]);
  });

  test("B4→B3 recommends removing combo cards and MLD cards", () => {
    const constraints: BracketConstraint[] = [
      {
        type: "two-card-combo",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
        minBracket: 4,
        explanation: "2-card wincon combo",
      },
      {
        type: "mass-land-denial",
        cards: ["Armageddon"],
        minBracket: 4,
        explanation: "Mass land destruction",
      },
      {
        type: "game-changer",
        cards: ["Cyclonic Rift"],
        minBracket: 3,
        explanation: "Game Changer card",
      },
    ];
    const recs = computeDowngradeRecommendations(4, constraints, 6);
    // Should have a B3 recommendation that removes B4 constraints
    const toB3 = recs.find((r) => r.targetBracket === 3);
    expect(toB3).toBeDefined();
    expect(toB3!.removals.some((r) => r.type === "two-card-combo")).toBe(true);
    expect(toB3!.removals.some((r) => r.type === "mass-land-denial")).toBe(true);
  });

  test("B3→B2 recommends removing Game Changer cards", () => {
    const constraints: BracketConstraint[] = [
      {
        type: "game-changer",
        cards: ["Cyclonic Rift", "Rhystic Study"],
        minBracket: 3,
        explanation: "Game Changer cards",
      },
    ];
    const recs = computeDowngradeRecommendations(3, constraints, 5);
    const toB2 = recs.find((r) => r.targetBracket === 2);
    expect(toB2).toBeDefined();
    expect(toB2!.removals.some((r) => r.type === "game-changer")).toBe(true);
  });

  test("skips unreachable brackets (don't suggest B1 if PL > 3)", () => {
    const constraints: BracketConstraint[] = [
      {
        type: "game-changer",
        cards: ["Cyclonic Rift"],
        minBracket: 3,
        explanation: "Game Changer card",
      },
    ];
    const recs = computeDowngradeRecommendations(3, constraints, 5);
    // PL=5 means B1 is unreachable (PL > 3)
    const toB1 = recs.find((r) => r.targetBracket === 1);
    expect(toB1).toBeUndefined();
  });

  test("includes B1 recommendation when PL <= 3", () => {
    const constraints: BracketConstraint[] = [
      {
        type: "extra-turn",
        cards: ["Time Warp"],
        minBracket: 2,
        explanation: "1 extra turn card",
      },
    ];
    const recs = computeDowngradeRecommendations(2, constraints, 3);
    const toB1 = recs.find((r) => r.targetBracket === 1);
    expect(toB1).toBeDefined();
  });
});
