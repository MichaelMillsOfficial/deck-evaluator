/**
 * Tests for 5 new keyword entries in the keyword-database:
 * connive, disturb, bargain, incubate, craft
 *
 * TDD: these tests are written BEFORE the implementation. They should fail
 * initially and pass after the feature is implemented.
 */

import { test, expect } from "@playwright/test";
import { lookupKeyword, expandKeyword } from "../../src/lib/interaction-engine/keyword-database";
import { profileCard } from "../../src/lib/interaction-engine/capability-extractor";
import { makeCard } from "../helpers";

// ═══════════════════════════════════════════════════════════════════
// CONNIVE
// ═══════════════════════════════════════════════════════════════════

test.describe("keyword: connive", () => {
  test("connive is in the keyword database", () => {
    const entry = lookupKeyword("connive");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("connive");
  });

  test("connive hasParameter is false", () => {
    const entry = lookupKeyword("connive");
    expect(entry!.hasParameter).toBe(false);
  });

  test("connive expands to at least one AbilityNode", () => {
    const nodes = expandKeyword("connive");
    expect(nodes).toBeDefined();
    expect(nodes!.length).toBeGreaterThan(0);
  });

  test("connive expansion includes draw effect", () => {
    const nodes = expandKeyword("connive");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "triggered") {
        return (n as import("../../src/lib/interaction-engine/types").TriggeredAbility).effects;
      }
      if (n.abilityType === "activated") {
        return (n as import("../../src/lib/interaction-engine/types").ActivatedAbility).effects;
      }
      return [];
    });
    const drawEffect = allEffects.find((e) => e.type === "draw");
    expect(drawEffect).toBeDefined();
    expect(drawEffect!.resource?.category).toBe("cards");
  });

  test("connive expansion includes discard effect", () => {
    const nodes = expandKeyword("connive");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "triggered") {
        return (n as import("../../src/lib/interaction-engine/types").TriggeredAbility).effects;
      }
      if (n.abilityType === "activated") {
        return (n as import("../../src/lib/interaction-engine/types").ActivatedAbility).effects;
      }
      return [];
    });
    const discardEffect = allEffects.find((e) => e.type === "discard");
    expect(discardEffect).toBeDefined();
  });

  test("connive expansion includes counter effect (conditional on discarding nonland)", () => {
    const nodes = expandKeyword("connive");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "triggered") {
        return (n as import("../../src/lib/interaction-engine/types").TriggeredAbility).effects;
      }
      if (n.abilityType === "activated") {
        return (n as import("../../src/lib/interaction-engine/types").ActivatedAbility).effects;
      }
      return [];
    });
    const counterEffect = allEffects.find(
      (e) => e.type === "counter" || e.attribute?.category === "counter"
    );
    expect(counterEffect).toBeDefined();
  });

  test("profileCard() with connive keyword produces abilities", () => {
    const card = makeCard({
      name: "Raffine, Scheming Seer",
      typeLine: "Legendary Creature — Sphinx Demon",
      oracleText: "Flying, ward {1}\nWhenever you attack, each attacking creature connives X, where X is the number of attacking creatures.",
      keywords: ["Flying", "Ward", "Connive"],
    });

    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISTURB
// ═══════════════════════════════════════════════════════════════════

test.describe("keyword: disturb", () => {
  test("disturb is in the keyword database", () => {
    const entry = lookupKeyword("disturb");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("disturb");
  });

  test("disturb hasParameter is true (it takes a mana cost)", () => {
    const entry = lookupKeyword("disturb");
    expect(entry!.hasParameter).toBe(true);
  });

  test("disturb category is zone_casting", () => {
    const entry = lookupKeyword("disturb");
    expect(entry!.category).toBe("zone_casting");
  });

  test("disturb expands to at least one AbilityNode", () => {
    const nodes = expandKeyword("disturb", "{1}{W}");
    expect(nodes).toBeDefined();
    expect(nodes!.length).toBeGreaterThan(0);
  });

  test("disturb expansion contains zone_cast_permission from graveyard", () => {
    const nodes = expandKeyword("disturb", "{2}{U}");
    const allGameEffects = nodes!.flatMap((n) => {
      const effects =
        n.abilityType === "activated"
          ? (n as import("../../src/lib/interaction-engine/types").ActivatedAbility).effects
          : n.abilityType === "static"
          ? (n as import("../../src/lib/interaction-engine/types").StaticAbility).effects
          : [];
      return effects.map((e) => e.gameEffect).filter(Boolean);
    });
    const zonePerm = allGameEffects.find(
      (ge) => ge?.category === "zone_cast_permission" &&
        (ge as import("../../src/lib/interaction-engine/types").ZoneCastPermission).fromZone === "graveyard"
    );
    expect(zonePerm).toBeDefined();
  });

  test("profileCard() with disturb keyword produces zone-casting permission", () => {
    const card = makeCard({
      name: "Lunarch Veteran",
      typeLine: "Creature — Human Cleric",
      oracleText: "Whenever another creature enters the battlefield under your control, you gain 1 life.\nDisturb {1}{W}",
      keywords: ["Disturb"],
    });

    const profile = profileCard(card);
    // Should have zone cast permission for graveyard (from disturb)
    expect(profile.zoneCastPermissions.length).toBeGreaterThan(0);
    const graveyardPerm = profile.zoneCastPermissions.find(
      (p) => p.fromZone === "graveyard"
    );
    expect(graveyardPerm).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// BARGAIN
// ═══════════════════════════════════════════════════════════════════

test.describe("keyword: bargain", () => {
  test("bargain is in the keyword database", () => {
    const entry = lookupKeyword("bargain");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("bargain");
  });

  test("bargain hasParameter is false", () => {
    const entry = lookupKeyword("bargain");
    expect(entry!.hasParameter).toBe(false);
  });

  test("bargain category is cost_modifying", () => {
    const entry = lookupKeyword("bargain");
    expect(entry!.category).toBe("cost_modifying");
  });

  test("bargain expands to at least one AbilityNode", () => {
    const nodes = expandKeyword("bargain");
    expect(nodes).toBeDefined();
    expect(nodes!.length).toBeGreaterThan(0);
  });

  test("bargain expansion describes optional sacrifice cost for bonus", () => {
    const nodes = expandKeyword("bargain");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "static") {
        return (n as import("../../src/lib/interaction-engine/types").StaticAbility).effects;
      }
      return [];
    });
    // Should have some description of the bargain mechanic
    expect(allEffects.length).toBeGreaterThan(0);
    // At least one effect should reference the bargain mechanic
    const bargainEffect = allEffects.find(
      (e) => JSON.stringify(e).toLowerCase().includes("bargain") ||
        JSON.stringify(e).toLowerCase().includes("sacrifice")
    );
    expect(bargainEffect).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// INCUBATE
// ═══════════════════════════════════════════════════════════════════

test.describe("keyword: incubate", () => {
  test("incubate is in the keyword database", () => {
    const entry = lookupKeyword("incubate");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("incubate");
  });

  test("incubate hasParameter is true (the counter count)", () => {
    const entry = lookupKeyword("incubate");
    expect(entry!.hasParameter).toBe(true);
  });

  test("incubate category is simple", () => {
    const entry = lookupKeyword("incubate");
    expect(entry!.category).toBe("simple");
  });

  test("incubate expands to at least one AbilityNode", () => {
    const nodes = expandKeyword("incubate", "3");
    expect(nodes).toBeDefined();
    expect(nodes!.length).toBeGreaterThan(0);
  });

  test("incubate expansion describes token creation", () => {
    const nodes = expandKeyword("incubate", "2");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "static") {
        return (n as import("../../src/lib/interaction-engine/types").StaticAbility).effects;
      }
      if (n.abilityType === "triggered") {
        return (n as import("../../src/lib/interaction-engine/types").TriggeredAbility).effects;
      }
      return [];
    });
    // Should produce incubator token or describe it
    const tokenEffect = allEffects.find(
      (e) =>
        e.type === "create_token" ||
        JSON.stringify(e).toLowerCase().includes("incubator") ||
        JSON.stringify(e).toLowerCase().includes("token")
    );
    expect(tokenEffect).toBeDefined();
  });

  test("incubate with parameter 4 creates incubator with 4 counters", () => {
    const nodes = expandKeyword("incubate", "4");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "static") {
        return (n as import("../../src/lib/interaction-engine/types").StaticAbility).effects;
      }
      return [];
    });
    // Parameter should be referenced in the details
    const effectStr = JSON.stringify(allEffects);
    expect(effectStr).toContain("4");
  });
});

// ═══════════════════════════════════════════════════════════════════
// CRAFT
// ═══════════════════════════════════════════════════════════════════

test.describe("keyword: craft", () => {
  test("craft is in the keyword database", () => {
    const entry = lookupKeyword("craft");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("craft");
  });

  test("craft hasParameter is true (the craft cost)", () => {
    const entry = lookupKeyword("craft");
    expect(entry!.hasParameter).toBe(true);
  });

  test("craft category is cost_modifying", () => {
    const entry = lookupKeyword("craft");
    expect(entry!.category).toBe("cost_modifying");
  });

  test("craft expands to at least one AbilityNode", () => {
    const nodes = expandKeyword("craft", "{2}{R}");
    expect(nodes).toBeDefined();
    expect(nodes!.length).toBeGreaterThan(0);
  });

  test("craft expansion describes transform mechanic", () => {
    const nodes = expandKeyword("craft", "{3}");
    const allEffects = nodes!.flatMap((n) => {
      if (n.abilityType === "static") {
        return (n as import("../../src/lib/interaction-engine/types").StaticAbility).effects;
      }
      if (n.abilityType === "activated") {
        return (n as import("../../src/lib/interaction-engine/types").ActivatedAbility).effects;
      }
      return [];
    });
    // Should reference exile (craft exiles cards from graveyard) or transform
    const craftEffect = allEffects.find(
      (e) =>
        JSON.stringify(e).toLowerCase().includes("transform") ||
        JSON.stringify(e).toLowerCase().includes("craft") ||
        JSON.stringify(e).toLowerCase().includes("exile")
    );
    expect(craftEffect).toBeDefined();
  });

  test("crReference contains CR 702", () => {
    const entry = lookupKeyword("craft");
    expect(entry!.crReference).toMatch(/CR 702/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// COVERAGE VALIDATION: profileCard() on curated cards
// ═══════════════════════════════════════════════════════════════════

test.describe("Coverage validation — profileCard() on curated cards", () => {
  test("connive card (Obscura Interceptor) has non-empty abilities", () => {
    const card = makeCard({
      name: "Obscura Interceptor",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Flash\nFlying\nWhen Obscura Interceptor enters the battlefield, it connives.",
      keywords: ["Flash", "Flying", "Connive"],
    });
    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThan(0);
  });

  test("disturb card (Faithful Mending) has zone cast permission", () => {
    const card = makeCard({
      name: "Lantern Bearer",
      typeLine: "Creature — Human Wizard",
      oracleText: "Disturb {1}{U}\nFlying",
      keywords: ["Disturb", "Flying"],
    });
    const profile = profileCard(card);
    expect(profile.zoneCastPermissions.length).toBeGreaterThan(0);
  });

  test("bargain card profile has abilities", () => {
    const card = makeCard({
      name: "Beseech the Mirror",
      typeLine: "Sorcery",
      oracleText: "Bargain (You may sacrifice an artifact, enchantment, or token as you cast this spell.)\nSearch your library for a card. If this spell was bargained, you may cast that card without paying its mana cost if its mana value is 4 or less. Otherwise, put that card into your hand. Then shuffle.",
      keywords: ["Bargain"],
    });
    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThan(0);
  });

  test("incubate card profile has token production", () => {
    const card = makeCard({
      name: "Invasion of Ikoria",
      typeLine: "Battle — Siege",
      oracleText: "When Invasion of Ikoria enters the battlefield, search your library for a non-Human creature card and put it onto the battlefield.",
      keywords: ["Incubate"],
    });
    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThan(0);
  });

  test("craft card profile has abilities", () => {
    const card = makeCard({
      name: "Gnarled Grovestrider",
      typeLine: "Creature — Treefolk",
      oracleText: "Craft with artifact {3}{G} (Exile this permanent, exile an artifact you control: Return this card transformed under your control. Craft only as a sorcery.)",
      keywords: ["Craft"],
    });
    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThan(0);
  });

  test("saga card (The Eldest Reborn) has 3+ triggered abilities", () => {
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
    const triggered = profile.abilities.filter((a) => a.abilityType === "triggered");
    expect(triggered.length).toBeGreaterThanOrEqual(3);
  });

  test("class card (Ranger Class) has 3+ abilities", () => {
    const card = makeCard({
      name: "Ranger Class",
      typeLine: "Enchantment — Class",
      oracleText: [
        "At the beginning of combat on your turn, up to one target creature you control gets +1/+1 until end of turn.",
        "Level 2 — {1}{G}: Target creature you control explores.",
        "Level 3 — At the beginning of your end step, if a land entered the battlefield under your control this turn, create a 1/1 white Human creature token.",
      ].join("\n"),
      subtypes: ["Class"],
    });
    const profile = profileCard(card);
    expect(profile.abilities.length).toBeGreaterThanOrEqual(3);
  });
});
