import { test, expect } from "@playwright/test";
import type { EnrichedCard } from "../../src/lib/types";
import {
  computeCardDesirability,
  estimateScryCount,
  estimateSurveilCount,
  isBrainstormEffect,
  isPonderEffect,
  isTopReorderEffect,
  estimateTopReorderCount,
  scryAppearsBeforeDraw,
  simulateScry,
  simulateSurveil,
  simulateBrainstorm,
  simulatePonder,
  simulateTopReorder,
} from "../../src/lib/goldfish-simulator";
import type {
  GoldfishCard,
  GoldfishGameState,
  LibraryAction,
} from "../../src/lib/goldfish-simulator";
import { makeCard } from "../helpers";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGoldfishCard(overrides: Partial<EnrichedCard> = {}): GoldfishCard {
  const enriched = makeCard(overrides);
  return { name: enriched.name, enriched, tags: [] };
}

function makeGoldfishLand(overrides: Partial<EnrichedCard> = {}): GoldfishCard {
  return makeGoldfishCard({
    typeLine: "Basic Land — Forest",
    supertypes: ["Basic"],
    producedMana: ["G"],
    oracleText: "{T}: Add {G}.",
    ...overrides,
  });
}

function emptyGameState(): GoldfishGameState {
  return {
    hand: [],
    battlefield: [],
    library: [],
    graveyard: [],
    commandZone: [],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    landsPlayedThisTurn: 0,
    commanderTaxPaid: 0,
    turn: 1,
    treasureCount: 0,
  };
}

/**
 * Place N untapped lands on the battlefield to provide mana.
 */
function addLandsToBattlefield(
  state: GoldfishGameState,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const land = makeGoldfishLand({ name: `Forest ${i + 1}` });
    state.battlefield.push({
      card: land,
      tapped: false,
      summoningSick: false,
      producedMana: ["G"],
      enteredTurn: state.turn - 1,
    });
  }
}

// ---------------------------------------------------------------------------
// 1. computeCardDesirability
// ---------------------------------------------------------------------------

