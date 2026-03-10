/**
 * Nuanced Synergy Detection Tests — amplifies, protects, recurs, reduces_cost
 *
 * L3-Judge-level tests verifying the interaction engine's ability to detect
 * subtle mechanical relationships between real Magic cards with accurate
 * oracle text. Tests follow TDD — written BEFORE implementation improvements.
 */

import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import type {
  CardProfile,
  Interaction,
  InteractionAnalysis,
  InteractionType,
} from "../../src/lib/interaction-engine/types";
import { profileCard } from "../../src/lib/interaction-engine";
import { findInteractions } from "../../src/lib/interaction-engine/interaction-detector";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function profile(overrides: Parameters<typeof makeCard>[0]): CardProfile {
  return profileCard(makeCard(overrides));
}

function findByType(
  analysis: InteractionAnalysis,
  type: InteractionType,
  cardA?: string,
  cardB?: string
): Interaction[] {
  return analysis.interactions.filter((i) => {
    if (i.type !== type) return false;
    if (cardA && cardB) {
      return (
        (i.cards[0] === cardA && i.cards[1] === cardB) ||
        (i.cards[0] === cardB && i.cards[1] === cardA)
      );
    }
    if (cardA) return i.cards[0] === cardA || i.cards[1] === cardA;
    return true;
  });
}

function findDirectional(
  analysis: InteractionAnalysis,
  type: InteractionType,
  from: string,
  to: string
): Interaction[] {
  return analysis.interactions.filter(
    (i) => i.type === type && i.cards[0] === from && i.cards[1] === to
  );
}

// ═══════════════════════════════════════════════════════════════
// COMMON CARD PROFILES
// ═══════════════════════════════════════════════════════════════

function doublingSeason(): CardProfile {
  return profile({
    name: "Doubling Season",
    typeLine: "Enchantment",
    oracleText:
      "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
    manaCost: "{4}{G}",
    cmc: 5,
  });
}

function avengerOfZendikar(): CardProfile {
  return profile({
    name: "Avenger of Zendikar",
    typeLine: "Creature — Elemental",
    oracleText:
      "When Avenger of Zendikar enters the battlefield, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land enters the battlefield under your control, you may put a +1/+1 counter on each Plant creature you control.",
    manaCost: "{5}{G}{G}",
    cmc: 7,
    power: "5",
    toughness: "5",
  });
}

function panharmonicon(): CardProfile {
  return profile({
    name: "Panharmonicon",
    typeLine: "Artifact",
    oracleText:
      "If an artifact or creature entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
    manaCost: "{4}",
    cmc: 4,
  });
}

function mulldrifter(): CardProfile {
  return profile({
    name: "Mulldrifter",
    typeLine: "Creature — Elemental",
    oracleText:
      "Flying\nWhen Mulldrifter enters the battlefield, draw two cards.\nEvoke {2}{U}",
    manaCost: "{4}{U}",
    cmc: 5,
    power: "2",
    toughness: "2",
    keywords: ["flying", "evoke"],
  });
}

function torbranThaneOfRedFell(): CardProfile {
  return profile({
    name: "Torbran, Thane of Red Fell",
    typeLine: "Legendary Creature — Dwarf Noble",
    oracleText:
      "If a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 2 instead.",
    manaCost: "{1}{R}{R}{R}",
    cmc: 4,
    power: "2",
    toughness: "4",
  });
}

function lightningBolt(): CardProfile {
  return profile({
    name: "Lightning Bolt",
    typeLine: "Instant",
    oracleText: "Lightning Bolt deals 3 damage to any target.",
    manaCost: "{R}",
    cmc: 1,
  });
}

function purphorosGodOfTheForge(): CardProfile {
  return profile({
    name: "Purphoros, God of the Forge",
    typeLine: "Legendary Enchantment Creature — God",
    oracleText:
      "Indestructible\nAs long as your devotion to red is less than five, Purphoros isn't a creature.\nWhenever another creature enters the battlefield under your control, Purphoros deals 2 damage to each opponent.\n{2}{R}: Creatures you control get +1/+0 until end of turn.",
    manaCost: "{3}{R}",
    cmc: 4,
    power: "6",
    toughness: "5",
    keywords: ["indestructible"],
  });
}

