/**
 * Capability Extractor Unit Tests — Phase 4 of the oracle text compiler
 *
 * Tests cover: profileCard() extraction of CardProfile fields from
 * EnrichedCard inputs. The extractor internally parses oracle text into
 * AbilityNode[] ASTs and walks them to populate produces, consumes,
 * triggersOn, causesEvents, grants, replacements, restrictions, speeds,
 * keyword expansion, type parsing, and full card integration profiles.
 *
 * These tests are TDD -- they are written BEFORE the implementation exists.
 */

import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import type {
  CardProfile,
  ManaResource,
  LifeResource,
  CreateTokenEffect,
  SacrificeCost,
  PayLifeCost,
  TapCost,
  ZoneTransition,
  StateChange,
  PlayerAction,
  GameEvent,
  Cost,
  RestrictionEffect,
  StatModification,
  KeywordGrant,
} from "../../src/lib/interaction-engine/types";

// Import the function under test -- will fail until capability-extractor.ts is created
import { profileCard } from "../../src/lib/interaction-engine";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Find a ManaResource in the produces array */
function findManaProduction(
  profile: CardProfile,
  color?: string
): ManaResource | undefined {
  return profile.produces.find(
    (p): p is ManaResource =>
      p.category === "mana" && (color === undefined || p.color === color)
  ) as ManaResource | undefined;
}

/** Find a LifeResource in the produces array */
function findLifeProduction(profile: CardProfile): LifeResource | undefined {
  return profile.produces.find(
    (p): p is LifeResource => p.category === "life"
  ) as LifeResource | undefined;
}

/** Find a CreateTokenEffect in the produces array */
function findTokenProduction(
  profile: CardProfile
): CreateTokenEffect | undefined {
  return profile.produces.find(
    (p): p is CreateTokenEffect => p.category === "create_token"
  ) as CreateTokenEffect | undefined;
}

/** Find a cost by costType */
function findCost<T extends Cost>(
  profile: CardProfile,
  costType: string
): T | undefined {
  return profile.consumes.find((c) => c.costType === costType) as T | undefined;
}

/** Find a trigger event by kind */
function findTrigger(
  profile: CardProfile,
  kind: GameEvent["kind"]
): GameEvent | undefined {
  return profile.triggersOn.find((e) => e.kind === kind);
}

/** Find a caused event by kind */
function findCausedEvent(
  profile: CardProfile,
  kind: GameEvent["kind"]
): GameEvent | undefined {
  return profile.causesEvents.find((e) => e.kind === kind);
}