test.describe("computeCardDesirability", () => {
  test.describe("lands", () => {
    test("scores 0.9 when battlefield lands < 4 and no lands in hand", () => {
      const state = emptyGameState();
      addLandsToBattlefield(state, 2);
      // No lands in hand
      state.hand = [
        makeGoldfishCard({ name: "Spell A", typeLine: "Creature", cmc: 3 }),
      ];

      const land = makeGoldfishLand({ name: "Forest" });
      const score = computeCardDesirability(land, state);
      expect(score).toBe(0.9);
    });

    test("scores 0.5 when battlefield lands < 4 and hand has 1+ land", () => {
      const state = emptyGameState();
      addLandsToBattlefield(state, 2);
      state.hand = [makeGoldfishLand({ name: "Hand Forest" })];

      const land = makeGoldfishLand({ name: "Forest" });
      const score = computeCardDesirability(land, state);
      expect(score).toBe(0.5);
    });

    test("scores 0.6 when battlefield lands 4-5 and no lands in hand", () => {
      const state = emptyGameState();
      addLandsToBattlefield(state, 4);
      state.hand = [
        makeGoldfishCard({ name: "Spell A", typeLine: "Creature", cmc: 3 }),
      ];

      const land = makeGoldfishLand({ name: "Forest" });
      const score = computeCardDesirability(land, state);
      expect(score).toBe(0.6);
    });

    test("scores 0.15 when battlefield lands 4-5 and hand has 2+ lands", () => {
      const state = emptyGameState();
      addLandsToBattlefield(state, 5);
      state.hand = [
        makeGoldfishLand({ name: "Hand Forest 1" }),
        makeGoldfishLand({ name: "Hand Forest 2" }),
      ];

      const land = makeGoldfishLand({ name: "Forest" });
      const score = computeCardDesirability(land, state);
      expect(score).toBe(0.15);
    });

    test("scores 0.1 when battlefield lands >= 6", () => {
      const state = emptyGameState();
      addLandsToBattlefield(state, 7);

      const land = makeGoldfishLand({ name: "Forest" });
      const score = computeCardDesirability(land, state);
      expect(score).toBe(0.1);
    });
  });

  test.describe("non-lands", () => {
    test("scores 0.95 for ramp spell on turn <= 4 with CMC <= 3", () => {
      const state = emptyGameState();
      state.turn = 3;
      addLandsToBattlefield(state, 2);

      const rampSpell: GoldfishCard = {
        name: "Rampant Growth",
        enriched: makeCard({
          name: "Rampant Growth",
          typeLine: "Sorcery",
          cmc: 2,
          manaCost: "{1}{G}",
          oracleText:
            "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
        }),
        tags: ["Ramp"],
      };

      const score = computeCardDesirability(rampSpell, state);
      expect(score).toBe(0.95);
    });

    test("scores 0.85 for card draw spell castable next turn", () => {
      const state = emptyGameState();
      state.turn = 3;
      addLandsToBattlefield(state, 3); // 3 mana available

      const drawSpell: GoldfishCard = {
        name: "Harmonize",
        enriched: makeCard({
          name: "Harmonize",
          typeLine: "Sorcery",
          cmc: 4,
          manaCost: "{2}{G}{G}",
          oracleText: "Draw three cards.",
        }),
        tags: ["Card Draw"],
      };

      // CMC 4 <= mana(3) + 1 = 4, so castable next turn
      const score = computeCardDesirability(drawSpell, state);
      expect(score).toBe(0.85);
    });

    test("scores 0.7 for non-tagged spell castable next turn", () => {
      const state = emptyGameState();
      state.turn = 3;
      addLandsToBattlefield(state, 3); // 3 mana available

      const creature: GoldfishCard = {
        name: "Beast Within",
        enriched: makeCard({
          name: "Beast Within",
          typeLine: "Creature — Beast",
          cmc: 4,
          manaCost: "{3}{G}",
        }),
        tags: [],
      };

      // CMC 4 <= mana(3) + 1 = 4
      const score = computeCardDesirability(creature, state);
      expect(score).toBe(0.7);
    });

    test("scores 0.4 for spell castable in 2-3 turns", () => {
      const state = emptyGameState();
      state.turn = 3;
      addLandsToBattlefield(state, 3); // 3 mana available

      const bigCreature: GoldfishCard = {
        name: "Primeval Titan",
        enriched: makeCard({
          name: "Primeval Titan",
          typeLine: "Creature — Giant",
          cmc: 6,
          manaCost: "{4}{G}{G}",
        }),
        tags: [],
      };

      // CMC 6 > mana(3)+1=4, but <= mana(3)+3=6
      const score = computeCardDesirability(bigCreature, state);
      expect(score).toBe(0.4);
    });

    test("scores 0.15 for spell too expensive (CMC > mana+3)", () => {
      const state = emptyGameState();
      state.turn = 2;
      addLandsToBattlefield(state, 2); // 2 mana available

      const expensive: GoldfishCard = {
        name: "Eldrazi Titan",
        enriched: makeCard({
          name: "Eldrazi Titan",
          typeLine: "Creature — Eldrazi",
          cmc: 10,
          manaCost: "{10}",
        }),
        tags: [],
      };

      // CMC 10 > mana(2)+3=5
      const score = computeCardDesirability(expensive, state);
      expect(score).toBe(0.15);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Oracle text parsers
// ---------------------------------------------------------------------------

test.describe("estimateScryCount", () => {
  test("extracts numeric scry count", () => {
    expect(estimateScryCount("Scry 1")).toBe(1);
    expect(estimateScryCount("Scry 2")).toBe(2);
    expect(estimateScryCount("scry 4")).toBe(4);
  });

  test("extracts word-form scry count", () => {
    expect(estimateScryCount("scry three")).toBe(3);
  });

  test("returns 0 when no scry present", () => {
    expect(estimateScryCount("Draw a card")).toBe(0);
    expect(estimateScryCount("")).toBe(0);
  });
});

test.describe("estimateSurveilCount", () => {
  test("extracts numeric surveil count", () => {
    expect(estimateSurveilCount("Surveil 1")).toBe(1);
    expect(estimateSurveilCount("Surveil 2")).toBe(2);
  });

  test("returns 0 when no surveil present", () => {
    expect(estimateSurveilCount("Draw a card")).toBe(0);
    expect(estimateSurveilCount("")).toBe(0);
  });
});

test.describe("isBrainstormEffect", () => {
  test("detects Brainstorm oracle text", () => {
    const oracle =
      "Draw three cards, then put two cards from your hand on top of your library in any order.";
    expect(isBrainstormEffect(oracle)).toBe(true);
  });

  test("rejects non-Brainstorm text", () => {
    expect(isBrainstormEffect("Draw a card.")).toBe(false);
    expect(isBrainstormEffect("Scry 2, then draw a card.")).toBe(false);
  });
});

test.describe("isPonderEffect", () => {
  test("detects Ponder oracle text", () => {
    const oracle =
      "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.";
    expect(isPonderEffect(oracle)).toBe(true);
  });

  test("rejects non-Ponder text", () => {
    expect(isPonderEffect("Draw a card.")).toBe(false);
    expect(isPonderEffect("Scry 2.")).toBe(false);
  });
});

test.describe("isTopReorderEffect", () => {
  test("detects Sensei's Divining Top style reorder", () => {
    const oracle =
      "Look at the top three cards of your library, then put them back in any order.";
    expect(isTopReorderEffect(oracle)).toBe(true);
  });

  test("rejects Ponder (has shuffle option, not just reorder)", () => {
    const ponderOracle =
      "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.";
    expect(isTopReorderEffect(ponderOracle)).toBe(false);
  });
});

test.describe("estimateTopReorderCount", () => {
  test("extracts count from top N cards text", () => {
    const oracle =
      "Look at the top three cards of your library, then put them back in any order.";
    expect(estimateTopReorderCount(oracle)).toBe(3);
  });
});

test.describe("scryAppearsBeforeDraw", () => {
  test("returns true when scry precedes draw", () => {
    expect(scryAppearsBeforeDraw("Scry 1, then draw a card.")).toBe(true);
  });

  test("returns false when draw precedes scry", () => {
    expect(scryAppearsBeforeDraw("Draw a card, then scry 1.")).toBe(false);
  });

  test("returns false when no scry present", () => {
    expect(scryAppearsBeforeDraw("Draw two cards.")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. simulateScry
// ---------------------------------------------------------------------------

test.describe("simulateScry", () => {
  test("keeps high-desirability cards on top and bottoms low-desirability cards", () => {
    const state = emptyGameState();
    // Few lands on battlefield, no lands in hand -> lands score high (0.9)
    addLandsToBattlefield(state, 1);

    const goodLand = makeGoldfishLand({ name: "Desirable Forest" });
    const anotherGoodLand = makeGoldfishLand({ name: "Another Forest" });
    const expensiveSpell: GoldfishCard = {
      name: "Costly Spell",
      enriched: makeCard({
        name: "Costly Spell",
        typeLine: "Sorcery",
        cmc: 10,
        manaCost: "{10}",
      }),
      tags: [],
    };

    // Library: expensive spell on top, then two lands
    const filler = makeGoldfishCard({ name: "Filler", typeLine: "Creature", cmc: 3 });
    state.library = [expensiveSpell, goodLand, anotherGoodLand, filler];

    const actions = simulateScry(state, 3, "Test Scry");

    // Expensive spell should be bottomed (score < 0.5 with only 1 land on battlefield)
    // Lands should stay on top (score 0.9)
    expect(actions.length).toBe(3);

    const keptActions = actions.filter((a) => a.action === "kept-on-top");
    const bottomedActions = actions.filter((a) => a.action === "bottomed");

    expect(keptActions.length).toBe(2);
    expect(bottomedActions.length).toBe(1);
    expect(bottomedActions[0].cardName).toBe("Costly Spell");

    // Verify library order: kept cards on top, bottomed card at end
    expect(state.library[0].name).not.toBe("Costly Spell");
    expect(state.library[1].name).not.toBe("Costly Spell");
    expect(state.library[state.library.length - 1].name).toBe("Costly Spell");
  });

  test("returns actions with source name", () => {
    const state = emptyGameState();
    addLandsToBattlefield(state, 3);
    const card = makeGoldfishLand({ name: "Forest" });
    state.library = [card];

    const actions = simulateScry(state, 1, "Opt");
    expect(actions.length).toBe(1);
    expect(actions[0].source).toBe("Opt");
  });
});

// ---------------------------------------------------------------------------
// 4. simulateSurveil
// ---------------------------------------------------------------------------

test.describe("simulateSurveil", () => {
  test("puts low-desirability cards into graveyard instead of bottom", () => {
    const state = emptyGameState();
    addLandsToBattlefield(state, 1);

    const goodLand = makeGoldfishLand({ name: "Wanted Forest" });
    const expensiveSpell: GoldfishCard = {
      name: "Expensive Spell",
      enriched: makeCard({
        name: "Expensive Spell",
        typeLine: "Sorcery",
        cmc: 10,
        manaCost: "{10}",
      }),
      tags: [],
    };

    state.library = [expensiveSpell, goodLand];

    const actions = simulateSurveil(state, 2, "Surveil Source");

    // Expensive spell should go to graveyard
    const graveyardActions = actions.filter((a) => a.action === "graveyard");
    expect(graveyardActions.length).toBe(1);
    expect(graveyardActions[0].cardName).toBe("Expensive Spell");

    // Verify graveyard received the card
    expect(state.graveyard.some((c) => c.name === "Expensive Spell")).toBe(true);

    // Good land should stay on top
    const keptActions = actions.filter((a) => a.action === "kept-on-top");
    expect(keptActions.length).toBe(1);
    expect(keptActions[0].cardName).toBe("Wanted Forest");
  });
});

// ---------------------------------------------------------------------------
// 5. simulateBrainstorm
// ---------------------------------------------------------------------------

test.describe("simulateBrainstorm", () => {
  test("draws 3, puts 2 lowest-scoring cards from hand back on top", () => {
    const state = emptyGameState();
    addLandsToBattlefield(state, 2);

    // Start with 1 card in hand (an expensive spell - low desirability)
    const handExpensive: GoldfishCard = {
      name: "Hand Expensive",
      enriched: makeCard({
        name: "Hand Expensive",
        typeLine: "Creature — Eldrazi",
        cmc: 12,
        manaCost: "{12}",
      }),
      tags: [],
    };
    state.hand = [handExpensive];

    // Library has 3 cards: 2 good lands and 1 mediocre spell
    const libLand1 = makeGoldfishLand({ name: "Library Forest 1" });
    const libLand2 = makeGoldfishLand({ name: "Library Forest 2" });
    const libCreature: GoldfishCard = {
      name: "Library Creature",
      enriched: makeCard({
        name: "Library Creature",
        typeLine: "Creature — Elf",
        cmc: 8,
        manaCost: "{8}",
      }),
      tags: [],
    };
    state.library = [libLand1, libLand2, libCreature];

    const result = simulateBrainstorm(state, "Brainstorm");

    // Should have drawn 3 cards
    expect(result.drawn.length).toBe(3);

    // Net hand change: started with 1, drew 3, put back 2 -> hand size = 2
    expect(state.hand.length).toBe(2);

    // 2 cards put back on top of library
    expect(result.actions.length).toBe(2);
    for (const action of result.actions) {
      expect(action.action).toBe("put-back-from-hand");
    }

    // The 2 put-back cards should be the lowest-scoring ones
    // (the expensive hand card and the expensive library creature)
    const putBackNames = result.actions.map((a) => a.cardName);
    expect(putBackNames).toContain("Hand Expensive");
    expect(putBackNames).toContain("Library Creature");
  });
});

// ---------------------------------------------------------------------------
// 6. simulatePonder
// ---------------------------------------------------------------------------

test.describe("simulatePonder", () => {
  test("shuffles library when all top 3 cards score below 0.4", () => {
    const state = emptyGameState();
    // Many lands on battlefield -> lands score low, expensive spells score low
    addLandsToBattlefield(state, 8);

    const badSpell1: GoldfishCard = {
      name: "Bad Spell 1",
      enriched: makeCard({
        name: "Bad Spell 1",
        typeLine: "Sorcery",
        cmc: 15,
        manaCost: "{15}",
      }),
      tags: [],
    };
    const badSpell2: GoldfishCard = {
      name: "Bad Spell 2",
      enriched: makeCard({
        name: "Bad Spell 2",
        typeLine: "Sorcery",
        cmc: 14,
        manaCost: "{14}",
      }),
      tags: [],
    };
    const badSpell3: GoldfishCard = {
      name: "Bad Spell 3",
      enriched: makeCard({
        name: "Bad Spell 3",
        typeLine: "Sorcery",
        cmc: 13,
        manaCost: "{13}",
      }),
      tags: [],
    };
    // Extra cards in library so shuffle is detectable
    const filler1 = makeGoldfishCard({
      name: "Filler A",
      typeLine: "Creature",
      cmc: 2,
    });
    const filler2 = makeGoldfishCard({
      name: "Filler B",
      typeLine: "Creature",
      cmc: 2,
    });

    state.library = [badSpell1, badSpell2, badSpell3, filler1, filler2];

    const result = simulatePonder(state, "Ponder");

    // Should draw 1 card
    expect(result.drawn.length).toBe(1);

    // Should have a shuffled action
    const shuffleActions = result.actions.filter((a) => a.action === "shuffled");
    expect(shuffleActions.length).toBeGreaterThan(0);
  });

  test("reorders top 3 by desirability and draws 1 when cards are mixed", () => {
    const state = emptyGameState();
    // Few lands on battlefield -> lands desirable
    addLandsToBattlefield(state, 2);

    const goodLand = makeGoldfishLand({ name: "Good Land" });
    const okSpell: GoldfishCard = {
      name: "Ok Spell",
      enriched: makeCard({
        name: "Ok Spell",
        typeLine: "Creature — Elf",
        cmc: 3,
        manaCost: "{2}{G}",
      }),
      tags: [],
    };
    const decentSpell: GoldfishCard = {
      name: "Decent Spell",
      enriched: makeCard({
        name: "Decent Spell",
        typeLine: "Creature — Beast",
        cmc: 4,
        manaCost: "{3}{G}",
      }),
      tags: [],
    };

    state.library = [okSpell, decentSpell, goodLand];

    const result = simulatePonder(state, "Ponder");

    // Should draw 1 card
    expect(result.drawn.length).toBe(1);

    // The drawn card should be the highest-scoring one (the land, score 0.9)
    expect(result.drawn[0].name).toBe("Good Land");

    // Should have kept-on-top actions (no shuffle)
    const shuffleActions = result.actions.filter((a) => a.action === "shuffled");
    expect(shuffleActions.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. simulateTopReorder
// ---------------------------------------------------------------------------

test.describe("simulateTopReorder", () => {
  test("reorders top N cards by desirability without removing any", () => {
    const state = emptyGameState();
    addLandsToBattlefield(state, 2);

    const expensiveSpell: GoldfishCard = {
      name: "Expensive",
      enriched: makeCard({
        name: "Expensive",
        typeLine: "Sorcery",
        cmc: 7,
        manaCost: "{7}",
      }),
      tags: [],
    };
    const goodLand = makeGoldfishLand({ name: "Good Land" });
    const cheapSpell: GoldfishCard = {
      name: "Cheap Spell",
      enriched: makeCard({
        name: "Cheap Spell",
        typeLine: "Creature — Elf",
        cmc: 3,
        manaCost: "{2}{G}",
      }),
      tags: [],
    };
    const fillerCard = makeGoldfishCard({
      name: "Filler",
      typeLine: "Creature",
      cmc: 2,
    });

    state.library = [expensiveSpell, goodLand, cheapSpell, fillerCard];

    const libraryLengthBefore = state.library.length;
    const actions = simulateTopReorder(state, 3, "Sensei's Divining Top");

    // Library length should not change
    expect(state.library.length).toBe(libraryLengthBefore);

    // All actions should be kept-on-top
    expect(actions.length).toBe(3);
    for (const action of actions) {
      expect(action.action).toBe("kept-on-top");
    }

    // The best card (land, score 0.9) should now be on top
    expect(state.library[0].name).toBe("Good Land");

    // The expensive card (low score) should be third among the reordered
    // Filler card at index 3 should be untouched
    expect(state.library[3].name).toBe("Filler");
  });
});

// ---------------------------------------------------------------------------
// 8. Scry-draw ordering integration
// ---------------------------------------------------------------------------

test.describe("scry-draw ordering integration", () => {
  test("scry before draw bottoms bad card and draws good card", () => {
    const state = emptyGameState();
    addLandsToBattlefield(state, 2);
    // No lands in hand
    state.hand = [];

    // Library: bad card on top, good card underneath
    const badCard: GoldfishCard = {
      name: "Terrible Spell",
      enriched: makeCard({
        name: "Terrible Spell",
        typeLine: "Sorcery",
        cmc: 15,
        manaCost: "{15}",
      }),
      tags: [],
    };
    const goodCard = makeGoldfishLand({ name: "Needed Land" });
    const extraCard = makeGoldfishCard({
      name: "Extra",
      typeLine: "Creature",
      cmc: 2,
    });

    state.library = [badCard, goodCard, extraCard];

    // Step 1: scry 1 (simulating "Scry 1, then draw a card")
    const scryActions = simulateScry(state, 1, "Opt");

    // Bad card should have been bottomed
    expect(scryActions.length).toBe(1);
    expect(scryActions[0].action).toBe("bottomed");
    expect(scryActions[0].cardName).toBe("Terrible Spell");

    // Now the good card should be on top
    expect(state.library[0].name).toBe("Needed Land");

    // Step 2: draw a card
    const drawnCard = state.library.shift()!;
    state.hand.push(drawnCard);

    // The drawn card should be the good card
    expect(drawnCard.name).toBe("Needed Land");

    // Bad card should be at the bottom of the library
    expect(state.library[state.library.length - 1].name).toBe("Terrible Spell");
  });

  test("scryAppearsBeforeDraw correctly identifies ordering in oracle text", () => {
    // Opt-style: "Scry 1. Draw a card."
    expect(scryAppearsBeforeDraw("Scry 1. Draw a card.")).toBe(true);

    // Reverse ordering should be false
    expect(scryAppearsBeforeDraw("Draw a card. Scry 1.")).toBe(false);
  });
});
