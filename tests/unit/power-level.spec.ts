import { test, expect } from "@playwright/test";
import {
  FAST_MANA_NAMES,
  FACTOR_WEIGHTS,
  countFastMana,
  scoreTutorDensity,
  scoreFastMana,
  scoreAverageCmc,
  scoreInteractionDensity,
  scoreInfiniteCombos,
  rawScoreToPowerLevel,
  computePowerLevel,
} from "../../src/lib/power-level";
import type { DeckData, EnrichedCard } from "../../src/lib/types";
import type { KnownCombo } from "../../src/lib/known-combos";
import { makeCard as mockCard } from "../helpers";

function mockDeck(
  mainboard: string[],
  commanders: string[] = []
): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: mainboard.map((name) => ({ name, quantity: 1 })),
    sideboard: [],
  };
}

// ---------------------------------------------------------------------------
// FAST_MANA_NAMES
// ---------------------------------------------------------------------------

test.describe("FAST_MANA_NAMES", () => {
  test("contains expected fast mana cards", () => {
    expect(FAST_MANA_NAMES.has("Sol Ring")).toBe(true);
    expect(FAST_MANA_NAMES.has("Mana Crypt")).toBe(true);
    expect(FAST_MANA_NAMES.has("Mana Vault")).toBe(true);
    expect(FAST_MANA_NAMES.has("Chrome Mox")).toBe(true);
    expect(FAST_MANA_NAMES.has("Mox Diamond")).toBe(true);
    expect(FAST_MANA_NAMES.has("Jeweled Lotus")).toBe(true);
    expect(FAST_MANA_NAMES.has("Mox Opal")).toBe(true);
    expect(FAST_MANA_NAMES.has("Lotus Petal")).toBe(true);
    expect(FAST_MANA_NAMES.has("Mox Amber")).toBe(true);
    expect(FAST_MANA_NAMES.has("Lion's Eye Diamond")).toBe(true);
    expect(FAST_MANA_NAMES.has("Dark Ritual")).toBe(true);
    expect(FAST_MANA_NAMES.has("Cabal Ritual")).toBe(true);
    expect(FAST_MANA_NAMES.has("Simian Spirit Guide")).toBe(true);
    expect(FAST_MANA_NAMES.has("Elvish Spirit Guide")).toBe(true);
    expect(FAST_MANA_NAMES.has("Rite of Flame")).toBe(true);
    expect(FAST_MANA_NAMES.has("Pyretic Ritual")).toBe(true);
    expect(FAST_MANA_NAMES.has("Desperate Ritual")).toBe(true);
  });

  test("has exactly 17 entries", () => {
    expect(FAST_MANA_NAMES.size).toBe(17);
  });

  test("excludes non-fast-mana cards", () => {
    expect(FAST_MANA_NAMES.has("Forest")).toBe(false);
    expect(FAST_MANA_NAMES.has("Lightning Bolt")).toBe(false);
    expect(FAST_MANA_NAMES.has("Command Tower")).toBe(false);
    expect(FAST_MANA_NAMES.has("Arcane Signet")).toBe(false);
    expect(FAST_MANA_NAMES.has("Birds of Paradise")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FACTOR_WEIGHTS
// ---------------------------------------------------------------------------

test.describe("FACTOR_WEIGHTS", () => {
  test("all weights sum to 1.0", () => {
    const sum = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

// ---------------------------------------------------------------------------
// countFastMana
// ---------------------------------------------------------------------------

test.describe("countFastMana", () => {
  test("returns 0 for deck with no fast mana", () => {
    const deck = mockDeck(["Lightning Bolt", "Forest", "Counterspell"]);
    const cardMap: Record<string, EnrichedCard> = {};
    expect(countFastMana(deck, cardMap)).toBe(0);
  });

  test("returns correct count for Sol Ring + Mana Crypt", () => {
    const deck = mockDeck(["Sol Ring", "Mana Crypt", "Lightning Bolt"]);
    const cardMap: Record<string, EnrichedCard> = {};
    expect(countFastMana(deck, cardMap)).toBe(2);
  });

  test("returns correct count for all 17 fast mana cards", () => {
    const deck = mockDeck([...FAST_MANA_NAMES]);
    const cardMap: Record<string, EnrichedCard> = {};
    expect(countFastMana(deck, cardMap)).toBe(17);
  });

  test("counts fast mana in commanders zone", () => {
    const deck = mockDeck(["Lightning Bolt"], ["Sol Ring"]);
    const cardMap: Record<string, EnrichedCard> = {};
    expect(countFastMana(deck, cardMap)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// scoreTutorDensity
// ---------------------------------------------------------------------------

test.describe("scoreTutorDensity", () => {
  test("returns 0 for zero tutors", () => {
    const { score } = scoreTutorDensity(0);
    expect(score).toBe(0);
  });

  test("returns 30 for 1 tutor", () => {
    const { score } = scoreTutorDensity(1);
    expect(score).toBe(30);
  });

  test("returns 30 for 2 tutors", () => {
    const { score } = scoreTutorDensity(2);
    expect(score).toBe(30);
  });

  test("returns 55 for 3 tutors", () => {
    const { score } = scoreTutorDensity(3);
    expect(score).toBe(55);
  });

  test("returns 55 for 4 tutors", () => {
    const { score } = scoreTutorDensity(4);
    expect(score).toBe(55);
  });

  test("returns 75 for 5 tutors", () => {
    const { score } = scoreTutorDensity(5);
    expect(score).toBe(75);
  });

  test("returns 75 for 6 tutors", () => {
    const { score } = scoreTutorDensity(6);
    expect(score).toBe(75);
  });

  test("returns 100 for 7+ tutors", () => {
    expect(scoreTutorDensity(7).score).toBe(100);
    expect(scoreTutorDensity(10).score).toBe(100);
    expect(scoreTutorDensity(99).score).toBe(100);
  });

  test("returns non-empty explanation", () => {
    const { explanation } = scoreTutorDensity(3);
    expect(explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreFastMana
// ---------------------------------------------------------------------------

test.describe("scoreFastMana", () => {
  test("returns 0 for zero fast mana", () => {
    expect(scoreFastMana(0).score).toBe(0);
  });

  test("returns 25 for 1 fast mana", () => {
    expect(scoreFastMana(1).score).toBe(25);
  });

  test("returns 45 for 2 fast mana", () => {
    expect(scoreFastMana(2).score).toBe(45);
  });

  test("returns 70 for 3 fast mana", () => {
    expect(scoreFastMana(3).score).toBe(70);
  });

  test("returns 70 for 4 fast mana", () => {
    expect(scoreFastMana(4).score).toBe(70);
  });

  test("returns 100 for 5+ fast mana", () => {
    expect(scoreFastMana(5).score).toBe(100);
    expect(scoreFastMana(10).score).toBe(100);
  });

  test("returns non-empty explanation", () => {
    expect(scoreFastMana(2).explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreAverageCmc
// ---------------------------------------------------------------------------

test.describe("scoreAverageCmc", () => {
  test("returns 100 for avg CMC ≤ 1.8", () => {
    expect(scoreAverageCmc(0).score).toBe(100);
    expect(scoreAverageCmc(1.0).score).toBe(100);
    expect(scoreAverageCmc(1.5).score).toBe(100);
    expect(scoreAverageCmc(1.8).score).toBe(100);
  });

  test("returns 0 for avg CMC ≥ 4.0", () => {
    expect(scoreAverageCmc(4.0).score).toBe(0);
    expect(scoreAverageCmc(4.5).score).toBe(0);
    expect(scoreAverageCmc(6.0).score).toBe(0);
  });

  test("returns mid-range score for avg CMC 2.9 (continuous interpolation)", () => {
    // 2.9 is between 1.8 and 4.0 — should be between 0 and 100, roughly middle
    const { score } = scoreAverageCmc(2.9);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
    // Linear: score = 100 * (1 - (2.9 - 1.8) / (4.0 - 1.8)) = 100 * (1 - 1.1/2.2) ≈ 50
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(55);
  });

  test("score is strictly decreasing as CMC increases between bounds", () => {
    const score1 = scoreAverageCmc(2.0).score;
    const score2 = scoreAverageCmc(2.5).score;
    const score3 = scoreAverageCmc(3.0).score;
    const score4 = scoreAverageCmc(3.5).score;
    expect(score1).toBeGreaterThan(score2);
    expect(score2).toBeGreaterThan(score3);
    expect(score3).toBeGreaterThan(score4);
  });

  test("returns non-empty explanation", () => {
    expect(scoreAverageCmc(2.5).explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreInteractionDensity
// ---------------------------------------------------------------------------

test.describe("scoreInteractionDensity", () => {
  test("returns 0 for 0-2 interaction pieces", () => {
    expect(scoreInteractionDensity(0).score).toBe(0);
    expect(scoreInteractionDensity(1).score).toBe(0);
    expect(scoreInteractionDensity(2).score).toBe(0);
  });

  test("returns 25 for 3-5 pieces", () => {
    expect(scoreInteractionDensity(3).score).toBe(25);
    expect(scoreInteractionDensity(5).score).toBe(25);
  });

  test("returns 45 for 6-8 pieces", () => {
    expect(scoreInteractionDensity(6).score).toBe(45);
    expect(scoreInteractionDensity(8).score).toBe(45);
  });

  test("returns 65 for 9-12 pieces", () => {
    expect(scoreInteractionDensity(9).score).toBe(65);
    expect(scoreInteractionDensity(12).score).toBe(65);
  });

  test("returns 80 for 13-16 pieces", () => {
    expect(scoreInteractionDensity(13).score).toBe(80);
    expect(scoreInteractionDensity(16).score).toBe(80);
  });

  test("returns 100 for 17+ pieces", () => {
    expect(scoreInteractionDensity(17).score).toBe(100);
    expect(scoreInteractionDensity(25).score).toBe(100);
  });

  test("returns non-empty explanation", () => {
    expect(scoreInteractionDensity(5).explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// scoreInfiniteCombos
// ---------------------------------------------------------------------------

const mockInfiniteCombo: KnownCombo = {
  cards: ["Card A", "Card B"],
  description: "Infinite mana",
  type: "infinite",
};

const mockWinconCombo: KnownCombo = {
  cards: ["Card C", "Card D"],
  description: "Win with Oracle",
  type: "wincon",
};

const mockValueCombo: KnownCombo = {
  cards: ["Card E", "Card F"],
  description: "Draw engine",
  type: "value",
};

const mockLockCombo: KnownCombo = {
  cards: ["Card G", "Card H"],
  description: "Hard lock",
  type: "lock",
};

test.describe("scoreInfiniteCombos", () => {
  test("returns 0 for no combos", () => {
    expect(scoreInfiniteCombos([]).score).toBe(0);
  });

  test("returns 0 for value-only combos (non-infinite)", () => {
    expect(scoreInfiniteCombos([mockValueCombo]).score).toBe(0);
  });

  test("returns 0 for lock-only combos (non-infinite)", () => {
    expect(scoreInfiniteCombos([mockLockCombo]).score).toBe(0);
  });

  test("returns 50 for 1 infinite combo", () => {
    expect(scoreInfiniteCombos([mockInfiniteCombo]).score).toBe(50);
  });

  test("returns 50 for 1 wincon combo", () => {
    expect(scoreInfiniteCombos([mockWinconCombo]).score).toBe(50);
  });

  test("returns 75 for 2 infinite/wincon combos", () => {
    expect(scoreInfiniteCombos([mockInfiniteCombo, mockWinconCombo]).score).toBe(75);
  });

  test("returns 100 for 3+ infinite/wincon combos", () => {
    const threeCombo: KnownCombo = {
      cards: ["X", "Y"],
      description: "Another",
      type: "infinite",
    };
    expect(
      scoreInfiniteCombos([mockInfiniteCombo, mockWinconCombo, threeCombo]).score
    ).toBe(100);
  });

  test("ignores value-type combos in count", () => {
    // 1 infinite + 1 value = still counted as 1
    expect(scoreInfiniteCombos([mockInfiniteCombo, mockValueCombo]).score).toBe(50);
  });

  test("returns non-empty explanation", () => {
    expect(scoreInfiniteCombos([mockInfiniteCombo]).explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// rawScoreToPowerLevel
// ---------------------------------------------------------------------------

test.describe("rawScoreToPowerLevel", () => {
  test("maps 0-9 → power level 1", () => {
    expect(rawScoreToPowerLevel(0).powerLevel).toBe(1);
    expect(rawScoreToPowerLevel(5).powerLevel).toBe(1);
    expect(rawScoreToPowerLevel(9).powerLevel).toBe(1);
  });

  test("maps 10-19 → power level 2", () => {
    expect(rawScoreToPowerLevel(10).powerLevel).toBe(2);
    expect(rawScoreToPowerLevel(15).powerLevel).toBe(2);
    expect(rawScoreToPowerLevel(19).powerLevel).toBe(2);
  });

  test("maps 50-59 → power level 6", () => {
    expect(rawScoreToPowerLevel(50).powerLevel).toBe(6);
    expect(rawScoreToPowerLevel(55).powerLevel).toBe(6);
    expect(rawScoreToPowerLevel(59).powerLevel).toBe(6);
  });

  test("maps 90-100 → power level 10", () => {
    expect(rawScoreToPowerLevel(90).powerLevel).toBe(10);
    expect(rawScoreToPowerLevel(95).powerLevel).toBe(10);
    expect(rawScoreToPowerLevel(100).powerLevel).toBe(10);
  });

  test("clamps negative values to power level 1", () => {
    expect(rawScoreToPowerLevel(-5).powerLevel).toBe(1);
    expect(rawScoreToPowerLevel(-100).powerLevel).toBe(1);
  });

  test("clamps values above 100 to power level 10", () => {
    expect(rawScoreToPowerLevel(150).powerLevel).toBe(10);
    expect(rawScoreToPowerLevel(200).powerLevel).toBe(10);
  });

  test("returns correct band labels", () => {
    expect(rawScoreToPowerLevel(5).bandLabel).toBe("Casual");
    expect(rawScoreToPowerLevel(15).bandLabel).toBe("Casual");
    expect(rawScoreToPowerLevel(25).bandLabel).toBe("Casual");
    expect(rawScoreToPowerLevel(35).bandLabel).toBe("Focused");
    expect(rawScoreToPowerLevel(45).bandLabel).toBe("Focused");
    expect(rawScoreToPowerLevel(55).bandLabel).toBe("Optimized");
    expect(rawScoreToPowerLevel(65).bandLabel).toBe("Optimized");
    expect(rawScoreToPowerLevel(75).bandLabel).toBe("High Power");
    expect(rawScoreToPowerLevel(85).bandLabel).toBe("High Power");
    expect(rawScoreToPowerLevel(95).bandLabel).toBe("cEDH");
  });

  test("returns non-empty band description", () => {
    expect(rawScoreToPowerLevel(50).bandDescription.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computePowerLevel
// ---------------------------------------------------------------------------

test.describe("computePowerLevel", () => {
  test("returns valid structure for empty deck", () => {
    const deck = mockDeck([]);
    const cardMap: Record<string, EnrichedCard> = {};
    const result = computePowerLevel(deck, cardMap);

    expect(result.powerLevel).toBeGreaterThanOrEqual(1);
    expect(result.powerLevel).toBeLessThanOrEqual(10);
    expect(result.rawScore).toBeGreaterThanOrEqual(0);
    expect(result.rawScore).toBeLessThanOrEqual(100);
    expect(result.bandLabel).toBeTruthy();
    expect(result.bandDescription).toBeTruthy();
    expect(Array.isArray(result.factors)).toBe(true);
    expect(result.factors.length).toBe(8);
  });

  test("empty deck returns power level 2 (avg CMC=0 gives CMC score=100, weighted = 12)", () => {
    // Empty deck: all factors 0 except avgCmc (0 → score 100).
    // rawScore = 0.12 * 100 = 12 → power level 2
    const deck = mockDeck([]);
    const cardMap: Record<string, EnrichedCard> = {};
    const result = computePowerLevel(deck, cardMap);
    expect(result.powerLevel).toBe(2);
  });

  test("all factors have scores in 0-100 range", () => {
    const deck = mockDeck(["Sol Ring", "Counterspell", "Lightning Bolt"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": mockCard({
        name: "Sol Ring",
        cmc: 1,
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
        producedMana: ["C"],
      }),
      "Counterspell": mockCard({
        name: "Counterspell",
        cmc: 2,
        typeLine: "Instant",
        oracleText: "Counter target spell.",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt",
        cmc: 1,
        typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
    };
    const result = computePowerLevel(deck, cardMap);

    for (const factor of result.factors) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
    }
  });

  test("all factors have non-empty explanation strings", () => {
    const deck = mockDeck(["Sol Ring"]);
    const cardMap: Record<string, EnrichedCard> = {};
    const result = computePowerLevel(deck, cardMap);

    for (const factor of result.factors) {
      expect(factor.explanation.length).toBeGreaterThan(0);
    }
  });

  test("returns low power (1-3) for precon-style deck", () => {
    // Precon: high CMC, no tutors, no fast mana, minimal interaction
    const deck = mockDeck([
      "Forest",
      "Plains",
      "Island",
      "Swamp",
      "Mountain",
      "Siege Rhino",     // 4 CMC
      "Serra Angel",     // 5 CMC
      "Air Elemental",   // 5 CMC
    ]);
    const cardMap: Record<string, EnrichedCard> = {
      "Siege Rhino": mockCard({ name: "Siege Rhino", cmc: 4, typeLine: "Creature" }),
      "Serra Angel": mockCard({ name: "Serra Angel", cmc: 5, typeLine: "Creature" }),
      "Air Elemental": mockCard({ name: "Air Elemental", cmc: 5, typeLine: "Creature" }),
      "Forest": mockCard({ name: "Forest", cmc: 0, typeLine: "Basic Land — Forest", producedMana: ["G"] }),
      "Plains": mockCard({ name: "Plains", cmc: 0, typeLine: "Basic Land — Plains", producedMana: ["W"] }),
      "Island": mockCard({ name: "Island", cmc: 0, typeLine: "Basic Land — Island", producedMana: ["U"] }),
      "Swamp": mockCard({ name: "Swamp", cmc: 0, typeLine: "Basic Land — Swamp", producedMana: ["B"] }),
      "Mountain": mockCard({ name: "Mountain", cmc: 0, typeLine: "Basic Land — Mountain", producedMana: ["R"] }),
    };
    const result = computePowerLevel(deck, cardMap);
    expect(result.powerLevel).toBeGreaterThanOrEqual(1);
    expect(result.powerLevel).toBeLessThanOrEqual(4);
    expect(result.bandLabel).toBe("Casual");
  });

  test("returns higher power for optimized deck with fast mana and tutors", () => {
    // Optimized: low CMC, fast mana, tutors, interaction
    const deckNames = [
      "Sol Ring",
      "Mana Crypt",
      "Demonic Tutor",
      "Vampiric Tutor",
      "Counterspell",
      "Force of Will",
      "Lightning Bolt",
      "Path to Exile",
      "Thassa's Oracle",
      "Demonic Consultation",
    ];
    const deck = mockDeck(deckNames);
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": mockCard({
        name: "Sol Ring", cmc: 1, typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
      }),
      "Mana Crypt": mockCard({
        name: "Mana Crypt", cmc: 0, typeLine: "Artifact",
        oracleText: "At the beginning of your upkeep, flip a coin. If you lose the flip, Mana Crypt deals 3 damage to you. {T}: Add {C}{C}.",
      }),
      "Demonic Tutor": mockCard({
        name: "Demonic Tutor", cmc: 2, typeLine: "Sorcery",
        oracleText: "Search your library for a card, put that card into your hand, then shuffle.",
      }),
      "Vampiric Tutor": mockCard({
        name: "Vampiric Tutor", cmc: 1, typeLine: "Instant",
        oracleText: "Search your library for a card, then shuffle and put that card on top. You lose 2 life.",
      }),
      "Counterspell": mockCard({
        name: "Counterspell", cmc: 2, typeLine: "Instant",
        oracleText: "Counter target spell.",
      }),
      "Force of Will": mockCard({
        name: "Force of Will", cmc: 5, typeLine: "Instant",
        oracleText: "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt", cmc: 1, typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
      "Path to Exile": mockCard({
        name: "Path to Exile", cmc: 1, typeLine: "Instant",
        oracleText: "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      }),
      "Thassa's Oracle": mockCard({
        name: "Thassa's Oracle", cmc: 2, typeLine: "Creature",
        oracleText: "When Thassa's Oracle enters the battlefield, look at the top X cards of your library, where X is your devotion to blue. If X is greater than or equal to the number of cards in your library, you win the game.",
      }),
      "Demonic Consultation": mockCard({
        name: "Demonic Consultation", cmc: 1, typeLine: "Instant",
        oracleText: "Name a card. Exile the top six cards of your library, then reveal cards from the top of your library until you reveal the named card. Put that card into your hand and exile all other cards revealed this way.",
      }),
    };
    const result = computePowerLevel(deck, cardMap);
    // Optimized deck should score higher than a precon
    expect(result.powerLevel).toBeGreaterThan(4);
  });

  test("deck with Thassa's Oracle + Demonic Consultation combo gets higher combo score", () => {
    const deck = mockDeck(["Thassa's Oracle", "Demonic Consultation"]);
    const cardMap: Record<string, EnrichedCard> = {
      "Thassa's Oracle": mockCard({ name: "Thassa's Oracle", cmc: 2, typeLine: "Creature" }),
      "Demonic Consultation": mockCard({ name: "Demonic Consultation", cmc: 1, typeLine: "Instant" }),
    };
    const result = computePowerLevel(deck, cardMap);

    const comboFactor = result.factors.find((f) => f.id === "infinite-combos");
    expect(comboFactor).toBeDefined();
    expect(comboFactor!.score).toBe(50); // 1 wincon combo = 50
  });
});