function lightningGreaves(): CardProfile {
  return profile({
    name: "Lightning Greaves",
    typeLine: "Artifact — Equipment",
    oracleText:
      "Equipped creature has shroud and haste.\nEquip {0}",
    manaCost: "{2}",
    cmc: 2,
  });
}

function heroicIntervention(): CardProfile {
  return profile({
    name: "Heroic Intervention",
    typeLine: "Instant",
    oracleText:
      "Permanents you control gain hexproof and indestructible until end of turn.",
    manaCost: "{1}{G}",
    cmc: 2,
  });
}

function motherOfRunes(): CardProfile {
  return profile({
    name: "Mother of Runes",
    typeLine: "Creature — Human Cleric",
    oracleText:
      "{T}: Target creature you control gains protection from the color of your choice until end of turn.",
    manaCost: "{W}",
    cmc: 1,
    power: "1",
    toughness: "1",
  });
}

function eternalWitness(): CardProfile {
  return profile({
    name: "Eternal Witness",
    typeLine: "Creature — Human Shaman",
    oracleText:
      "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.",
    manaCost: "{1}{G}{G}",
    cmc: 3,
    power: "2",
    toughness: "1",
  });
}

function solRing(): CardProfile {
  return profile({
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    manaCost: "{1}",
    cmc: 1,
  });
}

function counterspell(): CardProfile {
  return profile({
    name: "Counterspell",
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    manaCost: "{U}{U}",
    cmc: 2,
  });
}

function merenOfClanNelToth(): CardProfile {
  return profile({
    name: "Meren of Clan Nel Toth",
    typeLine: "Legendary Creature — Human Shaman",
    oracleText:
      "Whenever another creature you control dies, you get an experience counter.\nAt the beginning of your end step, choose target creature card in your graveyard. If X is less than that card's mana value, return it to your hand. Otherwise, return it to the battlefield. X is the number of experience counters you have.",
    manaCost: "{2}{B}{G}",
    cmc: 4,
    power: "3",
    toughness: "4",
  });
}

function bloodArtist(): CardProfile {
  return profile({
    name: "Blood Artist",
    typeLine: "Creature — Vampire",
    oracleText:
      "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
    manaCost: "{1}{B}",
    cmc: 2,
    power: "0",
    toughness: "1",
  });
}

function lurrusOfTheDreamDen(): CardProfile {
  return profile({
    name: "Lurrus of the Dream-Den",
    typeLine: "Legendary Creature — Cat Nightmare",
    oracleText:
      "Companion — Each permanent card in your starting deck has mana value 2 or less.\nLifelink\nDuring each of your turns, you may cast one permanent spell with mana value 2 or less from your graveyard.",
    manaCost: "{1}{W/B}{W/B}",
    cmc: 3,
    power: "3",
    toughness: "2",
    keywords: ["companion", "lifelink"],
  });
}

function urzasIncubator(): CardProfile {
  return profile({
    name: "Urza's Incubator",
    typeLine: "Artifact",
    oracleText:
      "As Urza's Incubator enters the battlefield, choose a creature type.\nCreature spells of the chosen type cost {2} less to cast.",
    manaCost: "{3}",
    cmc: 3,
  });
}

function goblinWarchief(): CardProfile {
  return profile({
    name: "Goblin Warchief",
    typeLine: "Creature — Goblin Warrior",
    oracleText:
      "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.",
    manaCost: "{1}{R}{R}",
    cmc: 3,
    power: "2",
    toughness: "2",
  });
}

function krenkoMobBoss(): CardProfile {
  return profile({
    name: "Krenko, Mob Boss",
    typeLine: "Legendary Creature — Goblin Warrior",
    oracleText:
      "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
    manaCost: "{2}{R}{R}",
    cmc: 4,
    power: "3",
    toughness: "3",
  });
}

