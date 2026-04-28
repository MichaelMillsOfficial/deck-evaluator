import { test, expect } from "@playwright/test";
import {
  detectMilestones,
  captureSnapshotsAtTurns,
  type BoardMilestone,
} from "../../src/lib/goldfish-milestones";
import type { GoldfishGameLog, GoldfishTurnLog } from "../../src/lib/goldfish-simulator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTurnLog(overrides: Partial<GoldfishTurnLog> = {}): GoldfishTurnLog {
  return {
    turn: 1,
    cardsDrawn: [],
    landPlayed: null,
    spellsCast: [],
    manaAvailable: 0,
    manaFromLandsOnly: 0,
    manaUsed: 0,
    handSize: 7,
    hand: [],
    permanentCount: 0,
    permanents: [],
    commanderCast: false,
    libraryActions: [],
    graveyard: [],
    exile: [],
    ...overrides,
  };
}

function makeGameLog(turnLogs: GoldfishTurnLog[], commanderFirstCastTurn: number | null = null): GoldfishGameLog {
  return {
    turnLogs,
    commanderFirstCastTurn,
    openingHand: {
      cards: [],
      score: 0,
      verdict: "keep",
      reasoning: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: detectMilestones
// ---------------------------------------------------------------------------

test.describe("detectMilestones", () => {
  test("returns empty array for empty game logs", () => {
    const milestones = detectMilestones([]);
    expect(milestones).toHaveLength(0);
  });

  test("returns empty array when no spells ever cast", () => {
    const log1 = makeGameLog([
      makeTurnLog({ turn: 1, spellsCast: [] }),
      makeTurnLog({ turn: 2, spellsCast: [] }),
      makeTurnLog({ turn: 3, spellsCast: [] }),
    ]);
    const milestones = detectMilestones([log1]);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell).toBeUndefined();
  });

  test("detects first spell cast turn", () => {
    const log1 = makeGameLog([
      makeTurnLog({ turn: 1, spellsCast: [] }),
      makeTurnLog({ turn: 2, spellsCast: ["Sol Ring"] }),
      makeTurnLog({ turn: 3, spellsCast: ["Command Tower"] }),
    ]);
    const milestones = detectMilestones([log1]);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell).toBeDefined();
    expect(firstSpell!.turn).toBe(2);
  });

  test("first spell milestone uses median turn across games", () => {
    // Game 1: first spell T1, Game 2: first spell T3, Game 3: first spell T5
    const games = [
      makeGameLog([
        makeTurnLog({ turn: 1, spellsCast: ["Sol Ring"] }),
        makeTurnLog({ turn: 2, spellsCast: [] }),
      ]),
      makeGameLog([
        makeTurnLog({ turn: 1, spellsCast: [] }),
        makeTurnLog({ turn: 2, spellsCast: [] }),
        makeTurnLog({ turn: 3, spellsCast: ["Cultivate"] }),
      ]),
      makeGameLog([
        makeTurnLog({ turn: 1, spellsCast: [] }),
        makeTurnLog({ turn: 2, spellsCast: [] }),
        makeTurnLog({ turn: 3, spellsCast: [] }),
        makeTurnLog({ turn: 4, spellsCast: [] }),
        makeTurnLog({ turn: 5, spellsCast: ["Swords to Plowshares"] }),
      ]),
    ];

    const milestones = detectMilestones(games);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell).toBeDefined();
    // Median of [1, 3, 5] = 3
    expect(firstSpell!.turn).toBe(3);
  });

  test("detects commander first cast milestone", () => {
    const log1 = makeGameLog(
      [
        makeTurnLog({ turn: 1, spellsCast: [], commanderCast: false }),
        makeTurnLog({ turn: 2, spellsCast: [], commanderCast: false }),
        makeTurnLog({ turn: 3, spellsCast: ["Commander Name"], commanderCast: true }),
      ],
      3
    );
    const milestones = detectMilestones([log1]);
    const cmdMilestone = milestones.find((m) => m.type === "commander_cast");
    expect(cmdMilestone).toBeDefined();
    expect(cmdMilestone!.turn).toBe(3);
  });

  test("commander_cast milestone not generated when no games cast commander", () => {
    const log1 = makeGameLog([
      makeTurnLog({ turn: 1, commanderCast: false }),
      makeTurnLog({ turn: 2, commanderCast: false }),
    ], null);
    const milestones = detectMilestones([log1]);
    const cmdMilestone = milestones.find((m) => m.type === "commander_cast");
    expect(cmdMilestone).toBeUndefined();
  });

  test("critical_mass milestone detected when permanentCount >= 7", () => {
    const log1 = makeGameLog([
      makeTurnLog({ turn: 1, permanentCount: 2 }),
      makeTurnLog({ turn: 2, permanentCount: 4 }),
      makeTurnLog({ turn: 3, permanentCount: 7 }),
    ]);
    const milestones = detectMilestones([log1]);
    const critMilestone = milestones.find((m) => m.type === "critical_mass");
    expect(critMilestone).toBeDefined();
    expect(critMilestone!.turn).toBe(3);
  });

  test("milestone includes board state snapshot data", () => {
    const log1 = makeGameLog([
      makeTurnLog({
        turn: 2,
        spellsCast: ["Sol Ring"],
        manaAvailable: 3,
        permanentCount: 2,
        permanents: [
          { name: "Forest", category: "land", tapped: false, enteredTurn: 1 },
          { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 2 },
        ],
      }),
    ]);
    const milestones = detectMilestones([log1]);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell).toBeDefined();
    expect(firstSpell!.permanentCount).toBeGreaterThanOrEqual(0);
    expect(firstSpell!.manaAvailable).toBeGreaterThanOrEqual(0);
    expect(firstSpell!.landCount).toBeGreaterThanOrEqual(0);
    expect(firstSpell!.creatureCount).toBeGreaterThanOrEqual(0);
  });

  test("milestone has description string", () => {
    const log1 = makeGameLog([
      makeTurnLog({ turn: 1, spellsCast: ["Lightning Bolt"] }),
    ]);
    const milestones = detectMilestones([log1]);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell?.description).toBeTruthy();
    expect(typeof firstSpell?.description).toBe("string");
  });

  test("milestone topPermanents lists most common permanents across simulations", () => {
    const games = [
      makeGameLog([
        makeTurnLog({
          turn: 2,
          spellsCast: ["Sol Ring"],
          permanents: [
            { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 2 },
            { name: "Forest", category: "land", tapped: false, enteredTurn: 1 },
          ],
        }),
      ]),
      makeGameLog([
        makeTurnLog({
          turn: 2,
          spellsCast: ["Sol Ring"],
          permanents: [
            { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 2 },
            { name: "Island", category: "land", tapped: false, enteredTurn: 1 },
          ],
        }),
      ]),
    ];

    const milestones = detectMilestones(games);
    const firstSpell = milestones.find((m) => m.type === "first_spell");
    expect(firstSpell).toBeDefined();
    // Sol Ring appears in both games
    const solRing = firstSpell!.topPermanents.find((p) => p.name === "Sol Ring");
    expect(solRing).toBeDefined();
    expect(solRing!.frequency).toBe(1.0); // 100% of games
  });
});

