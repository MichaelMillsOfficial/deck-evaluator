import { test, expect } from "@playwright/test";
import {
  computeRemovalImpact,
  computeAllRemovalImpacts,
} from "../../src/lib/interaction-removal-impact";
import type { InteractionAnalysis } from "../../src/lib/interaction-engine/types";

// ─── Minimal helpers ───────────────────────────────────────────

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

function makeInteraction(a: string, b: string, type: "enables" | "triggers" | "blocks" = "enables") {
  return {
    cards: [a, b] as [string, string],
    type,
    strength: 0.8,
    mechanical: `${a} ${type} ${b}`,
    events: [],
  };
}

function profiles(...names: string[]) {
  const result: InteractionAnalysis["profiles"] = {};
  for (const name of names) result[name] = makeProfile(name);
  return result;
}

function emptyAnalysis(...cardNames: string[]): InteractionAnalysis {
  return {
    profiles: profiles(...cardNames),
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

test.describe("computeRemovalImpact", () => {
  test("card with 3 interactions → 3 interactionsLost", () => {
    const cardA = "Blood Artist";
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(cardA, "B", "C", "D"),
      interactions: [
        makeInteraction(cardA, "B"),
        makeInteraction(cardA, "C"),
        makeInteraction("D", cardA),
      ],
    };
    const impact = computeRemovalImpact(cardA, analysis);
    expect(impact.removedCard).toBe(cardA);
    expect(impact.interactionsLost).toHaveLength(3);
  });

  test("blocker card → populates interactionsUnblocked", () => {
    const blockerCard = "Drannith Magistrate";
    const blockedInteraction = makeInteraction("A", "B", "enables");
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(blockerCard, "A", "B"),
      interactions: [blockedInteraction],
      blockers: [
        {
          blocker: blockerCard,
          mechanism: {
            abilityType: "replacement",
            replaces: { kind: "player_action", action: "cast_spell" },
            with: [],
            mode: "replace",
          },
          mechanismType: "replacement",
          blockedEvents: [],
          blockedInteractions: [blockedInteraction],
          description: `${blockerCard} blocks opponent's spells`,
        },
      ],
    };
    const impact = computeRemovalImpact(blockerCard, analysis);
    expect(impact.interactionsUnblocked).toHaveLength(1);
    expect(impact.interactionsUnblocked[0]).toBe(blockedInteraction);
  });

  test("card in 2 chains → 2 chainsDisrupted", () => {
    const cardA = "Yawgmoth, Thran Physician";
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(cardA, "B", "C", "D"),
      chains: [
        {
          cards: [cardA, "B", "C"],
          description: "Chain 1",
          reasoning: "...",
          strength: 0.9,
          steps: [],
        },
        {
          cards: ["D", cardA, "B"],
          description: "Chain 2",
          reasoning: "...",
          strength: 0.8,
          steps: [],
        },
      ],
    };
    const impact = computeRemovalImpact(cardA, analysis);
    expect(impact.chainsDisrupted).toHaveLength(2);
  });

  test("card in 1 loop → 1 loopsDisrupted", () => {
    const cardA = "Gravecrawler";
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(cardA, "Phyrexian Altar", "Diregraf Colossus"),
      loops: [
        {
          cards: [cardA, "Phyrexian Altar", "Diregraf Colossus"],
          description: "Gravecrawler infinite loop",
          steps: [],
          netEffect: { resources: [], attributes: [], events: [] },
          isInfinite: true,
        },
      ],
    };
    const impact = computeRemovalImpact(cardA, analysis);
    expect(impact.loopsDisrupted).toHaveLength(1);
    expect(impact.loopsDisrupted[0].cards).toContain(cardA);
  });

  test("no interactions → all arrays empty", () => {
    const analysis = emptyAnalysis("Llanowar Elves", "Forest");
    const impact = computeRemovalImpact("Llanowar Elves", analysis);
    expect(impact.interactionsLost).toHaveLength(0);
    expect(impact.interactionsUnblocked).toHaveLength(0);
    expect(impact.chainsDisrupted).toHaveLength(0);
    expect(impact.loopsDisrupted).toHaveLength(0);
  });

  test("description format matches expected pattern", () => {
    const cardA = "Blood Artist";
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(cardA, "B", "C"),
      interactions: [
        makeInteraction(cardA, "B"),
        makeInteraction(cardA, "C"),
      ],
      chains: [
        {
          cards: [cardA, "B"],
          description: "...",
          reasoning: "...",
          strength: 0.9,
          steps: [],
        },
      ],
    };
    const impact = computeRemovalImpact(cardA, analysis);
    expect(impact.description).toContain(cardA);
    expect(impact.description).toContain("2 interactions");
    expect(impact.description).toContain("1 chain");
  });

  test("card not in chains/loops → empty chain and loop arrays", () => {
    const outsiderCard = "Plains";
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(outsiderCard, "A", "B"),
      chains: [
        {
          cards: ["A", "B"],
          description: "...",
          reasoning: "...",
          strength: 0.8,
          steps: [],
        },
      ],
      loops: [
        {
          cards: ["A", "B"],
          description: "...",
          steps: [],
          netEffect: { resources: [], attributes: [], events: [] },
          isInfinite: false,
        },
      ],
    };
    const impact = computeRemovalImpact(outsiderCard, analysis);
    expect(impact.chainsDisrupted).toHaveLength(0);
    expect(impact.loopsDisrupted).toHaveLength(0);
  });
});

test.describe("computeAllRemovalImpacts", () => {
  test("covers every profiled card", () => {
    const cardNames = ["Alpha", "Beta", "Gamma", "Delta"];
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(...cardNames),
      interactions: [
        makeInteraction("Alpha", "Beta"),
        makeInteraction("Gamma", "Delta"),
      ],
    };
    const impacts = computeAllRemovalImpacts(analysis);
    expect(impacts.size).toBe(cardNames.length);
    for (const name of cardNames) {
      expect(impacts.has(name)).toBe(true);
    }
  });

  test("description says no interactions for isolated cards", () => {
    const analysis = emptyAnalysis("IsolatedCard");
    const impacts = computeAllRemovalImpacts(analysis);
    const impact = impacts.get("IsolatedCard")!;
    expect(impact.description).toContain("no interactions");
  });
});
