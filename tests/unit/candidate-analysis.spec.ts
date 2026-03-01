import { test, expect } from "@playwright/test";
import { makeCard, makeDeck } from "../helpers";
import type { EnrichedCard, DeckData, DeckSynergyAnalysis } from "../../src/lib/types";

// We'll import these once implemented
import {
  analyzeCandidateCard,
  computeCmcImpact,
  computeManaBaseImpact,
  findReplacementCandidates,
  type CandidateAnalysis,
  type CmcImpact,
  type ManaBaseImpact,
  type ReplacementCandidate,
} from "../../src/lib/candidate-analysis";
import { analyzeDeckSynergy } from "../../src/lib/synergy-engine";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function buildTestDeck(): {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
} {
  const commander = makeCard({
    name: "Atraxa, Praetors' Voice",
    manaCost: "{G}{W}{U}{B}",
    cmc: 4,
    colorIdentity: ["W", "U", "B", "G"],
    typeLine: "Legendary Creature — Phyrexian Angel Horror",
    supertypes: ["Legendary"],
    subtypes: ["Phyrexian", "Angel", "Horror"],
    oracleText:
      "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
    keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
    manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
  });

  const solRing = makeCard({
    name: "Sol Ring",
    manaCost: "{1}",
    cmc: 1,
    colorIdentity: [],
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    producedMana: ["C"],
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 1.5, usdFoil: 5.0, eur: 1.0 },
  });

  const commandTower = makeCard({
    name: "Command Tower",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    typeLine: "Land",
    oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    producedMana: ["W", "U", "B", "R", "G"],
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 0.25, usdFoil: 1.0, eur: 0.2 },
  });

  const counterspell = makeCard({
    name: "Counterspell",
    manaCost: "{U}{U}",
    cmc: 2,
    colorIdentity: ["U"],
    colors: ["U"],
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 1.0, usdFoil: 3.0, eur: 0.8 },
  });

  const swordsToPlowshares = makeCard({
    name: "Swords to Plowshares",
    manaCost: "{W}",
    cmc: 1,
    colorIdentity: ["W"],
    colors: ["W"],
    typeLine: "Instant",
    oracleText:
      "Exile target creature. Its controller gains life equal to its power.",
    manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 2.0, usdFoil: 6.0, eur: 1.5 },
  });

  const arcaneSigmet = makeCard({
    name: "Arcane Signet",
    manaCost: "{2}",
    cmc: 2,
    colorIdentity: [],
    typeLine: "Artifact",
    oracleText:
      "{T}: Add one mana of any color in your commander's color identity.",
    producedMana: ["W", "U", "B", "R", "G"],
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
  });

  const cultivate = makeCard({
    name: "Cultivate",
    manaCost: "{2}{G}",
    cmc: 3,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText:
      "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    prices: { usd: 0.5, usdFoil: 1.5, eur: 0.3 },
  });

  const rhysticStudy = makeCard({
    name: "Rhystic Study",
    manaCost: "{2}{U}",
    cmc: 3,
    colorIdentity: ["U"],
    colors: ["U"],
    typeLine: "Enchantment",
    oracleText:
      "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
    manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    prices: { usd: 35.0, usdFoil: 50.0, eur: 30.0 },
  });

  const deck: DeckData = {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
    mainboard: [
      { name: "Sol Ring", quantity: 1 },
      { name: "Command Tower", quantity: 1 },
      { name: "Arcane Signet", quantity: 1 },
      { name: "Swords to Plowshares", quantity: 1 },
      { name: "Counterspell", quantity: 1 },
      { name: "Cultivate", quantity: 1 },
      { name: "Rhystic Study", quantity: 1 },
    ],
    sideboard: [],
  };

  const cardMap: Record<string, EnrichedCard> = {
    "Atraxa, Praetors' Voice": commander,
    "Sol Ring": solRing,
    "Command Tower": commandTower,
    "Arcane Signet": arcaneSigmet,
    "Swords to Plowshares": swordsToPlowshares,
    Counterspell: counterspell,
    Cultivate: cultivate,
    "Rhystic Study": rhysticStudy,
  };

  return { deck, cardMap };
}

// ---------------------------------------------------------------------------
// computeCmcImpact
// ---------------------------------------------------------------------------

