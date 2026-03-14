import { test, expect } from "@playwright/test";
import {
  computeCentrality,
  categorizeCentrality,
} from "../../src/lib/interaction-centrality";
import type { InteractionAnalysis } from "../../src/lib/interaction-engine/types";

// ─── Minimal profile factory ───────────────────────────────────

function makeProfile(cardName: string) {
  return {
    cardName,
    cardTypes: ["creature" as const],
    supertypes: [],
    subtypes: [],
    abilities: [],
    layout: "normal" as const,
    produces: [],
    consumes: [],
    triggersOn: [],
    causesEvents: [],
    grants: [],
    replacements: [],
    linkedEffects: [],
    requires: [],
    staticEffects: [],
    restrictions: [],
    copies: [],
    zoneCastPermissions: [],
    speeds: [],
    zoneAbilities: [],
    designations: [],
    typeChanges: [],
    winConditions: [],
    costSubstitutions: [],
    extraTurns: [],
    playerControl: [],
  };
}

function makeInteraction(
  a: string,
  b: string,
  type: "enables" | "triggers" | "loops_with" | "conflicts" | "recurs" = "enables",
  strength = 0.8
) {
  return {
    cards: [a, b] as [string, string],
    type,
    strength,
    mechanical: `${a} ${type} ${b}`,
    events: [],
  };
}

