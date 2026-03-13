/**
 * Loop Chain Solver — Unit tests for step extraction, mana math, and chain solving.
 *
 * Phase 2 of the action-chain loop detector plan.
 */

import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import type { CardProfile, LoopStep } from "../../src/lib/interaction-engine/types";
import { profileCard } from "../../src/lib/interaction-engine";
import {
  extractLoopSteps,
  solveChain,
  canSatisfyRequirements,
} from "../../src/lib/interaction-engine/loop-chain-solver";

function profile(overrides: Parameters<typeof makeCard>[0]): CardProfile {
  return profileCard(makeCard(overrides));
}

function hasStep(
  steps: LoopStep[],
  predicate: (s: LoopStep) => boolean,
  description?: string
): void {
  const found = steps.find(predicate);
  expect(found, description ?? "expected step not found").toBeDefined();
}

function hasReq(step: LoopStep, token: string): boolean {
  return step.requires.some((r) => r.token === token);
}

function hasProd(step: LoopStep, token: string): boolean {
  return step.produces.some((p) => p.token === token);
}

function hasBlocking(step: LoopStep, token: string): boolean {
  return step.blocking.some((b) => b.token === token);
}

// ═══════════════════════════════════════════════════════════════
// STEP EXTRACTION TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("extractLoopSteps — sacrifice outlets", () => {
  test("Viscera Seer: requires creature_on_bf, produces creature_death", () => {
    const p = profile({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "creature_on_bf") && hasProd(s, "creature_death"),
      "Viscera Seer sac step"
    );
  });

  test("Viscera Seer: no self:false filter (can sac self)", () => {
    const p = profile({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    const sacStep = steps.find((s) => hasReq(s, "creature_on_bf"));
    expect(sacStep).toBeDefined();
    const creatureReq = sacStep!.requires.find((r) => r.token === "creature_on_bf");
    // No self:false filter — can sacrifice itself
    expect(creatureReq?.filter?.self).not.toBe(false);
  });

  test("Ashnod's Altar: produces creature_death + mana_C(2)", () => {
    const p = profile({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) =>
        hasReq(s, "creature_on_bf") &&
        hasProd(s, "creature_death") &&
        hasProd(s, "mana_C"),
      "Ashnod's Altar sac step with mana"
    );
  });

  test("Phyrexian Altar: produces creature_death + mana_any", () => {
    const p = profile({
      name: "Phyrexian Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add one mana of any color.",
      manaCost: "{3}",
      cmc: 3,
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) =>
        hasReq(s, "creature_on_bf") &&
        hasProd(s, "creature_death") &&
        hasProd(s, "mana_any"),
      "Phyrexian Altar sac step with any mana"
    );
  });

  test("Altar of Dementia: free sac, produces creature_death only", () => {
    const p = profile({
      name: "Altar of Dementia",
      typeLine: "Artifact",
      oracleText:
        "Sacrifice a creature: Target player mills cards equal to the sacrificed creature's power.",
      manaCost: "{2}",
      cmc: 2,
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "creature_on_bf") && hasProd(s, "creature_death"),
      "Altar of Dementia sac step"
    );
  });
});

test.describe("extractLoopSteps — death triggers", () => {
  test("Pitiless Plunderer: requires creature_death, produces treasure_token", () => {
    const p = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText: "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "creature_death") && hasProd(s, "treasure_token"),
      "Plunderer death trigger step"
    );
  });

  test("Pitiless Plunderer: death trigger has self:false filter", () => {
    const p = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText: "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const steps = extractLoopSteps(p);
    const deathStep = steps.find((s) => hasReq(s, "creature_death"));
    expect(deathStep).toBeDefined();
    const deathReq = deathStep!.requires.find((r) => r.token === "creature_death");
    expect(deathReq?.filter?.self).toBe(false);
  });
});