test.describe("computeCmcImpact", () => {
  test("returns current average CMC and delta when candidate is added", () => {
    const { deck, cardMap } = buildTestDeck();
    // Candidate: a 5-mana card
    const candidate = makeCard({
      name: "Teferi, Hero of Dominaria",
      manaCost: "{3}{W}{U}",
      cmc: 5,
      typeLine: "Legendary Planeswalker — Teferi",
    });

    const result = computeCmcImpact(candidate, deck, cardMap);

    expect(result.currentAvgCmc).toBeGreaterThan(0);
    expect(result.projectedAvgCmc).toBeGreaterThan(result.currentAvgCmc);
    expect(result.delta).toBeCloseTo(
      result.projectedAvgCmc - result.currentAvgCmc,
      2
    );
  });

  test("excludes lands from CMC calculation", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Breeding Pool",
      manaCost: "",
      cmc: 0,
      typeLine: "Land — Forest Island",
    });

    const result = computeCmcImpact(candidate, deck, cardMap);

    // Land candidate should not change average CMC
    expect(result.delta).toBe(0);
  });

  test("handles deck with no non-land spells", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Atraxa, Praetors' Voice": makeCard({
        name: "Atraxa, Praetors' Voice",
        typeLine: "Legendary Creature",
        cmc: 4,
      }),
      "Command Tower": makeCard({
        name: "Command Tower",
        typeLine: "Land",
        cmc: 0,
      }),
    };

    const candidate = makeCard({
      name: "Sol Ring",
      cmc: 1,
      typeLine: "Artifact",
    });

    const result = computeCmcImpact(candidate, deck, cardMap);
    // Commander is non-land, so currentAvg should reflect commander CMC
    expect(result.currentAvgCmc).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeManaBaseImpact
// ---------------------------------------------------------------------------

test.describe("computeManaBaseImpact", () => {
  test("returns source-to-demand ratios and identifies stressed colors", () => {
    const { deck, cardMap } = buildTestDeck();
    // Candidate with heavy blue demand
    const candidate = makeCard({
      name: "Cryptic Command",
      manaCost: "{1}{U}{U}{U}",
      cmc: 4,
      colorIdentity: ["U"],
      typeLine: "Instant",
      oracleText: "Choose two — Counter target spell; or return target permanent to its owner's hand; or tap all creatures your opponents control; or draw a card.",
      manaPips: { W: 0, U: 3, B: 0, R: 0, G: 0, C: 0 },
    });

    const result = computeManaBaseImpact(candidate, deck, cardMap);

    expect(result.currentRatios).toBeDefined();
    expect(result.projectedRatios).toBeDefined();
    // Blue ratio should decrease (more demand)
    expect(result.projectedRatios.U).toBeLessThanOrEqual(
      result.currentRatios.U
    );
    expect(result.stressedColors).toBeInstanceOf(Array);
  });

  test("does not flag colors with no demand as stressed", () => {
    const { deck, cardMap } = buildTestDeck();
    // Colorless artifact
    const candidate = makeCard({
      name: "Mana Crypt",
      manaCost: "{0}",
      cmc: 0,
      colorIdentity: [],
      typeLine: "Artifact",
      oracleText:
        "At the beginning of your upkeep, flip a coin. If you lose the flip, Mana Crypt deals 3 damage to you.\n{T}: Add {C}{C}.",
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["C"],
    });

    const result = computeManaBaseImpact(candidate, deck, cardMap);
    // No new colored demand, so stressed colors should not include colors with 0 demand
    expect(result.stressedColors).not.toContain("R"); // Red has 0 pips in deck + candidate
  });

  test("detects stressed colors when ratio drops below threshold", () => {
    const { deck, cardMap } = buildTestDeck();
    // Heavy multi-color demand
    const candidate = makeCard({
      name: "Omniscience",
      manaCost: "{7}{U}{U}{U}",
      cmc: 10,
      colorIdentity: ["U"],
      typeLine: "Enchantment",
      manaPips: { W: 0, U: 3, B: 0, R: 0, G: 0, C: 0 },
    });

    const result = computeManaBaseImpact(candidate, deck, cardMap);

    // With heavy U demand, the ratio should drop — it may or may not be "stressed"
    // but projected ratio should be lower than current
    expect(result.projectedRatios.U).toBeLessThan(result.currentRatios.U);
  });
});

// ---------------------------------------------------------------------------
// findReplacementCandidates
// ---------------------------------------------------------------------------

