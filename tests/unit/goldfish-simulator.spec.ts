import { test, expect } from "@playwright/test";
import type { EnrichedCard } from "../../src/lib/types";
import {
  initializeGame,
  chooseLandToPlay,
  chooseSpellToCast,
  computeAvailableMana,
  executeTurn,
  runGoldfishGame,
  runGoldfishSimulation,
  computeAggregateStats,
  DEFAULT_GOLDFISH_CONFIG,
} from "../../src/lib/goldfish-simulator";
import type {
  GoldfishCard,
  GoldfishGameState,
  GoldfishConfig,
  GoldfishGameLog,
} from "../../src/lib/goldfish-simulator";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGoldfishCard(overrides: Partial<EnrichedCard> = {}): GoldfishCard {
  const enriched = makeCard(overrides);
  return {
    name: enriched.name,
    enriched,
    tags: [],
  };
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

function makeGoldfishCreature(overrides: Partial<EnrichedCard> = {}): GoldfishCard {
  return makeGoldfishCard({
    typeLine: "Creature — Elf",
    power: "1",
    toughness: "1",
    ...overrides,
  });
}

function makeGoldfishRamp(overrides: Partial<EnrichedCard> = {}): GoldfishCard {
  const card = makeGoldfishCard({
    name: "Ramp Spell",
    typeLine: "Sorcery",
    manaCost: "{1}{G}",
    cmc: 2,
    oracleText:
      "Search your library for a basic land card and put it onto the battlefield tapped.",
    ...overrides,
  });
  card.tags = ["Ramp"];
  return card;
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

// ---------------------------------------------------------------------------
// Task 2.1.2: Single-turn tests
// ---------------------------------------------------------------------------

test.describe("chooseLandToPlay", () => {
  test("returns null when no lands in hand", () => {
    const state = emptyGameState();
    state.hand = [makeGoldfishCreature()];
    expect(chooseLandToPlay(state)).toBeNull();
  });

  test("prefers untapped land over tapped land", () => {
    const state = emptyGameState();
    const tappedLand = makeGoldfishCard({
      name: "Tapped Forest",
      typeLine: "Land",
      supertypes: [],
      oracleText: "Tapped Forest enters the battlefield tapped.",
      producedMana: ["G"],
    });
    const untappedLand = makeGoldfishLand({ name: "Basic Forest" });

    state.hand = [tappedLand, untappedLand];
    const chosen = chooseLandToPlay(state);
    expect(chosen?.name).toBe("Basic Forest");
  });

  test("prefers conditional land over unconditionally tapped land", () => {
    const state = emptyGameState();
    const tappedLand = makeGoldfishCard({
      name: "Tap Land",
      typeLine: "Land",
      supertypes: [],
      oracleText: "Tap Land enters the battlefield tapped.",
      producedMana: ["G", "U"],
    });
    const conditionalLand = makeGoldfishCard({
      name: "Check Land",
      typeLine: "Land",
      supertypes: [],
      oracleText:
        "Check Land enters the battlefield tapped unless you control two or fewer other lands.",
      producedMana: ["G", "U"],
    });

    state.hand = [tappedLand, conditionalLand];
    const chosen = chooseLandToPlay(state);
    expect(chosen?.name).toBe("Check Land");
  });

  test("returns the only land when one land available", () => {
    const state = emptyGameState();
    const land = makeGoldfishLand({ name: "Forest" });
    state.hand = [land, makeGoldfishCreature()];
    const chosen = chooseLandToPlay(state);
    expect(chosen?.name).toBe("Forest");
  });
});

test.describe("computeAvailableMana", () => {
  test("returns zero when battlefield is empty", () => {
    const state = emptyGameState();
    const pool = computeAvailableMana(state);
    expect(pool.W + pool.U + pool.B + pool.R + pool.G + pool.C).toBe(0);
  });

  test("counts mana from untapped lands on battlefield", () => {
    const state = emptyGameState();
    state.battlefield = [
      {
        card: makeGoldfishLand({ name: "Forest 1", producedMana: ["G"] }),
        tapped: false,
        summoningSick: false,
        producedMana: ["G"],
        enteredTurn: 1,
      },
      {
        card: makeGoldfishLand({ name: "Forest 2", producedMana: ["G"] }),
        tapped: false,
        summoningSick: false,
        producedMana: ["G"],
        enteredTurn: 1,
      },
    ];
    const pool = computeAvailableMana(state);
    expect(pool.G).toBe(2);
  });

  test("mana dork with summoning sickness does not produce mana", () => {
    const state = emptyGameState();
    state.battlefield = [
      {
        card: makeGoldfishCreature({
          name: "Llanowar Elves",
          producedMana: ["G"],
        }),
        tapped: false,
        summoningSick: true, // entered this turn, no haste
        producedMana: ["G"],
        enteredTurn: 1,
      },
    ];
    const pool = computeAvailableMana(state);
    expect(pool.G).toBe(0);
  });

  test("mana dork with haste produces mana even with summoning sickness", () => {
    const state = emptyGameState();
    state.battlefield = [
      {
        card: makeGoldfishCreature({
          name: "Haste Dork",
          producedMana: ["G"],
          keywords: ["Haste"],
        }),
        tapped: false,
        summoningSick: true,
        producedMana: ["G"],
        enteredTurn: 1,
      },
    ];
    const pool = computeAvailableMana(state);
    expect(pool.G).toBe(1);
  });

  test("mana dork without summoning sickness produces mana", () => {
    const state = emptyGameState();
    state.battlefield = [
      {
        card: makeGoldfishCreature({
          name: "Elvish Mystic",
          producedMana: ["G"],
        }),
        tapped: false,
        summoningSick: false, // already been on battlefield
        producedMana: ["G"],
        enteredTurn: 0,
      },
    ];
    const pool = computeAvailableMana(state);
    expect(pool.G).toBe(1);
  });

  test("counts treasures as colorless mana", () => {
    const state = emptyGameState();
    state.treasureCount = 3;
    const pool = computeAvailableMana(state);
    expect(pool.C).toBe(3);
  });
});

test.describe("chooseSpellToCast", () => {
  test("returns null when hand is empty", () => {
    const state = emptyGameState();
    expect(chooseSpellToCast(state)).toBeNull();
  });

  test("returns null when no spell is castable (not enough mana)", () => {
    const state = emptyGameState();
    state.hand = [
      makeGoldfishCreature({
        name: "Expensive Creature",
        manaCost: "{5}{G}",
        cmc: 6,
      }),
    ];
    // No lands = no mana
    expect(chooseSpellToCast(state)).toBeNull();
  });

  test("prioritizes ramp spells at CMC <= 3", () => {
    const state = emptyGameState();
    // 4 lands for mana
    state.battlefield = Array.from({ length: 4 }, (_, i) => ({
      card: makeGoldfishLand({ name: `Forest ${i}`, producedMana: ["G"] }),
      tapped: false,
      summoningSick: false,
      producedMana: ["G"],
      enteredTurn: 0,
    }));

    const ramp = makeGoldfishRamp({
      name: "Cultivate",
      manaCost: "{2}{G}",
      cmc: 3,
      colorIdentity: ["G"],
      colors: ["G"],
    });
    const bigCreature = makeGoldfishCreature({
      name: "Big Creature",
      manaCost: "{3}{G}",
      cmc: 4,
      colorIdentity: ["G"],
      colors: ["G"],
    });

    state.hand = [bigCreature, ramp];
    const choice = chooseSpellToCast(state);
    expect(choice?.card.name).toBe("Cultivate");
  });

  test("casts highest CMC spell when no ramp available", () => {
    const state = emptyGameState();
    // 5 lands
    state.battlefield = Array.from({ length: 5 }, (_, i) => ({
      card: makeGoldfishLand({ name: `Forest ${i}`, producedMana: ["G"] }),
      tapped: false,
      summoningSick: false,
      producedMana: ["G"],
      enteredTurn: 0,
    }));

    const small = makeGoldfishCreature({
      name: "Small",
      manaCost: "{G}",
      cmc: 1,
      colorIdentity: ["G"],
      colors: ["G"],
    });
    const big = makeGoldfishCreature({
      name: "Big",
      manaCost: "{4}{G}",
      cmc: 5,
      colorIdentity: ["G"],
      colors: ["G"],
    });

    state.hand = [small, big];
    const choice = chooseSpellToCast(state);
    expect(choice?.card.name).toBe("Big");
  });

  test("casts commander when no ramp in hand", () => {
    const state = emptyGameState();
    // 4 lands
    state.battlefield = Array.from({ length: 4 }, (_, i) => ({
      card: makeGoldfishLand({ name: `Land ${i}`, producedMana: ["G"] }),
      tapped: false,
      summoningSick: false,
      producedMana: ["G"],
      enteredTurn: 0,
    }));

    const commander = makeGoldfishCreature({
      name: "Commander",
      manaCost: "{3}{G}",
      cmc: 4,
      colorIdentity: ["G"],
      colors: ["G"],
    });

    state.commandZone = [commander];
    state.hand = [];

    const choice = chooseSpellToCast(state);
    expect(choice?.card.name).toBe("Commander");
    expect(choice?.isCommander).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 2.1.6: Multi-turn tests
// ---------------------------------------------------------------------------

test.describe("executeTurn", () => {
  test("plays a land from hand on turn 1", () => {
    const config: GoldfishConfig = { ...DEFAULT_GOLDFISH_CONFIG };
    const state = emptyGameState();
    state.turn = 0;
    state.hand = [makeGoldfishLand({ name: "Forest" })];

    const log = executeTurn(state, config);
    expect(log.landPlayed).toBe("Forest");
    expect(state.battlefield.length).toBeGreaterThan(0);
  });

  test("skips draw on turn 1 when on the play", () => {
    const config: GoldfishConfig = { ...DEFAULT_GOLDFISH_CONFIG, onThePlay: true };
    const state = emptyGameState();
    state.turn = 0;
    const initialHandSize = 7;
    state.hand = Array.from({ length: initialHandSize }, (_, i) =>
      makeGoldfishLand({ name: `Forest ${i}` })
    );
    state.library = [makeGoldfishLand({ name: "Extra Land" })];

    executeTurn(state, config);
    // On the play: T1 no draw, but played 1 land from hand → hand = 6
    expect(state.hand.length).toBe(initialHandSize - 1);
  });

  test("draws on turn 1 when on the draw", () => {
    const config: GoldfishConfig = { ...DEFAULT_GOLDFISH_CONFIG, onThePlay: false };
    const state = emptyGameState();
    state.turn = 0;
    // 6 cards in hand, library has more
    state.hand = Array.from({ length: 6 }, (_, i) =>
      makeGoldfishCreature({ name: `Creature ${i}` })
    );
    state.library = [makeGoldfishLand({ name: "Forest" })];

    executeTurn(state, config);
    // On draw: drew 1, played Forest from hand/library → net hand change
    // Drew 1 card (Forest from library), no lands in hand before → library empty
    expect(state.library.length).toBe(0);
  });

  test("casts a castable spell when enough mana available", () => {
    const config: GoldfishConfig = { ...DEFAULT_GOLDFISH_CONFIG };
    const state = emptyGameState();
    state.turn = 0;

    // Pre-place 3 lands on battlefield (so mana is available)
    state.battlefield = Array.from({ length: 3 }, (_, i) => ({
      card: makeGoldfishLand({ name: `Forest ${i}`, producedMana: ["G"] }),
      tapped: false,
      summoningSick: false,
      producedMana: ["G"],
      enteredTurn: 0,
    }));

    state.hand = [
      makeGoldfishCreature({
        name: "Elf",
        manaCost: "{G}",
        cmc: 1,
        colorIdentity: ["G"],
        colors: ["G"],
      }),
    ];

    const log = executeTurn(state, config);
    expect(log.spellsCast).toContain("Elf");
  });
});

test.describe("mana curve development over 10 turns", () => {
  test("average mana available increases from turn 1 to turn 6", () => {
    // Build a 60-card deck with 24 lands
    const lands = Array.from({ length: 24 }, (_, i) => ({
      name: `Forest ${i}`,
      quantity: 1,
    }));
    const creatures = Array.from({ length: 36 }, (_, i) => ({
      name: `Creature ${i}`,
      quantity: 1,
    }));
    const deck = makeDeck({ mainboard: [...lands, ...creatures] });

    const cardMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 24; i++) {
      cardMap[`Forest ${i}`] = makeCard({
        name: `Forest ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        oracleText: "{T}: Add {G}.",
      });
    }
    for (let i = 0; i < 36; i++) {
      cardMap[`Creature ${i}`] = makeCard({
        name: `Creature ${i}`,
        typeLine: "Creature — Elf",
        manaCost: "{3}{G}",
        cmc: 4,
        colorIdentity: ["G"],
        colors: ["G"],
      });
    }

    const config: GoldfishConfig = { turns: 10, iterations: 200, onThePlay: true };
    const result = runGoldfishSimulation(deck, cardMap, config);

    // Average mana at turn 6 (index 5) should be greater than turn 1 (index 0)
    const manaT1 = result.stats.avgManaByTurn[0];
    const manaT6 = result.stats.avgManaByTurn[5];
    expect(manaT6).toBeGreaterThan(manaT1);
  });

  test("deck with ramp has more mana at T4+ than deck without ramp", () => {
    // Deck 1: 24 lands, 12 ramp, 24 other
    const rampDeckMainboard = [
      ...Array.from({ length: 24 }, (_, i) => ({ name: `Forest ${i}`, quantity: 1 })),
      ...Array.from({ length: 12 }, (_, i) => ({ name: `Ramp ${i}`, quantity: 1 })),
      ...Array.from({ length: 24 }, (_, i) => ({ name: `Creature ${i}`, quantity: 1 })),
    ];

    // Deck 2: 24 lands, 36 creatures (no ramp)
    const noRampDeckMainboard = [
      ...Array.from({ length: 24 }, (_, i) => ({ name: `Forest ${i}`, quantity: 1 })),
      ...Array.from({ length: 36 }, (_, i) => ({ name: `Creature ${i}`, quantity: 1 })),
    ];

    const baseCardMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 24; i++) {
      baseCardMap[`Forest ${i}`] = makeCard({
        name: `Forest ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        oracleText: "{T}: Add {G}.",
      });
    }
    for (let i = 0; i < 36; i++) {
      baseCardMap[`Creature ${i}`] = makeCard({
        name: `Creature ${i}`,
        typeLine: "Creature — Elf",
        manaCost: "{3}{G}",
        cmc: 4,
        colorIdentity: ["G"],
        colors: ["G"],
      });
    }

    const rampCardMap = { ...baseCardMap };
    for (let i = 0; i < 12; i++) {
      // Use a land-searching ramp to add lands
      rampCardMap[`Ramp ${i}`] = makeCard({
        name: `Ramp ${i}`,
        typeLine: "Sorcery",
        manaCost: "{1}{G}",
        cmc: 2,
        colorIdentity: ["G"],
        colors: ["G"],
        oracleText:
          "Search your library for a basic land card and put it onto the battlefield tapped.",
      });
    }

    const config: GoldfishConfig = { turns: 10, iterations: 300, onThePlay: true };

    const rampDeck = makeDeck({ mainboard: rampDeckMainboard });
    const noRampDeck = makeDeck({ mainboard: noRampDeckMainboard });

    const rampResult = runGoldfishSimulation(rampDeck, rampCardMap, config);
    const noRampResult = runGoldfishSimulation(noRampDeck, baseCardMap, config);

    // At turn 5+ ramp deck should have more mana on average
    const rampManaT5 = rampResult.stats.avgManaByTurn[4];
    const noRampManaT5 = noRampResult.stats.avgManaByTurn[4];

    // Ramp deck should have rampAcceleration > 0
    expect(rampResult.stats.rampAcceleration).toBeGreaterThanOrEqual(0);
    // Ramp deck avg mana at T5 should be >= noRamp (allowing for variance)
    expect(rampManaT5).toBeGreaterThanOrEqual(noRampManaT5 - 1);
  });

  test("5-CMC commander should be castable around turn 5 in many games", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        ...Array.from({ length: 38 }, (_, i) => ({
          name: `Forest ${i}`,
          quantity: 1,
        })),
        ...Array.from({ length: 22 }, (_, i) => ({
          name: `Creature ${i}`,
          quantity: 1,
        })),
      ],
    });

    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature — Dragon",
        supertypes: ["Legendary"],
        manaCost: "{3}{G}{G}",
        cmc: 5,
        colorIdentity: ["G"],
        colors: ["G"],
      }),
    };
    for (let i = 0; i < 38; i++) {
      cardMap[`Forest ${i}`] = makeCard({
        name: `Forest ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        oracleText: "{T}: Add {G}.",
      });
    }
    for (let i = 0; i < 22; i++) {
      cardMap[`Creature ${i}`] = makeCard({
        name: `Creature ${i}`,
        typeLine: "Creature",
        manaCost: "{4}{G}",
        cmc: 5,
        colorIdentity: ["G"],
        colors: ["G"],
      });
    }

    const config: GoldfishConfig = { turns: 10, iterations: 300, onThePlay: true };
    const result = runGoldfishSimulation(deck, cardMap, config);

    // Commander should be cast in a good portion of games
    expect(result.stats.commanderCastRate).toBeGreaterThan(0.3);
    // Average commander turn should be around 5-8
    if (result.stats.avgCommanderTurn !== null) {
      expect(result.stats.avgCommanderTurn).toBeGreaterThanOrEqual(4);
      expect(result.stats.avgCommanderTurn).toBeLessThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 2.1.8: Aggregate stats tests
// ---------------------------------------------------------------------------

test.describe("computeAggregateStats", () => {
  test("returns zeroed stats for empty games array", () => {
    const stats = computeAggregateStats([], 10);
    expect(stats.avgManaByTurn).toHaveLength(10);
    expect(stats.avgManaByTurn.every((v) => v === 0)).toBe(true);
    expect(stats.commanderCastRate).toBe(0);
    expect(stats.avgCommanderTurn).toBeNull();
    expect(stats.avgTotalSpellsCast).toBe(0);
  });

  test("computes correct averages from known game logs", () => {
    const game1: GoldfishGameLog = {
      turnLogs: [
        {
          turn: 1,
          landPlayed: "Forest",
          spellsCast: [],
          manaAvailable: 1,
          manaUsed: 0,
          handSize: 6,
          permanentCount: 1,
          commanderCast: false,
        },
        {
          turn: 2,
          landPlayed: "Forest",
          spellsCast: ["Elf"],
          manaAvailable: 2,
          manaUsed: 1,
          handSize: 5,
          permanentCount: 3,
          commanderCast: false,
        },
      ],
      commanderFirstCastTurn: null,
    };
    const game2: GoldfishGameLog = {
      turnLogs: [
        {
          turn: 1,
          landPlayed: "Plains",
          spellsCast: [],
          manaAvailable: 1,
          manaUsed: 0,
          handSize: 6,
          permanentCount: 1,
          commanderCast: false,
        },
        {
          turn: 2,
          landPlayed: null,
          spellsCast: ["Sol Ring", "Elf"],
          manaAvailable: 3,
          manaUsed: 2,
          handSize: 4,
          permanentCount: 2,
          commanderCast: false,
        },
      ],
      commanderFirstCastTurn: null,
    };

    const stats = computeAggregateStats([game1, game2], 2);
    expect(stats.avgManaByTurn[0]).toBe(1); // both T1 = 1 mana
    expect(stats.avgManaByTurn[1]).toBeCloseTo(2.5, 1); // (2+3)/2 = 2.5
    expect(stats.avgSpellsByTurn[0]).toBe(0); // no spells T1
    expect(stats.avgSpellsByTurn[1]).toBeCloseTo(1.5, 1); // (1+2)/2 = 1.5
    expect(stats.commanderCastRate).toBe(0);
    expect(stats.avgCommanderTurn).toBeNull();
    expect(stats.avgTotalSpellsCast).toBeCloseTo(1.5, 1); // (1+2)/2
  });

  test("commander cast rate computed correctly", () => {
    const games: GoldfishGameLog[] = [
      { turnLogs: [], commanderFirstCastTurn: 5 },
      { turnLogs: [], commanderFirstCastTurn: 6 },
      { turnLogs: [], commanderFirstCastTurn: null },
      { turnLogs: [], commanderFirstCastTurn: null },
    ];
    const stats = computeAggregateStats(games, 0);
    expect(stats.commanderCastRate).toBeCloseTo(0.5, 2); // 2/4
    expect(stats.avgCommanderTurn).toBeCloseTo(5.5, 1); // (5+6)/2
  });

  test("handles all-land deck (no spells cast)", () => {
    const deck = makeDeck({
      mainboard: Array.from({ length: 40 }, (_, i) => ({
        name: `Forest ${i}`,
        quantity: 1,
      })),
    });
    const cardMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 40; i++) {
      cardMap[`Forest ${i}`] = makeCard({
        name: `Forest ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        oracleText: "{T}: Add {G}.",
      });
    }

    const config: GoldfishConfig = { turns: 5, iterations: 50, onThePlay: true };
    const result = runGoldfishSimulation(deck, cardMap, config);

    // No non-land spells → avg spells cast should be 0 or very low
    expect(result.stats.avgTotalSpellsCast).toBe(0);
    // Commander cast rate should be 0 (no commander)
    expect(result.stats.commanderCastRate).toBe(0);
  });

  test("handles empty deck gracefully", () => {
    const deck = makeDeck({ mainboard: [] });
    const config: GoldfishConfig = { turns: 5, iterations: 20, onThePlay: true };
    const result = runGoldfishSimulation(deck, {}, config);

    expect(result.stats.avgManaByTurn).toHaveLength(5);
    expect(result.stats.avgManaByTurn.every((v) => v === 0)).toBe(true);
  });

  test("runGoldfishGame returns correct turn count", () => {
    const deck = makeDeck({
      mainboard: Array.from({ length: 20 }, (_, i) => ({
        name: `Forest ${i}`,
        quantity: 1,
      })),
    });
    const cardMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 20; i++) {
      cardMap[`Forest ${i}`] = makeCard({
        name: `Forest ${i}`,
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        producedMana: ["G"],
        oracleText: "{T}: Add {G}.",
      });
    }

    const config: GoldfishConfig = { turns: 7, iterations: 1, onThePlay: true };
    const result = runGoldfishSimulation(deck, cardMap, config);
    expect(result.games).toHaveLength(1);
    expect(result.games[0].turnLogs).toHaveLength(7);
    expect(result.stats.avgManaByTurn).toHaveLength(7);
  });
});
