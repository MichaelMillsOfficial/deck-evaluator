import { test, expect } from "@playwright/test";
import { suggestCuts, type CutSuggestion } from "../../src/lib/cut-suggestions";
import {
  createCrucibleSession,
  setCardStatus,
  type CruciblePayload,
} from "../../src/lib/crucible-session";
import { makeCard } from "../helpers";
import type { DeckSynergyAnalysis, EnrichedCard } from "../../src/lib/types";
import type { CompositionScorecardResult } from "../../src/lib/deck-composition";

const ADELINE = makeCard({
  name: "Adeline, Resplendent Cathar",
  typeLine: "Legendary Creature — Human Knight",
  colorIdentity: ["W"],
});
const SOL_RING = makeCard({ name: "Sol Ring", typeLine: "Artifact", colorIdentity: [] });
const MURDER = makeCard({ name: "Murder", typeLine: "Instant", colorIdentity: ["B"] });
const MANALITH = makeCard({ name: "Manalith", typeLine: "Artifact", colorIdentity: [] });
const CULTIVATE = makeCard({ name: "Cultivate", typeLine: "Sorcery", colorIdentity: ["G"] });

const CARDS: EnrichedCard[] = [ADELINE, SOL_RING, MURDER, MANALITH, CULTIVATE];
const CARD_MAP = Object.fromEntries(CARDS.map((c) => [c.name, c]));

function payloadWith(commanders: string[] = []): CruciblePayload {
  return {
    ...createCrucibleSession(
      CARDS.map((c) => ({ name: c.name, quantity: 1 })),
      []
    ),
    commanders,
  };
}

function synergyWith(scores: Record<string, number>): DeckSynergyAnalysis {
  return {
    cardScores: Object.fromEntries(
      Object.entries(scores).map(([name, score]) => [
        name,
        { cardName: name, score, axes: [], pairs: [] },
      ])
    ),
    topSynergies: [],
    antiSynergies: [],
    knownCombos: [],
    deckThemes: [],
  } as unknown as DeckSynergyAnalysis;
}

function scorecardWith(
  categories: CompositionScorecardResult["categories"]
): CompositionScorecardResult {
  return {
    templateId: "command-zone",
    templateName: "Command Zone",
    categories,
    overallHealth: "healthy",
    healthSummary: "",
    untaggedCount: 0,
    untaggedCards: [],
  };
}

function names(suggestions: CutSuggestion[]): string[] {
  return suggestions.map((s) => s.name);
}

test.describe("suggestCuts", () => {
  test("off-identity cards are suggested once commanders are set", () => {
    const payload = payloadWith(["Adeline, Resplendent Cathar"]);
    const suggestions = suggestCuts(payload, CARD_MAP, null, null);
    const murder = suggestions.find((s) => s.name === "Murder");
    expect(murder).toBeTruthy();
    expect(murder!.reasons.join(" ")).toMatch(/off-identity/i);
    // Cultivate (G) is also off a mono-W identity.
    expect(names(suggestions)).toContain("Cultivate");
    // Colorless artifacts are fine.
    expect(names(suggestions)).not.toContain("Sol Ring");
  });

  test("no off-identity suggestions before a commander is chosen", () => {
    const suggestions = suggestCuts(payloadWith(), CARD_MAP, null, null);
    expect(suggestions.filter((s) => s.reasons.join(" ").match(/off-identity/i))).toEqual([]);
  });

  test("cards below the weak-synergy threshold are suggested with the low-synergy reason", () => {
    const synergy = synergyWith({ Manalith: 12, "Sol Ring": 92 });
    const suggestions = suggestCuts(payloadWith(), CARD_MAP, synergy, null);
    const manalith = suggestions.find((s) => s.name === "Manalith");
    expect(manalith).toBeTruthy();
    expect(manalith!.reasons.join(" ")).toMatch(/low synergy/i);
    expect(names(suggestions)).not.toContain("Sol Ring");
  });

  test("overfull categories suggest their lowest-scoring members beyond the max", () => {
    const synergy = synergyWith({ "Sol Ring": 92, Manalith: 20, Cultivate: 60 });
    const scorecard = scorecardWith([
      {
        tag: "Ramp",
        label: "Ramp",
        count: 3,
        min: 1,
        max: 2,
        status: "high",
        statusMessage: "1 over target",
        cards: [
          { name: "Sol Ring", quantity: 1 },
          { name: "Manalith", quantity: 1 },
          { name: "Cultivate", quantity: 1 },
        ],
      },
    ]);
    const suggestions = suggestCuts(payloadWith(), CARD_MAP, synergy, scorecard);
    const manalith = suggestions.find((s) => s.name === "Manalith");
    expect(manalith).toBeTruthy();
    expect(manalith!.reasons.join(" ")).toMatch(/overfull/i);
    // Only count - max = 1 member gets the overfull reason, and it is the weakest.
    const overfull = suggestions.filter((s) => s.reasons.join(" ").match(/overfull/i));
    expect(names(overfull)).toEqual(["Manalith"]);
  });

  test("commanders and already-cut cards are never suggested", () => {
    let payload = payloadWith(["Adeline, Resplendent Cathar"]);
    payload = setCardStatus(payload, "Murder", "cut");
    const synergy = synergyWith({
      "Adeline, Resplendent Cathar": 5,
      Murder: 5,
      Manalith: 5,
    });
    const suggestions = suggestCuts(payload, CARD_MAP, synergy, null);
    expect(names(suggestions)).not.toContain("Adeline, Resplendent Cathar");
    expect(names(suggestions)).not.toContain("Murder");
    expect(names(suggestions)).toContain("Manalith");
  });

  test("dismissed suggestions are excluded and ranking is score-desc", () => {
    const payload = payloadWith(["Adeline, Resplendent Cathar"]);
    const synergy = synergyWith({ Manalith: 12 });
    const all = suggestCuts(payload, CARD_MAP, synergy, null);
    expect(names(all)).toContain("Murder");
    const filtered = suggestCuts(payload, CARD_MAP, synergy, null, new Set(["Murder"]));
    expect(names(filtered)).not.toContain("Murder");
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].score).toBeGreaterThanOrEqual(all[i].score);
    }
  });
});
