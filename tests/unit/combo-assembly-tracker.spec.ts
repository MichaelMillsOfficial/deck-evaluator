import { test, expect } from "@playwright/test";
import type { EnrichedCard } from "../../src/lib/types";
import {
  ComboAssemblyTracker,
  type ComboPieceStatus,
  type ComboAssemblySnapshot,
  type ComboAssemblyStats,
} from "../../src/lib/combo-assembly-tracker";
import type { GoldfishGameState } from "../../src/lib/goldfish-simulator";
import { makeCard } from "../helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGoldfishCard(overrides: Partial<EnrichedCard> = {}) {
  const enriched = makeCard(overrides);
  return { name: enriched.name, enriched, tags: [] as string[] };
}

function makeGoldfishPermanent(name: string, typeLine = "Creature", enteredTurn = 1) {
  const card = makeGoldfishCard({ name, typeLine });
  return {
    card,
    tapped: false,
    summoningSick: false,
    producedMana: [] as string[],
    enteredTurn,
  };
}

function emptyState(): GoldfishGameState {
  return {
    hand: [],
    battlefield: [],
    library: [],
    graveyard: [],
    exile: [],
    commandZone: [],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    landsPlayedThisTurn: 0,
    commanderTaxPaid: 0,
    turn: 1,
    treasureCount: 0,
    rampLandsSearched: 0,
    random: Math.random,
  };
}

