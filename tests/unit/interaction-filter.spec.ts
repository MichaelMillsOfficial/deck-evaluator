/**
 * Interaction Filter Tests — Reasoning engine filtering of interaction detector output
 *
 * Tests that the reasoning engine correctly filters false-positive interactions
 * where harmful/opponent-directed effects are incorrectly treated as positive
 * interactions with your own cards.
 */

import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import type { Interaction } from "../../src/lib/interaction-engine/types";
import type { CardIntentSummary } from "../../src/lib/reasoning-engine/types";
import {
  shouldFilterInteraction,
  filterInteractions,
  filterInteractionAnalysis,
} from "../../src/lib/reasoning-engine/interaction-filter";
import { buildCardIntentSummary } from "../../src/lib/reasoning-engine/intent-resolver";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function makeInteraction(
  overrides: Partial<Interaction> & Pick<Interaction, "cards" | "type" | "mechanical">
): Interaction {
  return {
    strength: 0.7,
    events: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// shouldFilterInteraction
// ═══════════════════════════════════════════════════════════════

test.describe("shouldFilterInteraction", () => {
  test("filters Breya -4/-4 amplifying own creatures", () => {
    const breya = makeCard({
      name: "Breya, Etherium Shaper",
      typeLine: "Legendary Artifact Creature — Human",
      oracleText:
        "When Breya, Etherium Shaper enters the battlefield, create two 1/1 blue Thopter artifact creature tokens with flying.\n" +
        "{2}, Sacrifice two artifacts: Choose one —\n" +
        "• Target player loses 3 life.\n" +
        "• Target creature gets -4/-4 until end of turn.\n" +
        "• You gain 5 life.",
      keywords: [],
    });

    const summary = buildCardIntentSummary(breya);
    const summaries: Record<string, CardIntentSummary> = {
      [breya.name]: summary,
    };

    const interaction = makeInteraction({
      cards: ["Breya, Etherium Shaper", "Alloy Myr"],
      type: "amplifies",
      mechanical: "Breya, Etherium Shaper grants -4/-4 to Alloy Myr",
    });

    expect(shouldFilterInteraction(interaction, summaries)).toBe(true);
  });

  test("does NOT filter positive stat buff amplification", () => {
    const anthem = makeCard({
      name: "Glorious Anthem",
      typeLine: "Enchantment",
      oracleText: "Creatures you control get +1/+1.",
      keywords: [],
    });

    const summary = buildCardIntentSummary(anthem);
    const summaries: Record<string, CardIntentSummary> = {
      [anthem.name]: summary,
    };

    const interaction = makeInteraction({
      cards: ["Glorious Anthem", "Blood Artist"],
      type: "amplifies",
      mechanical: "Glorious Anthem grants +1/+1 to Blood Artist",
    });

    expect(shouldFilterInteraction(interaction, summaries)).toBe(false);
  });

  test("does NOT filter non-positive interaction types (blocks, conflicts)", () => {
    const breya = makeCard({
      name: "Breya, Etherium Shaper",
      typeLine: "Legendary Artifact Creature — Human",
      oracleText:
        "When Breya, Etherium Shaper enters the battlefield, create two 1/1 blue Thopter artifact creature tokens with flying.\n" +
        "{2}, Sacrifice two artifacts: Choose one —\n" +
        "• Target player loses 3 life.\n" +
        "• Target creature gets -4/-4 until end of turn.\n" +
        "• You gain 5 life.",
      keywords: [],
    });

    const summary = buildCardIntentSummary(breya);
    const summaries: Record<string, CardIntentSummary> = {
      [breya.name]: summary,
    };

    const interaction = makeInteraction({
      cards: ["Breya, Etherium Shaper", "Some Card"],
      type: "conflicts",
      mechanical: "Breya, Etherium Shaper conflicts with Some Card",
    });

    expect(shouldFilterInteraction(interaction, summaries)).toBe(false);
  });

  test("filters interaction when mechanical text describes destruction", () => {
    const card = makeCard({
      name: "Swords to Plowshares",
      typeLine: "Instant",
      oracleText: "Exile target creature. Its controller gains life equal to its power.",
      keywords: [],
    });

    const summary = buildCardIntentSummary(card);
    const summaries: Record<string, CardIntentSummary> = {
      [card.name]: summary,
    };

    const interaction = makeInteraction({
      cards: ["Swords to Plowshares", "Alloy Myr"],
      type: "enables",
      mechanical: "Swords to Plowshares exile target creature Alloy Myr",
    });

    expect(shouldFilterInteraction(interaction, summaries)).toBe(true);
  });

  test("returns false when source card has no intent summary", () => {
    const interaction = makeInteraction({
      cards: ["Unknown Card", "Alloy Myr"],
      type: "amplifies",
      mechanical: "Unknown Card grants -4/-4 to Alloy Myr",
    });

    expect(shouldFilterInteraction(interaction, {})).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// filterInteractions (batch)
// ═══════════════════════════════════════════════════════════════

test.describe("filterInteractions", () => {
  test("removes harmful amplifies but keeps beneficial ones", () => {
    const breya = makeCard({
      name: "Breya, Etherium Shaper",
      typeLine: "Legendary Artifact Creature — Human",
      oracleText:
        "When Breya, Etherium Shaper enters the battlefield, create two 1/1 blue Thopter artifact creature tokens with flying.\n" +
        "{2}, Sacrifice two artifacts: Choose one —\n" +
        "• Target player loses 3 life.\n" +
        "• Target creature gets -4/-4 until end of turn.\n" +
        "• You gain 5 life.",
      keywords: [],
    });

    const anthem = makeCard({
      name: "Glorious Anthem",
      typeLine: "Enchantment",
      oracleText: "Creatures you control get +1/+1.",
      keywords: [],
    });

    const summaries: Record<string, CardIntentSummary> = {
      [breya.name]: buildCardIntentSummary(breya),
      [anthem.name]: buildCardIntentSummary(anthem),
    };

    const interactions: Interaction[] = [
      makeInteraction({
        cards: ["Breya, Etherium Shaper", "Alloy Myr"],
        type: "amplifies",
        mechanical: "Breya, Etherium Shaper grants -4/-4 to Alloy Myr",
      }),
      makeInteraction({
        cards: ["Glorious Anthem", "Alloy Myr"],
        type: "amplifies",
        mechanical: "Glorious Anthem grants +1/+1 to Alloy Myr",
      }),
    ];

    const filtered = filterInteractions(interactions, summaries);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].cards[0]).toBe("Glorious Anthem");
  });
});

// ═══════════════════════════════════════════════════════════════
// filterInteractionAnalysis (full pipeline)
// ═══════════════════════════════════════════════════════════════

test.describe("filterInteractionAnalysis", () => {
  test("filters Breya -4/-4 from full interaction analysis", () => {
    const breya = makeCard({
      name: "Breya, Etherium Shaper",
      typeLine: "Legendary Artifact Creature — Human",
      oracleText:
        "When Breya, Etherium Shaper enters the battlefield, create two 1/1 blue Thopter artifact creature tokens with flying.\n" +
        "{2}, Sacrifice two artifacts: Choose one —\n" +
        "• Target player loses 3 life.\n" +
        "• Target creature gets -4/-4 until end of turn.\n" +
        "• You gain 5 life.",
      keywords: [],
    });

    const alloyMyr = makeCard({
      name: "Alloy Myr",
      typeLine: "Artifact Creature — Myr",
      oracleText: "{T}: Add one mana of any color.",
      keywords: [],
    });

    const cardMap = {
      [breya.name]: breya,
      [alloyMyr.name]: alloyMyr,
    };

    const mockAnalysis = {
      profiles: {},
      interactions: [
        makeInteraction({
          cards: ["Breya, Etherium Shaper", "Alloy Myr"],
          type: "amplifies",
          mechanical: "Breya, Etherium Shaper grants -4/-4 to Alloy Myr",
        }),
        makeInteraction({
          cards: ["Breya, Etherium Shaper", "Alloy Myr"],
          type: "enables",
          mechanical: "Breya, Etherium Shaper enables Alloy Myr as sacrifice fodder",
        }),
      ],
      chains: [],
      loops: [],
      blockers: [],
      enablers: [],
    };

    const filtered = filterInteractionAnalysis(mockAnalysis, cardMap);

    // The -4/-4 amplifies should be removed
    const amplifies = filtered.interactions.filter(
      (i) => i.type === "amplifies" && i.mechanical.includes("-4/-4")
    );
    expect(amplifies).toHaveLength(0);

    // The enables interaction should remain
    const enables = filtered.interactions.filter((i) => i.type === "enables");
    expect(enables).toHaveLength(1);
  });
});
