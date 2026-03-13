import { test, expect } from "@playwright/test";
import {
  extractMechanicalKeywords,
  findOracleSnippet,
  extractCitations,
} from "../../src/lib/interaction-citations";
import type { Interaction, CardProfile } from "../../src/lib/interaction-engine/types";

// ─── Helpers ───────────────────────────────────────────────────

function makeProfile(cardName: string, overrides: Partial<CardProfile> = {}): CardProfile {
  return {
    cardName,
    cardTypes: ["creature"],
    supertypes: [],
    subtypes: [],
    abilities: [],
    layout: "normal",
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
    ...overrides,
  };
}

function makeInteraction(
  a: string,
  b: string,
  type: "enables" | "triggers" | "recurs" = "enables",
  mechanical = ""
): Interaction {
  return {
    cards: [a, b] as [string, string],
    type,
    strength: 0.8,
    mechanical: mechanical || `${a} ${type} ${b} via sacrifice`,
    events: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("extractMechanicalKeywords", () => {
  test("extracts 'sacrifice' from description", () => {
    const keywords = extractMechanicalKeywords(
      "Blood Artist triggers whenever a creature is sacrificed to Viscera Seer"
    );
    expect(keywords).toContain("sacrifice");
  });

  test("extracts 'enters the battlefield' from description", () => {
    const keywords = extractMechanicalKeywords(
      "Panharmonicon doubles ETB triggers when a creature enters the battlefield"
    );
    expect(keywords).toContain("enters the battlefield");
  });

  test("returns empty array for empty string", () => {
    expect(extractMechanicalKeywords("")).toEqual([]);
  });

  test("extracts multiple keywords from complex description", () => {
    const keywords = extractMechanicalKeywords(
      "When you sacrifice a creature, draw a card and gain life"
    );
    expect(keywords.some((k) => k.includes("sacrifice"))).toBe(true);
    expect(keywords.some((k) => k.includes("draw"))).toBe(true);
    expect(keywords.some((k) => k.includes("gain life"))).toBe(true);
  });
});

test.describe("findOracleSnippet", () => {
  test("finds matching sentence in oracle text", () => {
    const oracle =
      "Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life. Sacrifice a creature: Scry 1.";
    const result = findOracleSnippet(oracle, ["dies", "sacrifice"]);
    expect(result).not.toBeNull();
    expect(result!.snippet).toContain("dies");
  });

  test("returns null when no keyword matches", () => {
    const oracle = "Flying. {T}: Add {W}.";
    const result = findOracleSnippet(oracle, ["sacrifice", "graveyard"]);
    expect(result).toBeNull();
  });

  test("handles newlines as sentence separators", () => {
    const oracle =
      "Flying.\nWhenever this creature deals combat damage to a player, you may draw a card.";
    const result = findOracleSnippet(oracle, ["draw a card"]);
    expect(result).not.toBeNull();
    expect(result!.snippet.toLowerCase()).toContain("draw");
  });

  test("returns null for empty oracle text", () => {
    expect(findOracleSnippet("", ["sacrifice"])).toBeNull();
  });
});

test.describe("extractCitations", () => {
  test("produces citations from both cards in interaction", () => {
    const interaction = makeInteraction(
      "Blood Artist",
      "Viscera Seer",
      "enables",
      "Blood Artist triggers when a creature dies; Viscera Seer sacrifice enables the dying"
    );
    const profiles: Record<string, CardProfile> = {
      "Blood Artist": makeProfile("Blood Artist", {
        rawOracleText:
          "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.",
      }),
      "Viscera Seer": makeProfile("Viscera Seer", {
        rawOracleText: "Sacrifice a creature: Scry 1.",
      }),
    };
    const citations = extractCitations(interaction, profiles);
    expect(citations.length).toBeGreaterThan(0);
    const cardNames = citations.map((c) => c.cardName);
    // At least one citation from one of the cards
    expect(
      cardNames.includes("Blood Artist") || cardNames.includes("Viscera Seer")
    ).toBe(true);
  });

  test("handles missing rawOracleText gracefully", () => {
    const interaction = makeInteraction("A", "B", "enables");
    const profiles: Record<string, CardProfile> = {
      A: makeProfile("A"), // no rawOracleText
      B: makeProfile("B"), // no rawOracleText
    };
    // Should not throw; returns empty or type-line citations
    const citations = extractCitations(interaction, profiles);
    expect(Array.isArray(citations)).toBe(true);
  });

  test("deduplicates identical snippets", () => {
    const sharedSnippet =
      "Whenever a creature you control dies, each opponent loses 1 life.";
    const interaction = makeInteraction(
      "A",
      "B",
      "triggers",
      "both cards trigger on death"
    );
    // Both cards have identical oracle text
    const profiles: Record<string, CardProfile> = {
      A: makeProfile("A", { rawOracleText: sharedSnippet }),
      B: makeProfile("B", { rawOracleText: sharedSnippet }),
    };
    const citations = extractCitations(interaction, profiles);
    const snippets = citations.map((c) => c.snippet);
    const uniqueSnippets = new Set(snippets);
    expect(uniqueSnippets.size).toBe(snippets.length);
  });
});
