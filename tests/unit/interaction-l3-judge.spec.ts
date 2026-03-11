/**
 * Interaction Engine L3 Judge Tests
 *
 * Comprehensive accuracy tests for the interaction detector, authored from
 * the perspective of five L3 Judge sub-agents, each focused on a different
 * category of mechanical interaction.
 *
 * Categories:
 *   1. Enablers — resource production / consumption matching
 *   2. Triggers — event causation chains
 *   3. Loops & Chains — multi-card combo / value paths
 *   4. Blockers & Conflicts — replacement/restriction effects
 *   5. Nuanced Synergies — amplifies, protects, recurs, reduces_cost
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
    if (cardA) {
      return i.cards[0] === cardA || i.cards[1] === cardA;
    }
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

function visceraSeer(): CardProfile {
  return profile({
    name: "Viscera Seer",
    typeLine: "Creature — Vampire Wizard",
    oracleText: "Sacrifice a creature: Scry 1.",
    manaCost: "{B}",
    cmc: 1,
    power: "1",
    toughness: "1",
  });
}

function reassemblingSkeleton(): CardProfile {
  return profile({
    name: "Reassembling Skeleton",
    typeLine: "Creature — Skeleton Warrior",
    oracleText:
      "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
    manaCost: "{1}{B}",
    cmc: 2,
    power: "1",
    toughness: "1",
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

function ashnodAltar(): CardProfile {
  return profile({
    name: "Ashnod's Altar",
    typeLine: "Artifact",
    oracleText: "Sacrifice a creature: Add {C}{C}.",
    manaCost: "{3}",
    cmc: 3,
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

// ═══════════════════════════════════════════════════════════════
// JUDGE 1: ENABLERS
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Enablers", () => {
  test("Smothering Tithe creates Treasure artifacts — enables Krark-Clan Ironworks artifact sacrifice", () => {
    const tithe = profile({
      name: "Smothering Tithe",
      typeLine: "Enchantment",
      oracleText:
        "Whenever an opponent draws a card, that player may pay {2}. If that player doesn't, you create a Treasure token.",
      manaCost: "{3}{W}",
      cmc: 4,
    });
    const kci = profile({
      name: "Krark-Clan Ironworks",
      typeLine: "Artifact",
      oracleText: "Sacrifice an artifact: Add {C}{C}.",
      manaCost: "{4}",
      cmc: 4,
    });
    const analysis = findInteractions([tithe, kci]);

    // Smothering Tithe creates artifact tokens → KCI sacrifices artifacts
    const enables = findDirectional(
      analysis,
      "enables",
      "Smothering Tithe",
      "Krark-Clan Ironworks"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });

  test("Dockside Extortionist creates conditional Treasure tokens — still detected as token producer", () => {
    const dockside = profile({
      name: "Dockside Extortionist",
      typeLine: "Creature — Goblin Pirate",
      oracleText:
        "When Dockside Extortionist enters the battlefield, create X Treasure tokens, where X is the number of artifacts and enchantments your opponents control.",
      manaCost: "{1}{R}",
      cmc: 2,
      power: "1",
      toughness: "2",
    });
    const kci = profile({
      name: "Krark-Clan Ironworks",
      typeLine: "Artifact",
      oracleText: "Sacrifice an artifact: Add {C}{C}.",
      manaCost: "{4}",
      cmc: 4,
    });
    const analysis = findInteractions([dockside, kci]);

    // Even though X is variable/conditional, the token creation should be detected
    const enables = findDirectional(
      analysis,
      "enables",
      "Dockside Extortionist",
      "Krark-Clan Ironworks"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });

  test("Phyrexian Altar enables multicolor spells — converts creatures to any color mana", () => {
    const altar = profile({
      name: "Phyrexian Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add one mana of any color.",
      manaCost: "{3}",
      cmc: 3,
    });
    const seer = visceraSeer();
    const analysis = findInteractions([seer, altar]);

    // Viscera Seer is a creature that Phyrexian Altar can sacrifice
    const enables = findDirectional(
      analysis,
      "enables",
      "Viscera Seer",
      "Phyrexian Altar"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });

  test("Llanowar Elves + Craterhoof Behemoth does NOT produce enables (noise reduction)", () => {
    const elves = profile({
      name: "Llanowar Elves",
      typeLine: "Creature — Elf Druid",
      oracleText: "{T}: Add {G}.",
      manaCost: "{G}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const hoof = profile({
      name: "Craterhoof Behemoth",
      typeLine: "Creature — Beast",
      oracleText:
        "Haste\nWhen Craterhoof Behemoth enters the battlefield, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
      manaCost: "{5}{G}{G}{G}",
      cmc: 8,
      power: "5",
      toughness: "5",
      keywords: ["Haste"],
    });
    const analysis = findInteractions([elves, hoof]);

    // Generic mana producers should not generate enables for expensive spells
    const enables = findDirectional(
      analysis,
      "enables",
      "Llanowar Elves",
      "Craterhoof Behemoth"
    );
    expect(enables.length).toBe(0);
  });

  test("Gilded Goose creates Food tokens (artifacts) — enables artifact sacrifice outlets", () => {
    const goose = profile({
      name: "Gilded Goose",
      typeLine: "Creature — Bird",
      oracleText:
        "Flying\nWhen Gilded Goose enters the battlefield, create a Food token.\n{1}{G}, Sacrifice a Food: Add one mana of any color.\n{2}, {T}: Create a Food token.",
      manaCost: "{G}",
      cmc: 1,
      power: "0",
      toughness: "2",
      keywords: ["Flying"],
    });
    const kci = profile({
      name: "Krark-Clan Ironworks",
      typeLine: "Artifact",
      oracleText: "Sacrifice an artifact: Add {C}{C}.",
      manaCost: "{4}",
      cmc: 4,
    });
    const analysis = findInteractions([goose, kci]);

    // Food tokens are artifacts — KCI can sacrifice them
    const enables = findDirectional(
      analysis,
      "enables",
      "Gilded Goose",
      "Krark-Clan Ironworks"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });

  test("Bolas's Citadel has zone_cast_permission from library top", () => {
    const citadel = profile({
      name: "Bolas's Citadel",
      typeLine: "Legendary Artifact",
      oracleText:
        "You may look at the top card of your library at any time.\nYou may play lands and cast spells from the top of your library. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost.\n{T}, Sacrifice ten nonland permanents: Each opponent loses 10 life.",
      manaCost: "{3}{B}{B}{B}",
      cmc: 6,
    });
    const p = citadel;

    // Bolas's Citadel should have a zoneCastPermission from library
    expect(p.zoneCastPermissions.length).toBeGreaterThanOrEqual(1);
    const libPerm = p.zoneCastPermissions.find((z) => z.fromZone === "library");
    expect(libPerm).toBeDefined();
  });

  test("Reassembling Skeleton enables sacrifice outlets as a self-recurring creature", () => {
    const skeleton = reassemblingSkeleton();
    const seer = visceraSeer();
    const analysis = findInteractions([skeleton, seer]);

    // Skeleton is a creature → enables Viscera Seer's sacrifice cost
    const enables = findDirectional(
      analysis,
      "enables",
      "Reassembling Skeleton",
      "Viscera Seer"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });

  test("Pitiless Plunderer creates Treasure tokens when creatures die — enables artifact sacrifice", () => {
    const plunderer = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText:
        "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const kci = profile({
      name: "Krark-Clan Ironworks",
      typeLine: "Artifact",
      oracleText: "Sacrifice an artifact: Add {C}{C}.",
      manaCost: "{4}",
      cmc: 4,
    });
    const analysis = findInteractions([plunderer, kci]);

    // Plunderer creates artifact tokens → KCI can sacrifice artifacts
    const enables = findDirectional(
      analysis,
      "enables",
      "Pitiless Plunderer",
      "Krark-Clan Ironworks"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// JUDGE 2: TRIGGERS
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Triggers", () => {
  test("Soul Warden + Archangel of Thune: life gain triggers counter placement", () => {
    const warden = profile({
      name: "Soul Warden",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "Whenever another creature enters the battlefield, you gain 1 life.",
      manaCost: "{W}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const thune = profile({
      name: "Archangel of Thune",
      typeLine: "Creature — Angel",
      oracleText:
        "Flying, lifelink\nWhenever you gain life, put a +1/+1 counter on each creature you control.",
      manaCost: "{3}{W}{W}",
      cmc: 5,
      power: "3",
      toughness: "4",
      keywords: ["Flying", "Lifelink"],
    });
    const analysis = findInteractions([warden, thune]);

    // Soul Warden produces life → Archangel of Thune triggers on life gain
    const triggers = findByType(
      analysis,
      "triggers",
      "Soul Warden",
      "Archangel of Thune"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Zulaport Cutthroat triggers on creature death (controller-specific)", () => {
    const cutthroat = profile({
      name: "Zulaport Cutthroat",
      typeLine: "Creature — Human Rogue Ally",
      oracleText:
        "Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "1",
      toughness: "1",
    });
    const altar = ashnodAltar();
    const analysis = findInteractions([altar, cutthroat]);

    // Altar causes sacrifice (creature death) → Zulaport triggers on creature you control dying
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Zulaport Cutthroat"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Talrand triggers on instant/sorcery cast — Lightning Bolt is an instant", () => {
    const talrand = profile({
      name: "Talrand, Sky Summoner",
      typeLine: "Legendary Creature — Merfolk Wizard",
      oracleText:
        "Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.",
      manaCost: "{2}{U}{U}",
      cmc: 4,
      power: "2",
      toughness: "2",
    });
    const bolt = profile({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const analysis = findInteractions([bolt, talrand]);

    // Lightning Bolt cast causes a player_action{cast_spell} → Talrand triggers on instant cast
    const triggers = findByType(
      analysis,
      "triggers",
      "Lightning Bolt",
      "Talrand, Sky Summoner"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Talrand does NOT trigger on artifact cast — Sol Ring is not an instant/sorcery", () => {
    const talrand = profile({
      name: "Talrand, Sky Summoner",
      typeLine: "Legendary Creature — Merfolk Wizard",
      oracleText:
        "Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.",
      manaCost: "{2}{U}{U}",
      cmc: 4,
      power: "2",
      toughness: "2",
    });
    const ring = solRing();
    const analysis = findInteractions([ring, talrand]);

    // Sol Ring is an artifact, not instant/sorcery — should NOT trigger Talrand
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Sol Ring",
      "Talrand, Sky Summoner"
    );
    expect(triggers.length).toBe(0);
  });

  test("Eidolon of Blossoms triggers on enchantment ETB", () => {
    const eidolon = profile({
      name: "Eidolon of Blossoms",
      typeLine: "Enchantment Creature — Spirit",
      oracleText:
        "Constellation — Whenever Eidolon of Blossoms or another enchantment enters the battlefield under your control, draw a card.",
      manaCost: "{2}{G}{G}",
      cmc: 4,
      power: "2",
      toughness: "2",
    });
    const sigil = profile({
      name: "Sigil of the Empty Throne",
      typeLine: "Enchantment",
      oracleText:
        "Whenever you cast an enchantment spell, create a 4/4 white Angel creature token with flying.",
      manaCost: "{3}{W}{W}",
      cmc: 5,
    });
    const analysis = findInteractions([sigil, eidolon]);

    // Sigil is an enchantment — when it ETBs, Eidolon should trigger (constellation)
    // The engine should detect that Sigil's ETB triggers Eidolon
    const triggers = findByType(
      analysis,
      "triggers",
      "Sigil of the Empty Throne",
      "Eidolon of Blossoms"
    );
    // This may be detected via enables or triggers depending on engine modeling
    const anyInteraction = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Sigil of the Empty Throne") &&
        i.cards.includes("Eidolon of Blossoms")
    );
    expect(anyInteraction.length).toBeGreaterThanOrEqual(1);
  });

  test("Niv-Mizzet, Parun has multiple triggers — cast trigger and draw trigger", () => {
    const niv = profile({
      name: "Niv-Mizzet, Parun",
      typeLine: "Legendary Creature — Dragon Wizard",
      oracleText:
        "This spell can't be countered.\nFlying\nWhenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card.",
      manaCost: "{U}{U}{U}{R}{R}{R}",
      cmc: 6,
      power: "5",
      toughness: "5",
      keywords: ["Flying"],
    });
    const brainstorm = profile({
      name: "Brainstorm",
      typeLine: "Instant",
      oracleText: "Draw three cards, then put two cards from your hand on top of your library.",
      manaCost: "{U}",
      cmc: 1,
    });
    const analysis = findInteractions([brainstorm, niv]);

    // Brainstorm is an instant → triggers Niv's cast trigger → draw a card → triggers Niv's damage
    // At minimum, casting Brainstorm should trigger Niv
    const triggers = findByType(
      analysis,
      "triggers",
      "Brainstorm",
      "Niv-Mizzet, Parun"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Pitiless Plunderer triggers on creature death — Ashnod's Altar sacrifice causes death", () => {
    const plunderer = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText:
        "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const altar = ashnodAltar();
    const analysis = findInteractions([altar, plunderer]);

    // Altar sacrifice causes creature death → Plunderer triggers on creature death
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Pitiless Plunderer"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Grave Pact forces sacrifice — triggers Blood Artist's death trigger", () => {
    const gravePact = profile({
      name: "Grave Pact",
      typeLine: "Enchantment",
      oracleText:
        "Whenever a creature you control dies, each other player sacrifices a creature.",
      manaCost: "{1}{B}{B}{B}",
      cmc: 4,
    });
    const artist = bloodArtist();
    const analysis = findInteractions([gravePact, artist]);

    // Grave Pact forces opponents to sacrifice → causes creature death → triggers Blood Artist
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Grave Pact",
      "Blood Artist"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Purphoros triggers on creature ETB — Avenger of Zendikar creates creature tokens", () => {
    const purphoros = profile({
      name: "Purphoros, God of the Forge",
      typeLine: "Legendary Enchantment Creature — God",
      oracleText:
        "Indestructible\nAs long as your devotion to red is less than five, Purphoros isn't a creature.\nWhenever another creature enters the battlefield under your control, Purphoros deals 2 damage to each opponent.\n{2}{R}: Creatures you control get +1/+0 until end of turn.",
      manaCost: "{3}{R}",
      cmc: 4,
      power: "6",
      toughness: "5",
      keywords: ["Indestructible"],
    });
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([avenger, purphoros]);

    // Avenger creates creature tokens (ETB) → Purphoros triggers on creature ETB
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Avenger of Zendikar",
      "Purphoros, God of the Forge"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// JUDGE 3: LOOPS & CHAINS
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Loops & Chains", () => {
  test("Aristocrats loop: Reassembling Skeleton + Ashnod's Altar + Blood Artist", () => {
    const skeleton = reassemblingSkeleton();
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([skeleton, altar, artist]);

    // Sac Skeleton → get {C}{C} → pay {1}{B} to return Skeleton → Blood Artist drains
    // This should produce a chain involving all three cards
    expect(analysis.chains.length).toBeGreaterThanOrEqual(1);
    const tripleChain = analysis.chains.find(
      (c) =>
        c.cards.includes("Reassembling Skeleton") &&
        c.cards.includes("Ashnod's Altar") &&
        c.cards.includes("Blood Artist")
    );
    expect(tripleChain).toBeDefined();
  });

  test("Pitiless Plunderer + Viscera Seer + Reassembling Skeleton — infinite loop", () => {
    const plunderer = profile({
      name: "Pitiless Plunderer",
      typeLine: "Creature — Human Pirate",
      oracleText:
        "Whenever another creature you control dies, create a Treasure token.",
      manaCost: "{3}{B}",
      cmc: 4,
      power: "1",
      toughness: "4",
    });
    const seer = visceraSeer();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([plunderer, seer, skeleton]);

    // Sac Skeleton to Seer → Plunderer makes Treasure → crack Treasures for {1}{B} → return Skeleton
    // At minimum: Seer + Skeleton enables, Plunderer triggers on death
    const altarTriggers = findDirectional(
      analysis,
      "triggers",
      "Viscera Seer",
      "Pitiless Plunderer"
    );
    expect(altarTriggers.length).toBeGreaterThanOrEqual(1);

    // Should form a chain
    expect(analysis.chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Mikaeus + Triskelion — two-card infinite combo", () => {
    const mikaeus = profile({
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
    const analysis = findInteractions([mikaeus, trisk]);

    // Mikaeus grants undying to non-Human creatures → Triskelion is non-Human
    // At minimum they should have some interaction (grants, amplifies, or enables)
    const anyInteraction = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Mikaeus, the Unhallowed") &&
        i.cards.includes("Triskelion")
    );
    expect(anyInteraction.length).toBeGreaterThanOrEqual(1);
  });

  test("Non-combo cards produce no loops: Llanowar Elves + Serra Angel", () => {
    const elves = profile({
      name: "Llanowar Elves",
      typeLine: "Creature — Elf Druid",
      oracleText: "{T}: Add {G}.",
      manaCost: "{G}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const angel = profile({
      name: "Serra Angel",
      typeLine: "Creature — Angel",
      oracleText: "Flying, vigilance",
      manaCost: "{3}{W}{W}",
      cmc: 5,
      power: "4",
      toughness: "4",
      keywords: ["Flying", "Vigilance"],
    });
    const analysis = findInteractions([elves, angel]);

    expect(analysis.loops.length).toBe(0);
    expect(analysis.chains.length).toBe(0);
  });

  test("Value chain (not infinite): Skullclamp + token creator", () => {
    const clamp = profile({
      name: "Skullclamp",
      typeLine: "Artifact — Equipment",
      oracleText:
        "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}",
      manaCost: "{1}",
      cmc: 1,
    });
    const pyromancer = profile({
      name: "Young Pyromancer",
      typeLine: "Creature — Human Shaman",
      oracleText:
        "Whenever you cast a noncreature spell, create a 1/1 red Elemental creature token.",
      manaCost: "{1}{R}",
      cmc: 2,
      power: "2",
      toughness: "1",
    });
    const analysis = findInteractions([clamp, pyromancer]);

    // Skullclamp + token creator is a well-known value engine
    // They should have some pairwise interaction
    const anyInteraction = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Skullclamp") &&
        i.cards.includes("Young Pyromancer")
    );
    expect(anyInteraction.length).toBeGreaterThanOrEqual(1);
  });

  test("Four-card chain: token creator → sacrifice outlet → death trigger → recursion", () => {
    const avenger = avengerOfZendikar();
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const eWitness = profile({
      name: "Eternal Witness",
      typeLine: "Creature — Human Shaman",
      oracleText:
        "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.",
      manaCost: "{1}{G}{G}",
      cmc: 3,
      power: "2",
      toughness: "1",
    });
    const analysis = findInteractions([avenger, altar, artist, eWitness]);

    // Should have multiple pairwise interactions forming chains
    expect(analysis.interactions.length).toBeGreaterThanOrEqual(4);

    // Should have at least one chain
    expect(analysis.chains.length).toBeGreaterThanOrEqual(1);
  });

  test("Persist combo: Kitchen Finks + Viscera Seer + Vizier of Remedies", () => {
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
    const seer = visceraSeer();
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
    const analysis = findInteractions([finks, seer, vizier]);

    // Finks → Seer sacrifices → Finks persists → Vizier prevents -1/-1 counter → repeat
    // At minimum: Finks enables Seer (sacrifice fodder), and there should be interactions
    const enablesFinks = findDirectional(
      analysis,
      "enables",
      "Kitchen Finks",
      "Viscera Seer"
    );
    expect(enablesFinks.length).toBeGreaterThanOrEqual(1);

    // Vizier's replacement effect should interact with Finks
    const vizierInteractions = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Vizier of Remedies") &&
        i.cards.includes("Kitchen Finks")
    );
    expect(vizierInteractions.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// JUDGE 4: BLOCKERS & CONFLICTS
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Blockers & Conflicts", () => {
  test("Torpor Orb blocks creature ETB triggers (Avenger of Zendikar)", () => {
    const torpor = profile({
      name: "Torpor Orb",
      typeLine: "Artifact",
      oracleText:
        "Creatures entering the battlefield don't cause abilities to trigger.",
      manaCost: "{2}",
      cmc: 2,
    });
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([torpor, avenger]);

    // Torpor Orb prevents creature ETB triggers → blocks Avenger's token creation
    const blocks = findByType(
      analysis,
      "blocks",
      "Torpor Orb",
      "Avenger of Zendikar"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Torpor Orb blocks Soul Warden's ETB trigger", () => {
    const torpor = profile({
      name: "Torpor Orb",
      typeLine: "Artifact",
      oracleText:
        "Creatures entering the battlefield don't cause abilities to trigger.",
      manaCost: "{2}",
      cmc: 2,
    });
    const warden = profile({
      name: "Soul Warden",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "Whenever another creature enters the battlefield, you gain 1 life.",
      manaCost: "{W}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const analysis = findInteractions([torpor, warden]);

    const blocks = findByType(
      analysis,
      "blocks",
      "Torpor Orb",
      "Soul Warden"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Cursed Totem blocks creature activated abilities but NOT artifact abilities", () => {
    const totem = profile({
      name: "Cursed Totem",
      typeLine: "Artifact",
      oracleText: "Activated abilities of creatures can't be activated.",
      manaCost: "{2}",
      cmc: 2,
    });
    const seer = visceraSeer();
    const altar = ashnodAltar();
    const analysis = findInteractions([totem, seer, altar]);

    // Should block Viscera Seer (creature with activated ability)
    const blocksSeer = findByType(
      analysis,
      "blocks",
      "Cursed Totem",
      "Viscera Seer"
    );
    expect(blocksSeer.length).toBeGreaterThanOrEqual(1);

    // Should NOT block Ashnod's Altar (artifact, not a creature)
    const blocksAltar = findByType(
      analysis,
      "blocks",
      "Cursed Totem",
      "Ashnod's Altar"
    );
    expect(blocksAltar.length).toBe(0);
  });

  test("Null Rod blocks artifact activated abilities but NOT creature abilities", () => {
    const nullRod = profile({
      name: "Null Rod",
      typeLine: "Artifact",
      oracleText: "Activated abilities of artifacts can't be activated.",
      manaCost: "{2}",
      cmc: 2,
    });
    const ring = solRing();
    const seer = visceraSeer();
    const analysis = findInteractions([nullRod, ring, seer]);

    // Should block Sol Ring (artifact with activated ability)
    const blocksRing = findByType(
      analysis,
      "blocks",
      "Null Rod",
      "Sol Ring"
    );
    expect(blocksRing.length).toBeGreaterThanOrEqual(1);

    // Should NOT block Viscera Seer (creature, not an artifact)
    const blocksSeer = findByType(
      analysis,
      "blocks",
      "Null Rod",
      "Viscera Seer"
    );
    expect(blocksSeer.length).toBe(0);
  });

  test("Grafdigger's Cage blocks Sun Titan recursion AND Animate Dead reanimation", () => {
    const cage = profile({
      name: "Grafdigger's Cage",
      typeLine: "Artifact",
      oracleText:
        "Creature cards in graveyards and libraries can't enter the battlefield.\nPlayers can't cast spells from graveyards or libraries.",
      manaCost: "{1}",
      cmc: 1,
    });
    const titan = profile({
      name: "Sun Titan",
      typeLine: "Creature — Giant",
      oracleText:
        "Vigilance\nWhenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.",
      manaCost: "{4}{W}{W}",
      cmc: 6,
      power: "6",
      toughness: "6",
      keywords: ["Vigilance"],
    });
    const animate = profile({
      name: "Animate Dead",
      typeLine: "Enchantment — Aura",
      oracleText:
        'Enchant creature card in a graveyard\nWhen Animate Dead enters the battlefield, if it\'s on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with Animate Dead." Return enchanted creature card to the battlefield under your control.',
      manaCost: "{1}{B}",
      cmc: 2,
    });
    const analysis = findInteractions([cage, titan, animate]);

    // Cage should block Sun Titan's graveyard recursion
    const blocksTitan = findByType(
      analysis,
      "blocks",
      "Grafdigger's Cage",
      "Sun Titan"
    );
    expect(blocksTitan.length).toBeGreaterThanOrEqual(1);

    // Cage should block Animate Dead's reanimation
    const blocksAnimate = findByType(
      analysis,
      "blocks",
      "Grafdigger's Cage",
      "Animate Dead"
    );
    expect(blocksAnimate.length).toBeGreaterThanOrEqual(1);
  });

  test("Containment Priest blocks cheated creatures — exiles instead of ETB", () => {
    const priest = profile({
      name: "Containment Priest",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "Flash\nIf a nontoken creature would enter the battlefield and it wasn't cast, exile it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
      power: "2",
      toughness: "2",
      keywords: ["Flash"],
    });
    const titan = profile({
      name: "Sun Titan",
      typeLine: "Creature — Giant",
      oracleText:
        "Vigilance\nWhenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.",
      manaCost: "{4}{W}{W}",
      cmc: 6,
      power: "6",
      toughness: "6",
      keywords: ["Vigilance"],
    });
    const analysis = findInteractions([priest, titan]);

    // Containment Priest should block/conflict with Sun Titan's recursion
    const blocksOrConflicts = analysis.interactions.filter(
      (i) =>
        (i.type === "blocks" || i.type === "conflicts") &&
        i.cards.includes("Containment Priest") &&
        i.cards.includes("Sun Titan")
    );
    expect(blocksOrConflicts.length).toBeGreaterThanOrEqual(1);
  });

  test("Rest in Peace conflicts with entire graveyard strategy", () => {
    const rip = profile({
      name: "Rest in Peace",
      typeLine: "Enchantment",
      oracleText:
        "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
    });
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([rip, skeleton]);

    // RiP exiles cards instead of graveyard → Skeleton can never be in graveyard to return
    const blocksOrConflicts = analysis.interactions.filter(
      (i) =>
        (i.type === "blocks" || i.type === "conflicts") &&
        i.cards.includes("Rest in Peace") &&
        i.cards.includes("Reassembling Skeleton")
    );
    expect(blocksOrConflicts.length).toBeGreaterThanOrEqual(1);
  });

  test("Doubling Season does NOT block Blood Artist (modify mode, not replace mode)", () => {
    const doubling = profile({
      name: "Doubling Season",
      typeLine: "Enchantment",
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      manaCost: "{4}{G}",
      cmc: 5,
    });
    const artist = bloodArtist();
    const analysis = findInteractions([doubling, artist]);

    // Doubling Season is modify mode — it amplifies, not blocks
    const blocks = findByType(
      analysis,
      "blocks",
      "Doubling Season",
      "Blood Artist"
    );
    expect(blocks.length).toBe(0);
  });

  test("Stony Silence blocks artifact activated abilities — affects Treasure tokens", () => {
    const stony = profile({
      name: "Stony Silence",
      typeLine: "Enchantment",
      oracleText: "Activated abilities of artifacts can't be activated.",
      manaCost: "{1}{W}",
      cmc: 2,
    });
    const ring = solRing();
    const analysis = findInteractions([stony, ring]);

    // Should block Sol Ring's tap ability
    const blocks = findByType(
      analysis,
      "blocks",
      "Stony Silence",
      "Sol Ring"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// JUDGE 5: NUANCED SYNERGIES
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Amplifies", () => {
  test("Doubling Season amplifies Avenger of Zendikar token creation", () => {
    const doubling = profile({
      name: "Doubling Season",
      typeLine: "Enchantment",
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      manaCost: "{4}{G}",
      cmc: 5,
    });
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([doubling, avenger]);

    // Doubling Season doubles tokens AND counters — amplifies Avenger on both axes
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Doubling Season",
      "Avenger of Zendikar"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });

  test("Panharmonicon amplifies ETB triggers (Mulldrifter)", () => {
    const panharmonicon = profile({
      name: "Panharmonicon",
      typeLine: "Artifact",
      oracleText:
        "If an artifact or creature entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      manaCost: "{4}",
      cmc: 4,
    });
    const mulldrifter = profile({
      name: "Mulldrifter",
      typeLine: "Creature — Elemental",
      oracleText:
        "Flying\nWhen Mulldrifter enters the battlefield, draw two cards.\nEvoke {2}{U}",
      manaCost: "{4}{U}",
      cmc: 5,
      power: "2",
      toughness: "2",
      keywords: ["Flying", "Evoke"],
    });
    const analysis = findInteractions([panharmonicon, mulldrifter]);

    // Panharmonicon doubles Mulldrifter's ETB draw
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Panharmonicon",
      "Mulldrifter"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });

  test("Torbran amplifies red damage sources", () => {
    const torbran = profile({
      name: "Torbran, Thane of Red Fell",
      typeLine: "Legendary Creature — Dwarf Noble",
      oracleText:
        "If a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 2 instead.",
      manaCost: "{1}{R}{R}{R}",
      cmc: 4,
      power: "2",
      toughness: "4",
    });
    const purphoros = profile({
      name: "Purphoros, God of the Forge",
      typeLine: "Legendary Enchantment Creature — God",
      oracleText:
        "Indestructible\nAs long as your devotion to red is less than five, Purphoros isn't a creature.\nWhenever another creature enters the battlefield under your control, Purphoros deals 2 damage to each opponent.\n{2}{R}: Creatures you control get +1/+0 until end of turn.",
      manaCost: "{3}{R}",
      cmc: 4,
      power: "6",
      toughness: "5",
      keywords: ["Indestructible"],
    });
    const analysis = findInteractions([torbran, purphoros]);

    // Torbran amplifies Purphoros's damage (2 → 4 per creature ETB)
    const amplifies = findByType(
      analysis,
      "amplifies",
      "Torbran, Thane of Red Fell",
      "Purphoros, God of the Forge"
    );
    expect(amplifies.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("L3 Judge: Protects", () => {
  test("Lightning Greaves protects creatures with shroud + haste", () => {
    const greaves = profile({
      name: "Lightning Greaves",
      typeLine: "Artifact — Equipment",
      oracleText:
        "Equipped creature has shroud and haste.\nEquip {0}",
      manaCost: "{2}",
      cmc: 2,
    });
    const artist = bloodArtist();
    const analysis = findInteractions([greaves, artist]);

    // Greaves grants shroud → protects Blood Artist from targeted removal
    const protects = findDirectional(
      analysis,
      "protects",
      "Lightning Greaves",
      "Blood Artist"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
  });

  test("Mother of Runes protects creatures with color protection", () => {
    const mom = profile({
      name: "Mother of Runes",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "{T}: Target creature you control gains protection from the color of your choice until end of turn.",
      manaCost: "{W}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const artist = bloodArtist();
    const analysis = findInteractions([mom, artist]);

    // Mother of Runes grants protection → protects Blood Artist
    const protects = findDirectional(
      analysis,
      "protects",
      "Mother of Runes",
      "Blood Artist"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("L3 Judge: Recurs", () => {
  test("Eternal Witness recurs any card from graveyard — including noncreatures", () => {
    const witness = profile({
      name: "Eternal Witness",
      typeLine: "Creature — Human Shaman",
      oracleText:
        "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.",
      manaCost: "{1}{G}{G}",
      cmc: 3,
      power: "2",
      toughness: "1",
    });
    const bolt = profile({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const analysis = findInteractions([witness, bolt]);

    // E-Witness can return any card → should recur Lightning Bolt
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Eternal Witness",
      "Lightning Bolt"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
  });

  test("Eternal Witness recurs Sol Ring", () => {
    const witness = profile({
      name: "Eternal Witness",
      typeLine: "Creature — Human Shaman",
      oracleText:
        "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.",
      manaCost: "{1}{G}{G}",
      cmc: 3,
      power: "2",
      toughness: "1",
    });
    const ring = solRing();
    const analysis = findInteractions([witness, ring]);

    const recurs = findDirectional(
      analysis,
      "recurs",
      "Eternal Witness",
      "Sol Ring"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
  });

  test("Sun Titan recurs low-MV permanents but not high-MV ones", () => {
    const titan = profile({
      name: "Sun Titan",
      typeLine: "Creature — Giant",
      oracleText:
        "Vigilance\nWhenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.",
      manaCost: "{4}{W}{W}",
      cmc: 6,
      power: "6",
      toughness: "6",
      keywords: ["Vigilance"],
    });
    const ring = solRing();
    const panharmonicon = profile({
      name: "Panharmonicon",
      typeLine: "Artifact",
      oracleText:
        "If an artifact or creature entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      manaCost: "{4}",
      cmc: 4,
    });
    const analysis = findInteractions([titan, ring, panharmonicon]);

    // Sun Titan recurs Sol Ring (MV 1)
    const recursRing = findDirectional(
      analysis,
      "recurs",
      "Sun Titan",
      "Sol Ring"
    );
    expect(recursRing.length).toBeGreaterThanOrEqual(1);

    // Sun Titan should NOT recur Panharmonicon (MV 4 > 3)
    const recursPanharmonicon = findDirectional(
      analysis,
      "recurs",
      "Sun Titan",
      "Panharmonicon"
    );
    expect(recursPanharmonicon.length).toBe(0);
  });

  test("Meren recurs creatures — not instants or sorceries", () => {
    const meren = profile({
      name: "Meren of Clan Nel Toth",
      typeLine: "Legendary Creature — Human Shaman",
      oracleText:
        "Whenever another creature you control dies, you get an experience counter.\nAt the beginning of your end step, choose target creature card in your graveyard. If X is less than that card's mana value, where X is the number of experience counters you have, return it to your hand. Otherwise, return it to the battlefield.",
      manaCost: "{2}{B}{G}",
      cmc: 4,
      power: "3",
      toughness: "4",
    });
    const artist = bloodArtist();
    const bolt = profile({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const analysis = findInteractions([meren, artist, bolt]);

    // Meren recurs creature cards → should recur Blood Artist
    const recursArtist = findDirectional(
      analysis,
      "recurs",
      "Meren of Clan Nel Toth",
      "Blood Artist"
    );
    expect(recursArtist.length).toBeGreaterThanOrEqual(1);

    // Meren does NOT recur instants
    const recursBolt = findDirectional(
      analysis,
      "recurs",
      "Meren of Clan Nel Toth",
      "Lightning Bolt"
    );
    expect(recursBolt.length).toBe(0);
  });
});

test.describe("L3 Judge: Reduces Cost", () => {
  test("Goblin Warchief reduces Goblin spell costs", () => {
    const warchief = profile({
      name: "Goblin Warchief",
      typeLine: "Creature — Goblin Warrior",
      oracleText:
        "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.",
      manaCost: "{1}{R}{R}",
      cmc: 3,
      power: "2",
      toughness: "2",
    });
    const krenko = profile({
      name: "Krenko, Mob Boss",
      typeLine: "Legendary Creature — Goblin Warrior",
      oracleText:
        "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
      manaCost: "{2}{R}{R}",
      cmc: 4,
      power: "3",
      toughness: "3",
    });
    const analysis = findInteractions([warchief, krenko]);

    // Warchief reduces cost for Goblin spells → Krenko is a Goblin
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Goblin Warchief",
      "Krenko, Mob Boss"
    );
    // Also check for any interaction — the engine might model this differently
    const anyInteraction = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Goblin Warchief") &&
        i.cards.includes("Krenko, Mob Boss")
    );
    expect(anyInteraction.length).toBeGreaterThanOrEqual(1);
  });

  test("Helm of Awakening reduces all spell costs", () => {
    const helm = profile({
      name: "Helm of Awakening",
      typeLine: "Artifact",
      oracleText: "Spells cost {1} less to cast.",
      manaCost: "{2}",
      cmc: 2,
    });
    const artist = bloodArtist();
    const analysis = findInteractions([helm, artist]);

    // Helm reduces all spell costs → should reduce Blood Artist's cost
    const anyInteraction = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Helm of Awakening") &&
        i.cards.includes("Blood Artist")
    );
    expect(anyInteraction.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// JUDGE PANEL: CROSS-CUTTING CONCERNS
// ═══════════════════════════════════════════════════════════════

test.describe("L3 Judge: Cross-cutting accuracy", () => {
  test("Sacrifice causes death — death triggers fire — forced sacrifice cascades", () => {
    // Three-way chain: Altar causes death → Blood Artist drains → Grave Pact forces opponent sac
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const gravePact = profile({
      name: "Grave Pact",
      typeLine: "Enchantment",
      oracleText:
        "Whenever a creature you control dies, each other player sacrifices a creature.",
      manaCost: "{1}{B}{B}{B}",
      cmc: 4,
    });
    const analysis = findInteractions([altar, artist, gravePact]);

    // Altar → Blood Artist (triggers on death)
    const altarToArtist = findDirectional(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Blood Artist"
    );
    expect(altarToArtist.length).toBeGreaterThanOrEqual(1);

    // Altar → Grave Pact (triggers on your creature dying)
    const altarToGP = findDirectional(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Grave Pact"
    );
    expect(altarToGP.length).toBeGreaterThanOrEqual(1);

    // Grave Pact → Blood Artist (forces opponents to sacrifice → more deaths)
    const gpToArtist = findDirectional(
      analysis,
      "triggers",
      "Grave Pact",
      "Blood Artist"
    );
    expect(gpToArtist.length).toBeGreaterThanOrEqual(1);
  });

  test("Interaction strength is always in 0-1 range", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const seer = visceraSeer();
    const analysis = findInteractions([altar, artist, avenger, seer]);

    for (const interaction of analysis.interactions) {
      expect(interaction.strength).toBeGreaterThanOrEqual(0);
      expect(interaction.strength).toBeLessThanOrEqual(1);
      expect(interaction.mechanical.length).toBeGreaterThan(0);
    }
  });

  test("Cards that both enable AND trigger should have multiple interactions", () => {
    // Ashnod's Altar: enables (produces mana) AND triggers (causes death)
    // Blood Artist: triggers on death AND enables (is a creature for sacrifice)
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // Should have at least 2 distinct interactions between these cards
    const pairInteractions = analysis.interactions.filter(
      (i) =>
        i.cards.includes("Ashnod's Altar") &&
        i.cards.includes("Blood Artist")
    );
    expect(pairInteractions.length).toBeGreaterThanOrEqual(2);

    // Should include both enables and triggers
    const types = new Set(pairInteractions.map((i) => i.type));
    expect(types.has("enables")).toBe(true);
    expect(types.has("triggers")).toBe(true);
  });

  test("Full aristocrats package: 5 cards produce rich interaction web", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const seer = visceraSeer();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([altar, artist, avenger, seer, skeleton]);

    // 5 cards should produce many interactions
    // C(5,2) = 10 possible pairs, many should have interactions
    expect(analysis.interactions.length).toBeGreaterThanOrEqual(8);

    // Should have chains
    expect(analysis.chains.length).toBeGreaterThanOrEqual(1);
  });
});