// ---------------------------------------------------------------------------
// Tests: captureSnapshotsAtTurns
// ---------------------------------------------------------------------------

test.describe("captureSnapshotsAtTurns", () => {
  test("captures snapshots at T3, T5, T8", () => {
    const turnLogs: GoldfishTurnLog[] = [];
    for (let t = 1; t <= 10; t++) {
      turnLogs.push(makeTurnLog({
        turn: t,
        manaAvailable: t,
        permanentCount: t,
        permanents: [
          { name: "Forest", category: "land", tapped: false, enteredTurn: t },
        ],
      }));
    }
    const log = makeGameLog(turnLogs);

    const snapshots = captureSnapshotsAtTurns([log], [3, 5, 8]);
    const turns = snapshots.map((s) => s.turn);
    expect(turns).toContain(3);
    expect(turns).toContain(5);
    expect(turns).toContain(8);
  });

  test("returns empty array for empty game logs", () => {
    const snapshots = captureSnapshotsAtTurns([], [3, 5, 8]);
    expect(snapshots).toHaveLength(0);
  });

  test("skips turns that don't exist in logs", () => {
    // Only 3 turns of data
    const log = makeGameLog([
      makeTurnLog({ turn: 1 }),
      makeTurnLog({ turn: 2 }),
      makeTurnLog({ turn: 3 }),
    ]);

    // Requesting T3, T5, T8 — only T3 should be returned
    const snapshots = captureSnapshotsAtTurns([log], [3, 5, 8]);
    expect(snapshots.map((s) => s.turn)).toContain(3);
    expect(snapshots.map((s) => s.turn)).not.toContain(8);
  });

  test("snapshot type is 'snapshot' for turn snapshots", () => {
    const log = makeGameLog([
      makeTurnLog({ turn: 5, permanentCount: 4 }),
    ]);
    const snapshots = captureSnapshotsAtTurns([log], [5]);
    expect(snapshots[0].type).toBe("snapshot");
  });

  test("snapshot aggregates data across multiple games at same turn", () => {
    const game1 = makeGameLog([
      makeTurnLog({
        turn: 3,
        manaAvailable: 4,
        permanentCount: 3,
        permanents: [
          { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 2 },
        ],
      }),
    ]);
    const game2 = makeGameLog([
      makeTurnLog({
        turn: 3,
        manaAvailable: 6,
        permanentCount: 5,
        permanents: [
          { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 2 },
          { name: "Mana Crypt", category: "artifact", tapped: false, enteredTurn: 1 },
        ],
      }),
    ]);

    const snapshots = captureSnapshotsAtTurns([game1, game2], [3]);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].turn).toBe(3);
    // Avg permanentCount = (3 + 5) / 2 = 4
    expect(snapshots[0].permanentCount).toBeCloseTo(4, 0);
    // Avg manaAvailable = (4 + 6) / 2 = 5
    expect(snapshots[0].manaAvailable).toBeCloseTo(5, 0);
  });

  test("land count and creature count computed from permanents snapshot", () => {
    const log = makeGameLog([
      makeTurnLog({
        turn: 5,
        permanentCount: 4,
        permanents: [
          { name: "Forest", category: "land", tapped: false, enteredTurn: 1 },
          { name: "Mountain", category: "land", tapped: false, enteredTurn: 2 },
          { name: "Goblin Token", category: "creature", tapped: false, enteredTurn: 5 },
          { name: "Sol Ring", category: "artifact", tapped: false, enteredTurn: 3 },
        ],
      }),
    ]);

    const snapshots = captureSnapshotsAtTurns([log], [5]);
    expect(snapshots[0].landCount).toBe(2);
    expect(snapshots[0].creatureCount).toBe(1);
  });
});
