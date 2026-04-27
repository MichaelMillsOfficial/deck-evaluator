import { test, expect } from "@playwright/test";
import {
  buildGraphData,
  buildHeatmapData,
} from "../../src/lib/interaction-graph-data";
import type { GraphNode, GraphEdge } from "../../src/lib/interaction-graph-data";
import type { InteractionAnalysis } from "../../src/lib/interaction-engine/types";
import type { CentralityResult } from "../../src/lib/interaction-centrality";

// ─── Factories (matching interaction-centrality.spec.ts pattern) ─────────────

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

function makeCentralityResult(
  cardNames: string[],
  scoreOverrides: Record<string, number> = {}
): CentralityResult {
  const scores = cardNames.map((name, i) => ({
    cardName: name,
    interactionCount: 0,
    weightedScore: scoreOverrides[name] ?? 1.0 - i * 0.1,
    asSource: 0,
    asTarget: 0,
    chainCount: 0,
    loopCount: 0,
    enablerOf: 0,
    rank: i + 1,
    category: (i === 0 ? "engine" : "contributor") as
      | "engine"
      | "contributor"
      | "peripheral"
      | "isolated",
  }));
  return {
    scores,
    maxScore: scores[0]?.weightedScore ?? 0,
    medianScore: scores[Math.floor(scores.length / 2)]?.weightedScore ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// buildGraphData tests
// ═══════════════════════════════════════════════════════════════

test.describe("buildGraphData", () => {
  test("empty interaction set produces empty graph", () => {
    const analysis = emptyAnalysis([]);
    const centrality = makeCentralityResult([]);
    const graph = buildGraphData(analysis, centrality);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  test("cards with no interactions produce nodes but no edges", () => {
    const analysis = emptyAnalysis(["Blood Artist", "Viscera Seer"]);
    const centrality = makeCentralityResult(["Blood Artist", "Viscera Seer"]);
    const graph = buildGraphData(analysis, centrality);
    // Only cards appearing in interactions become nodes
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  test("transforms interactions into nodes and edges", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.8),
        makeInteraction("B", "C", "triggers", 0.6),
      ],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const graph = buildGraphData(analysis, centrality);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);

    const nodeNames = graph.nodes.map((n) => n.id).sort();
    expect(nodeNames).toEqual(["A", "B", "C"]);
  });

  test("edge strength is derived from interaction strength", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "enables", 0.75)],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const graph = buildGraphData(analysis, centrality);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].strength).toBeCloseTo(0.75);
  });

  test("edge preserves interaction type and mechanical description", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Altar", "Gravecrawler"]),
      interactions: [makeInteraction("Altar", "Gravecrawler", "enables", 0.9)],
    };
    const centrality = makeCentralityResult(["Altar", "Gravecrawler"]);
    const graph = buildGraphData(analysis, centrality);

    const edge = graph.edges[0];
    expect(edge.type).toBe("enables");
    expect(edge.mechanical).toMatch(/Altar enables Gravecrawler/);
    expect(edge.source).toBe("Altar");
    expect(edge.target).toBe("Gravecrawler");
  });

  test("node centrality is populated from CentralityResult", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "enables", 0.8)],
    };
    const centrality = makeCentralityResult(["A", "B"], { A: 5.0, B: 2.0 });
    const graph = buildGraphData(analysis, centrality);

    const nodeA = graph.nodes.find((n) => n.id === "A")!;
    const nodeB = graph.nodes.find((n) => n.id === "B")!;
    expect(nodeA.centrality).toBeCloseTo(5.0);
    expect(nodeB.centrality).toBeCloseTo(2.0);
  });

  test("node category is populated from CentralityResult", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "enables", 0.8)],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const graph = buildGraphData(analysis, centrality);

    const nodeA = graph.nodes.find((n) => n.id === "A")!;
    expect(nodeA.category).toBe("engine");
  });

  test("loop participants are marked on nodes with loopCount > 0", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Altar", "Gravecrawler", "Phyrexian Altar"]),
      interactions: [],
      loops: [
        {
          cards: ["Altar", "Gravecrawler", "Phyrexian Altar"],
          description: "Infinite mill loop",
          steps: [],
          netEffect: { resources: [], attributes: [], events: [] },
          isInfinite: true,
        },
      ],
    };
    const centrality = makeCentralityResult([
      "Altar",
      "Gravecrawler",
      "Phyrexian Altar",
    ]);
    const graph = buildGraphData(analysis, centrality);

    // Loop participants become nodes even without direct interactions
    for (const name of ["Altar", "Gravecrawler", "Phyrexian Altar"]) {
      const node = graph.nodes.find((n) => n.id === name);
      expect(node).toBeDefined();
      expect(node!.loopCount).toBe(1);
    }
  });

  test("chain participants are marked on nodes with chainCount > 0", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Yawgmoth", "Young Wolf", "Blood Artist"]),
      interactions: [],
      chains: [
        {
          cards: ["Yawgmoth", "Young Wolf", "Blood Artist"],
          description: "Yawgmoth chain",
          reasoning: "death triggers",
          strength: 0.9,
          steps: [],
        },
      ],
    };
    const centrality = makeCentralityResult([
      "Yawgmoth",
      "Young Wolf",
      "Blood Artist",
    ]);
    const graph = buildGraphData(analysis, centrality);

    for (const name of ["Yawgmoth", "Young Wolf", "Blood Artist"]) {
      const node = graph.nodes.find((n) => n.id === name);
      expect(node).toBeDefined();
      expect(node!.chainCount).toBe(1);
    }
  });

  test("conflict interactions produce edges with conflict type", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Drannith Magistrate", "Aetherflux Reservoir"]),
      interactions: [
        makeInteraction(
          "Drannith Magistrate",
          "Aetherflux Reservoir",
          "conflicts",
          1.0
        ),
      ],
    };
    const centrality = makeCentralityResult([
      "Drannith Magistrate",
      "Aetherflux Reservoir",
    ]);
    const graph = buildGraphData(analysis, centrality);

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].type).toBe("conflicts");
  });

  test("node interactionCount reflects number of interactions the card appears in", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B"),
        makeInteraction("A", "C"),
        makeInteraction("B", "C"),
      ],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const graph = buildGraphData(analysis, centrality);

    const nodeA = graph.nodes.find((n) => n.id === "A")!;
    const nodeB = graph.nodes.find((n) => n.id === "B")!;
    const nodeC = graph.nodes.find((n) => n.id === "C")!;

    expect(nodeA.interactionCount).toBe(2);
    expect(nodeB.interactionCount).toBe(2);
    expect(nodeC.interactionCount).toBe(2);
  });

  test("triggers type interaction sets isConditional flag correctly", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Niv-Mizzet", "Curiosity"]),
      interactions: [makeInteraction("Niv-Mizzet", "Curiosity", "triggers", 0.9)],
    };
    const centrality = makeCentralityResult(["Niv-Mizzet", "Curiosity"]);
    const graph = buildGraphData(analysis, centrality);

    const edge = graph.edges[0];
    // triggers type → isConditional = true
    expect(edge.isConditional).toBe(true);
  });

  test("enables type interaction sets isConditional = false", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "enables", 0.8)],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const graph = buildGraphData(analysis, centrality);

    const edge = graph.edges[0];
    expect(edge.isConditional).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildHeatmapData tests
