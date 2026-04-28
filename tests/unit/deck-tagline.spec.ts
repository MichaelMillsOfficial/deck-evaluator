import { test, expect } from "@playwright/test";
import type { DeckData } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import type { DeckTheme, SynergyPair } from "@/lib/types";
import { deckTagline } from "@/lib/deck-tagline";

// ---------------------------------------------------------------------------
// Helpers — minimal DeckAnalysisResults stubs for tagline branches
// ---------------------------------------------------------------------------

function makeAnalysis(partial: {
  themes?: DeckTheme[];
  powerLevel?: number;
  knownCombos?: SynergyPair[];
}): DeckAnalysisResults {
  return {
    manaCurve: [],
    colorDistribution: {} as DeckAnalysisResults["colorDistribution"],
    manaBaseMetrics: {} as DeckAnalysisResults["manaBaseMetrics"],
    commanderIdentity: new Set() as DeckAnalysisResults["commanderIdentity"],
    landEfficiency: {} as DeckAnalysisResults["landEfficiency"],
    manaRecommendations: {} as DeckAnalysisResults["manaRecommendations"],
    powerLevel: {
      powerLevel: partial.powerLevel ?? 5,
    } as DeckAnalysisResults["powerLevel"],
    bracketResult: {} as DeckAnalysisResults["bracketResult"],
    budgetAnalysis: {} as DeckAnalysisResults["budgetAnalysis"],
    synergyAnalysis: {
      cardScores: {},
      topSynergies: [],
      antiSynergies: [],
      knownCombos: partial.knownCombos ?? [],
      deckThemes: partial.themes ?? [],
    },
    compositionScorecard: {} as DeckAnalysisResults["compositionScorecard"],
    creatureTypes: [],
    supertypes: [],
    simulationStats: {} as DeckAnalysisResults["simulationStats"],
  };
}

const EMPTY_DECK: DeckData = {
  name: "Test Deck",
  source: "text",
  url: "",
  commanders: [],
  mainboard: [],
  sideboard: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("deckTagline", () => {
  test("never returns an empty string", () => {
    const tagline = deckTagline(EMPTY_DECK, makeAnalysis({}));
    expect(tagline.length).toBeGreaterThan(0);
  });

  test("always ends with a sentence-final punctuation", () => {
    const tagline = deckTagline(EMPTY_DECK, makeAnalysis({}));
    expect(tagline).toMatch(/[.!?]$/);
  });

  test("landfall theme produces a landfall tagline", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          { axisId: "landfall", axisName: "Landfall", strength: 0.8, cardCount: 12 },
        ],
        powerLevel: 7,
      })
    );
    expect(tagline.toLowerCase()).toContain("landfall");
  });

  test("tribal theme includes the tribe name when provided", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          {
            axisId: "tribal",
            axisName: "Tribal",
            strength: 0.7,
            cardCount: 18,
            detail: "Elf",
          },
        ],
      })
    );
    expect(tagline.toLowerCase()).toContain("elf");
    expect(tagline.toLowerCase()).toContain("tribal");
  });

  test("tokens theme produces a go-wide tagline", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          { axisId: "tokens", axisName: "Tokens", strength: 0.6, cardCount: 14 },
        ],
      })
    );
    expect(tagline.toLowerCase()).toMatch(/token|go-wide|swarm/);
  });

  test("graveyard theme produces a graveyard tagline", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          { axisId: "graveyard", axisName: "Graveyard", strength: 0.7, cardCount: 16 },
        ],
      })
    );
    expect(tagline.toLowerCase()).toMatch(/graveyard|recur|reanimat/);
  });

  test("artifacts theme produces an artifact-flavoured tagline", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          {
            axisId: "artifacts",
            axisName: "Artifacts",
            strength: 0.65,
            cardCount: 22,
          },
        ],
      })
    );
    expect(tagline.toLowerCase()).toContain("artifact");
  });

  test("known combo with no theme calls out the combo finish", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [],
        knownCombos: [
          {
            cards: ["Thassa's Oracle", "Demonic Consultation"],
            axisId: null,
            type: "combo",
            strength: 1,
            description: "Win the game.",
          },
        ],
      })
    );
    expect(tagline.toLowerCase()).toContain("combo");
  });

  test("high power level (8+) reads as relentless / optimized", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          { axisId: "landfall", axisName: "Landfall", strength: 0.8, cardCount: 14 },
        ],
        powerLevel: 9,
      })
    );
    expect(tagline.toLowerCase()).toMatch(/relentless|optimi[sz]ed|high-power|cedh/);
  });

  test("low power level (1-3) reads as casual / patient", () => {
    const tagline = deckTagline(
      EMPTY_DECK,
      makeAnalysis({
        themes: [
          { axisId: "lifegain", axisName: "Lifegain", strength: 0.6, cardCount: 10 },
        ],
        powerLevel: 2,
      })
    );
    expect(tagline.toLowerCase()).toMatch(/casual|patient|gentle|relaxed/);
  });

  test("no theme + no combo + mid power → midrange/goodstuff fallback", () => {
    const tagline = deckTagline(EMPTY_DECK, makeAnalysis({ powerLevel: 5 }));
    expect(tagline.toLowerCase()).toMatch(/midrange|goodstuff|broad|toolbox/);
  });
});
