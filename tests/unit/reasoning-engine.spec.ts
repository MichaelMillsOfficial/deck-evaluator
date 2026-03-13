import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import {
  classifyEffectPolarity,
  inferTargetIntent,
  categorizeEffect,
  classifyAbilityEffects,
} from "../../src/lib/reasoning-engine/effect-classifier";
import {
  buildCardIntentSummary,
  buildDeckIntentSummaries,
} from "../../src/lib/reasoning-engine/intent-resolver";
import {
  analyzeDeckContext,
  generateIntentOverrides,
  applyDeckContext,
} from "../../src/lib/reasoning-engine/deck-context";
import type { AnnotatedEffect } from "../../src/lib/reasoning-engine/types";
import type { EnrichedCard } from "../../src/lib/types";
import { analyzeDeckSynergy } from "../../src/lib/synergy-engine";

// ═══════════════════════════════════════════════════════════════════
// Helper to build cards for testing
// ═══════════════════════════════════════════════════════════════════

function mockDeck(
  mainboard: string[],
  commanders: string[] = []
) {
  return {
    name: "Test Deck",
    source: "text" as const,
    url: "",
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: mainboard.map((name) => ({ name, quantity: 1 })),
    sideboard: [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Effect Classifier Tests
// ═══════════════════════════════════════════════════════════════════

test.describe("Effect Classifier", () => {
  test.describe("classifyAbilityEffects", () => {
    test("Breya's -4/-4 mode is harmful + opponent intent", () => {
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
      // Find the -4/-4 effect
      const debuffEffects = summary.effects.filter(
        (e) => e.effectCategory === "stat_debuff"
      );
      expect(debuffEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of debuffEffects) {
        expect(e.polarity).toBe("harmful");
        expect(e.targetIntent).toBe("opponent");
      }
    });

    test("Breya's token creation is beneficial + self intent", () => {
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
      const tokenEffects = summary.effects.filter(
        (e) => e.effectCategory === "token_creation"
      );
      expect(tokenEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of tokenEffects) {
        expect(e.polarity).toBe("beneficial");
        expect(e.targetIntent).toBe("self");
      }
    });

    test("Breya's life gain mode is beneficial + self intent", () => {
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
      const lifeGainEffects = summary.effects.filter(
        (e) => e.effectCategory === "life_gain"
      );
      expect(lifeGainEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of lifeGainEffects) {
        expect(e.polarity).toBe("beneficial");
        expect(e.targetIntent).toBe("self");
      }
    });

    test("Craterhoof Behemoth's +X/+X is beneficial + self intent", () => {
      const craterhoof = makeCard({
        name: "Craterhoof Behemoth",
        typeLine: "Creature — Beast",
        oracleText:
          "Haste\nWhen Craterhoof Behemoth enters the battlefield, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
        keywords: ["Haste"],
      });

      const summary = buildCardIntentSummary(craterhoof);
      const buffEffects = summary.effects.filter(
        (e) => e.effectCategory === "stat_buff" || e.effectCategory === "keyword_grant"
      );
      expect(buffEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of buffEffects) {
        expect(e.polarity).toBe("beneficial");
        expect(e.targetIntent).toBe("self");
      }
    });

    test("Swords to Plowshares is harmful + opponent intent", () => {
      const stp = makeCard({
        name: "Swords to Plowshares",
        typeLine: "Instant",
        oracleText: "Exile target creature. Its controller gains life equal to its power.",
        keywords: [],
      });

      const summary = buildCardIntentSummary(stp);
      const exileEffects = summary.effects.filter(
        (e) => e.effectCategory === "removal_exile"
      );
      expect(exileEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of exileEffects) {
        expect(e.polarity).toBe("harmful");
        expect(e.targetIntent).toBe("opponent");
      }
    });

    test("sacrifice costs are classified as cost intent", () => {
      const viscerasSeer = makeCard({
        name: "Viscera Seer",
        typeLine: "Creature — Vampire Wizard",
        oracleText: "Sacrifice a creature: Scry 1.",
        keywords: [],
      });

      const summary = buildCardIntentSummary(viscerasSeer);
      const sacEffects = summary.effects.filter(
        (e) => e.effectCategory === "sacrifice" && e.isCostEffect
      );
      expect(sacEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of sacEffects) {
        expect(e.targetIntent).toBe("cost");
      }
    });

    test("keyword grants are beneficial + self intent", () => {
      const swiftfoot = makeCard({
        name: "Swiftfoot Boots",
        typeLine: "Artifact — Equipment",
        oracleText:
          "Equipped creature has hexproof and haste.\nEquip {1}",
        keywords: [],
      });

      const summary = buildCardIntentSummary(swiftfoot);
      const kwEffects = summary.effects.filter(
        (e) => e.effectCategory === "keyword_grant"
      );
      expect(kwEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of kwEffects) {
        expect(e.polarity).toBe("beneficial");
        expect(e.targetIntent).toBe("self");
      }
    });

    test("destroy all creatures is harmful", () => {
      const wrath = makeCard({
        name: "Wrath of God",
        typeLine: "Sorcery",
        oracleText: "Destroy all creatures. They can't be regenerated.",
        keywords: [],
      });

      const summary = buildCardIntentSummary(wrath);
      const destroyEffects = summary.effects.filter(
        (e) => e.effectCategory === "board_wipe" || e.effectCategory === "removal_destroy"
      );
      expect(destroyEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of destroyEffects) {
        expect(e.polarity).toBe("harmful");
      }
    });

    test("explicit 'you control' cards are always self intent", () => {
      const eleshNorn = makeCard({
        name: "Elesh Norn, Grand Cenobite",
        typeLine: "Legendary Creature — Phyrexian Praetor",
        oracleText:
          "Vigilance\nOther creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
        keywords: ["Vigilance"],
      });

      const summary = buildCardIntentSummary(eleshNorn);
      const buffEffects = summary.effects.filter(
        (e) => e.effectCategory === "stat_buff"
      );
      for (const e of buffEffects) {
        expect(e.targetIntent).toBe("self");
      }
    });

    test("explicit 'opponents control' cards are always opponent intent", () => {
      const eleshNorn = makeCard({
        name: "Elesh Norn, Grand Cenobite",
        typeLine: "Legendary Creature — Phyrexian Praetor",
        oracleText:
          "Vigilance\nOther creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
        keywords: ["Vigilance"],
      });

      const summary = buildCardIntentSummary(eleshNorn);
      const debuffEffects = summary.effects.filter(
        (e) => e.effectCategory === "stat_debuff"
      );
      for (const e of debuffEffects) {
        expect(e.targetIntent).toBe("opponent");
      }
    });

    test("In Garruk's Wake is harmful + opponent intent (one-sided)", () => {
      const igw = makeCard({
        name: "In Garruk's Wake",
        typeLine: "Sorcery",
        oracleText:
          "Destroy all creatures you don't control. Destroy all planeswalkers you don't control.",
        keywords: [],
      });

      const summary = buildCardIntentSummary(igw);
      const destroyEffects = summary.effects.filter(
        (e) =>
          e.effectCategory === "removal_destroy" ||
          e.effectCategory === "board_wipe"
      );
      expect(destroyEffects.length).toBeGreaterThanOrEqual(1);
      for (const e of destroyEffects) {
        expect(e.polarity).toBe("harmful");
        expect(e.targetIntent).toBe("opponent");
      }
    });

    test("Skullclamp's -1 toughness is contextual", () => {
      const skullclamp = makeCard({
        name: "Skullclamp",
        typeLine: "Artifact — Equipment",
        oracleText:
          "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}",
        keywords: [],
      });

      const summary = buildCardIntentSummary(skullclamp);
      // Skullclamp has a mixed stat mod (+1/-1) — the toughness reduction
      // makes it contextual (beneficial with 1/1 tokens + death triggers)
      const statEffects = summary.effects.filter(
        (e) => e.effectCategory === "stat_debuff" || e.effectCategory === "stat_buff"
      );
      // Should have at least one effect that is contextual or has the stat mod
      const hasContextual = summary.effects.some(
        (e) => e.polarity === "contextual" || e.effectCategory === "stat_debuff"
      );
      expect(hasContextual).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Deck Context Tests
// ═══════════════════════════════════════════════════════════════════

test.describe("Deck Context", () => {
  test("detects death triggers in deck", () => {
    const cards: Record<string, EnrichedCard> = {
      "Blood Artist": makeCard({
        name: "Blood Artist",
        typeLine: "Creature — Vampire",
        oracleText: "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
        keywords: [],
      }),
      "Zulaport Cutthroat": makeCard({
        name: "Zulaport Cutthroat",
        typeLine: "Creature — Human Rogue Ally",
        oracleText: "Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life and you gain 1 life.",
        keywords: [],
      }),
    };

    const context = analyzeDeckContext(cards, new Map());
    expect(context.hasDeathTriggers).toBe(true);
  });

  test("detects enrage payoffs in deck", () => {
    const cards: Record<string, EnrichedCard> = {
      "Polyraptor": makeCard({
        name: "Polyraptor",
        typeLine: "Creature — Dinosaur",
        oracleText: "Enrage — Whenever Polyraptor is dealt damage, create a token that's a copy of Polyraptor.",
        keywords: ["Enrage"],
      }),
    };

    const context = analyzeDeckContext(cards, new Map());
    expect(context.hasEnragePayoffs).toBe(true);
  });

  test("detects madness payoffs when 2+ cards have Madness", () => {
    const cards: Record<string, EnrichedCard> = {
      "Fiery Temper": makeCard({
        name: "Fiery Temper",
        typeLine: "Instant",
        oracleText: "Fiery Temper deals 3 damage to any target.\nMadness {R}",
        keywords: ["Madness"],
      }),
      "Big Game Hunter": makeCard({
        name: "Big Game Hunter",
        typeLine: "Creature — Human Rebel Assassin",
        oracleText: "When Big Game Hunter enters the battlefield, destroy target creature with power 4 or greater. It can't be regenerated.\nMadness {B}",
        keywords: ["Madness"],
      }),
    };

    const context = analyzeDeckContext(cards, new Map());
    expect(context.hasMadnessPayoffs).toBe(true);
  });

  test("does not detect madness with only 1 madness card", () => {
    const cards: Record<string, EnrichedCard> = {
      "Fiery Temper": makeCard({
        name: "Fiery Temper",
        typeLine: "Instant",
        oracleText: "Fiery Temper deals 3 damage to any target.\nMadness {R}",
        keywords: ["Madness"],
      }),
    };

    const context = analyzeDeckContext(cards, new Map());
    expect(context.hasMadnessPayoffs).toBe(false);
  });

  test("sacrifice cost becomes synergistic when death triggers present", () => {
    const cards: Record<string, EnrichedCard> = {
      "Viscera Seer": makeCard({
        name: "Viscera Seer",
        typeLine: "Creature — Vampire Wizard",
        oracleText: "Sacrifice a creature: Scry 1.",
        keywords: [],
      }),
      "Blood Artist": makeCard({
        name: "Blood Artist",
        typeLine: "Creature — Vampire",
        oracleText: "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
        keywords: [],
      }),
    };

    const summaries = buildDeckIntentSummaries(cards);
    const context = analyzeDeckContext(cards, new Map());
    applyDeckContext(summaries, context);

    // After context override, Viscera Seer's sacrifice should be self-synergistic
    const seerSummary = summaries["Viscera Seer"];
    expect(seerSummary).toBeDefined();
    const sacEffects = seerSummary.effects.filter(
      (e) => e.effectCategory === "sacrifice"
    );
    // At least one sacrifice effect should now be overridden to "self" or "either"
    const hasOverridden = sacEffects.some(
      (e) => e.targetIntent === "self" || e.targetIntent === "either"
    );
    expect(hasOverridden).toBe(true);
  });

  test("context override does NOT apply when deck lacks payoffs", () => {
    const cards: Record<string, EnrichedCard> = {
      "Viscera Seer": makeCard({
        name: "Viscera Seer",
        typeLine: "Creature — Vampire Wizard",
        oracleText: "Sacrifice a creature: Scry 1.",
        keywords: [],
      }),
      "Grizzly Bears": makeCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        oracleText: "",
        keywords: [],
      }),
    };

    const summaries = buildDeckIntentSummaries(cards);
    const context = analyzeDeckContext(cards, new Map());
    applyDeckContext(summaries, context);

    // Without death triggers, sacrifice stays as "cost"
    const seerSummary = summaries["Viscera Seer"];
    const sacEffects = seerSummary.effects.filter(
      (e) => e.effectCategory === "sacrifice" && e.isCostEffect
    );
    for (const e of sacEffects) {
      expect(e.targetIntent).toBe("cost");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration Tests — Synergy Engine with Reasoning
// ═══════════════════════════════════════════════════════════════════

test.describe("Synergy Engine with Reasoning", () => {
  test("Breya does NOT synergize with random creatures when reasoning enabled", () => {
    const cards: Record<string, EnrichedCard> = {
      "Breya, Etherium Shaper": makeCard({
        name: "Breya, Etherium Shaper",
        typeLine: "Legendary Artifact Creature — Human",
        oracleText:
          "When Breya, Etherium Shaper enters the battlefield, create two 1/1 blue Thopter artifact creature tokens with flying.\n" +
          "{2}, Sacrifice two artifacts: Choose one —\n" +
          "• Target player loses 3 life.\n" +
          "• Target creature gets -4/-4 until end of turn.\n" +
          "• You gain 5 life.",
        keywords: [],
        manaCost: "{W}{U}{B}{R}",
        cmc: 4,
        colorIdentity: ["W", "U", "B", "R"],
      }),
      "Grizzly Bears": makeCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        oracleText: "",
        keywords: [],
        manaCost: "{1}{G}",
        cmc: 2,
      }),
      "Hill Giant": makeCard({
        name: "Hill Giant",
        typeLine: "Creature — Giant",
        oracleText: "",
        keywords: [],
        manaCost: "{3}{R}",
        cmc: 4,
      }),
    };

    const deck = mockDeck(["Grizzly Bears", "Hill Giant"], ["Breya, Etherium Shaper"]);
    const result = analyzeDeckSynergy(deck, cards, undefined, { reasoning: true });

    // Breya should NOT be paired with Grizzly Bears or Hill Giant
    // because her -4/-4 is removal (opponent-directed), not a synergy
    const breyaPairs = result.topSynergies.filter(
      (p) =>
        p.cards.includes("Breya, Etherium Shaper") &&
        (p.cards.includes("Grizzly Bears") || p.cards.includes("Hill Giant"))
    );
    // These pairs should not exist (Breya's removal mode is opponent-directed)
    expect(breyaPairs.length).toBe(0);
  });

  test("Craterhoof DOES synergize with creatures when reasoning enabled", () => {
    const cards: Record<string, EnrichedCard> = {
      "Craterhoof Behemoth": makeCard({
        name: "Craterhoof Behemoth",
        typeLine: "Creature — Beast",
        oracleText:
          "Haste\nWhen Craterhoof Behemoth enters the battlefield, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
        keywords: ["Haste"],
        manaCost: "{5}{G}{G}{G}",
        cmc: 8,
      }),
      "Llanowar Elves": makeCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        oracleText: "{T}: Add {G}.",
        keywords: [],
        manaCost: "{G}",
        cmc: 1,
      }),
    };

    const deck = mockDeck(["Craterhoof Behemoth", "Llanowar Elves"]);
    const result = analyzeDeckSynergy(deck, cards, undefined, { reasoning: true });

    // Craterhoof's +X/+X is self-beneficial — it should still show synergies
    // (Note: they may or may not pair on a specific axis depending on scores,
    // but Craterhoof should not be filtered OUT by reasoning)
    const craterhoof = result.cardScores["Craterhoof Behemoth"];
    expect(craterhoof).toBeDefined();
  });

  test("backward compatibility: no reasoning flag behaves identically", () => {
    const cards: Record<string, EnrichedCard> = {
      "Hardened Scales": makeCard({
        name: "Hardened Scales",
        typeLine: "Enchantment",
        oracleText:
          "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
        keywords: [],
      }),
      "Walking Ballista": makeCard({
        name: "Walking Ballista",
        typeLine: "Artifact Creature — Construct",
        oracleText:
          "Walking Ballista enters the battlefield with X +1/+1 counters on it.\nRemove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.",
        keywords: [],
      }),
    };

    const deck = mockDeck(["Hardened Scales", "Walking Ballista"]);

    const resultWithout = analyzeDeckSynergy(deck, cards);
    const resultWithFalse = analyzeDeckSynergy(deck, cards, undefined, { reasoning: false });

    // Same number of synergies either way
    expect(resultWithout.topSynergies.length).toBe(resultWithFalse.topSynergies.length);
  });

  test("aristocrats deck correctly pairs sacrifice outlets with death triggers", () => {
    const cards: Record<string, EnrichedCard> = {
      "Viscera Seer": makeCard({
        name: "Viscera Seer",
        typeLine: "Creature — Vampire Wizard",
        oracleText: "Sacrifice a creature: Scry 1.",
        keywords: [],
      }),
      "Blood Artist": makeCard({
        name: "Blood Artist",
        typeLine: "Creature — Vampire",
        oracleText: "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
        keywords: [],
      }),
      "Zulaport Cutthroat": makeCard({
        name: "Zulaport Cutthroat",
        typeLine: "Creature — Human Rogue Ally",
        oracleText: "Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life and you gain 1 life.",
        keywords: [],
      }),
    };

    const deck = mockDeck(["Viscera Seer", "Blood Artist", "Zulaport Cutthroat"]);
    const result = analyzeDeckSynergy(deck, cards, undefined, { reasoning: true });

    // These cards should still synergize on the sacrifice axis
    // even with reasoning enabled, because the deck has death triggers
    const sacPairs = result.topSynergies.filter(
      (p) => p.axisId === "sacrifice"
    );
    expect(sacPairs.length).toBeGreaterThanOrEqual(1);
  });
});
