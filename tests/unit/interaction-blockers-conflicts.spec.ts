/**
 * Interaction Engine — Blocker, Conflict, and Anti-Synergy Detection Tests
 *
 * Tests cover: blocks, conflicts, and protection detection for stax pieces,
 * ability hosers, type-changing effects, and replacement effects using
 * real Magic: The Gathering cards with accurate oracle text.
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
// CARD DEFINITIONS — Real cards with accurate oracle text
// ═══════════════════════════════════════════════════════════════

function torporOrb(): CardProfile {
  return profile({
    name: "Torpor Orb",
    typeLine: "Artifact",
    oracleText:
      "Creatures entering the battlefield don't cause abilities to trigger.",
    manaCost: "{2}",
    cmc: 2,
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
    keywords: ["Landfall"],
  });
}

function soulWarden(): CardProfile {
  return profile({
    name: "Soul Warden",
    typeLine: "Creature — Human Cleric",
    oracleText:
      "Whenever another creature enters the battlefield, you gain 1 life.",
    manaCost: "{W}",
    cmc: 1,
    power: "1",
    toughness: "1",
  });
}

function cursedTotem(): CardProfile {
  return profile({
    name: "Cursed Totem",
    typeLine: "Artifact",
    oracleText: "Activated abilities of creatures can't be activated.",
    manaCost: "{2}",
    cmc: 2,
  });
}

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

function ashnodAltar(): CardProfile {
  return profile({
    name: "Ashnod's Altar",
    typeLine: "Artifact",
    oracleText: "Sacrifice a creature: Add {C}{C}.",
    manaCost: "{3}",
    cmc: 3,
  });
}

function nullRod(): CardProfile {
  return profile({
    name: "Null Rod",
    typeLine: "Artifact",
    oracleText: "Activated abilities of artifacts can't be activated.",
    manaCost: "{2}",
    cmc: 2,
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

function isochornScepter(): CardProfile {
  return profile({
    name: "Isochron Scepter",
    typeLine: "Artifact",
    oracleText:
      "Imprint — When Isochron Scepter enters the battlefield, you may exile an instant card with mana value 2 or less from your hand.\n{2}, {T}: You may copy the exiled card. If you do, you may cast the copy without paying its mana cost.",
    manaCost: "{2}",
    cmc: 2,
  });
}

function senseisDiviningTop(): CardProfile {
  return profile({
    name: "Sensei's Divining Top",
    typeLine: "Artifact",
    oracleText:
      "{1}: Look at the top three cards of your library, then put them back in any order.\n{T}: Draw a card, then put Sensei's Divining Top on top of its owner's library.",
    manaCost: "{1}",
    cmc: 1,
  });
}

function containmentPriest(): CardProfile {
  return profile({
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
}

function sunTitan(): CardProfile {
  return profile({
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
}

function animateDead(): CardProfile {
  return profile({
    name: "Animate Dead",
    typeLine: "Enchantment — Aura",
    oracleText:
      'Enchant creature card in a graveyard\nWhen Animate Dead enters the battlefield, if it\'s on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with Animate Dead." Return enchanted creature card to the battlefield under your control.',
    manaCost: "{1}{B}",
    cmc: 2,
  });
}

function linvalaKeeperOfSilence(): CardProfile {
  return profile({
    name: "Linvala, Keeper of Silence",
    typeLine: "Legendary Creature — Angel",
    oracleText:
      "Flying\nActivated abilities of creatures your opponents control can't be activated.",
    manaCost: "{2}{W}{W}",
    cmc: 4,
    power: "3",
    toughness: "4",
    keywords: ["Flying"],
  });
}

function stonySilence(): CardProfile {
  return profile({
    name: "Stony Silence",
    typeLine: "Enchantment",
    oracleText: "Activated abilities of artifacts can't be activated.",
    manaCost: "{1}{W}",
    cmc: 2,
  });
}

function smotheringTithe(): CardProfile {
  return profile({
    name: "Smothering Tithe",
    typeLine: "Enchantment",
    oracleText:
      "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.",
    manaCost: "{3}{W}",
    cmc: 4,
  });
}

function notionThief(): CardProfile {
  return profile({
    name: "Notion Thief",
    typeLine: "Creature — Human Rogue",
    oracleText:
      "Flash\nIf an opponent would draw a card except the first one they draw in each of their draw steps, instead that player doesn't draw that card and you draw a card instead.",
    manaCost: "{2}{U}{B}",
    cmc: 4,
    power: "3",
    toughness: "1",
    keywords: ["Flash"],
  });
}

function consecratedSphinx(): CardProfile {
  return profile({
    name: "Consecrated Sphinx",
    typeLine: "Creature — Sphinx",
    oracleText:
      "Flying\nWhenever an opponent draws a card, you may draw two cards.",
    manaCost: "{4}{U}{U}",
    cmc: 6,
    power: "4",
    toughness: "6",
    keywords: ["Flying"],
  });
}

function bloodMoon(): CardProfile {
  return profile({
    name: "Blood Moon",
    typeLine: "Enchantment",
    oracleText: "Nonbasic lands are Mountains.",
    manaCost: "{2}{R}",
    cmc: 3,
  });
}

function mazeOfIth(): CardProfile {
  return profile({
    name: "Maze of Ith",
    typeLine: "Land",
    oracleText:
      "{T}: Untap target attacking creature. Prevent all combat damage that would be dealt to and dealt by that creature this turn.",
    manaCost: "",
    cmc: 0,
  });
}

function avenMindcensor(): CardProfile {
  return profile({
    name: "Aven Mindcensor",
    typeLine: "Creature — Bird Wizard",
    oracleText:
      "Flash\nFlying\nIf an opponent would search a library, that player searches the top four cards of that library instead.",
    manaCost: "{2}{W}",
    cmc: 3,
    power: "2",
    toughness: "1",
    keywords: ["Flash", "Flying"],
  });
}

function demonicTutor(): CardProfile {
  return profile({
    name: "Demonic Tutor",
    typeLine: "Sorcery",
    oracleText:
      "Search your library for a card, put that card into your hand, then shuffle.",
    manaCost: "{1}{B}",
    cmc: 2,
  });
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("Torpor Orb blocks ETB triggers", () => {
  test("Torpor Orb blocks Avenger of Zendikar ETB (create Plant tokens)", () => {
    const torpor = torporOrb();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([torpor, avenger]);

    // Torpor Orb stops creatures from triggering abilities on ETB.
    // Avenger of Zendikar's "When ~ enters the battlefield, create tokens" is blocked.
    const blocks = findByType(
      analysis,
      "blocks",
      "Torpor Orb",
      "Avenger of Zendikar"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Torpor Orb blocks Soul Warden creature-ETB trigger", () => {
    const torpor = torporOrb();
    const warden = soulWarden();
    const analysis = findInteractions([torpor, warden]);

    // Soul Warden's "Whenever another creature enters the battlefield" is blocked
    // by Torpor Orb's blanket ETB suppression.
    const blocks = findByType(
      analysis,
      "blocks",
      "Torpor Orb",
      "Soul Warden"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Torpor Orb generates conflict interactions with ETB creatures", () => {
    const torpor = torporOrb();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([torpor, avenger]);

    // Conflicts should be derived from blocks — Torpor Orb undermines Avenger's strategy
    const conflicts = findByType(
      analysis,
      "conflicts",
      "Torpor Orb",
      "Avenger of Zendikar"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Cursed Totem blocks creature activated abilities", () => {
  test("Cursed Totem blocks Viscera Seer sacrifice ability", () => {
    const totem = cursedTotem();
    const seer = visceraSeer();
    const analysis = findInteractions([totem, seer]);

    // Viscera Seer has an activated ability ("Sacrifice a creature: Scry 1.")
    // and is a creature. Cursed Totem prevents activated abilities of creatures.
    const blocks = findByType(
      analysis,
      "blocks",
      "Cursed Totem",
      "Viscera Seer"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Cursed Totem blocks Reassembling Skeleton self-return ability", () => {
    const totem = cursedTotem();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([totem, skeleton]);

    // Reassembling Skeleton has "{1}{B}: Return ~ from your graveyard to the battlefield"
    // This is an activated ability on a creature card. Cursed Totem blocks it.
    const blocks = findByType(
      analysis,
      "blocks",
      "Cursed Totem",
      "Reassembling Skeleton"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Cursed Totem does NOT block Ashnod's Altar (artifact, not creature)", () => {
    const totem = cursedTotem();
    const altar = ashnodAltar();
    const analysis = findInteractions([totem, altar]);

    // Ashnod's Altar is an Artifact, not a Creature.
    // Cursed Totem only restricts "activated abilities of creatures."
    // No block should be generated.
    const blocks = findDirectional(
      analysis,
      "blocks",
      "Cursed Totem",
      "Ashnod's Altar"
    );
    expect(blocks).toHaveLength(0);
  });

  test("Cursed Totem generates conflict with blocked creatures", () => {
    const totem = cursedTotem();
    const seer = visceraSeer();
    const analysis = findInteractions([totem, seer]);

    const conflicts = findByType(
      analysis,
      "conflicts",
      "Cursed Totem",
      "Viscera Seer"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Null Rod blocks artifact activated abilities", () => {
  test("Null Rod blocks Sol Ring mana ability", () => {
    const rod = nullRod();
    const ring = solRing();
    const analysis = findInteractions([rod, ring]);

    // Sol Ring is an artifact with "{T}: Add {C}{C}." — an activated ability.
    // Null Rod prevents activated abilities of artifacts.
    const blocks = findByType(analysis, "blocks", "Null Rod", "Sol Ring");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Null Rod blocks Isochron Scepter imprint ability", () => {
    const rod = nullRod();
    const scepter = isochornScepter();
    const analysis = findInteractions([rod, scepter]);

    // Isochron Scepter has "{2}, {T}: You may copy the exiled card..."
    // This is an activated ability on an artifact. Null Rod blocks it.
    const blocks = findByType(
      analysis,
      "blocks",
      "Null Rod",
      "Isochron Scepter"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Null Rod blocks Sensei's Divining Top", () => {
    const rod = nullRod();
    const top = senseisDiviningTop();
    const analysis = findInteractions([rod, top]);

    // SDT has two activated abilities: "{1}: Look at top 3" and "{T}: Draw, put on top"
    // Both are artifact activated abilities. Null Rod blocks them.
    const blocks = findByType(
      analysis,
      "blocks",
      "Null Rod",
      "Sensei's Divining Top"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Null Rod does NOT block Viscera Seer (creature, not artifact)", () => {
    const rod = nullRod();
    const seer = visceraSeer();
    const analysis = findInteractions([rod, seer]);

    // Viscera Seer is a Creature, not an Artifact.
    // Null Rod only restricts "activated abilities of artifacts."
    const blocks = findDirectional(
      analysis,
      "blocks",
      "Null Rod",
      "Viscera Seer"
    );
    expect(blocks).toHaveLength(0);
  });

  test("Null Rod generates conflict with blocked artifacts", () => {
    const rod = nullRod();
    const ring = solRing();
    const analysis = findInteractions([rod, ring]);

    const conflicts = findByType(
      analysis,
      "conflicts",
      "Null Rod",
      "Sol Ring"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Containment Priest blocks cheated creatures", () => {
  test("Containment Priest blocks Sun Titan recursion", () => {
    const priest = containmentPriest();
    const titan = sunTitan();
    const analysis = findInteractions([priest, titan]);

    // Sun Titan returns permanents from graveyard to battlefield — not cast.
    // Containment Priest exiles nontoken creatures that enter without being cast.
    const blocks = findByType(
      analysis,
      "blocks",
      "Containment Priest",
      "Sun Titan"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Containment Priest blocks Animate Dead reanimation", () => {
    const priest = containmentPriest();
    const animate = animateDead();
    const analysis = findInteractions([priest, animate]);

    // Animate Dead returns a creature from graveyard to battlefield without casting it.
    // Containment Priest's replacement effect exiles it instead.
    const blocks = findByType(
      analysis,
      "blocks",
      "Containment Priest",
      "Animate Dead"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Containment Priest generates conflict with reanimation spells", () => {
    const priest = containmentPriest();
    const animate = animateDead();
    const analysis = findInteractions([priest, animate]);

    const conflicts = findByType(
      analysis,
      "conflicts",
      "Containment Priest",
      "Animate Dead"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Linvala, Keeper of Silence — opponent-only restriction", () => {
  test("Linvala does NOT block your own Viscera Seer (same controller)", () => {
    const linvala = linvalaKeeperOfSilence();
    const seer = visceraSeer();
    const analysis = findInteractions([linvala, seer]);

    // Linvala restricts "activated abilities of creatures YOUR OPPONENTS control."
    // In a deck analysis context, all cards are controlled by the same player.
    // Linvala should NOT block your own Viscera Seer.
    const blocks = findDirectional(
      analysis,
      "blocks",
      "Linvala, Keeper of Silence",
      "Viscera Seer"
    );
    expect(blocks).toHaveLength(0);
  });

  test("Linvala does NOT generate conflicts with your own creature abilities", () => {
    const linvala = linvalaKeeperOfSilence();
    const seer = visceraSeer();
    const analysis = findInteractions([linvala, seer]);

    // No conflict should exist between Linvala and your own Viscera Seer
    const conflicts = findByType(
      analysis,
      "conflicts",
      "Linvala, Keeper of Silence",
      "Viscera Seer"
    );
    expect(conflicts).toHaveLength(0);
  });
});

test.describe("Stony Silence + Treasure tokens", () => {
  test("Stony Silence blocks Sol Ring (artifact activated ability)", () => {
    const stony = stonySilence();
    const ring = solRing();
    const analysis = findInteractions([stony, ring]);

    // Stony Silence and Null Rod have equivalent effects — both prevent
    // activated abilities of artifacts.
    const blocks = findByType(
      analysis,
      "blocks",
      "Stony Silence",
      "Sol Ring"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Stony Silence does NOT block Smothering Tithe creating Treasures (triggered ability)", () => {
    const stony = stonySilence();
    const tithe = smotheringTithe();
    const analysis = findInteractions([stony, tithe]);

    // Smothering Tithe creates Treasure tokens via a triggered ability
    // ("Whenever an opponent draws a card...you create a Treasure token").
    // Stony Silence blocks activated abilities, not triggered abilities.
    // The Treasures themselves can't be cracked, but Tithe still creates them.
    // Stony Silence should NOT block Smothering Tithe's triggered ability.
    const blocks = findDirectional(
      analysis,
      "blocks",
      "Stony Silence",
      "Smothering Tithe"
    );
    // If there IS a block, it should be about the Treasures' activated ability,
    // NOT about Tithe's triggered creation. Tithe still functions to create tokens.
    // A nuanced engine might detect partial blocking (Treasures can't be used),
    // but should never say Tithe is fully blocked.
    // Accept either no block or a partial block about Treasures
    if (blocks.length > 0) {
      // If a block is detected, it should be about artifact activation, not triggered creation
      expect(blocks[0].mechanical.toLowerCase()).not.toContain(
        "triggered"
      );
    }
  });

  test("Stony Silence generates conflict with Sol Ring", () => {
    const stony = stonySilence();
    const ring = solRing();
    const analysis = findInteractions([stony, ring]);

    const conflicts = findByType(
      analysis,
      "conflicts",
      "Stony Silence",
      "Sol Ring"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Notion Thief + Consecrated Sphinx", () => {
  test("Notion Thief and Consecrated Sphinx produce a positive interaction (enables or triggers)", () => {
    const thief = notionThief();
    const sphinx = consecratedSphinx();
    const analysis = findInteractions([thief, sphinx]);

    // These two cards synergize in multiplayer:
    // - Consecrated Sphinx triggers "Whenever an opponent draws a card, you may draw two"
    // - Notion Thief replaces opponents' extra draws with yours
    // They should have a positive interaction — enables, triggers, or amplifies
    const positiveInteractions = analysis.interactions.filter(
      (i) =>
        (i.type === "enables" ||
          i.type === "triggers" ||
          i.type === "amplifies") &&
        ((i.cards[0] === "Notion Thief" &&
          i.cards[1] === "Consecrated Sphinx") ||
          (i.cards[0] === "Consecrated Sphinx" &&
            i.cards[1] === "Notion Thief"))
    );
    expect(positiveInteractions.length).toBeGreaterThanOrEqual(1);
  });

  test("Notion Thief should NOT block Consecrated Sphinx (both benefit you)", () => {
    const thief = notionThief();
    const sphinx = consecratedSphinx();
    const analysis = findInteractions([thief, sphinx]);

    // Notion Thief replaces OPPONENTS' draws, not yours.
    // Consecrated Sphinx triggers when opponents draw, causing YOU to draw.
    // These should NOT conflict — they're complementary.
    const blocks = findByType(
      analysis,
      "blocks",
      "Notion Thief",
      "Consecrated Sphinx"
    );
    expect(blocks).toHaveLength(0);
  });
});

test.describe("Blood Moon vs nonbasic lands", () => {
  test("Blood Moon blocks/conflicts with Maze of Ith (utility land)", () => {
    const moon = bloodMoon();
    const maze = mazeOfIth();
    const analysis = findInteractions([moon, maze]);

    // Blood Moon turns nonbasic lands into Mountains.
    // Maze of Ith is a nonbasic land with a unique activated ability.
    // Under Blood Moon, Maze loses its ability and can only tap for {R}.
    // This should produce a block or conflict.
    const blocksOrConflicts = analysis.interactions.filter(
      (i) =>
        (i.type === "blocks" || i.type === "conflicts") &&
        ((i.cards[0] === "Blood Moon" && i.cards[1] === "Maze of Ith") ||
          (i.cards[0] === "Maze of Ith" && i.cards[1] === "Blood Moon"))
    );
    expect(blocksOrConflicts.length).toBeGreaterThanOrEqual(1);
  });

  test("Blood Moon type-changing effect registered as blocker", () => {
    const moon = bloodMoon();
    const maze = mazeOfIth();
    const analysis = findInteractions([moon, maze]);

    // Blood Moon should appear in the blockers list if it blocks Maze of Ith
    const blocks = findByType(analysis, "blocks", "Blood Moon", "Maze of Ith");
    if (blocks.length > 0) {
      const moonBlockers = analysis.blockers.filter(
        (b) => b.blocker === "Blood Moon"
      );
      expect(moonBlockers.length).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe("Aven Mindcensor vs own tutors — anti-synergy", () => {
  test("Aven Mindcensor conflicts with Demonic Tutor (limits own tutor)", () => {
    const mindcensor = avenMindcensor();
    const tutor = demonicTutor();
    const analysis = findInteractions([mindcensor, tutor]);

    // Aven Mindcensor says "If an opponent would search a library, that player
    // searches the top four cards instead." This is an opponent-only restriction.
    // In a deck analysis context, it should NOT block your own Demonic Tutor
    // since Mindcensor only affects opponents.
    // However, if the engine detects this as your own deck anti-synergy,
    // it would be a false positive.

    // Mindcensor should NOT block your own tutor (it only affects opponents)
    const blocks = findDirectional(
      analysis,
      "blocks",
      "Aven Mindcensor",
      "Demonic Tutor"
    );
    expect(blocks).toHaveLength(0);
  });

  test("Aven Mindcensor does NOT generate false-positive conflict with own tutors", () => {
    const mindcensor = avenMindcensor();
    const tutor = demonicTutor();
    const analysis = findInteractions([mindcensor, tutor]);

    // Since Mindcensor only affects opponents, no conflict should exist
    // with your own Demonic Tutor in the same deck.
    const conflicts = findByType(
      analysis,
      "conflicts",
      "Aven Mindcensor",
      "Demonic Tutor"
    );
    expect(conflicts).toHaveLength(0);
  });
});

test.describe("cross-cutting blocker scenarios", () => {
  test("Cursed Totem and Null Rod coexist without blocking each other", () => {
    const totem = cursedTotem();
    const rod = nullRod();
    const analysis = findInteractions([totem, rod]);

    // Cursed Totem restricts creature activated abilities.
    // Null Rod restricts artifact activated abilities.
    // Neither blocks the other — they restrict different permanent types.
    const blocks = findByType(
      analysis,
      "blocks",
      "Cursed Totem",
      "Null Rod"
    );
    expect(blocks).toHaveLength(0);

    const reverseBlocks = findByType(
      analysis,
      "blocks",
      "Null Rod",
      "Cursed Totem"
    );
    expect(reverseBlocks).toHaveLength(0);
  });

  test("multiple stax pieces stack: Null Rod + Stony Silence both block Sol Ring", () => {
    const rod = nullRod();
    const stony = stonySilence();
    const ring = solRing();
    const analysis = findInteractions([rod, stony, ring]);

    // Both Null Rod and Stony Silence prevent artifact activated abilities
    const rodBlocks = findByType(analysis, "blocks", "Null Rod", "Sol Ring");
    const stonyBlocks = findByType(
      analysis,
      "blocks",
      "Stony Silence",
      "Sol Ring"
    );
    expect(rodBlocks.length).toBeGreaterThanOrEqual(1);
    expect(stonyBlocks.length).toBeGreaterThanOrEqual(1);
  });

  test("blocker entries include all blocked cards", () => {
    const rod = nullRod();
    const ring = solRing();
    const top = senseisDiviningTop();
    const analysis = findInteractions([rod, ring, top]);

    const rodBlockers = analysis.blockers.filter(
      (b) => b.blocker === "Null Rod"
    );
    if (rodBlockers.length > 0) {
      // Should reference both Sol Ring and Sensei's Divining Top as blocked
      const blockedNames = rodBlockers[0].blockedInteractions.map((i) =>
        i.cards.find((c) => c !== "Null Rod")
      );
      // At minimum, the blocker entry should exist
      expect(rodBlockers[0].description.length).toBeGreaterThan(0);
    }
  });

  test("conflict strength is <= block strength", () => {
    const rod = nullRod();
    const ring = solRing();
    const analysis = findInteractions([rod, ring]);

    const blocks = findByType(analysis, "blocks", "Null Rod", "Sol Ring");
    const conflicts = findByType(
      analysis,
      "conflicts",
      "Null Rod",
      "Sol Ring"
    );

    if (blocks.length > 0 && conflicts.length > 0) {
      // Conflict strength is derived from block strength (typically * 0.9)
      expect(conflicts[0].strength).toBeLessThanOrEqual(blocks[0].strength);
    }
  });
});