// ═══════════════════════════════════════════════════════════════
// 1. PRODUCES EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("produces extraction", () => {
  test("Ashnod's Altar: produces colorless mana ({C}{C} per sacrifice)", () => {
    const card = makeCard({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const profile = profileCard(card);

    const mana = findManaProduction(profile, "C");
    expect(mana).toBeDefined();
    expect(mana!.category).toBe("mana");
    expect(mana!.color).toBe("C");
  });

  test("Sol Ring: produces colorless mana ({C}{C} from {T})", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      manaCost: "{1}",
      cmc: 1,
    });
    const profile = profileCard(card);

    const mana = findManaProduction(profile, "C");
    expect(mana).toBeDefined();
    expect(mana!.color).toBe("C");
  });

  test("Blood Artist: produces life (gain 1 life on death trigger)", () => {
    const card = makeCard({
      name: "Blood Artist",
      typeLine: "Creature — Vampire",
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "0",
      toughness: "1",
    });
    const profile = profileCard(card);

    const life = findLifeProduction(profile);
    expect(life).toBeDefined();
    expect(life!.category).toBe("life");
    expect(life!.quantity).toBe(1);
  });

  test("Avenger of Zendikar: produces tokens (create Plant tokens on ETB)", () => {
    const card = makeCard({
      name: "Avenger of Zendikar",
      typeLine: "Creature — Elemental",
      oracleText:
        "When Avenger of Zendikar enters the battlefield, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land enters the battlefield under your control, you may put a +1/+1 counter on each Plant creature you control.",
      manaCost: "{5}{G}{G}",
      cmc: 7,
      power: "5",
      toughness: "5",
    });
    const profile = profileCard(card);

    const token = findTokenProduction(profile);
    expect(token).toBeDefined();
    expect(token!.category).toBe("create_token");
    expect(token!.token.types).toContain("creature");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. CONSUMES EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("consumes extraction", () => {
  test("Ashnod's Altar: consumes creature (sacrifice cost)", () => {
    const card = makeCard({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const profile = profileCard(card);

    const sac = findCost<SacrificeCost>(profile, "sacrifice");
    expect(sac).toBeDefined();
    expect(sac!.costType).toBe("sacrifice");
    expect(sac!.object.types).toContain("creature");
  });

  test("Viscera Seer: consumes creature (free sacrifice outlet)", () => {
    const card = makeCard({
      name: "Viscera Seer",
      typeLine: "Creature — Vampire Wizard",
      oracleText: "Sacrifice a creature: Scry 1.",
      manaCost: "{B}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const profile = profileCard(card);

    const sac = findCost<SacrificeCost>(profile, "sacrifice");
    expect(sac).toBeDefined();
    expect(sac!.costType).toBe("sacrifice");
    expect(sac!.object.types).toContain("creature");
  });

  test("Necropotence: consumes life (pay 1 life activated)", () => {
    const card = makeCard({
      name: "Necropotence",
      typeLine: "Enchantment",
      oracleText:
        "Skip your draw step.\nWhenever you discard a card, exile that card from your graveyard.\nPay 1 life: Exile the top card of your library face down. Put that card into your hand at the beginning of your next end step.",
      manaCost: "{B}{B}{B}",
      cmc: 3,
    });
    const profile = profileCard(card);

    const lifeCost = findCost<PayLifeCost>(profile, "pay_life");
    expect(lifeCost).toBeDefined();
    expect(lifeCost!.costType).toBe("pay_life");
    expect(lifeCost!.quantity).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. TRIGGERS ON EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("triggersOn extraction", () => {
  test("Blood Artist: triggers on creature death (ZoneTransition dies)", () => {
    const card = makeCard({
      name: "Blood Artist",
      typeLine: "Creature — Vampire",
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "0",
      toughness: "1",
    });
    const profile = profileCard(card);

    const deathTrigger = findTrigger(profile, "zone_transition");
    expect(deathTrigger).toBeDefined();
    const zt = deathTrigger as ZoneTransition;
    expect(zt.from).toBe("battlefield");
    expect(zt.to).toBe("graveyard");
  });

  test("Smothering Tithe: triggers on opponent draw", () => {
    const card = makeCard({
      name: "Smothering Tithe",
      typeLine: "Enchantment",
      oracleText:
        "Whenever an opponent draws a card, that player may pay {2}. If that player doesn't, you create a Treasure token.",
      manaCost: "{3}{W}",
      cmc: 4,
    });
    const profile = profileCard(card);

    const drawTrigger = findTrigger(profile, "player_action");
    expect(drawTrigger).toBeDefined();
    const pa = drawTrigger as PlayerAction;
    expect(pa.action).toBe("draw");
  });

  test("Panharmonicon: triggers on artifact/creature ETB or applies as static", () => {
    const card = makeCard({
      name: "Panharmonicon",
      typeLine: "Artifact",
      oracleText:
        "If an artifact or creature entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      manaCost: "{4}",
      cmc: 4,
    });
    const profile = profileCard(card);

    // Panharmonicon could be modeled as a replacement or static effect.
    // Either way it should reference ETB zone transitions.
    const hasETBReference =
      profile.triggersOn.some(
        (e) =>
          e.kind === "zone_transition" &&
          (e as ZoneTransition).to === "battlefield"
      ) ||
      profile.replacements.length > 0 ||
      profile.staticEffects.length > 0;
    expect(hasETBReference).toBe(true);
  });

  test("Grave Pact: triggers on creature you control dying", () => {
    const card = makeCard({
      name: "Grave Pact",
      typeLine: "Enchantment",
      oracleText:
        "Whenever a creature you control dies, each other player sacrifices a creature.",
      manaCost: "{1}{B}{B}{B}",
      cmc: 4,
    });
    const profile = profileCard(card);

    const deathTrigger = findTrigger(profile, "zone_transition");
    expect(deathTrigger).toBeDefined();
    const zt = deathTrigger as ZoneTransition;
    expect(zt.from).toBe("battlefield");
    expect(zt.to).toBe("graveyard");
    // Should reference a creature controlled by "you"
    expect(zt.object.types).toContain("creature");
    expect(zt.object.controller).toBe("you");
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. CAUSES EVENTS EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("causesEvents extraction", () => {
  test("Ashnod's Altar: sacrifice cost causes ZoneTransition dies", () => {
    const card = makeCard({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const profile = profileCard(card);

    const dieEvent = findCausedEvent(profile, "zone_transition");
    expect(dieEvent).toBeDefined();
    const zt = dieEvent as ZoneTransition;
    expect(zt.from).toBe("battlefield");
    expect(zt.to).toBe("graveyard");
    expect(zt.cause).toBe("sacrifice");
  });

  test("Swords to Plowshares: exile causes ZoneTransition to exile", () => {
    const card = makeCard({
      name: "Swords to Plowshares",
      typeLine: "Instant",
      oracleText:
        "Exile target creature. Its controller gains life equal to its power.",
      manaCost: "{W}",
      cmc: 1,
    });
    const profile = profileCard(card);

    const exileEvent = profile.causesEvents.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" && e.to === "exile"
    );
    expect(exileEvent).toBeDefined();
    expect(exileEvent!.to).toBe("exile");
  });

  test("Lightning Bolt: damage causes life_total StateChange", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const profile = profileCard(card);

    // Damage should cause a state change to life total, or a damage event
    const hasDamageEffect =
      profile.causesEvents.some(
        (e) =>
          (e.kind === "state_change" &&
            (e as StateChange).property === "life_total") ||
          e.kind === "damage"
      );
    expect(hasDamageEffect).toBe(true);
  });

  test("Avenger of Zendikar: create token causes ZoneTransition ETB", () => {
    const card = makeCard({
      name: "Avenger of Zendikar",
      typeLine: "Creature — Elemental",
      oracleText:
        "When Avenger of Zendikar enters the battlefield, create a 0/1 green Plant creature token for each land you control.\nLandfall — Whenever a land enters the battlefield under your control, you may put a +1/+1 counter on each Plant creature you control.",
      manaCost: "{5}{G}{G}",
      cmc: 7,
      power: "5",
      toughness: "5",
    });
    const profile = profileCard(card);

    // Token creation causes an ETB zone transition
    const etbEvent = profile.causesEvents.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" && e.to === "battlefield"
    );
    expect(etbEvent).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. GRANTS EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("grants extraction", () => {
  test("Elesh Norn, Grand Cenobite: grants +2/+2 to your creatures and -2/-2 to opponents'", () => {
    const card = makeCard({
      name: "Elesh Norn, Grand Cenobite",
      typeLine: "Legendary Creature — Phyrexian Praetor",
      oracleText:
        "Vigilance\nOther creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
      manaCost: "{5}{W}{W}",
      cmc: 7,
      power: "4",
      toughness: "7",
      keywords: ["Vigilance"],
    });
    const profile = profileCard(card);

    expect(profile.grants.length).toBeGreaterThanOrEqual(2);

    // Find the positive anthem (+2/+2 to your creatures)
    const positiveGrant = profile.grants.find((g) => {
      if (typeof g.ability === "string") return false;
      if (g.ability.category === "stat_mod") {
        const mod = g.ability as StatModification;
        return mod.power === 2 && mod.toughness === 2;
      }
      return false;
    });
    expect(positiveGrant).toBeDefined();
    expect(positiveGrant!.to.controller).toBe("you");

    // Find the negative anthem (-2/-2 to opponents' creatures)
    const negativeGrant = profile.grants.find((g) => {
      if (typeof g.ability === "string") return false;
      if (g.ability.category === "stat_mod") {
        const mod = g.ability as StatModification;
        return mod.power === -2 && mod.toughness === -2;
      }
      return false;
    });
    expect(negativeGrant).toBeDefined();
    expect(negativeGrant!.to.controller).toBe("opponent");
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. REPLACEMENTS EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("replacements extraction", () => {
  test("Rest in Peace: replaces ZoneTransition to graveyard with exile (mode: replace)", () => {
    const card = makeCard({
      name: "Rest in Peace",
      typeLine: "Enchantment",
      oracleText:
        "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
      manaCost: "{1}{W}",
      cmc: 2,
    });
    const profile = profileCard(card);

    expect(profile.replacements.length).toBeGreaterThanOrEqual(1);
    const replacement = profile.replacements.find(
      (r) => r.mode === "replace"
    );
    expect(replacement).toBeDefined();
    expect(replacement!.replaces.kind).toBe("zone_transition");
    const zt = replacement!.replaces as ZoneTransition;
    expect(zt.to).toBe("graveyard");
  });

  test("Doubling Season: modifies token creation quantity (mode: modify)", () => {
    const card = makeCard({
      name: "Doubling Season",
      typeLine: "Enchantment",
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      manaCost: "{4}{G}",
      cmc: 5,
    });
    const profile = profileCard(card);

    expect(profile.replacements.length).toBeGreaterThanOrEqual(1);
    const modifyReplacement = profile.replacements.find(
      (r) => r.mode === "modify"
    );
    expect(modifyReplacement).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. RESTRICTIONS EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("restrictions extraction", () => {
  test("Narset, Parter of Veils: opponents can't draw more than one card each turn", () => {
    const card = makeCard({
      name: "Narset, Parter of Veils",
      typeLine: "Legendary Planeswalker — Narset",
      oracleText:
        "Each opponent can't draw more than one card each turn.\n-2: Look at the top four cards of your library. You may reveal a noncreature, nonland card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      manaCost: "{1}{U}{U}",
      cmc: 3,
      loyalty: "5",
    });
    const profile = profileCard(card);

    expect(profile.restrictions.length).toBeGreaterThanOrEqual(1);
    const drawRestriction = profile.restrictions.find(
      (r) => r.restricts === "draw"
    );
    expect(drawRestriction).toBeDefined();
    expect(drawRestriction!.target).toMatchObject({
      controller: "opponent",
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. SPEEDS EXTRACTION
// ═══════════════════════════════════════════════════════════════

test.describe("speeds extraction", () => {
  test("Ashnod's Altar: includes mana_ability speed", () => {
    const card = makeCard({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    const profile = profileCard(card);

    expect(profile.speeds).toContain("mana_ability");
  });

  test("Blood Artist: includes instant speed (triggered ability)", () => {
    const card = makeCard({
      name: "Blood Artist",
      typeLine: "Creature — Vampire",
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "0",
      toughness: "1",
    });
    const profile = profileCard(card);

    expect(profile.speeds).toContain("instant");
  });

  test("Sol Ring: includes mana_ability speed", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      manaCost: "{1}",
      cmc: 1,
    });
    const profile = profileCard(card);

    expect(profile.speeds).toContain("mana_ability");
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. KEYWORD EXPANSION
// ═══════════════════════════════════════════════════════════════

test.describe("keyword expansion", () => {
  test("creature with flying: produces keyword ability node", () => {
    const card = makeCard({
      name: "Serra Angel",
      typeLine: "Creature — Angel",
      oracleText: "Flying, vigilance",
      manaCost: "{3}{W}{W}",
      cmc: 5,
      power: "4",
      toughness: "4",
      keywords: ["Flying", "Vigilance"],
    });
    const profile = profileCard(card);

    const flyingAbility = profile.abilities.find(
      (a) => a.abilityType === "keyword" && a.keyword === "flying"
    );
    expect(flyingAbility).toBeDefined();
  });

  test("creature with lifelink: abilities include lifelink keyword", () => {
    const card = makeCard({
      name: "Vampire Nighthawk",
      typeLine: "Creature — Vampire Shaman",
      oracleText: "Flying, deathtouch, lifelink",
      manaCost: "{1}{B}{B}",
      cmc: 3,
      power: "2",
      toughness: "3",
      keywords: ["Flying", "Deathtouch", "Lifelink"],
    });
    const profile = profileCard(card);

    const lifelinkAbility = profile.abilities.find(
      (a) => a.abilityType === "keyword" && a.keyword === "lifelink"
    );
    expect(lifelinkAbility).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. TYPE PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("type parsing from typeLine", () => {
  test("'Legendary Creature - Zombie Wizard': parses types, supertypes, subtypes", () => {
    const card = makeCard({
      name: "Sidisi, Undead Vizier",
      typeLine: "Legendary Creature — Zombie Wizard",
      oracleText: "Exploit\nWhen Sidisi, Undead Vizier exploits a creature, you may search your library for a card, put it into your hand, then shuffle.",
      manaCost: "{3}{B}{B}",
      cmc: 5,
      power: "4",
      toughness: "6",
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("creature");
    expect(profile.supertypes).toContain("legendary");
    expect(profile.subtypes).toContain("Zombie");
    expect(profile.subtypes).toContain("Wizard");
  });

  test("'Artifact': parses single card type with no super/subtypes", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      manaCost: "{1}",
      cmc: 1,
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("artifact");
    expect(profile.supertypes).toHaveLength(0);
    expect(profile.subtypes).toHaveLength(0);
  });

  test("'Enchantment': parses simple enchantment type", () => {
    const card = makeCard({
      name: "Rhystic Study",
      typeLine: "Enchantment",
      oracleText:
        "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
      manaCost: "{2}{U}",
      cmc: 3,
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("enchantment");
    expect(profile.supertypes).toHaveLength(0);
    expect(profile.subtypes).toHaveLength(0);
  });

  test("'Legendary Planeswalker - Narset': parses planeswalker with subtype", () => {
    const card = makeCard({
      name: "Narset, Parter of Veils",
      typeLine: "Legendary Planeswalker — Narset",
      oracleText:
        "Each opponent can't draw more than one card each turn.\n-2: Look at the top four cards of your library. You may reveal a noncreature, nonland card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      manaCost: "{1}{U}{U}",
      cmc: 3,
      loyalty: "5",
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("planeswalker");
    expect(profile.supertypes).toContain("legendary");
    expect(profile.subtypes).toContain("Narset");
  });

  test("'Instant': parses instant card type", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("instant");
  });

  test("'Legendary Creature - Phyrexian Praetor': multi-word subtypes", () => {
    const card = makeCard({
      name: "Elesh Norn, Grand Cenobite",
      typeLine: "Legendary Creature — Phyrexian Praetor",
      oracleText:
        "Vigilance\nOther creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
      manaCost: "{5}{W}{W}",
      cmc: 7,
      power: "4",
      toughness: "7",
      keywords: ["Vigilance"],
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("creature");
    expect(profile.supertypes).toContain("legendary");
    expect(profile.subtypes).toContain("Phyrexian");
    expect(profile.subtypes).toContain("Praetor");
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. FULL CARD PROFILES (Integration Tests)
// ═══════════════════════════════════════════════════════════════

test.describe("full card profile: Ashnod's Altar", () => {
  let profile: CardProfile;

  test.beforeEach(() => {
    const card = makeCard({
      name: "Ashnod's Altar",
      typeLine: "Artifact",
      oracleText: "Sacrifice a creature: Add {C}{C}.",
      manaCost: "{3}",
      cmc: 3,
    });
    profile = profileCard(card);
  });

  test("cardName is set", () => {
    expect(profile.cardName).toBe("Ashnod's Altar");
  });

  test("cardTypes includes artifact", () => {
    expect(profile.cardTypes).toContain("artifact");
  });

  test("layout is normal", () => {
    expect(profile.layout).toBe("normal");
  });

  test("produces colorless mana", () => {
    const mana = findManaProduction(profile, "C");
    expect(mana).toBeDefined();
  });

  test("consumes creature via sacrifice", () => {
    const sac = findCost<SacrificeCost>(profile, "sacrifice");
    expect(sac).toBeDefined();
    expect(sac!.object.types).toContain("creature");
  });

  test("causesEvents includes sacrifice-death zone transition", () => {
    const dieEvent = profile.causesEvents.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" &&
        e.from === "battlefield" &&
        e.to === "graveyard"
    );
    expect(dieEvent).toBeDefined();
    expect(dieEvent!.cause).toBe("sacrifice");
  });

  test("speeds includes mana_ability", () => {
    expect(profile.speeds).toContain("mana_ability");
  });

  test("has one activated ability", () => {
    const activated = profile.abilities.filter(
      (a) => a.abilityType === "activated"
    );
    expect(activated).toHaveLength(1);
  });

  test("castingCost reflects {3} mana cost", () => {
    expect(profile.castingCost).toBeDefined();
    expect(profile.castingCost!.manaCost).toBe("{3}");
    expect(profile.castingCost!.manaValue).toBe(3);
  });
});

test.describe("full card profile: Blood Artist", () => {
  let profile: CardProfile;

  test.beforeEach(() => {
    const card = makeCard({
      name: "Blood Artist",
      typeLine: "Creature — Vampire",
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      manaCost: "{1}{B}",
      cmc: 2,
      power: "0",
      toughness: "1",
    });
    profile = profileCard(card);
  });

  test("cardName is set", () => {
    expect(profile.cardName).toBe("Blood Artist");
  });

  test("cardTypes includes creature", () => {
    expect(profile.cardTypes).toContain("creature");
  });

  test("subtypes includes Vampire", () => {
    expect(profile.subtypes).toContain("Vampire");
  });

  test("triggersOn includes creature death ZoneTransition", () => {
    const deathTrigger = profile.triggersOn.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" &&
        e.from === "battlefield" &&
        e.to === "graveyard"
    );
    expect(deathTrigger).toBeDefined();
  });

  test("produces life", () => {
    const life = findLifeProduction(profile);
    expect(life).toBeDefined();
    expect(life!.quantity).toBe(1);
  });

  test("speeds includes instant (triggered)", () => {
    expect(profile.speeds).toContain("instant");
  });

  test("has one triggered ability", () => {
    const triggered = profile.abilities.filter(
      (a) => a.abilityType === "triggered"
    );
    expect(triggered).toHaveLength(1);
  });

  test("castingCost reflects {1}{B}", () => {
    expect(profile.castingCost).toBeDefined();
    expect(profile.castingCost!.manaCost).toBe("{1}{B}");
    expect(profile.castingCost!.manaValue).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. ADDITIONAL EDGE CASES
// ═══════════════════════════════════════════════════════════════

test.describe("additional extraction edge cases", () => {
  test("Sol Ring: tap cost extracted into consumes", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      manaCost: "{1}",
      cmc: 1,
    });
    const profile = profileCard(card);

    const tapCost = findCost<TapCost>(profile, "tap");
    expect(tapCost).toBeDefined();
  });

  test("Grave Pact: causesEvents includes sacrifice (forced by opponent)", () => {
    const card = makeCard({
      name: "Grave Pact",
      typeLine: "Enchantment",
      oracleText:
        "Whenever a creature you control dies, each other player sacrifices a creature.",
      manaCost: "{1}{B}{B}{B}",
      cmc: 4,
    });
    const profile = profileCard(card);

    // The effect causes opponents to sacrifice, which means creature death events
    const sacEvent = profile.causesEvents.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" &&
        e.from === "battlefield" &&
        e.to === "graveyard"
    );
    expect(sacEvent).toBeDefined();
  });

  test("multi-ability card: Niv-Mizzet, Parun has multiple triggers", () => {
    const card = makeCard({
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
    const profile = profileCard(card);

    // Should have at least 2 triggered abilities
    const triggered = profile.abilities.filter(
      (a) => a.abilityType === "triggered"
    );
    expect(triggered.length).toBeGreaterThanOrEqual(2);

    // Should have at least 2 events in triggersOn
    expect(profile.triggersOn.length).toBeGreaterThanOrEqual(2);

    // Should include flying keyword
    const flyingAbility = profile.abilities.find(
      (a) => a.abilityType === "keyword" && a.keyword === "flying"
    );
    expect(flyingAbility).toBeDefined();
  });

  test("Phyrexian Arena: phase trigger produces cards and consumes life", () => {
    const card = makeCard({
      name: "Phyrexian Arena",
      typeLine: "Enchantment",
      oracleText:
        "At the beginning of your upkeep, you draw a card and you lose 1 life.",
      manaCost: "{1}{B}{B}",
      cmc: 3,
    });
    const profile = profileCard(card);

    // Should have a phase trigger
    const phaseTrigger = findTrigger(profile, "phase_trigger");
    expect(phaseTrigger).toBeDefined();

    // Should produce cards
    const cardsProduction = profile.produces.find(
      (p) => p.category === "cards"
    );
    expect(cardsProduction).toBeDefined();
  });

  test("Demonic Tutor: spell with search library effect", () => {
    const card = makeCard({
      name: "Demonic Tutor",
      typeLine: "Sorcery",
      oracleText:
        "Search your library for a card, put that card into your hand, then shuffle.",
      manaCost: "{1}{B}",
      cmc: 2,
    });
    const profile = profileCard(card);

    expect(profile.cardTypes).toContain("sorcery");
    // Should have at least one ability (spell_effect)
    expect(profile.abilities.length).toBeGreaterThanOrEqual(1);
  });

  test("empty oracle text card: basic land", () => {
    const card = makeCard({
      name: "Swamp",
      typeLine: "Basic Land — Swamp",
      oracleText: "({T}: Add {B}.)",
      manaCost: "",
      cmc: 0,
    });
    const profile = profileCard(card);

    expect(profile.cardName).toBe("Swamp");
    expect(profile.cardTypes).toContain("land");
    expect(profile.supertypes).toContain("basic");
    expect(profile.subtypes).toContain("Swamp");
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. ADDITIONAL COST EXTRACTION INTO CONSUMES
// ═══════════════════════════════════════════════════════════════

test.describe("additional cost extraction into consumes", () => {
  test("Village Rites: consumes creature via additional cost sacrifice", () => {
    const card = makeCard({
      name: "Village Rites",
      typeLine: "Instant",
      oracleText:
        "As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.",
      manaCost: "{B}",
      cmc: 1,
    });
    const profile = profileCard(card);

    const sac = findCost<SacrificeCost>(profile, "sacrifice");
    expect(sac).toBeDefined();
    expect(sac!.costType).toBe("sacrifice");
    expect(sac!.object.types).toContain("creature");
  });

  test("Village Rites: additional cost sacrifice causes ZoneTransition dies", () => {
    const card = makeCard({
      name: "Village Rites",
      typeLine: "Instant",
      oracleText:
        "As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.",
      manaCost: "{B}",
      cmc: 1,
    });
    const profile = profileCard(card);

    const dieEvent = profile.causesEvents.find(
      (e): e is ZoneTransition =>
        e.kind === "zone_transition" &&
        e.from === "battlefield" &&
        e.to === "graveyard" &&
        e.cause === "sacrifice"
    );
    expect(dieEvent).toBeDefined();
  });

  test("Force of Will: alternativeCosts are populated on profile castingCost", () => {
    const card = makeCard({
      name: "Force of Will",
      typeLine: "Instant",
      oracleText:
        "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
      manaCost: "{3}{U}{U}",
      cmc: 5,
    });
    const profile = profileCard(card);

    // The spell_effect ability should have alternativeCosts
    const spellAbility = profile.abilities.find(
      (a) => a.abilityType === "spell_effect"
    );
    expect(spellAbility).toBeDefined();
    if (spellAbility?.abilityType === "spell_effect") {
      const spell = spellAbility as import("../../src/lib/interaction-engine/types").SpellEffect;
      expect(spell.castingCost.alternativeCosts).toBeDefined();
      expect(spell.castingCost.alternativeCosts!.length).toBeGreaterThanOrEqual(1);
    }
  });
});