// ═══════════════════════════════════════════════════════════════

test.describe("buildHeatmapData", () => {
  test("empty interaction set produces empty heatmap", () => {
    const analysis = emptyAnalysis([]);
    const centrality = makeCentralityResult([]);
    const heatmap = buildHeatmapData(analysis, centrality);
    expect(heatmap.cardNames).toHaveLength(0);
    expect(heatmap.matrix).toHaveLength(0);
    expect(heatmap.maxStrength).toBe(0);
  });

  test("heatmap matrix dimensions match cardNames length (NxN)", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.8),
        makeInteraction("B", "C", "triggers", 0.6),
      ],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    const N = heatmap.cardNames.length;
    expect(heatmap.matrix).toHaveLength(N);
    for (const row of heatmap.matrix) {
      expect(row).toHaveLength(N);
    }
  });

  test("heatmap matrix is symmetric", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.8),
        makeInteraction("B", "C", "triggers", 0.6),
      ],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    const N = heatmap.cardNames.length;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        expect(heatmap.matrix[i][j]).toBeCloseTo(heatmap.matrix[j][i]);
      }
    }
  });

  test("diagonal cells are 0 (no self-interaction)", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "enables", 0.8)],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    for (let i = 0; i < heatmap.cardNames.length; i++) {
      expect(heatmap.matrix[i][i]).toBe(0);
    }
  });

  test("cell value equals sum of interaction strengths between pair", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.5),
        makeInteraction("A", "B", "triggers", 0.3),
      ],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    const idxA = heatmap.cardNames.indexOf("A");
    const idxB = heatmap.cardNames.indexOf("B");
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    // Sum of strengths: 0.5 + 0.3 = 0.8
    expect(heatmap.matrix[idxA][idxB]).toBeCloseTo(0.8);
    expect(heatmap.matrix[idxB][idxA]).toBeCloseTo(0.8);
  });

  test("maxStrength reflects the highest cell value in the matrix", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [
        makeInteraction("A", "B", "enables", 0.9),
        makeInteraction("B", "C", "triggers", 0.3),
      ],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    expect(heatmap.maxStrength).toBeCloseTo(0.9);
  });

  test("cards are sorted by centrality rank in cardNames", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["Low", "High", "Mid"]),
      interactions: [
        makeInteraction("Low", "High"),
        makeInteraction("Mid", "High"),
      ],
    };
    // Centrality ranks: High=1, Mid=2, Low=3
    const centrality = makeCentralityResult(["High", "Mid", "Low"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    // First card should be the highest-centrality card that appears in interactions
    expect(heatmap.cardNames[0]).toBe("High");
  });

  test("typeMatrix tracks dominant interaction type for each cell", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B"]),
      interactions: [makeInteraction("A", "B", "loops_with", 1.0)],
    };
    const centrality = makeCentralityResult(["A", "B"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    const idxA = heatmap.cardNames.indexOf("A");
    const idxB = heatmap.cardNames.indexOf("B");
    expect(heatmap.typeMatrix[idxA][idxB]).toBe("loops_with");
    expect(heatmap.typeMatrix[idxB][idxA]).toBe("loops_with");
  });

  test("cells with no interactions have null typeMatrix entries", () => {
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(["A", "B", "C"]),
      interactions: [makeInteraction("A", "B", "enables", 0.8)],
    };
    const centrality = makeCentralityResult(["A", "B", "C"]);
    const heatmap = buildHeatmapData(analysis, centrality);

    const idxA = heatmap.cardNames.indexOf("A");
    const idxC = heatmap.cardNames.indexOf("C");
    // A and C have no interaction
    if (idxA >= 0 && idxC >= 0) {
      expect(heatmap.typeMatrix[idxA][idxC]).toBeNull();
    }
  });

  test("heatmap limited to top 30 cards by default when more than 30 exist", () => {
    const cardNames = Array.from({ length: 40 }, (_, i) => `Card${i}`);
    const analysis: InteractionAnalysis = {
      ...emptyAnalysis(cardNames),
      interactions: cardNames.slice(0, 39).map((card, i) =>
        makeInteraction(card, cardNames[i + 1], "enables", 0.5)
      ),
    };
    const centrality = makeCentralityResult(cardNames);
    const heatmap = buildHeatmapData(analysis, centrality);

    expect(heatmap.cardNames.length).toBeLessThanOrEqual(30);
  });
});