// ---------------------------------------------------------------------------
// Tests: Piece tracking
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker - piece tracking", () => {
  test("tracks piece in library at turn 1 (not yet available)", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
    ]);

    const state = emptyState();
    // Both pieces in library — not in hand or battlefield
    state.library = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];

    tracker.update(state, 1);
    const snapshots = tracker.getSnapshots();

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].fullyAssembled).toBe(false);
    expect(snapshots[0].assembledOnTurn).toBeNull();

    const oraclePiece = snapshots[0].pieces.find(
      (p) => p.cardName === "Thassa's Oracle"
    );
    expect(oraclePiece?.zone).toBe("library");
    expect(oraclePiece?.turnFirstAvailable).toBeNull();
  });

  test("tracks piece zone transition from library to hand", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
    ]);

    const state1 = emptyState();
    state1.library = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];
    tracker.update(state1, 1);

    // Turn 2: Oracle drawn into hand
    const state2 = emptyState();
    state2.turn = 2;
    state2.hand = [makeGoldfishCard({ name: "Thassa's Oracle" })];
    state2.library = [makeGoldfishCard({ name: "Demonic Consultation" })];
    tracker.update(state2, 2);

    const snapshots = tracker.getSnapshots();
    const oraclePiece = snapshots[0].pieces.find(
      (p) => p.cardName === "Thassa's Oracle"
    );
    expect(oraclePiece?.zone).toBe("hand");
    expect(oraclePiece?.turnFirstAvailable).toBe(2);
  });

  test("turnFirstAvailable is set when piece first enters hand or battlefield", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "dramatic-isochron",
        name: "Dramatic Reversal + Isochron Scepter",
        cards: ["Dramatic Reversal", "Isochron Scepter"],
      },
    ]);

    // Turn 3: Isochron Scepter enters battlefield
    const state = emptyState();
    state.turn = 3;
    state.battlefield = [makeGoldfishPermanent("Isochron Scepter", "Artifact", 3)];
    state.library = [makeGoldfishCard({ name: "Dramatic Reversal" })];
    tracker.update(state, 3);

    const snapshots = tracker.getSnapshots();
    const scepterPiece = snapshots[0].pieces.find(
      (p) => p.cardName === "Isochron Scepter"
    );
    expect(scepterPiece?.zone).toBe("battlefield");
    expect(scepterPiece?.turnFirstAvailable).toBe(3);
  });

  test("turnFirstAvailable does not change once set", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "dramatic-isochron",
        name: "Dramatic Reversal + Isochron Scepter",
        cards: ["Dramatic Reversal", "Isochron Scepter"],
      },
    ]);

    // Turn 2: Dramatic Reversal in hand
    const state2 = emptyState();
    state2.turn = 2;
    state2.hand = [makeGoldfishCard({ name: "Dramatic Reversal" })];
    tracker.update(state2, 2);

    // Turn 3: Dramatic Reversal cast to graveyard (non-permanent)
    const state3 = emptyState();
    state3.turn = 3;
    state3.graveyard = [makeGoldfishCard({ name: "Dramatic Reversal" })];
    tracker.update(state3, 3);

    const snapshots = tracker.getSnapshots();
    const piece = snapshots[0].pieces.find((p) => p.cardName === "Dramatic Reversal");
    // turnFirstAvailable was set at turn 2 and should not change
    expect(piece?.turnFirstAvailable).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: Assembly detection
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker - assembly detection", () => {
  test("detects assembly when all pieces are in hand", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
    ]);

    const state = emptyState();
    state.turn = 4;
    state.hand = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];
    tracker.update(state, 4);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(true);
    expect(snapshots[0].assembledOnTurn).toBe(4);
  });

  test("detects assembly when all pieces are on battlefield", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "kiki-conscripts",
        name: "Kiki-Jiki + Zealous Conscripts",
        cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"],
      },
    ]);

    const state = emptyState();
    state.turn = 5;
    state.battlefield = [
      makeGoldfishPermanent("Kiki-Jiki, Mirror Breaker", "Creature", 3),
      makeGoldfishPermanent("Zealous Conscripts", "Creature", 4),
    ];
    tracker.update(state, 5);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(true);
    expect(snapshots[0].assembledOnTurn).toBe(5);
  });

  test("detects assembly when pieces split between hand and battlefield", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "dramatic-isochron",
        name: "Dramatic Reversal + Isochron Scepter",
        cards: ["Dramatic Reversal", "Isochron Scepter"],
      },
    ]);

    const state = emptyState();
    state.turn = 4;
    state.hand = [makeGoldfishCard({ name: "Dramatic Reversal" })];
    state.battlefield = [makeGoldfishPermanent("Isochron Scepter", "Artifact", 3)];
    tracker.update(state, 4);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(true);
    expect(snapshots[0].assembledOnTurn).toBe(4);
  });

  test("does not detect assembly when one piece is in library", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
    ]);

    const state = emptyState();
    state.turn = 4;
    state.hand = [makeGoldfishCard({ name: "Thassa's Oracle" })];
    state.library = [makeGoldfishCard({ name: "Demonic Consultation" })];
    tracker.update(state, 4);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(false);
  });

  test("assembledOnTurn captures the first turn of assembly", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
    ]);

    // Turn 3: only one piece
    const state3 = emptyState();
    state3.turn = 3;
    state3.hand = [makeGoldfishCard({ name: "Thassa's Oracle" })];
    state3.library = [makeGoldfishCard({ name: "Demonic Consultation" })];
    tracker.update(state3, 3);

    // Turn 4: both pieces available
    const state4 = emptyState();
    state4.turn = 4;
    state4.hand = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];
    tracker.update(state4, 4);

    // Turn 5: still assembled (should not change assembledOnTurn)
    const state5 = emptyState();
    state5.turn = 5;
    state5.hand = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];
    tracker.update(state5, 5);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].assembledOnTurn).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: Graveyard combos
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker - graveyard combo support", () => {
  test("detects graveyard combo assembly with zoneRequirements", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "worldgorger-animate-dead",
        name: "Worldgorger Dragon + Animate Dead",
        cards: ["Worldgorger Dragon", "Animate Dead"],
        zoneRequirements: {
          "Worldgorger Dragon": ["graveyard"],
        },
      },
    ]);

    const state = emptyState();
    state.turn = 5;
    // Dragon in graveyard (where it needs to be), Animate Dead in hand
    state.graveyard = [makeGoldfishCard({ name: "Worldgorger Dragon" })];
    state.hand = [makeGoldfishCard({ name: "Animate Dead" })];
    tracker.update(state, 5);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(true);
    expect(snapshots[0].assembledOnTurn).toBe(5);
  });

  test("does not assemble graveyard combo when required piece is in library", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "worldgorger-animate-dead",
        name: "Worldgorger Dragon + Animate Dead",
        cards: ["Worldgorger Dragon", "Animate Dead"],
        zoneRequirements: {
          "Worldgorger Dragon": ["graveyard"],
        },
      },
    ]);

    const state = emptyState();
    state.turn = 5;
    // Dragon still in library, not graveyard
    state.library = [makeGoldfishCard({ name: "Worldgorger Dragon" })];
    state.hand = [makeGoldfishCard({ name: "Animate Dead" })];
    tracker.update(state, 5);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(false);
  });

  test("does not assemble graveyard combo when piece in hand instead of graveyard", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "worldgorger-animate-dead",
        name: "Worldgorger Dragon + Animate Dead",
        cards: ["Worldgorger Dragon", "Animate Dead"],
        zoneRequirements: {
          "Worldgorger Dragon": ["graveyard"],
        },
      },
    ]);

    const state = emptyState();
    state.turn = 5;
    state.hand = [
      makeGoldfishCard({ name: "Worldgorger Dragon" }),
      makeGoldfishCard({ name: "Animate Dead" }),
    ];
    tracker.update(state, 5);

    const snapshots = tracker.getSnapshots();
    expect(snapshots[0].fullyAssembled).toBe(false);
  });

  test("graveyard piece zone is correctly reported", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "worldgorger-animate-dead",
        name: "Worldgorger Dragon + Animate Dead",
        cards: ["Worldgorger Dragon", "Animate Dead"],
        zoneRequirements: {
          "Worldgorger Dragon": ["graveyard"],
        },
      },
    ]);

    const state = emptyState();
    state.turn = 3;
    state.graveyard = [makeGoldfishCard({ name: "Worldgorger Dragon" })];
    state.library = [makeGoldfishCard({ name: "Animate Dead" })];
    tracker.update(state, 3);

    const snapshots = tracker.getSnapshots();
    const dragonPiece = snapshots[0].pieces.find(
      (p) => p.cardName === "Worldgorger Dragon"
    );
    expect(dragonPiece?.zone).toBe("graveyard");
    expect(dragonPiece?.turnFirstAvailable).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: No combos
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker - no combos", () => {
  test("returns empty snapshots array when initialized with no combos", () => {
    const tracker = new ComboAssemblyTracker([]);
    const state = emptyState();
    state.turn = 1;
    state.hand = [makeGoldfishCard({ name: "Sol Ring" })];
    tracker.update(state, 1);

    const snapshots = tracker.getSnapshots();
    expect(snapshots).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Multiple combos tracked independently
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker - multiple combos", () => {
  test("tracks two combos independently", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "thassas-oracle-consultation",
        name: "Thassa's Oracle + Demonic Consultation",
        cards: ["Thassa's Oracle", "Demonic Consultation"],
      },
      {
        id: "kiki-conscripts",
        name: "Kiki-Jiki + Zealous Conscripts",
        cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"],
      },
    ]);

    const state = emptyState();
    state.turn = 4;
    // Only first combo assembled
    state.hand = [
      makeGoldfishCard({ name: "Thassa's Oracle" }),
      makeGoldfishCard({ name: "Demonic Consultation" }),
    ];
    state.library = [
      makeGoldfishCard({ name: "Kiki-Jiki, Mirror Breaker" }),
      makeGoldfishCard({ name: "Zealous Conscripts" }),
    ];
    tracker.update(state, 4);

    const snapshots = tracker.getSnapshots();
    expect(snapshots).toHaveLength(2);

    const assembled = snapshots.find((s) => s.comboId === "thassas-oracle-consultation");
    const notAssembled = snapshots.find((s) => s.comboId === "kiki-conscripts");

    expect(assembled?.fullyAssembled).toBe(true);
    expect(notAssembled?.fullyAssembled).toBe(false);
  });

  test("assembling one combo does not affect another", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "combo-a",
        name: "Combo A",
        cards: ["Card A1", "Card A2"],
      },
      {
        id: "combo-b",
        name: "Combo B",
        cards: ["Card B1", "Card B2"],
      },
    ]);

    const state = emptyState();
    state.turn = 3;
    state.hand = [
      makeGoldfishCard({ name: "Card A1" }),
      makeGoldfishCard({ name: "Card A2" }),
    ];
    tracker.update(state, 3);

    const snapshots = tracker.getSnapshots();
    const comboA = snapshots.find((s) => s.comboId === "combo-a");
    const comboB = snapshots.find((s) => s.comboId === "combo-b");

    expect(comboA?.fullyAssembled).toBe(true);
    expect(comboA?.assembledOnTurn).toBe(3);
    expect(comboB?.fullyAssembled).toBe(false);
    expect(comboB?.assembledOnTurn).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: Static aggregateStats