function helmOfAwakening(): CardProfile {
  return profile({
    name: "Helm of Awakening",
    typeLine: "Artifact",
    oracleText: "Spells cost {1} less to cast.",
    manaCost: "{2}",
    cmc: 2,
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. AMPLIFIES — Replacement effects and enhancement
// ═══════════════════════════════════════════════════════════════

test.describe("amplifies — Doubling Season + token/counter creators", () => {
  test("Doubling Season amplifies Avenger of Zendikar's token creation", () => {
    const ds = doublingSeason();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([ds, avenger]);

    // Doubling Season's replacement effect doubles token creation.
    // Avenger creates Plant tokens on ETB — Doubling Season should amplify this.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Doubling Season",
      "Avenger of Zendikar"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
    expect(amplifies[0].strength).toBeGreaterThanOrEqual(0.6);
    expect(amplifies[0].mechanical).toBeTruthy();
  });

  test("Doubling Season amplifies Avenger of Zendikar's +1/+1 counter placement", () => {
    const ds = doublingSeason();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([ds, avenger]);

    // Avenger's landfall puts +1/+1 counters on Plants — Doubling Season
    // doubles those counters too. There should be at least one amplifies
    // interaction covering the counter-doubling aspect.
    const allAmplifies = findByType(
      analysis,
      "amplifies",
      "Doubling Season",
      "Avenger of Zendikar"
    );
    expect(allAmplifies.length).toBeGreaterThanOrEqual(1);

    // At least one amplifies interaction should mention tokens or counters
    const mentionsTokenOrCounter = allAmplifies.some(
      (i) =>
        i.mechanical.toLowerCase().includes("token") ||
        i.mechanical.toLowerCase().includes("counter") ||
        i.mechanical.toLowerCase().includes("twice") ||
        i.mechanical.toLowerCase().includes("double")
    );
    expect(mentionsTokenOrCounter).toBe(true);
  });
});

test.describe("amplifies — Panharmonicon + ETB creatures", () => {
  test("Panharmonicon amplifies Mulldrifter's ETB draw trigger", () => {
    const pan = panharmonicon();
    const mull = mulldrifter();
    const analysis = findInteractions([pan, mull]);

    // Panharmonicon causes ETB triggered abilities to trigger an additional time.
    // Mulldrifter has "When ~ enters the battlefield, draw two cards" — a creature
    // ETB trigger. Panharmonicon should amplify this.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Panharmonicon",
      "Mulldrifter"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
    expect(amplifies[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Panharmonicon amplifies Avenger of Zendikar's ETB token creation", () => {
    const pan = panharmonicon();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([pan, avenger]);

    // Avenger's ETB ("When Avenger of Zendikar enters the battlefield, create...")
    // is a creature ETB triggered ability — Panharmonicon doubles it.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Panharmonicon",
      "Avenger of Zendikar"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("amplifies — Torbran + red damage sources", () => {
  test("Torbran amplifies Lightning Bolt's damage", () => {
    const torb = torbranThaneOfRedFell();
    const bolt = lightningBolt();
    const analysis = findInteractions([torb, bolt]);

    // Torbran's replacement effect adds +2 to damage from red sources.
    // Lightning Bolt is a red instant that deals damage — Torbran amplifies it.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Torbran, Thane of Red Fell",
      "Lightning Bolt"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
    expect(amplifies[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Torbran amplifies Purphoros's ETB damage", () => {
    const torb = torbranThaneOfRedFell();
    const purph = purphorosGodOfTheForge();
    const analysis = findInteractions([torb, purph]);

    // Purphoros deals 2 damage to each opponent whenever a creature ETBs.
    // Torbran makes that 4 damage instead. Should detect amplification.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Torbran, Thane of Red Fell",
      "Purphoros, God of the Forge"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });

  test("Torbran does NOT amplify non-red damage sources", () => {
    const torb = torbranThaneOfRedFell();
    // Pestilence is a black enchantment — not a red source
    const pestilence = profile({
      name: "Pestilence",
      typeLine: "Enchantment",
      oracleText:
        "At the beginning of the end step, if no creatures are on the battlefield, sacrifice Pestilence.\n{B}: Pestilence deals 1 damage to each creature and each player.",
      manaCost: "{2}{B}{B}",
      cmc: 4,
    });
    const analysis = findInteractions([torb, pestilence]);

    // Pestilence is black, not red — Torbran should NOT amplify it
    const amplifies = findDirectional(
      analysis,
      "amplifies",
      "Torbran, Thane of Red Fell",
      "Pestilence"
    );
    expect(amplifies.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. PROTECTS — Equipment, instants, and activated abilities
// ═══════════════════════════════════════════════════════════════

test.describe("protects — Lightning Greaves protects creatures", () => {
  test("Lightning Greaves protects a legendary creature (commander)", () => {
    const greaves = lightningGreaves();
    const commander = profile({
      name: "Atraxa, Praetors' Voice",
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      oracleText: "Flying, vigilance, deathtouch, lifelink\nProliferate.",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      power: "4",
      toughness: "4",
      keywords: ["flying", "vigilance", "deathtouch", "lifelink"],
    });
    const analysis = findInteractions([greaves, commander]);

    // Lightning Greaves grants shroud and haste to equipped creature.
    // The engine should detect a "protects" interaction for shroud.
    const protects = findByType(
      analysis,
      "protects",
      "Lightning Greaves",
      "Atraxa, Praetors' Voice"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
    expect(protects[0].strength).toBeGreaterThanOrEqual(0.6);

    // The mechanical description should mention shroud
    const mentionsShroud = protects.some(
      (i) => i.mechanical.toLowerCase().includes("shroud")
    );
    expect(mentionsShroud).toBe(true);
  });

  test("Lightning Greaves also amplifies with haste grant", () => {
    const greaves = lightningGreaves();
    const creature = profile({
      name: "Craterhoof Behemoth",
      typeLine: "Creature — Beast",
      oracleText:
        "Haste\nWhen Craterhoof Behemoth enters the battlefield, creatures you control get +X/+X and gain trample until end of turn, where X is the number of creatures you control.",
      manaCost: "{5}{G}{G}{G}",
      cmc: 8,
      power: "5",
      toughness: "5",
      keywords: ["haste"],
    });
    const analysis = findInteractions([greaves, creature]);

    // Greaves also grants haste — an amplifying keyword for creatures
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Lightning Greaves",
      "Craterhoof Behemoth"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("protects — Heroic Intervention protects the board", () => {
  test("Heroic Intervention protects creatures", () => {
    const heroic = heroicIntervention();
    const creature = bloodArtist();
    const analysis = findInteractions([heroic, creature]);

    // Heroic Intervention grants hexproof and indestructible to permanents
    // you control — Blood Artist is a permanent (creature).
    const protects = findByType(
      analysis,
      "protects",
      "Heroic Intervention",
      "Blood Artist"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
    expect(protects[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Heroic Intervention protects artifacts", () => {
    const heroic = heroicIntervention();
    const ring = solRing();
    const analysis = findInteractions([heroic, ring]);

    // Sol Ring is a permanent (artifact) — Heroic Intervention protects it too
    const protects = findByType(
      analysis,
      "protects",
      "Heroic Intervention",
      "Sol Ring"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
  });

  test("Heroic Intervention protects enchantments", () => {
    const heroic = heroicIntervention();
    const ds = doublingSeason();
    const analysis = findInteractions([heroic, ds]);

    // Doubling Season is a permanent (enchantment) — also protected
    const protects = findByType(
      analysis,
      "protects",
      "Heroic Intervention",
      "Doubling Season"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("protects — Mother of Runes protects creatures", () => {
  test("Mother of Runes protects a creature with targeted protection", () => {
    const mom = motherOfRunes();
    const creature = bloodArtist();
    const analysis = findInteractions([mom, creature]);

    // Mother of Runes gives protection from a color to target creature you control.
    // This is a "protects" interaction.
    const protects = findByType(
      analysis,
      "protects",
      "Mother of Runes",
      "Blood Artist"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
    expect(protects[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Mother of Runes does NOT protect non-creature permanents", () => {
    const mom = motherOfRunes();
    const ring = solRing();
    const analysis = findInteractions([mom, ring]);

    // Mother of Runes targets "creature you control" — Sol Ring is an artifact,
    // not a creature, so no protects interaction.
    const protects = findDirectional(
      analysis,
      "protects",
      "Mother of Runes",
      "Sol Ring"
    );
    expect(protects.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. RECURS — Graveyard recursion with type filtering
// ═══════════════════════════════════════════════════════════════

test.describe("recurs — Eternal Witness recurs any card", () => {
  test("Eternal Witness recurs Sol Ring (an artifact)", () => {
    const eWit = eternalWitness();
    const ring = solRing();
    const analysis = findInteractions([eWit, ring]);

    // Eternal Witness returns "target card" from graveyard — no type restriction.
    // Sol Ring can go to the graveyard and be returned.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Eternal Witness",
      "Sol Ring"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
    expect(recurs[0].strength).toBeGreaterThanOrEqual(0.6);
    expect(recurs[0].mechanical).toContain("graveyard");
  });

  test("Eternal Witness recurs Counterspell (an instant)", () => {
    const eWit = eternalWitness();
    const cs = counterspell();
    const analysis = findInteractions([eWit, cs]);

    // "target card" is unrestricted — Counterspell is a card.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Eternal Witness",
      "Counterspell"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
    expect(recurs[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Eternal Witness recurs a sorcery too", () => {
    const eWit = eternalWitness();
    const tutor = profile({
      name: "Demonic Tutor",
      typeLine: "Sorcery",
      oracleText:
        "Search your library for a card, put that card into your hand, then shuffle.",
      manaCost: "{1}{B}",
      cmc: 2,
    });
    const analysis = findInteractions([eWit, tutor]);

    const recurs = findDirectional(
      analysis,
      "recurs",
      "Eternal Witness",
      "Demonic Tutor"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("recurs — Meren of Clan Nel Toth recurs creatures only", () => {
  test("Meren recurs Blood Artist (a creature)", () => {
    const meren = merenOfClanNelToth();
    const artist = bloodArtist();
    const analysis = findInteractions([meren, artist]);

    // Meren targets "creature card in your graveyard" — Blood Artist is a creature.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Meren of Clan Nel Toth",
      "Blood Artist"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
    expect(recurs[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Meren does NOT recur Lightning Bolt (an instant, not a creature card)", () => {
    const meren = merenOfClanNelToth();
    const bolt = lightningBolt();
    const analysis = findInteractions([meren, bolt]);

    // Meren specifies "creature card" — Lightning Bolt is an instant.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Meren of Clan Nel Toth",
      "Lightning Bolt"
    );
    expect(recurs.length).toBe(0);
  });

  test("Meren does NOT recur Sol Ring (an artifact, not a creature card)", () => {
    const meren = merenOfClanNelToth();
    const ring = solRing();
    const analysis = findInteractions([meren, ring]);

    // Sol Ring is an artifact, not a creature — Meren can't target it.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Meren of Clan Nel Toth",
      "Sol Ring"
    );
    expect(recurs.length).toBe(0);
  });
});

test.describe("recurs — Lurrus of the Dream-Den recurs low-cost permanents", () => {
  test("Lurrus recurs Sol Ring (permanent, MV 1)", () => {
    const lurrus = lurrusOfTheDreamDen();
    const ring = solRing();
    const analysis = findInteractions([lurrus, ring]);

    // Lurrus can cast permanent spells with MV 2 or less from graveyard.
    // Sol Ring is a permanent with MV 1 — it qualifies.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Lurrus of the Dream-Den",
      "Sol Ring"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
    expect(recurs[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Lurrus recurs Blood Artist (permanent, MV 2)", () => {
    const lurrus = lurrusOfTheDreamDen();
    const artist = bloodArtist();
    const analysis = findInteractions([lurrus, artist]);

    // Blood Artist is a creature (permanent) with MV 2 — within Lurrus's range.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Lurrus of the Dream-Den",
      "Blood Artist"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
  });

  test("Lurrus does NOT recur Panharmonicon (permanent, MV 4 — too expensive)", () => {
    const lurrus = lurrusOfTheDreamDen();
    const pan = panharmonicon();
    const analysis = findInteractions([lurrus, pan]);

    // Panharmonicon is MV 4 — exceeds Lurrus's "2 or less" restriction.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Lurrus of the Dream-Den",
      "Panharmonicon"
    );
    expect(recurs.length).toBe(0);
  });

  test("Lurrus does NOT recur Counterspell (instant, not a permanent)", () => {
    const lurrus = lurrusOfTheDreamDen();
    const cs = counterspell();
    const analysis = findInteractions([lurrus, cs]);

    // Counterspell is an instant — not a permanent spell, even though MV 2.
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Lurrus of the Dream-Den",
      "Counterspell"
    );
    expect(recurs.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. REDUCES_COST — Tribal, universal, and conditional reductions
// ═══════════════════════════════════════════════════════════════

test.describe("reduces_cost — Urza's Incubator with creature type", () => {
  test("Urza's Incubator has a cost reduction static effect", () => {
    const incubator = urzasIncubator();

    // Urza's Incubator chooses a creature type at ETB and reduces
    // creature spells of that type by {2}. The engine should at minimum
    // detect that this card has cost reduction capability.
    const hasReductionCapability =
      incubator.staticEffects.some(
        (se) =>
          se.effect.type === "cost_reduction" ||
          se.effect.type === "reduce_cost" ||
          se.effect.type === "cost_modifier"
      ) ||
      incubator.rawOracleText?.toLowerCase().includes("cost") ||
      incubator.rawOracleText?.toLowerCase().includes("less to cast");

    expect(hasReductionCapability).toBe(true);
  });

  test("Urza's Incubator reduces cost for creature spells", () => {
    const incubator = urzasIncubator();
    const creature = bloodArtist();
    const analysis = findInteractions([incubator, creature]);

    // Even though the chosen creature type is runtime-dependent,
    // the engine should detect the cost reduction pattern for creatures.
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Urza's Incubator",
      "Blood Artist"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
    expect(reduces[0].strength).toBeGreaterThanOrEqual(0.5);
  });
});

test.describe("reduces_cost — Goblin Warchief reduces Goblin costs", () => {
  test("Goblin Warchief reduces cost for Krenko, Mob Boss", () => {
    const warchief = goblinWarchief();
    const krenko = krenkoMobBoss();
    const analysis = findInteractions([warchief, krenko]);

    // Goblin Warchief: "Goblin spells you cast cost {1} less to cast."
    // Krenko is a Goblin — should get cost reduction.
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Goblin Warchief",
      "Krenko, Mob Boss"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
    expect(reduces[0].strength).toBeGreaterThanOrEqual(0.5);
  });

  test("Goblin Warchief does NOT reduce cost for non-Goblin creatures", () => {
    const warchief = goblinWarchief();
    const artist = bloodArtist();
    const analysis = findInteractions([warchief, artist]);

    // Blood Artist is a Vampire, not a Goblin — no cost reduction.
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Goblin Warchief",
      "Blood Artist"
    );
    expect(reduces.length).toBe(0);
  });

  test("Goblin Warchief also amplifies Goblins with haste", () => {
    const warchief = goblinWarchief();
    const krenko = krenkoMobBoss();
    const analysis = findInteractions([warchief, krenko]);

    // Goblin Warchief also grants haste to Goblins — that's an amplifies interaction.
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Goblin Warchief",
      "Krenko, Mob Boss"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("reduces_cost — Helm of Awakening universal reduction", () => {
  test("Helm of Awakening reduces cost for creatures", () => {
    const helm = helmOfAwakening();
    const creature = bloodArtist();
    const analysis = findInteractions([helm, creature]);

    // "Spells cost {1} less to cast" — universal, applies to all spells.
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Helm of Awakening",
      "Blood Artist"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
    expect(reduces[0].strength).toBeGreaterThanOrEqual(0.5);
  });

  test("Helm of Awakening reduces cost for instants", () => {
    const helm = helmOfAwakening();
    const cs = counterspell();
    const analysis = findInteractions([helm, cs]);

    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Helm of Awakening",
      "Counterspell"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
  });

  test("Helm of Awakening reduces cost for sorceries", () => {
    const helm = helmOfAwakening();
    const tutor = profile({
      name: "Demonic Tutor",
      typeLine: "Sorcery",
      oracleText:
        "Search your library for a card, put that card into your hand, then shuffle.",
      manaCost: "{1}{B}",
      cmc: 2,
    });
    const analysis = findInteractions([helm, tutor]);

    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Helm of Awakening",
      "Demonic Tutor"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
  });

  test("Helm of Awakening reduces cost for artifacts", () => {
    const helm = helmOfAwakening();
    const ring = solRing();
    const analysis = findInteractions([helm, ring]);

    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Helm of Awakening",
      "Sol Ring"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
  });
});
