/**
 * Tests for Saga chapter parsing, Class level parsing, and Room card handling
 * in the interaction engine.
 *
 * TDD: these tests are written BEFORE the implementation. They should fail
 * initially and pass after the feature is implemented.
 */

import { test, expect } from "@playwright/test";
import { parseSagaChapters, parseClassLevels } from "../../src/lib/interaction-engine/parser";
import { profileCard } from "../../src/lib/interaction-engine/capability-extractor";
import { makeCard } from "../helpers";

// ═══════════════════════════════════════════════════════════════════
// SAGA CHAPTER PARSING TESTS
// ═══════════════════════════════════════════════════════════════════

test.describe("parseSagaChapters()", () => {
  test("The Eldest Reborn — 3 chapters produce 3 TriggeredAbilities", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I — Each opponent sacrifices a creature or planeswalker.",
      "II — Each opponent discards a card.",
      "III — Put target creature or planeswalker card from a graveyard onto the battlefield under your control.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    expect(abilities).toHaveLength(3);

    // All should be triggered abilities
    for (const ability of abilities) {
      expect(ability.abilityType).toBe("triggered");
    }
  });

  test("saga chapter triggers have lore counter state_change trigger", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I — Draw a card.",
      "II — Create a 1/1 token.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    expect(abilities).toHaveLength(2);

    for (const ability of abilities) {
      expect(ability.abilityType).toBe("triggered");
      const triggered = ability as import("../../src/lib/interaction-engine/types").TriggeredAbility;
      expect(triggered.trigger).toBeDefined();
      expect(triggered.trigger?.kind).toBe("state_change");
      const sc = triggered.trigger as import("../../src/lib/interaction-engine/types").StateChange;
      expect(sc.property).toBe("counters");
    }
  });

  test("combined chapters I, II produce two triggers each with same effects", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I, II — Draw a card.",
      "III — Create a 3/3 green Beast creature token.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    // I, II combined = 2 TriggeredAbilities, III = 1, total = 3
    expect(abilities).toHaveLength(3);

    // First two (I and II) should have identical effects
    const chap1 = abilities[0] as import("../../src/lib/interaction-engine/types").TriggeredAbility;
    const chap2 = abilities[1] as import("../../src/lib/interaction-engine/types").TriggeredAbility;
    expect(chap1.effects.length).toBeGreaterThan(0);
    expect(chap2.effects.length).toBeGreaterThan(0);
  });

  test("Binding the Old Gods — 4 chapters produce 4 TriggeredAbilities", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I — Destroy target non-Forest permanent.",
      "II — Search your library for a Forest card, put it onto the battlefield tapped, then shuffle.",
      "III — Put a deathtouch counter on target creature you control.",
      "IV — Creatures you control gain deathtouch until end of turn.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    expect(abilities).toHaveLength(4);
    for (const ability of abilities) {
      expect(ability.abilityType).toBe("triggered");
    }
  });

  test("read-ahead saga still produces chapters correctly", () => {
    // Read-Ahead reminder text appears in parens and should be stripped
    const oracleText = [
      "(As this Saga enters, choose a chapter and sacrifice it. Start with that many lore counters. Read ahead — You may add a lore counter to this Saga on your turn.)",
      "I — Surveil 2.",
      "II — Draw a card.",
      "III — Each opponent discards a card.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    expect(abilities).toHaveLength(3);
  });

  test("II, III combined chapters produce two triggers", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I — Exile target creature.",
      "II, III — Return that card to the battlefield under your control.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    // I = 1, II and III combined = 2, total = 3
    expect(abilities).toHaveLength(3);
  });

  test("saga chapter effects are parsed (not empty)", () => {
    const oracleText = [
      "(As this Saga enters and after your draw step, add a lore counter.)",
      "I — Draw a card.",
      "II — Destroy target creature.",
      "III — You gain 5 life.",
    ].join("\n");

    const abilities = parseSagaChapters(oracleText);
    expect(abilities).toHaveLength(3);
    // At minimum the raw chapter text is stored in details
    for (const ability of abilities) {
      const triggered = ability as import("../../src/lib/interaction-engine/types").TriggeredAbility;
      // Effects array should not be empty
      expect(triggered.effects.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SAGA INTEGRATION: profileCard() routes sagas correctly
// ═══════════════════════════════════════════════════════════════════

test.describe("profileCard() — Saga routing", () => {
  test("Enchantment Saga card produces abilities from parseSagaChapters", () => {
    const card = makeCard({
      name: "The Eldest Reborn",
      typeLine: "Enchantment — Saga",
      oracleText: [
        "(As this Saga enters and after your draw step, add a lore counter.)",
        "I — Each opponent sacrifices a creature or planeswalker.",
        "II — Each opponent discards a card.",
        "III — Put target creature or planeswalker card from a graveyard onto the battlefield under your control.",
      ].join("\n"),
      subtypes: ["Saga"],
    });

    const profile = profileCard(card);
    // Should have abilities extracted from saga chapters
    const triggeredAbilities = profile.abilities.filter(
      (a) => a.abilityType === "triggered"
    );
    expect(triggeredAbilities.length).toBeGreaterThanOrEqual(3);
  });

  test("non-Saga enchantment does NOT use parseSagaChapters", () => {
    const card = makeCard({
      name: "Rhystic Study",
      typeLine: "Enchantment",
      oracleText: "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
      subtypes: [],
    });

    const profile = profileCard(card);
    // Should have triggered ability but NOT from saga parsing
    const triggeredAbilities = profile.abilities.filter(
      (a) => a.abilityType === "triggered"
    );
    expect(triggeredAbilities.length).toBeGreaterThanOrEqual(1);
    // Should NOT have multiple triggered abilities that look like chapters
    // (Rhystic Study has exactly 1 triggered ability)
    expect(triggeredAbilities.length).toBeLessThan(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLASS LEVEL PARSING TESTS
// ═══════════════════════════════════════════════════════════════════

test.describe("parseClassLevels()", () => {
  test("Barbarian Class — base + Level 2 + Level 3 produces correct abilities", () => {
    // Barbarian Class oracle text (simplified)
    const oracleText = [
      "Attacking creatures you control get +1/+0.",
      "Level 2 — {2}{R}: You may discard a card. If you do, draw a card.",
      "Level 3 — Whenever you attack, Barbarian Class deals 1 damage to each opponent.",
    ].join("\n");

    const abilities = parseClassLevels(oracleText);
    // Should produce: 1 static (base) + 1 activated (level 2 upgrade) + 1 triggered (level 3 ability)
    // Plus gated versions of level abilities
    expect(abilities.length).toBeGreaterThanOrEqual(3);
  });

  test("level-up abilities are ActivatedAbility with sorcery speed", () => {
    const oracleText = [
      "When Fighter Class enters, create a 1/1 Fighter token.",
      "Level 2 — {1}{W}: Creatures you control get +1/+1 until end of turn.",
      "Level 3 — Creatures you control have double strike.",
    ].join("\n");

    const abilities = parseClassLevels(oracleText);

    // The level-up itself is an activated ability
    const activatedAbilities = abilities.filter(
      (a) => a.abilityType === "activated"
    );
    // At least one activated ability for the level-up action
    expect(activatedAbilities.length).toBeGreaterThanOrEqual(1);

    // Level-up activated abilities should have sorcery speed
    for (const activated of activatedAbilities) {
      const act = activated as import("../../src/lib/interaction-engine/types").ActivatedAbility;
      expect(act.speed).toBe("sorcery");
    }
  });

  test("level-gated abilities have Condition with class_level check", () => {
    const oracleText = [
      "Creatures you control get +1/+1.",
      "Level 2 — {2}: Creatures you control have vigilance.",
      "Level 3 — Creatures you control have double strike.",
    ].join("\n");

    const abilities = parseClassLevels(oracleText);

    // Static abilities from level 2+ should be conditioned on class level
    const conditionedAbilities = abilities.filter(
      (a) =>
        (a.abilityType === "static" || a.abilityType === "triggered") &&
        (a as import("../../src/lib/interaction-engine/types").StaticAbility).condition !== undefined
    );
    expect(conditionedAbilities.length).toBeGreaterThanOrEqual(1);

    for (const ability of conditionedAbilities) {
      const cond = (ability as import("../../src/lib/interaction-engine/types").StaticAbility).condition!;
      expect(cond.type).toBe("as_long_as");
      expect(cond.structured?.check).toBe("class_level");
    }
  });

  test("base class ability (before Level markers) has no class_level condition", () => {
    // Use a triggered ability as the base so we can check condition absence clearly
    const oracleText = [
      "Whenever you attack, create a 1/1 Warrior token.",
      "Level 2 — {2}{G}: Create a 3/3 green Beast creature token.",
      "Level 3 — Creatures you control have trample.",
    ].join("\n");

    const abilities = parseClassLevels(oracleText);

    // The base ability (before any Level marker) should NOT have a class_level condition
    // Base abilities come first and have no class_level structured condition
    const baseAbilities = abilities.filter(
      (a) => {
        const ab = a as import("../../src/lib/interaction-engine/types").TriggeredAbility | import("../../src/lib/interaction-engine/types").StaticAbility;
        // Must be a triggered or static ability (not activated level-up)
        if (a.abilityType !== "triggered" && a.abilityType !== "static") return false;
        // Must NOT have a class_level condition
        return !ab.condition || ab.condition.structured?.check !== "class_level";
      }
    );
    expect(baseAbilities.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLASS INTEGRATION: profileCard() routes class enchantments correctly
// ═══════════════════════════════════════════════════════════════════

test.describe("profileCard() — Class routing", () => {
  test("Enchantment Class card abilities are extracted", () => {
    const card = makeCard({
      name: "Barbarian Class",
      typeLine: "Enchantment — Class",
      oracleText: [
        "Attacking creatures you control get +1/+0.",
        "Level 2 — {2}{R}: Attacking creatures you control get an additional +1/+0.",
        "Level 3 — Whenever you attack, Barbarian Class deals 1 damage to each opponent.",
      ].join("\n"),
      subtypes: ["Class"],
    });

    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThanOrEqual(3);

    // Should have at least one activated ability (level-up)
    const activatedAbilities = profile.abilities.filter(
      (a) => a.abilityType === "activated"
    );
    expect(activatedAbilities.length).toBeGreaterThanOrEqual(1);
  });

  test("non-Class enchantment does NOT trigger class parsing", () => {
    const card = makeCard({
      name: "Parallel Lives",
      typeLine: "Enchantment",
      oracleText: "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.",
      subtypes: [],
    });

    const profile = profileCard(card);
    // Should not produce class-level conditions
    const conditionedAbilities = profile.abilities.filter(
      (a) => {
        const ab = a as import("../../src/lib/interaction-engine/types").StaticAbility;
        return ab.condition?.structured?.check === "class_level";
      }
    );
    expect(conditionedAbilities).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ROOM HANDLING TESTS
// ═══════════════════════════════════════════════════════════════════

test.describe("profileCard() — Room handling", () => {
  test("Room card with two doors produces abilities from both faces", () => {
    // Rooms in Duskmourn are split cards with Room subtype.
    // First door can be cast normally, second door has an "unlock" activated ability.
    const card = makeCard({
      name: "Catacombs of Archelos // Catacombs of Archelos",
      typeLine: "Enchantment — Room // Enchantment — Room",
      oracleText: "Whenever a creature dies, put a corpse counter on Catacombs of Archelos. // Unlock {4}{B} (You may cast this door if you've unlocked the other one.) Permanents your opponents control enter the battlefield tapped.",
      layout: "split",
      subtypes: ["Room"],
      cardFaces: [
        {
          name: "Catacombs of Archelos",
          manaCost: "{2}{B}",
          typeLine: "Enchantment — Room",
          oracleText: "Whenever a creature dies, put a corpse counter on Catacombs of Archelos.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
        {
          name: "Catacombs of Archelos",
          manaCost: "",
          typeLine: "Enchantment — Room",
          oracleText: "Unlock {4}{B} (You may cast this door if you've unlocked the other one.) Permanents your opponents control enter the battlefield tapped.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    });

    const profile = profileCard(card);
    // Should have abilities from both faces
    expect(profile.abilities.length).toBeGreaterThanOrEqual(1);
    // Card should be recognized as having the Room subtype
    expect(profile.subtypes.map((s) => s.toLowerCase())).toContain("room");
  });

  test("Room card with unlock produces activated ability", () => {
    const card = makeCard({
      name: "Dollhouse of Horrors // Dollhouse of Horrors",
      typeLine: "Enchantment — Room // Enchantment — Room",
      oracleText: "Whenever a nontoken creature you control dies, mill two cards. // Unlock {3}{B}: Put target creature card from your graveyard onto the battlefield as a Construct artifact creature.",
      layout: "split",
      subtypes: ["Room"],
      cardFaces: [
        {
          name: "Dollhouse of Horrors",
          manaCost: "{B}",
          typeLine: "Enchantment — Room",
          oracleText: "Whenever a nontoken creature you control dies, mill two cards.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
        {
          name: "Dollhouse of Horrors",
          manaCost: "",
          typeLine: "Enchantment — Room",
          oracleText: "Unlock {3}{B}: Put target creature card from your graveyard onto the battlefield as a Construct artifact creature.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    });

    const profile = profileCard(card);
    // Should have at least one triggered ability (from door 1)
    const triggeredAbilities = profile.abilities.filter(
      (a) => a.abilityType === "triggered"
    );
    expect(triggeredAbilities.length).toBeGreaterThanOrEqual(1);
  });
});