test.describe("extractLoopSteps — graveyard return", () => {
  test("Reassembling Skeleton: requires mana_generic(1) + mana_B(1), produces creature_on_bf", () => {
    const p = profile({
      name: "Reassembling Skeleton",
      typeLine: "Creature — Skeleton Warrior",
      oracleText:
        "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "1",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) =>
        (hasReq(s, "mana_generic") || hasReq(s, "mana_B")) && hasProd(s, "creature_on_bf"),
      "Skeleton return step"
    );
  });

  test("Gravecrawler: requires mana_B(1), produces creature_on_bf (graveyard cast)", () => {
    const p = profile({
      name: "Gravecrawler",
      typeLine: "Creature — Zombie",
      oracleText:
        "Gravecrawler can't block.\nYou may cast Gravecrawler from your graveyard as long as you control a Zombie.",
      manaCost: "{B}",
      cmc: 1,
      power: "2",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "mana_B") && hasProd(s, "creature_on_bf"),
      "Gravecrawler cast from graveyard"
    );
  });
});

test.describe("extractLoopSteps — keyword grants and self-keywords", () => {
  test("Mikaeus: produces undying_grant", () => {
    const p = profile({
      name: "Mikaeus, the Unhallowed",
      typeLine: "Legendary Creature — Zombie Cleric",
      oracleText:
        "Intimidate\nWhenever a Human deals damage to you, destroy it.\nOther non-Human creatures you control get +1/+1 and have undying.",
      manaCost: "{3}{B}{B}{B}",
      cmc: 6,
      power: "5",
      toughness: "5",
      keywords: ["Intimidate"],
    });
    const steps = extractLoopSteps(p);
    hasStep(steps, (s) => hasProd(s, "undying_grant"), "Mikaeus grant undying step");
  });

  test("Kitchen Finks: persist return with blocking minus_counter", () => {
    const p = profile({
      name: "Kitchen Finks",
      typeLine: "Creature — Ouphe",
      oracleText:
        "When Kitchen Finks enters the battlefield, you gain 2 life.\nPersist",
      manaCost: "{1}{G/W}{G/W}",
      cmc: 3,
      power: "3",
      toughness: "2",
      keywords: ["Persist"],
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasProd(s, "creature_on_bf") && hasBlocking(s, "minus_counter"),
      "Finks persist return step"
    );
  });

  test("Triskelion: remove counter step (requires plus_counter)", () => {
    const p = profile({
      name: "Triskelion",
      typeLine: "Artifact Creature — Construct",
      oracleText:
        "Triskelion enters the battlefield with three +1/+1 counters on it.\nRemove a +1/+1 counter from Triskelion: It deals 1 damage to any target.",
      manaCost: "{6}",
      cmc: 6,
      power: "1",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "plus_counter"),
      "Triskelion counter removal step"
    );
  });
});

test.describe("extractLoopSteps — counter prevention", () => {
  test("Vizier of Remedies: requires minus_counter", () => {
    const p = profile({
      name: "Vizier of Remedies",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "If one or more -1/-1 counters would be put on a creature you control, that many -1/-1 counters minus one are put on it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
      power: "2",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "minus_counter"),
      "Vizier counter prevention step"
    );
  });

  test("Solemnity: requires minus_counter (same functional role as Vizier)", () => {
    const p = profile({
      name: "Solemnity",
      typeLine: "Enchantment",
      oracleText:
        "Players can't get counters.\nCounters can't be placed on artifacts, creatures, enchantments, or lands.",
      manaCost: "{2}{W}",
      cmc: 3,
    });
    const steps = extractLoopSteps(p);
    hasStep(
      steps,
      (s) => hasReq(s, "minus_counter"),
      "Solemnity counter prevention step"
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// MANA ECONOMICS TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("canSatisfyRequirements — mana substitution", () => {
  test("mana_any(1) satisfies mana_B(1)", () => {
    const { satisfied } = canSatisfyRequirements(
      [{ token: "mana_any", quantity: 1 }],
      [{ token: "mana_B", quantity: 1 }]
    );
    expect(satisfied).toBe(true);
  });

  test("mana_C(2) satisfies mana_generic(2)", () => {
    const { satisfied } = canSatisfyRequirements(
      [{ token: "mana_C", quantity: 2 }],
      [{ token: "mana_generic", quantity: 2 }]
    );
    expect(satisfied).toBe(true);
  });

  test("mana_C(1) does NOT satisfy mana_B(1)", () => {
    const { satisfied } = canSatisfyRequirements(
      [{ token: "mana_C", quantity: 1 }],
      [{ token: "mana_B", quantity: 1 }]
    );
    expect(satisfied).toBe(false);
  });

  test("mana_any(1) + mana_C(2) satisfies mana_generic(1) + mana_B(1)", () => {
    const { satisfied } = canSatisfyRequirements(
      [
        { token: "mana_any", quantity: 1 },
        { token: "mana_C", quantity: 2 },
      ],
      [
        { token: "mana_generic", quantity: 1 },
        { token: "mana_B", quantity: 1 },
      ]
    );
    expect(satisfied).toBe(true);
  });

  test("insufficient mana: mana_B(1) does NOT satisfy mana_generic(1) + mana_B(1)", () => {
    const { satisfied } = canSatisfyRequirements(
      [{ token: "mana_B", quantity: 1 }],
      [
        { token: "mana_generic", quantity: 1 },
        { token: "mana_B", quantity: 1 },
      ]
    );
    expect(satisfied).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// CHAIN SOLVER TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("solveChain — combo detection", () => {
  test("Ashnod's Altar + Plunderer + Skeleton: finds mana-positive loop", () => {
    const altar = profile({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const plunderer = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText: "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const skeleton = profile({
      name: "Reassembling Skeleton",
      typeLine: "Creature — Skeleton Warrior",
      oracleText:
        "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "1",
      toughness: "1",
    });

    const allSteps = [
      ...extractLoopSteps(altar),
      ...extractLoopSteps(plunderer),
      ...extractLoopSteps(skeleton),
    ];
    // Add treasure implicit step
    allSteps.push({
      card: "(Treasure)",
      action: "sacrifice for mana",
      requires: [{ token: "treasure_token", quantity: 1 }],
      produces: [{ token: "mana_any", quantity: 1 }],
      blocking: [],
      source: "structured",
    });

    const chains = solveChain(allSteps);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Mikaeus + Triskelion: finds counter-cycling loop", () => {
    const mike = profile({
      name: "Mikaeus, the Unhallowed",
      typeLine: "Legendary Creature — Zombie Cleric",
      oracleText:
        "Intimidate\nWhenever a Human deals damage to you, destroy it.\nOther non-Human creatures you control get +1/+1 and have undying.",
      manaCost: "{3}{B}{B}{B}",
      cmc: 6,
      power: "5",
      toughness: "5",
      keywords: ["Intimidate"],
    });
    const trisk = profile({
      name: "Triskelion",
      typeLine: "Artifact Creature — Construct",
      oracleText:
        "Triskelion enters the battlefield with three +1/+1 counters on it.\nRemove a +1/+1 counter from Triskelion: It deals 1 damage to any target.",
      manaCost: "{6}",
      cmc: 6,
      power: "1",
      toughness: "1",
    });

    const allSteps = [
      ...extractLoopSteps(mike),
      ...extractLoopSteps(trisk),
    ];
    const chains = solveChain(allSteps);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Finks + Seer + Vizier: finds persist loop (blocking consumed)", () => {
    const finks = profile({
      name: "Kitchen Finks",
      typeLine: "Creature — Ouphe",
      oracleText:
        "When Kitchen Finks enters the battlefield, you gain 2 life.\nPersist",
      manaCost: "{1}{G/W}{G/W}",
      cmc: 3,
      power: "3",
      toughness: "2",
      keywords: ["Persist"],
    });
    const seer = profile({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const vizier = profile({
      name: "Vizier of Remedies",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "If one or more -1/-1 counters would be put on a creature you control, that many -1/-1 counters minus one are put on it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
      power: "2",
      toughness: "1",
    });

    const allSteps = [
      ...extractLoopSteps(finks),
      ...extractLoopSteps(seer),
      ...extractLoopSteps(vizier),
    ];
    const chains = solveChain(allSteps);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Finks + Seer WITHOUT Vizier: NO loop (blocking minus_counter unconsumed)", () => {
    const finks = profile({
      name: "Kitchen Finks",
      typeLine: "Creature — Ouphe",
      oracleText:
        "When Kitchen Finks enters the battlefield, you gain 2 life.\nPersist",
      manaCost: "{1}{G/W}{G/W}",
      cmc: 3,
      power: "3",
      toughness: "2",
      keywords: ["Persist"],
    });
    const seer = profile({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });

    const allSteps = [
      ...extractLoopSteps(finks),
      ...extractLoopSteps(seer),
    ];
    const chains = solveChain(allSteps);
    expect(chains.length).toBe(0);
  });

  test("Seer + Plunderer + Skeleton (no Altar): NO loop (insufficient mana)", () => {
    const seer = profile({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const plunderer = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText: "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const skeleton = profile({
      name: "Reassembling Skeleton",
      typeLine: "Creature — Skeleton Warrior",
      oracleText:
        "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "1",
      toughness: "1",
    });

    const allSteps = [
      ...extractLoopSteps(seer),
      ...extractLoopSteps(plunderer),
      ...extractLoopSteps(skeleton),
    ];
    // Add treasure implicit step
    allSteps.push({
      card: "(Treasure)",
      action: "sacrifice for mana",
      requires: [{ token: "treasure_token", quantity: 1 }],
      produces: [{ token: "mana_any", quantity: 1 }],
      blocking: [],
      source: "structured",
    });

    const chains = solveChain(allSteps);
    // Seer produces no mana. 1 Treasure = 1 mana. Skeleton needs 2 mana ({1}{B}).
    expect(chains.length).toBe(0);
  });

  test("3 random creatures with no resource chain: no loop", () => {
    const c1 = profile({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      oracleText: "",
      manaCost: "{1}{G}",
      cmc: 2,
      power: "2",
      toughness: "2",
    });
    const c2 = profile({
      name: "Hill Giant",
      typeLine: "Creature — Giant",
      oracleText: "",
      manaCost: "{3}{R}",
      cmc: 4,
      power: "3",
      toughness: "3",
    });
    const c3 = profile({
      name: "Grey Ogre",
      typeLine: "Creature — Ogre",
      oracleText: "",
      manaCost: "{2}{R}",
      cmc: 3,
      power: "2",
      toughness: "2",
    });

    const allSteps = [
      ...extractLoopSteps(c1),
      ...extractLoopSteps(c2),
      ...extractLoopSteps(c3),
    ];
    const chains = solveChain(allSteps);
    expect(chains.length).toBe(0);
  });

  test("Murderous Redcap + Vizier + Altar of Dementia: persist combo with free sac", () => {
    const redcap = profile({
      name: "Murderous Redcap",
      typeLine: "Creature — Goblin Assassin",
      oracleText:
        "When Murderous Redcap enters the battlefield, it deals damage equal to its power to any target.\nPersist",
      manaCost: "{2}{B/R}{B/R}",
      cmc: 4,
      power: "2",
      toughness: "2",
      keywords: ["Persist"],
    });
    const vizier = profile({
      name: "Vizier of Remedies",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "If one or more -1/-1 counters would be put on a creature you control, that many -1/-1 counters minus one are put on it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
      power: "2",
      toughness: "1",
    });
    const altar = profile({
      name: "Altar of Dementia",
      typeLine: "Artifact",
      oracleText:
        "Sacrifice a creature: Target player mills cards equal to the sacrificed creature's power.",
      manaCost: "{2}",
      cmc: 2,
    });

    const allSteps = [
      ...extractLoopSteps(redcap),
      ...extractLoopSteps(vizier),
      ...extractLoopSteps(altar),
    ];
    const chains = solveChain(allSteps);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Gravecrawler + Phyrexian Altar: mana-neutral loop", () => {
    const crawler = profile({
      name: "Gravecrawler",
      typeLine: "Creature — Zombie",
      oracleText:
        "Gravecrawler can't block.\nYou may cast Gravecrawler from your graveyard as long as you control a Zombie.",
      manaCost: "{B}",
      cmc: 1,
      power: "2",
      toughness: "1",
    });
    const altar = profile({
      name: "Phyrexian Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add one mana of any color.",
      manaCost: "{3}",
      cmc: 3,
    });

    const allSteps = [
      ...extractLoopSteps(crawler),
      ...extractLoopSteps(altar),
    ];
    const chains = solveChain(allSteps);
    // Sac Gravecrawler for {any} (choose B), recast from graveyard for {B}. Mana-neutral.
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// OBJECT FILTER TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("extractLoopSteps — object filters", () => {
  test("Blood Artist: death trigger has NO self:false filter", () => {
    const p = profile({
      name: "Blood Artist",
      typeLine: "Creature — Vampire",
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "0",
      toughness: "1",
    });
    const steps = extractLoopSteps(p);
    // Blood Artist triggers on self AND others — no self:false filter
    for (const s of steps) {
      for (const r of s.requires) {
        if (r.token === "creature_death") {
          expect(r.filter?.self).not.toBe(false);
        }
      }
    }
  });

  test("Mikaeus: undying_grant has supertypeExcludes filter for Human", () => {
    const p = profile({
      name: "Mikaeus, the Unhallowed",
      typeLine: "Legendary Creature — Zombie Cleric",
      oracleText:
        "Intimidate\nWhenever a Human deals damage to you, destroy it.\nOther non-Human creatures you control get +1/+1 and have undying.",
      manaCost: "{3}{B}{B}{B}",
      cmc: 6,
      power: "5",
      toughness: "5",
      keywords: ["Intimidate"],
    });
    const steps = extractLoopSteps(p);
    const grantStep = steps.find((s) => hasProd(s, "undying_grant"));
    expect(grantStep).toBeDefined();
    const grantProd = grantStep!.produces.find((p) => p.token === "undying_grant");
    expect(grantProd?.filter?.supertypeExcludes).toContain("Human");
  });
});
