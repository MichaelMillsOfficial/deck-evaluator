import { test, expect } from "@playwright/test";
import { analyzeDeckSynergy } from "../../src/lib/synergy-engine";
import type { DeckData, EnrichedCard } from "../../src/lib/types";
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

  test("tribal-heavy deck: Elf lord and Elves score above baseline", () => {
    const cards: Record<string, EnrichedCard> = {
      "Elvish Archdruid": mockCard({
        name: "Elvish Archdruid",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.",
      }),
      "Llanowar Elves": mockCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G}.",
      }),
      "Elvish Mystic": mockCard({
        name: "Elvish Mystic",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G}.",
      }),
      "Fyndhorn Elves": mockCard({
        name: "Fyndhorn Elves",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G}.",
      }),
      "Priest of Titania": mockCard({
        name: "Priest of Titania",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G} for each Elf on the battlefield.",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt",
        typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
    };
    const deck = mockDeck(
      ["Llanowar Elves", "Elvish Mystic", "Fyndhorn Elves", "Priest of Titania", "Lightning Bolt"],
      ["Elvish Archdruid"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Elf lord should score above baseline (50)
    const archdruidScore = result.cardScores["Elvish Archdruid"]?.score ?? 0;
    expect(archdruidScore).toBeGreaterThan(50);

    // Plain Elves should also get a tribal boost above baseline
    const llanowarScore = result.cardScores["Llanowar Elves"]?.score ?? 0;
    expect(llanowarScore).toBeGreaterThan(50);

    // Non-tribal card should stay at baseline
    const boltScore = result.cardScores["Lightning Bolt"]?.score ?? 50;
    expect(archdruidScore).toBeGreaterThan(boltScore);
  });

  test("Changeling synergizes with tribal payoffs", () => {
    const cards: Record<string, EnrichedCard> = {
      "Mirror Entity": mockCard({
        name: "Mirror Entity",
        typeLine: "Creature — Shapeshifter",
        subtypes: ["Shapeshifter"],
        keywords: ["Changeling"],
        oracleText: "{X}: Until end of turn, creatures you control have base power and toughness X/X and gain all creature types until end of turn.",
      }),
      "Elvish Archdruid": mockCard({
        name: "Elvish Archdruid",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.",
      }),
      "Llanowar Elves": mockCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G}.",
      }),
      "Elvish Mystic": mockCard({
        name: "Elvish Mystic",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        oracleText: "{T}: Add {G}.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    // Mirror Entity should have synergy with the Elf lord
    const mirrorScore = result.cardScores["Mirror Entity"]?.score ?? 0;
    expect(mirrorScore).toBeGreaterThan(50);
  });

  test("warrior commander establishes tribal anchor and detects tribal theme", () => {
    const cards: Record<string, EnrichedCard> = {
      "Najeela, the Blade-Blossom": mockCard({
        name: "Najeela, the Blade-Blossom",
        typeLine: "Legendary Creature — Human Warrior",
        subtypes: ["Human", "Warrior"],
        oracleText: "Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking.",
      }),
      "Warrior A": mockCard({
        name: "Warrior A",
        typeLine: "Creature — Human Warrior",
        subtypes: ["Human", "Warrior"],
        oracleText: "Haste",
      }),
      "Warrior B": mockCard({
        name: "Warrior B",
        typeLine: "Creature — Human Warrior",
        subtypes: ["Human", "Warrior"],
        oracleText: "First strike",
      }),
      "Warrior C": mockCard({
        name: "Warrior C",
        typeLine: "Creature — Elf Warrior",
        subtypes: ["Elf", "Warrior"],
        oracleText: "Trample",
      }),
      "Warrior D": mockCard({
        name: "Warrior D",
        typeLine: "Creature — Warrior",
        subtypes: ["Warrior"],
        oracleText: "",
      }),
    };
    const deck = mockDeck(
      ["Warrior A", "Warrior B", "Warrior C", "Warrior D"],
      ["Najeela, the Blade-Blossom"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Should detect tribal as a deck theme
    const tribalTheme = result.deckThemes.find((t) => t.axisId === "tribal");
    expect(tribalTheme).toBeDefined();
  });

  test("commander subtype gets higher tribal boost than density-only anchor", () => {
    // Elf commander + 10 Elves + 5 Goblins (Goblins reach density threshold)
    const cards: Record<string, EnrichedCard> = {
      "Elf Commander": mockCard({
        name: "Elf Commander",
        typeLine: "Legendary Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        supertypes: ["Legendary"],
        oracleText: "{T}: Add {G}.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `Elf ${i}`,
          mockCard({
            name: `Elf ${i}`,
            typeLine: "Creature — Elf",
            subtypes: ["Elf"],
          }),
        ])
      ),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Goblin ${i}`,
          mockCard({
            name: `Goblin ${i}`,
            typeLine: "Creature — Goblin",
            subtypes: ["Goblin"],
          }),
        ])
      ),
    };
    const elfNames = Array.from({ length: 10 }, (_, i) => `Elf ${i}`);
    const goblinNames = Array.from({ length: 5 }, (_, i) => `Goblin ${i}`);
    const deck = mockDeck([...elfNames, ...goblinNames], ["Elf Commander"]);
    const result = analyzeDeckSynergy(deck, cards);

    // Elf creatures should score higher than Goblin creatures (commander alignment)
    const avgElfScore =
      elfNames.reduce((sum, n) => sum + (result.cardScores[n]?.score ?? 50), 0) / elfNames.length;
    const avgGoblinScore =
      goblinNames.reduce((sum, n) => sum + (result.cardScores[n]?.score ?? 50), 0) /
      goblinNames.length;
    expect(avgElfScore).toBeGreaterThan(avgGoblinScore);
  });

  test("commander oracle-referenced type gets moderate boost above density-only", () => {
    // Najeela references Warriors in oracle text. Warriors and Soldiers both have density.
    const cards: Record<string, EnrichedCard> = {
      "Najeela, the Blade-Blossom": mockCard({
        name: "Najeela, the Blade-Blossom",
        typeLine: "Legendary Creature — Human Warrior",
        subtypes: ["Human", "Warrior"],
        supertypes: ["Legendary"],
        oracleText:
          "Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Warrior ${i}`,
          mockCard({
            name: `Warrior ${i}`,
            typeLine: "Creature — Warrior",
            subtypes: ["Warrior"],
          }),
        ])
      ),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Soldier ${i}`,
          mockCard({
            name: `Soldier ${i}`,
            typeLine: "Creature — Soldier",
            subtypes: ["Soldier"],
          }),
        ])
      ),
    };
    const warriorNames = Array.from({ length: 5 }, (_, i) => `Warrior ${i}`);
    const soldierNames = Array.from({ length: 5 }, (_, i) => `Soldier ${i}`);
    const deck = mockDeck(
      [...warriorNames, ...soldierNames],
      ["Najeela, the Blade-Blossom"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Warriors should score higher than Soldiers (commander subtype + oracle reference)
    const avgWarriorScore =
      warriorNames.reduce((sum, n) => sum + (result.cardScores[n]?.score ?? 50), 0) /
      warriorNames.length;
    const avgSoldierScore =
      soldierNames.reduce((sum, n) => sum + (result.cardScores[n]?.score ?? 50), 0) /
      soldierNames.length;
    expect(avgWarriorScore).toBeGreaterThan(avgSoldierScore);
  });

  test("non-commander anchor cards still receive standard boost (regression)", () => {
    // Same deck as above — Soldiers should still score above baseline (50)
    const cards: Record<string, EnrichedCard> = {
      "Elf Commander": mockCard({
        name: "Elf Commander",
        typeLine: "Legendary Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
        supertypes: ["Legendary"],
        oracleText: "{T}: Add {G}.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [
          `Elf ${i}`,
          mockCard({
            name: `Elf ${i}`,
            typeLine: "Creature — Elf",
            subtypes: ["Elf"],
          }),
        ])
      ),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Goblin ${i}`,
          mockCard({
            name: `Goblin ${i}`,
            typeLine: "Creature — Goblin",
            subtypes: ["Goblin"],
          }),
        ])
      ),
    };
    const goblinNames = Array.from({ length: 5 }, (_, i) => `Goblin ${i}`);
    const elfNames = Array.from({ length: 6 }, (_, i) => `Elf ${i}`);
    const deck = mockDeck([...elfNames, ...goblinNames], ["Elf Commander"]);
    const result = analyzeDeckSynergy(deck, cards);

    // Goblins (density-only anchor) should still get boosted above baseline
    const goblinScore = result.cardScores["Goblin 0"]?.score ?? 50;
    expect(goblinScore).toBeGreaterThan(50);
  });

  test("Jodah deck: legendary creatures get boosted supertypeMatter scores", () => {
    const cards: Record<string, EnrichedCard> = {
      "Jodah, the Unifier": mockCard({
        name: "Jodah, the Unifier",
        typeLine: "Legendary Creature — Human Wizard",
        supertypes: ["Legendary"],
        subtypes: ["Human", "Wizard"],
        oracleText:
          "Whenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken spell that costs less. You may cast that spell without paying its mana cost. Legendary creatures you control get +1/+1.",
      }),
      // 20 legendary creatures to hit density threshold
      ...Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `Legend ${i}`,
          mockCard({
            name: `Legend ${i}`,
            typeLine: "Legendary Creature — Human",
            supertypes: ["Legendary"],
            subtypes: ["Human"],
          }),
        ])
      ),
      "Generic Sorcery": mockCard({
        name: "Generic Sorcery",
        typeLine: "Sorcery",
        supertypes: [],
        oracleText: "Draw a card.",
      }),
    };
    const legendNames = Array.from({ length: 20 }, (_, i) => `Legend ${i}`);
    const deck = mockDeck(
      [...legendNames, "Generic Sorcery"],
      ["Jodah, the Unifier"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Should detect supertypeMatter as a deck theme
    const supertypeTheme = result.deckThemes.find(
      (t) => t.axisId === "supertypeMatter"
    );
    expect(supertypeTheme).toBeDefined();
    expect(supertypeTheme!.detail).toBe("legendary");

    // Legendary creatures should score higher than non-legendary sorcery
    const avgLegendScore =
      legendNames.reduce(
        (sum, n) => sum + (result.cardScores[n]?.score ?? 50),
        0
      ) / legendNames.length;
    const sorceryScore =
      result.cardScores["Generic Sorcery"]?.score ?? 50;
    expect(avgLegendScore).toBeGreaterThan(sorceryScore);
  });

  test("non-legendary sorcery does NOT get supertypeMatter boost in Jodah deck", () => {
    const cards: Record<string, EnrichedCard> = {
      "Jodah, the Unifier": mockCard({
        name: "Jodah, the Unifier",
        typeLine: "Legendary Creature — Human Wizard",
        supertypes: ["Legendary"],
        subtypes: ["Human", "Wizard"],
        oracleText:
          "Whenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken spell that costs less. You may cast that spell without paying its mana cost. Legendary creatures you control get +1/+1.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `Legend ${i}`,
          mockCard({
            name: `Legend ${i}`,
            typeLine: "Legendary Creature — Human",
            supertypes: ["Legendary"],
            subtypes: ["Human"],
          }),
        ])
      ),
      "Shock": mockCard({
        name: "Shock",
        typeLine: "Instant",
        supertypes: [],
        oracleText: "Shock deals 2 damage to any target.",
      }),
    };
    const legendNames = Array.from({ length: 20 }, (_, i) => `Legend ${i}`);
    const deck = mockDeck(
      [...legendNames, "Shock"],
      ["Jodah, the Unifier"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Shock should NOT have a supertypeMatter axis score
    const shockAxes = result.cardScores["Shock"]?.axes ?? [];
    const supertypeAxis = shockAxes.find(
      (a) => a.axisId === "supertypeMatter"
    );
    expect(supertypeAxis).toBeUndefined();
  });

  test("Narfi deck: snow permanents get boosted and snow theme detected", () => {
    const cards: Record<string, EnrichedCard> = {
      "Narfi, Betrayer King": mockCard({
        name: "Narfi, Betrayer King",
        typeLine: "Legendary Snow Creature — Zombie Wizard",
        supertypes: ["Legendary", "Snow"],
        subtypes: ["Zombie", "Wizard"],
        oracleText:
          "Other snow and Zombie creatures you control get +1/+1.\n{S}{S}{S}: Return Narfi, Betrayer King from your graveyard to the battlefield tapped.",
        manaCost: "{3}{U}{B}",
      }),
      ...Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `Snow Creature ${i}`,
          mockCard({
            name: `Snow Creature ${i}`,
            typeLine: "Snow Creature — Zombie",
            supertypes: ["Snow"],
            subtypes: ["Zombie"],
          }),
        ])
      ),
      "Regular Creature": mockCard({
        name: "Regular Creature",
        typeLine: "Creature — Human",
        supertypes: [],
        subtypes: ["Human"],
      }),
    };
    const snowNames = Array.from(
      { length: 8 },
      (_, i) => `Snow Creature ${i}`
    );
    const deck = mockDeck(
      [...snowNames, "Regular Creature"],
      ["Narfi, Betrayer King"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Should detect supertypeMatter theme with snow detail
    const supertypeTheme = result.deckThemes.find(
      (t) => t.axisId === "supertypeMatter"
    );
    expect(supertypeTheme).toBeDefined();
    expect(supertypeTheme!.detail).toBe("snow");

    // Snow creatures should score higher than regular creature
    const avgSnowScore =
      snowNames.reduce(
        (sum, n) => sum + (result.cardScores[n]?.score ?? 50),
        0
      ) / snowNames.length;
    const regularScore =
      result.cardScores["Regular Creature"]?.score ?? 50;
    expect(avgSnowScore).toBeGreaterThan(regularScore);
  });

  test("Jhoira deck: historic cards (legendary + artifact + saga) all get boost", () => {
    const cards: Record<string, EnrichedCard> = {
      "Jhoira, Weatherlight Captain": mockCard({
        name: "Jhoira, Weatherlight Captain",
        typeLine: "Legendary Creature — Human Artificer",
        supertypes: ["Legendary"],
        subtypes: ["Human", "Artificer"],
        oracleText: "Whenever you cast a historic spell, draw a card.",
      }),
      "Mox Amber": mockCard({
        name: "Mox Amber",
        typeLine: "Legendary Artifact",
        supertypes: ["Legendary"],
        subtypes: [],
        oracleText:
          "{T}: Add one mana of any color among legendary creatures and planeswalkers you control.",
      }),
      "Sol Ring": mockCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        supertypes: [],
        subtypes: [],
        oracleText: "{T}: Add {C}{C}.",
      }),
      "The Eldest Reborn": mockCard({
        name: "The Eldest Reborn",
        typeLine: "Enchantment — Saga",
        supertypes: [],
        subtypes: ["Saga"],
        oracleText:
          "I — Each opponent sacrifices a creature or planeswalker.\nII — Each opponent discards a card.\nIII — Put target creature or planeswalker card from a graveyard onto the battlefield under your control.",
      }),
      "Regular Enchantment": mockCard({
        name: "Regular Enchantment",
        typeLine: "Enchantment",
        supertypes: [],
        subtypes: [],
        oracleText: "At the beginning of your upkeep, scry 1.",
      }),
    };
    const deck = mockDeck(
      ["Mox Amber", "Sol Ring", "The Eldest Reborn", "Regular Enchantment"],
      ["Jhoira, Weatherlight Captain"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // All historic cards should score higher than the regular enchantment
    const moxScore = result.cardScores["Mox Amber"]?.score ?? 50;
    const solRingScore = result.cardScores["Sol Ring"]?.score ?? 50;
    const sagaScore = result.cardScores["The Eldest Reborn"]?.score ?? 50;
    const regularScore =
      result.cardScores["Regular Enchantment"]?.score ?? 50;

    expect(moxScore).toBeGreaterThan(regularScore);
    expect(solRingScore).toBeGreaterThan(regularScore);
    expect(sagaScore).toBeGreaterThan(regularScore);
  });

  test("flying-matters commander boosts flying creatures above baseline", () => {
    const cards: Record<string, EnrichedCard> = {
      "Kangee, Aerie Keeper": mockCard({
        name: "Kangee, Aerie Keeper",
        typeLine: "Legendary Creature — Bird Wizard",
        supertypes: ["Legendary"],
        subtypes: ["Bird", "Wizard"],
        keywords: ["Flying"],
        oracleText:
          "Flying\nCreatures with flying get +1/+1 for each feather counter on Kangee, Aerie Keeper.",
      }),
      "Serra Angel": mockCard({
        name: "Serra Angel",
        typeLine: "Creature — Angel",
        subtypes: ["Angel"],
        keywords: ["Flying", "Vigilance"],
        oracleText: "Flying, vigilance",
      }),
      "Air Elemental": mockCard({
        name: "Air Elemental",
        typeLine: "Creature — Elemental",
        subtypes: ["Elemental"],
        keywords: ["Flying"],
        oracleText: "Flying",
      }),
      "Favorable Winds": mockCard({
        name: "Favorable Winds",
        typeLine: "Enchantment",
        oracleText: "Creatures you control with flying get +1/+1.",
      }),
      "Grizzly Bears": mockCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        subtypes: ["Bear"],
        oracleText: "",
      }),
    };
    const deck = mockDeck(
      ["Serra Angel", "Air Elemental", "Favorable Winds", "Grizzly Bears"],
      ["Kangee, Aerie Keeper"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Flying creatures should score above Grizzly Bears
    const angelScore = result.cardScores["Serra Angel"]?.score ?? 50;
    const airScore = result.cardScores["Air Elemental"]?.score ?? 50;
    const bearScore = result.cardScores["Grizzly Bears"]?.score ?? 50;
    expect(angelScore).toBeGreaterThan(bearScore);
    expect(airScore).toBeGreaterThan(bearScore);
  });

  test("haste-matters commander boosts haste creatures", () => {
    const cards: Record<string, EnrichedCard> = {
      "Ognis, the Dragon's Lash": mockCard({
        name: "Ognis, the Dragon's Lash",
        typeLine: "Legendary Creature — Viashino Warrior",
        supertypes: ["Legendary"],
        subtypes: ["Viashino", "Warrior"],
        keywords: ["Haste"],
        oracleText:
          "Haste\nWhenever a creature with haste attacks, create a tapped Treasure token.",
      }),
      "Goblin Guide": mockCard({
        name: "Goblin Guide",
        typeLine: "Creature — Goblin Scout",
        subtypes: ["Goblin", "Scout"],
        keywords: ["Haste"],
        oracleText: "Haste\nWhenever Goblin Guide attacks, defending player reveals the top card of their library.",
      }),
      "Monastery Swiftspear": mockCard({
        name: "Monastery Swiftspear",
        typeLine: "Creature — Human Monk",
        subtypes: ["Human", "Monk"],
        keywords: ["Haste", "Prowess"],
        oracleText: "Haste\nProwess",
      }),
      "Wall of Omens": mockCard({
        name: "Wall of Omens",
        typeLine: "Creature — Wall",
        subtypes: ["Wall"],
        keywords: ["Defender"],
        oracleText: "Defender\nWhen Wall of Omens enters the battlefield, draw a card.",
      }),
    };
    const deck = mockDeck(
      ["Goblin Guide", "Monastery Swiftspear", "Wall of Omens"],
      ["Ognis, the Dragon's Lash"]
    );
    const result = analyzeDeckSynergy(deck, cards);

    // Haste creatures should score higher than Wall of Omens
    const goblinScore = result.cardScores["Goblin Guide"]?.score ?? 50;
    const wallScore = result.cardScores["Wall of Omens"]?.score ?? 50;
    expect(goblinScore).toBeGreaterThan(wallScore);
  });

  test("keyword-matters theme detected with proper display name", () => {
    const cards: Record<string, EnrichedCard> = {
      "Kangee, Aerie Keeper": mockCard({
        name: "Kangee, Aerie Keeper",
        typeLine: "Legendary Creature — Bird Wizard",
        supertypes: ["Legendary"],
        subtypes: ["Bird", "Wizard"],
        keywords: ["Flying"],
        oracleText:
          "Flying\nCreatures with flying get +1/+1 for each feather counter on Kangee, Aerie Keeper.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Flyer ${i}`,
          mockCard({
            name: `Flyer ${i}`,
            typeLine: "Creature — Bird",
            subtypes: ["Bird"],
            keywords: ["Flying"],
            oracleText: "Flying",
          }),
        ])
      ),
    };
    const flyerNames = Array.from({ length: 5 }, (_, i) => `Flyer ${i}`);
    const deck = mockDeck(flyerNames, ["Kangee, Aerie Keeper"]);
    const result = analyzeDeckSynergy(deck, cards);

    const kwTheme = result.deckThemes.find(
      (t) => t.axisId === "keywordMatters"
    );
    expect(kwTheme).toBeDefined();
    expect(kwTheme!.axisName).toBe("Flying Matters");
    expect(kwTheme!.detail).toBe("flying");
  });

  test("no keyword-matters boost without payoff cards", () => {
    // A deck with flying creatures but NO flying-matters payoffs
    const cards: Record<string, EnrichedCard> = {
      Commander: mockCard({
        name: "Commander",
        typeLine: "Legendary Creature — Human",
        supertypes: ["Legendary"],
        subtypes: ["Human"],
        oracleText: "{T}: Add {G}.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [
          `Flyer ${i}`,
          mockCard({
            name: `Flyer ${i}`,
            typeLine: "Creature — Bird",
            subtypes: ["Bird"],
            keywords: ["Flying"],
            oracleText: "Flying",
          }),
        ])
      ),
    };
    const flyerNames = Array.from({ length: 5 }, (_, i) => `Flyer ${i}`);
    const deck = mockDeck(flyerNames, ["Commander"]);
    const result = analyzeDeckSynergy(deck, cards);

    // Should NOT detect keywordMatters theme — no payoff cards
    const kwTheme = result.deckThemes.find(
      (t) => t.axisId === "keywordMatters"
    );
    expect(kwTheme).toBeUndefined();
  });

  test("Yarok with 10 legendaries does NOT get supertypeMatter theme", () => {
    const cards: Record<string, EnrichedCard> = {
      "Yarok, the Desecrated": mockCard({
        name: "Yarok, the Desecrated",
        typeLine: "Legendary Creature — Elemental Horror",
        supertypes: ["Legendary"],
        subtypes: ["Elemental", "Horror"],
        oracleText:
          "Deathtouch, lifelink\nIf a permanent entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      }),
      ...Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `Legend ${i}`,
          mockCard({
            name: `Legend ${i}`,
            typeLine: "Legendary Creature — Human",
            supertypes: ["Legendary"],
            subtypes: ["Human"],
          }),
        ])
      ),
    };
    const legendNames = Array.from({ length: 10 }, (_, i) => `Legend ${i}`);
    const deck = mockDeck(legendNames, ["Yarok, the Desecrated"]);
    const result = analyzeDeckSynergy(deck, cards);

    // Should NOT detect supertypeMatter theme — Yarok doesn't care about legendaries
    const supertypeTheme = result.deckThemes.find(
      (t) => t.axisId === "supertypeMatter"
    );
    expect(supertypeTheme).toBeUndefined();
  });

  test("Liliana of the Veil + Waste Not → synergy pair on discard axis", () => {
    const cards: Record<string, EnrichedCard> = {
      "Liliana of the Veil": mockCard({
        name: "Liliana of the Veil",
        typeLine: "Legendary Planeswalker — Liliana",
        oracleText:
          "+1: Each player discards a card.\n−2: Target player sacrifices a creature.\n−6: Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.",
      }),
      "Waste Not": mockCard({
        name: "Waste Not",
        typeLine: "Enchantment",
        oracleText:
          "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.\nWhenever an opponent discards a land card, add {B}{B}.\nWhenever an opponent discards a noncreature, nonland card, draw a card.",
      }),
      "Geth's Grimoire": mockCard({
        name: "Geth's Grimoire",
        typeLine: "Artifact",
        oracleText:
          "Whenever an opponent discards a card, you may draw a card.",
      }),
      "Syphon Mind": mockCard({
        name: "Syphon Mind",
        typeLine: "Sorcery",
        oracleText:
          "Each other player discards a card. You draw a card for each card discarded this way.",
      }),
      "Lightning Bolt": mockCard({
        name: "Lightning Bolt",
        typeLine: "Instant",
        oracleText: "Lightning Bolt deals 3 damage to any target.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    // Should have synergy pairs on the discard axis
    const discardPairs = result.topSynergies.filter(
      (p) => p.axisId === "discard"
    );
    expect(discardPairs.length).toBeGreaterThan(0);

    // Waste Not should score higher than Lightning Bolt
    const wasteScore = result.cardScores["Waste Not"]?.score ?? 0;
    const boltScore = result.cardScores["Lightning Bolt"]?.score ?? 50;
    expect(wasteScore).toBeGreaterThan(boltScore);
  });

  test("discard-heavy deck detects Discard theme", () => {
    const cards: Record<string, EnrichedCard> = {
      "Liliana of the Veil": mockCard({
        name: "Liliana of the Veil",
        typeLine: "Legendary Planeswalker — Liliana",
        oracleText:
          "+1: Each player discards a card.\n−2: Target player sacrifices a creature.",
      }),
      "Waste Not": mockCard({
        name: "Waste Not",
        typeLine: "Enchantment",
        oracleText:
          "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.\nWhenever an opponent discards a land card, add {B}{B}.\nWhenever an opponent discards a noncreature, nonland card, draw a card.",
      }),
      "Geth's Grimoire": mockCard({
        name: "Geth's Grimoire",
        typeLine: "Artifact",
        oracleText:
          "Whenever an opponent discards a card, you may draw a card.",
      }),
      "Syphon Mind": mockCard({
        name: "Syphon Mind",
        typeLine: "Sorcery",
        oracleText:
          "Each other player discards a card. You draw a card for each card discarded this way.",
      }),
      "Liliana Vess": mockCard({
        name: "Liliana Vess",
        typeLine: "Legendary Planeswalker — Liliana",
        oracleText:
          "+1: Target player discards a card.\n−2: Search your library for a card, then shuffle and put that card on top.",
      }),
    };
    const deck = mockDeck(Object.keys(cards));
    const result = analyzeDeckSynergy(deck, cards);

    const discardTheme = result.deckThemes.find(
      (t) => t.axisId === "discard"
    );
    expect(discardTheme).toBeDefined();
  });
});