// ---------------------------------------------------------------------------

test.describe("ComboAssemblyTracker.aggregateStats", () => {
  test("returns empty perCombo array when no combos", () => {
    const stats = ComboAssemblyTracker.aggregateStats([], 10);
    expect(stats.perCombo).toHaveLength(0);
  });

  test("computes assembly rate across multiple trackers", () => {
    const makeTrackerAssembled = (turn: number) => {
      const tracker = new ComboAssemblyTracker([
        {
          id: "combo-test",
          name: "Test Combo",
          cards: ["Card X", "Card Y"],
        },
      ]);
      const state = emptyState();
      state.turn = turn;
      state.hand = [
        makeGoldfishCard({ name: "Card X" }),
        makeGoldfishCard({ name: "Card Y" }),
      ];
      tracker.update(state, turn);
      return tracker;
    };

    const makeTrackerNotAssembled = () => {
      const tracker = new ComboAssemblyTracker([
        {
          id: "combo-test",
          name: "Test Combo",
          cards: ["Card X", "Card Y"],
        },
      ]);
      const state = emptyState();
      state.turn = 1;
      state.library = [
        makeGoldfishCard({ name: "Card X" }),
        makeGoldfishCard({ name: "Card Y" }),
      ];
      tracker.update(state, 1);
      return tracker;
    };

    // 2 assembled out of 4 games = 50% assembly rate
    const trackers = [
      makeTrackerAssembled(3),
      makeTrackerAssembled(5),
      makeTrackerNotAssembled(),
      makeTrackerNotAssembled(),
    ];

    const stats = ComboAssemblyTracker.aggregateStats(trackers, 10);
    expect(stats.perCombo).toHaveLength(1);
    expect(stats.perCombo[0].assemblyRate).toBeCloseTo(0.5, 2);
    expect(stats.perCombo[0].comboId).toBe("combo-test");
  });

  test("computes avgAssemblyTurn from games that assembled", () => {
    const makeTracker = (assemblyTurn: number | null) => {
      const tracker = new ComboAssemblyTracker([
        {
          id: "combo-test",
          name: "Test Combo",
          cards: ["Card X", "Card Y"],
        },
      ]);
      if (assemblyTurn !== null) {
        const state = emptyState();
        state.turn = assemblyTurn;
        state.hand = [
          makeGoldfishCard({ name: "Card X" }),
          makeGoldfishCard({ name: "Card Y" }),
        ];
        tracker.update(state, assemblyTurn);
      } else {
        const state = emptyState();
        state.turn = 1;
        state.library = [
          makeGoldfishCard({ name: "Card X" }),
          makeGoldfishCard({ name: "Card Y" }),
        ];
        tracker.update(state, 1);
      }
      return tracker;
    };

    // Assembled on T3, T5, T7 — avg should be 5
    const trackers = [
      makeTracker(3),
      makeTracker(5),
      makeTracker(7),
      makeTracker(null),
    ];

    const stats = ComboAssemblyTracker.aggregateStats(trackers, 10);
    expect(stats.perCombo[0].avgAssemblyTurn).toBeCloseTo(5, 1);
  });

  test("avgAssemblyTurn is null when combo never assembled", () => {
    const tracker = new ComboAssemblyTracker([
      {
        id: "combo-test",
        name: "Test Combo",
        cards: ["Card X", "Card Y"],
      },
    ]);
    const state = emptyState();
    state.turn = 1;
    state.library = [
      makeGoldfishCard({ name: "Card X" }),
      makeGoldfishCard({ name: "Card Y" }),
    ];
    tracker.update(state, 1);

    const stats = ComboAssemblyTracker.aggregateStats([tracker], 10);
    expect(stats.perCombo[0].avgAssemblyTurn).toBeNull();
    expect(stats.perCombo[0].assemblyRate).toBe(0);
  });

  test("assemblyByTurn is cumulative probability array of length turns", () => {
    const makeTracker = (assemblyTurn: number) => {
      const tracker = new ComboAssemblyTracker([
        { id: "combo-test", name: "Test Combo", cards: ["Card X", "Card Y"] },
      ]);
      for (let t = 1; t <= assemblyTurn; t++) {
        const state = emptyState();
        state.turn = t;
        if (t === assemblyTurn) {
          state.hand = [
            makeGoldfishCard({ name: "Card X" }),
            makeGoldfishCard({ name: "Card Y" }),
          ];
        } else {
          state.library = [
            makeGoldfishCard({ name: "Card X" }),
            makeGoldfishCard({ name: "Card Y" }),
          ];
        }
        tracker.update(state, t);
      }
      return tracker;
    };

    // 2 games assemble at T3, 2 games assemble at T5
    const trackers = [
      makeTracker(3),
      makeTracker(3),
      makeTracker(5),
      makeTracker(5),
    ];

    const stats = ComboAssemblyTracker.aggregateStats(trackers, 10);
    const { assemblyByTurn } = stats.perCombo[0];

    expect(assemblyByTurn).toHaveLength(10);
    // By T3: 2/4 = 0.5
    expect(assemblyByTurn[2]).toBeCloseTo(0.5, 2);
    // By T5: 4/4 = 1.0 (cumulative)
    expect(assemblyByTurn[4]).toBeCloseTo(1.0, 2);
    // Monotonically non-decreasing
    for (let i = 1; i < assemblyByTurn.length; i++) {
      expect(assemblyByTurn[i]).toBeGreaterThanOrEqual(assemblyByTurn[i - 1]);
    }
  });

  test("pieceStats includes draw rate for each combo piece", () => {
    const makeTracker = (drewCardX: boolean) => {
      const tracker = new ComboAssemblyTracker([
        { id: "combo-test", name: "Test Combo", cards: ["Card X", "Card Y"] },
      ]);
      const state = emptyState();
      state.turn = 3;
      state.hand = drewCardX
        ? [makeGoldfishCard({ name: "Card X" })]
        : [];
      state.library = drewCardX
        ? [makeGoldfishCard({ name: "Card Y" })]
        : [
            makeGoldfishCard({ name: "Card X" }),
            makeGoldfishCard({ name: "Card Y" }),
          ];
      tracker.update(state, 3);
      return tracker;
    };

    // Card X drawn in 3 out of 4 games
    const trackers = [
      makeTracker(true),
      makeTracker(true),
      makeTracker(true),
      makeTracker(false),
    ];

    const stats = ComboAssemblyTracker.aggregateStats(trackers, 10);
    const xPiece = stats.perCombo[0].pieceStats.find((p) => p.cardName === "Card X");
    expect(xPiece).toBeDefined();
    expect(xPiece!.drawRate).toBeCloseTo(0.75, 2);
  });
});
