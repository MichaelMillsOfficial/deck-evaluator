import { test, expect } from "@playwright/test";
import { analyzeDeckSynergy } from "../../src/lib/synergy-engine";
import type { DeckData, EnrichedCard } from "../../src/lib/types";

/** Helper to build a minimal EnrichedCard */
function mockCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Creature",
    supertypes: [],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    ...overrides,
  };
}

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

test.describe("analyzeDeckSynergy", () => {
  test("returns valid structure for empty deck", () => {
    const deck = mockDeck([]);
    const cardMap: Record<string, EnrichedCard> = {};
    const result = analyzeDeckSynergy(deck, cardMap);

    expect(result.cardScores).toBeDefined();
    expect(result.topSynergies).toBeDefined();
    expect(result.antiSynergies).toBeDefined();
    expect(result.knownCombos).toBeDefined();
    expect(result.deckThemes).toBeDefined();
    expect(Array.isArray(result.topSynergies)).toBe(true);
    expect(Array.isArray(result.antiSynergies)).toBe(true);
    expect(Array.isArray(result.knownCombos)).toBe(true);
    expect(Array.isArray(result.deckThemes)).toBe(true);
  });

  test("all per-card scores are within 0-100 range", () => {
    const cards: Record<string, EnrichedCard> = {
      "Hardened Scales": mockCard({
        name: "Hardened Scales",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      }),
      "Walking Ballista": mockCard({
        name: "Walking Ballista",
        oracleText:
          "Walking Ballista enters the battlefield with X +1/+1 counters on it.\nRemove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt",
        typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    for (const [, score] of Object.entries(result.cardScores)) {
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    }
  });

  test("counters-heavy deck gives high scores to counters cards", () => {
    const cards: Record<string, EnrichedCard> = {
      "Doubling Season": mockCard({
        name: "Doubling Season",
        oracleText:
          "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      }),
      "Hardened Scales": mockCard({
        name: "Hardened Scales",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      }),
      "Walking Ballista": mockCard({
        name: "Walking Ballista",
        oracleText:
          "Walking Ballista enters the battlefield with X +1/+1 counters on it.\nRemove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.",
      }),
      "Winding Constrictor": mockCard({
        name: "Winding Constrictor",
        oracleText:
          "If one or more counters would be put on an artifact or creature you control, that many plus one of each of those kinds of counters are put on that permanent instead.",
      }),
      "Rishkar, Peema Renegade": mockCard({
        name: "Rishkar, Peema Renegade",
        oracleText:
          "When Rishkar, Peema Renegade enters the battlefield, put a +1/+1 counter on each of up to two target creatures.\nEach creature you control with a counter on it has \"{T}: Add {G}.\"",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt",
        typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    // Counters cards should score higher than Lightning Bolt
    const doublingScore = result.cardScores["Doubling Season"]?.score ?? 0;
    const boltScore = result.cardScores["Lightning Bolt"]?.score ?? 0;
    expect(doublingScore).toBeGreaterThan(boltScore);
  });

  test("Rest in Peace gets anti-synergy penalty in reanimator deck", () => {
    const cards: Record<string, EnrichedCard> = {
      Reanimate: mockCard({
        name: "Reanimate",
        oracleText:
          "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.",
      }),
      Exhume: mockCard({
        name: "Exhume",
        oracleText:
          "Each player puts a creature card from their graveyard onto the battlefield.",
      }),
      Entomb: mockCard({
        name: "Entomb",
        oracleText:
          "Search your library for a card, put that card into your graveyard, then shuffle.",
      }),
      "Buried Alive": mockCard({
        name: "Buried Alive",
        oracleText:
          "Search your library for up to three creature cards, put them into your graveyard, then shuffle.",
      }),
      "Rest in Peace": mockCard({
        name: "Rest in Peace",
        typeLine: "Enchantment",
        oracleText:
          "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    // Rest in Peace should have anti-synergy pairs
    const ripScore = result.cardScores["Rest in Peace"];
    expect(ripScore).toBeDefined();
    expect(ripScore.score).toBeLessThan(50); // Below neutral baseline

    // Should generate anti-synergy pairs
    expect(result.antiSynergies.length).toBeGreaterThan(0);
    const ripAntiSynergy = result.antiSynergies.find((p) =>
      p.cards.includes("Rest in Peace")
    );
    expect(ripAntiSynergy).toBeDefined();
  });

  test("known combo cards get bonus scores", () => {
    const cards: Record<string, EnrichedCard> = {
      "Thassa's Oracle": mockCard({
        name: "Thassa's Oracle",
        oracleText:
          "When Thassa's Oracle enters the battlefield, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of your library in a random order. If X is greater than or equal to the number of cards in your library, you win the game.",
      }),
      "Demonic Consultation": mockCard({
        name: "Demonic Consultation",
        typeLine: "Instant",
        oracleText:
          "Name a card. Exile the top six cards of your library, then reveal cards from the top of your library until you reveal the named card. Put that card into your hand and exile all other cards revealed this way.",
      }),
      Island: mockCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        oracleText: "",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    expect(result.knownCombos.length).toBeGreaterThanOrEqual(1);
    const oracleScore = result.cardScores["Thassa's Oracle"]?.score ?? 0;
    const islandScore = result.cardScores["Island"]?.score ?? 50;
    expect(oracleScore).toBeGreaterThan(islandScore);
  });

  test("deckThemes sorted by strength descending", () => {
    const cards: Record<string, EnrichedCard> = {
      "Hardened Scales": mockCard({
        name: "Hardened Scales",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      }),
      "Walking Ballista": mockCard({
        name: "Walking Ballista",
        oracleText:
          "Walking Ballista enters the battlefield with X +1/+1 counters on it.",
      }),
      "Avenger of Zendikar": mockCard({
        name: "Avenger of Zendikar",
        keywords: ["Landfall"],
        oracleText:
          "When Avenger of Zendikar enters the battlefield, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land enters the battlefield under your control, you may put a +1/+1 counter on each Plant creature you control.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    if (result.deckThemes.length >= 2) {
      for (let i = 1; i < result.deckThemes.length; i++) {
        expect(result.deckThemes[i - 1].strength).toBeGreaterThanOrEqual(
          result.deckThemes[i].strength
        );
      }
    }
  });

  test("topSynergies sorted by strength descending", () => {
    const cards: Record<string, EnrichedCard> = {
      "Doubling Season": mockCard({
        name: "Doubling Season",
        oracleText:
          "If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      }),
      "Hardened Scales": mockCard({
        name: "Hardened Scales",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      }),
      "Walking Ballista": mockCard({
        name: "Walking Ballista",
        oracleText:
          "Walking Ballista enters the battlefield with X +1/+1 counters on it.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    if (result.topSynergies.length >= 2) {
      for (let i = 1; i < result.topSynergies.length; i++) {
        expect(result.topSynergies[i - 1].strength).toBeGreaterThanOrEqual(
          result.topSynergies[i].strength
        );
      }
    }
  });

  test("board wipes get anti-synergy in token-heavy deck", () => {
    const cards: Record<string, EnrichedCard> = {
      "Avenger of Zendikar": mockCard({
        name: "Avenger of Zendikar",
        oracleText:
          "When Avenger of Zendikar enters the battlefield, create a 0/1 green Plant creature token for each land you control.",
      }),
      "Bitterblossom": mockCard({
        name: "Bitterblossom",
        oracleText:
          "At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.",
      }),
      "Raise the Alarm": mockCard({
        name: "Raise the Alarm",
        oracleText: "Create two 1/1 white Soldier creature tokens.",
      }),
      "Wrath of God": mockCard({
        name: "Wrath of God",
        typeLine: "Sorcery",
        oracleText: "Destroy all creatures. They can't be regenerated.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    // Wrath of God should have lower score than token generators
    const wrathScore = result.cardScores["Wrath of God"]?.score ?? 50;
    const avengerScore =
      result.cardScores["Avenger of Zendikar"]?.score ?? 50;
    expect(wrathScore).toBeLessThan(avengerScore);
  });

  test("each cardScore has axes and pairs arrays", () => {
    const cards: Record<string, EnrichedCard> = {
      "Hardened Scales": mockCard({
        name: "Hardened Scales",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    const score = result.cardScores["Hardened Scales"];
    expect(score).toBeDefined();
    expect(score.cardName).toBe("Hardened Scales");
    expect(Array.isArray(score.axes)).toBe(true);
    expect(Array.isArray(score.pairs)).toBe(true);
  });
});