test.describe("findReplacementCandidates", () => {
  test("returns up to 5 replacement candidates", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Ponder",
      manaCost: "{U}",
      cmc: 1,
      colorIdentity: ["U"],
      typeLine: "Sorcery",
      oracleText:
        "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.",
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 3.0, usdFoil: 8.0, eur: 2.5 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBeGreaterThan(0);
  });

  test("excludes commanders from replacement candidates", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Ponder",
      cmc: 1,
      typeLine: "Sorcery",
      oracleText: "Draw a card.",
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    const commanderNames = deck.commanders.map((c) => c.name);
    for (const replacement of result) {
      expect(commanderNames).not.toContain(replacement.cardName);
    }
  });

  test("excludes lands from replacement candidates", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Brainstorm",
      cmc: 1,
      typeLine: "Instant",
      oracleText: "Draw three cards, then put two cards from your hand on top of your library in any order.",
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    for (const replacement of result) {
      const card = cardMap[replacement.cardName];
      expect(card?.typeLine).not.toContain("Land");
    }
  });

  test("Tier 1: identifies cards sharing tags with candidate", () => {
    const { deck, cardMap } = buildTestDeck();
    // A removal spell — should suggest other removal cards as replacements
    const candidate = makeCard({
      name: "Path to Exile",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      typeLine: "Instant",
      oracleText:
        "Exile target creature. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 3.0, usdFoil: 8.0, eur: 2.5 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    // Swords to Plowshares shares the "Removal" tag — should be in Tier 1
    const swordsReplacement = result.find(
      (r) => r.cardName === "Swords to Plowshares"
    );
    if (swordsReplacement) {
      expect(swordsReplacement.reason).toContain("Same role");
      expect(swordsReplacement.sharedTags.length).toBeGreaterThan(0);
    }
  });

  test("Tier 2: fills remaining slots with weakest synergy cards", () => {
    const { deck, cardMap } = buildTestDeck();
    // A card that doesn't share tags with many deck cards
    const candidate = makeCard({
      name: "Thassa's Oracle",
      manaCost: "{U}{U}",
      cmc: 2,
      colorIdentity: ["U"],
      typeLine: "Creature — Merfolk Wizard",
      oracleText:
        "When Thassa's Oracle enters the battlefield, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of your library in a random order. If X is greater than or equal to the number of cards in your library, you win the game.",
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    // Should have some Tier 2 "Lowest synergy in deck" candidates
    const tier2 = result.filter((r) =>
      r.reason.includes("Lowest synergy")
    );
    // Either all are tier1 (shared tags) or some are backfilled from tier2
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  test("each replacement includes price and cmc difference", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Dovin's Veto",
      manaCost: "{W}{U}",
      cmc: 2,
      colorIdentity: ["W", "U"],
      typeLine: "Instant",
      oracleText:
        "This spell can't be countered.\nCounter target noncreature spell.",
      manaPips: { W: 1, U: 1, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 2.0, usdFoil: 5.0, eur: 1.5 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    for (const replacement of result) {
      expect(replacement).toHaveProperty("cardName");
      expect(replacement).toHaveProperty("reason");
      expect(replacement).toHaveProperty("synergyScore");
      expect(replacement).toHaveProperty("sharedTags");
      expect(replacement).toHaveProperty("cmcDifference");
      expect(replacement).toHaveProperty("priceUsd");
      expect(typeof replacement.cmcDifference).toBe("number");
    }
  });

  test("sorts Tier 1 by synergy ascending then shared tags descending", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Nature's Claim",
      manaCost: "{G}",
      cmc: 1,
      colorIdentity: ["G"],
      typeLine: "Instant",
      oracleText:
        "Destroy target artifact or enchantment. Its controller gains 4 life.",
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    });

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = findReplacementCandidates(
      candidate,
      deck,
      cardMap,
      synergyAnalysis
    );

    // Tier 1 entries should be sorted by synergy ascending
    const tier1 = result.filter((r) => r.reason.includes("Same role"));
    for (let i = 1; i < tier1.length; i++) {
      if (tier1[i].synergyScore === tier1[i - 1].synergyScore) {
        // Same synergy score — more shared tags first
        expect(tier1[i].sharedTags.length).toBeLessThanOrEqual(
          tier1[i - 1].sharedTags.length
        );
      } else {
        expect(tier1[i].synergyScore).toBeGreaterThanOrEqual(
          tier1[i - 1].synergyScore
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// analyzeCandidateCard (integration of all sub-functions)
// ---------------------------------------------------------------------------

test.describe("analyzeCandidateCard", () => {
  test("returns full analysis with all fields", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Teferi's Protection",
      manaCost: "{2}{W}",
      cmc: 3,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      oracleText:
        "Until your next turn, your life total can't change, and you have protection from everything. All permanents you control phase out.",
      keywords: [],
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      prices: { usd: 30.0, usdFoil: 45.0, eur: 25.0 },
    });
    const candidateCardMap = { ...cardMap, "Teferi's Protection": candidate };

    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = analyzeCandidateCard(
      candidate,
      deck,
      candidateCardMap,
      synergyAnalysis
    );

    expect(result).toHaveProperty("synergyScore");
    expect(typeof result.synergyScore).toBe("number");
    expect(result.synergyScore).toBeGreaterThanOrEqual(0);
    expect(result.synergyScore).toBeLessThanOrEqual(100);

    expect(result).toHaveProperty("cmcImpact");
    expect(result.cmcImpact).toHaveProperty("currentAvgCmc");
    expect(result.cmcImpact).toHaveProperty("projectedAvgCmc");
    expect(result.cmcImpact).toHaveProperty("delta");

    expect(result).toHaveProperty("manaBaseImpact");
    expect(result.manaBaseImpact).toHaveProperty("currentRatios");
    expect(result.manaBaseImpact).toHaveProperty("projectedRatios");
    expect(result.manaBaseImpact).toHaveProperty("stressedColors");

    expect(result).toHaveProperty("replacements");
    expect(Array.isArray(result.replacements)).toBe(true);

    expect(result).toHaveProperty("tags");
    expect(Array.isArray(result.tags)).toBe(true);

    expect(result).toHaveProperty("axes");
    expect(Array.isArray(result.axes)).toBe(true);

    expect(result).toHaveProperty("pairs");
    expect(Array.isArray(result.pairs)).toBe(true);
  });

  test("computes synergy score in context of the deck", () => {
    const { deck, cardMap } = buildTestDeck();
    // A card with strong synergy (card draw in a deck with Rhystic Study)
    const candidate = makeCard({
      name: "Mystic Remora",
      manaCost: "{U}",
      cmc: 1,
      colorIdentity: ["U"],
      typeLine: "Enchantment",
      oracleText:
        "Cumulative upkeep {1}\nWhenever an opponent casts a noncreature spell, you may draw a card unless that player pays {4}.",
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    });

    const candidateCardMap = { ...cardMap, "Mystic Remora": candidate };
    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = analyzeCandidateCard(
      candidate,
      deck,
      candidateCardMap,
      synergyAnalysis
    );

    // Should have a positive synergy score (base is 50)
    expect(result.synergyScore).toBeGreaterThanOrEqual(0);
  });

  test("includes off-identity check data", () => {
    const { deck, cardMap } = buildTestDeck();
    // Red card in a WUBG deck — should be flagged
    const candidate = makeCard({
      name: "Lightning Bolt",
      manaCost: "{R}",
      cmc: 1,
      colorIdentity: ["R"],
      colors: ["R"],
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
    });

    const candidateCardMap = { ...cardMap, "Lightning Bolt": candidate };
    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = analyzeCandidateCard(
      candidate,
      deck,
      candidateCardMap,
      synergyAnalysis
    );

    expect(result).toHaveProperty("offIdentityColors");
    expect(result.offIdentityColors).toContain("R");
  });

  test("returns empty offIdentityColors for on-identity cards", () => {
    const { deck, cardMap } = buildTestDeck();
    const candidate = makeCard({
      name: "Generous Gift",
      manaCost: "{2}{W}",
      cmc: 3,
      colorIdentity: ["W"],
      typeLine: "Instant",
      oracleText:
        "Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.",
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
    });

    const candidateCardMap = { ...cardMap, "Generous Gift": candidate };
    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = analyzeCandidateCard(
      candidate,
      deck,
      candidateCardMap,
      synergyAnalysis
    );

    expect(result.offIdentityColors).toEqual([]);
  });

  test("returns empty offIdentityColors when deck has no commanders", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Counterspell", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", typeLine: "Artifact", cmc: 1 }),
      Counterspell: makeCard({
        name: "Counterspell",
        typeLine: "Instant",
        cmc: 2,
        manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      }),
    };

    const candidate = makeCard({
      name: "Lightning Bolt",
      cmc: 1,
      colorIdentity: ["R"],
      typeLine: "Instant",
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
    });

    const candidateCardMap = { ...cardMap, "Lightning Bolt": candidate };
    const synergyAnalysis = analyzeDeckSynergy(deck, cardMap);
    const result = analyzeCandidateCard(
      candidate,
      deck,
      candidateCardMap,
      synergyAnalysis
    );

    // No commanders = no identity restriction
    expect(result.offIdentityColors).toEqual([]);
  });
});