function emptyAnalysis(cardNames: string[]): InteractionAnalysis {
  const profiles: InteractionAnalysis["profiles"] = {};
  for (const name of cardNames) {
    profiles[name] = makeProfile(name);
  }
  return {
    profiles,
    interactions: [],
    chains: [],
    loops: [],
    blockers: [],
    enablers: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("computeCentrality", () => {
  test("empty analysis returns empty scores", () => {
    const analysis = emptyAnalysis([]);
    const result = computeCentrality(analysis);
    expect(result.scores).toHaveLength(0);
    expect(result.maxScore).toBe(0);
    expect(result.medianScore).toBe(0);
  });

  test("zero interactions → all cards are isolated", () => {
    const analysis = emptyAnalysis(["Blood Artist", "Viscera Seer", "Zulaport Cutthroat"]);
    const result = computeCentrality(analysis);
    expect(result.scores).toHaveLength(3);
    for (const score of result.scores) {
      expect(score.weightedScore).toBe(0);
      expect(score.category).toBe("isolated");
    }
  });

  test("card in 5 interactions scores higher than card in 2", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C", "D", "E", "F"]),
      interactions: [
        makeInteraction("A", "B"),
        makeInteraction("A", "C"),
        makeInteraction("A", "D"),
        makeInteraction("A", "E"),
        makeInteraction("A", "F"),
        makeInteraction("B", "C"),
        makeInteraction("B", "D"),
      ],
    };
    const result = computeCentrality(analysis);
    const scoreA = result.scores.find((s) => s.cardName === "A")!;
    const scoreB = result.scores.find((s) => s.cardName === "B")!;
    expect(scoreA.weightedScore).toBeGreaterThan(scoreB.weightedScore);
    expect(scoreA.rank).toBeLessThan(scoreB.rank);
  });

  test("loop bonus applied correctly", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Altar of Dementia", "Gravecrawler", "Phyrexian Altar"]),
      interactions: [],
      loops: [
        {
          cards: ["Altar of Dementia", "Gravecrawler", "Phyrexian Altar"],
          description: "Infinite mill loop",
          steps: [],
          netEffect: { resources: [], attributes: [], events: [] },
          isInfinite: true,
        },
      ],
    };
    const result = computeCentrality(analysis);
    for (const score of result.scores) {
      // Each card in the loop should get LOOP_BONUS = 5.0
      expect(score.weightedScore).toBe(5.0);
      expect(score.loopCount).toBe(1);
    }
  });

  test("chain bonus applied correctly", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Yawgmoth", "Young Wolf", "Blood Artist"]),
      interactions: [],
      chains: [
        {
          cards: ["Yawgmoth", "Young Wolf", "Blood Artist"],
          description: "Yawgmoth chain",
          reasoning: "Each creature death triggers Blood Artist",
          strength: 0.9,
          steps: [],
        },
      ],
    };
    const result = computeCentrality(analysis);
    for (const score of result.scores) {
      // Each card in the chain should get CHAIN_BONUS = 2.0
      expect(score.weightedScore).toBe(2.0);
      expect(score.chainCount).toBe(1);
    }
  });

  test("enabler bonus applied correctly", () => {
    const enabledInteractions = [
      makeInteraction("A", "B"),
      makeInteraction("A", "C"),
      makeInteraction("A", "D"),
    ];
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Ashnod's Altar", "A", "B", "C", "D"]),
      interactions: enabledInteractions,
      enablers: [
        {
          enabler: "Ashnod's Altar",
          enabledInteractions,
          isRequired: true,
        },
      ],
    };
    const result = computeCentrality(analysis);
    const altarScore = result.scores.find(
      (s) => s.cardName === "Ashnod's Altar"
    )!;
    // 3 enabled interactions × ENABLER_BONUS (1.5) = 4.5
    expect(altarScore.enablerOf).toBe(3);
    expect(altarScore.weightedScore).toBeCloseTo(4.5);
  });

  test("ranks are 1-indexed and unique", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.9),
        makeInteraction("B", "C", "triggers", 0.5),
      ],
    };
    const result = computeCentrality(analysis);
    const ranks = result.scores.map((s) => s.rank);
    expect(ranks[0]).toBe(1);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(result.scores.length);
  });

  test("maxScore and medianScore are computed correctly", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 1.0), // weight 0.9 → score 0.9 for A and B
        makeInteraction("A", "C", "triggers", 1.0), // weight 0.8 → score 0.8 for A and C
      ],
    };
    const result = computeCentrality(analysis);
    // A: 0.9 + 0.8 = 1.7, B: 0.9, C: 0.8
    // maxScore = 1.7
    // sorted scores: [1.7, 0.9, 0.8] → median = 0.9
    expect(result.maxScore).toBeCloseTo(1.7);
    expect(result.medianScore).toBeCloseTo(0.9);
  });

  test("conflict interactions produce negative weight contribution", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Drannith Magistrate", "Aetherflux Reservoir"]),
      interactions: [
        makeInteraction("Drannith Magistrate", "Aetherflux Reservoir", "conflicts", 1.0),
      ],
    };
    const result = computeCentrality(analysis);
    // conflicts weight = -0.5; strength 1.0 → contribution = -0.5 per card
    for (const score of result.scores) {
      expect(score.weightedScore).toBeCloseTo(-0.5);
    }
  });
});

test.describe("categorizeCentrality", () => {
  test("returns 'engine' for scores >= 60% of max", () => {
    expect(categorizeCentrality(6, 10, 4)).toBe("engine");
    expect(categorizeCentrality(10, 10, 4)).toBe("engine");
  });

  test("returns 'contributor' for scores >= median but < 60% of max", () => {
    expect(categorizeCentrality(4, 10, 4)).toBe("contributor");
    expect(categorizeCentrality(5, 10, 4)).toBe("contributor");
    expect(categorizeCentrality(5.9, 10, 4)).toBe("contributor");
  });

  test("returns 'peripheral' for scores > 0 but below median", () => {
    expect(categorizeCentrality(1, 10, 4)).toBe("peripheral");
    expect(categorizeCentrality(3.9, 10, 4)).toBe("peripheral");
  });

  test("returns 'isolated' for score of exactly 0", () => {
    expect(categorizeCentrality(0, 10, 4)).toBe("isolated");
    expect(categorizeCentrality(0, 0, 0)).toBe("isolated");
  });

  test("returns 'isolated' for negative scores (conflict-only cards)", () => {
    expect(categorizeCentrality(-0.5, 10, 4)).toBe("isolated");
    expect(categorizeCentrality(-3, 5, 2)).toBe("isolated");
  });
});
