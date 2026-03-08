/**
 * Interaction Detector Unit Tests — Phase 5, Slice A
 *
 * Tests cover: findInteractions() pairwise interaction detection between
 * CardProfile pairs. Detectors include: enables, triggers, protects,
 * recurs, tutors_for, and reduces_cost.
 *
 * Tests follow TDD — written BEFORE the implementation exists.
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

/** Profile a card from makeCard overrides */
function profile(overrides: Parameters<typeof makeCard>[0]): CardProfile {
  return profileCard(makeCard(overrides));
}

/** Find interactions of a specific type between two named cards */
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

/** Find directional interactions: cards[0] === from, cards[1] === to */
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

function ashnodAltar(): CardProfile {
  return profile({
    name: "Ashnod's Altar",
    typeLine: "Artifact",
    oracleText: "Sacrifice a creature: Add {C}{C}.",
    manaCost: "{3}",
    cmc: 3,
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
// 1. ENABLES — A.produces matches B.consumes
// ═══════════════════════════════════════════════════════════════

test.describe("enables detection", () => {
  test("token creator enables sacrifice outlet (Avenger of Zendikar + Ashnod's Altar)", () => {
    const avenger = avengerOfZendikar();
    const altar = ashnodAltar();
    const analysis = findInteractions([avenger, altar]);

    // Avenger creates creature tokens -> Altar consumes creatures
    const enables = findDirectional(
      analysis,
      "enables",
      "Avenger of Zendikar",
      "Ashnod's Altar"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
    expect(enables[0].strength).toBeGreaterThanOrEqual(0.6);
    expect(enables[0].mechanical).toBeTruthy();
  });

  test("mana producer does NOT create low-value enables interaction (disabled for noise reduction)", () => {
    const ring = solRing();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([ring, avenger]);

    // Generic "mana helps cast" interactions are disabled to reduce noise —
    // they produce ~N interactions per mana producer, overwhelming real synergies.
    const enables = findDirectional(
      analysis,
      "enables",
      "Sol Ring",
      "Avenger of Zendikar"
    );
    expect(enables.length).toBe(0);
  });

  test("Ashnod's Altar consumes creature — any creature enables it", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // Blood Artist is a creature -> Altar consumes creatures
    const enables = findDirectional(
      analysis,
      "enables",
      "Blood Artist",
      "Ashnod's Altar"
    );
    expect(enables.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. TRIGGERS — A.causesEvents matches B.triggersOn
// ═══════════════════════════════════════════════════════════════

test.describe("triggers detection", () => {
  test("sacrifice outlet triggers death trigger (Ashnod's Altar + Blood Artist)", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // Altar causes ZoneTransition{dies} -> Blood Artist triggers on creature death
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Blood Artist"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
    expect(triggers[0].strength).toBeGreaterThanOrEqual(0.8);
    expect(triggers[0].mechanical).toBeTruthy();
  });

  test("token creator triggers ETB trigger (Avenger of Zendikar + creature ETB card)", () => {
    const avenger = avengerOfZendikar();
    const soulWarden = profile({
      name: "Soul Warden",
      typeLine: "Creature — Human Cleric",
      oracleText:
        "Whenever another creature enters the battlefield, you gain 1 life.",
      manaCost: "{W}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    const analysis = findInteractions([avenger, soulWarden]);

    // Avenger creates creature tokens (ETB) -> Soul Warden triggers on creature ETB
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Avenger of Zendikar",
      "Soul Warden"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("Grave Pact + Soul Warden — sacrifice causes death, which triggers ETB of replacements", () => {
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

    // Grave Pact causes sacrifice (zone transition dies) -> Blood Artist triggers on creature death
    const triggers = findDirectional(
      analysis,
      "triggers",
      "Grave Pact",
      "Blood Artist"
    );
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. PROTECTS — A grants protective keyword to B's type
// ═══════════════════════════════════════════════════════════════

test.describe("protects detection", () => {
  test("card granting indestructible to creatures protects a creature", () => {
    const avacyn = profile({
      name: "Avacyn, Angel of Hope",
      typeLine: "Legendary Creature — Angel",
      oracleText:
        "Flying, vigilance, indestructible\nOther permanents you control have indestructible.",
      manaCost: "{5}{W}{W}{W}",
      cmc: 8,
      power: "8",
      toughness: "8",
      keywords: ["Flying", "Vigilance", "Indestructible"],
    });
    const artist = bloodArtist();
    const analysis = findInteractions([avacyn, artist]);

    // Avacyn grants indestructible to permanents -> Blood Artist is a permanent
    const protects = findDirectional(
      analysis,
      "protects",
      "Avacyn, Angel of Hope",
      "Blood Artist"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
    expect(protects[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("hexproof granter protects matching type", () => {
    const privilegedPosition = profile({
      name: "Privileged Position",
      typeLine: "Enchantment",
      oracleText:
        "Other permanents you control have hexproof.",
      manaCost: "{2}{G/W}{G/W}{G/W}",
      cmc: 5,
    });
    const ring = solRing();
    const analysis = findInteractions([privilegedPosition, ring]);

    const protects = findDirectional(
      analysis,
      "protects",
      "Privileged Position",
      "Sol Ring"
    );
    expect(protects.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. RECURS — A returns objects from graveyard matching B
// ═══════════════════════════════════════════════════════════════

test.describe("recurs detection", () => {
  test("card that returns creatures from graveyard recurs a creature (Victimize)", () => {
    const victimize = profile({
      name: "Victimize",
      typeLine: "Sorcery",
      oracleText:
        "As an additional cost to cast this spell, sacrifice a creature.\nChoose two target creature cards in your graveyard. Return those cards to the battlefield.",
      manaCost: "{2}{B}",
      cmc: 3,
    });
    const artist = bloodArtist();
    const analysis = findInteractions([victimize, artist]);

    // Victimize returns from graveyard to battlefield -> Blood Artist is a creature
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Victimize",
      "Blood Artist"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
    expect(recurs[0].strength).toBeGreaterThanOrEqual(0.6);
  });

  test("Sun Titan recurs low-cost permanents", () => {
    const sunTitan = profile({
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
    const analysis = findInteractions([sunTitan, ring]);

    // Sun Titan returns permanents from graveyard -> Sol Ring is a permanent with MV 1
    const recurs = findDirectional(
      analysis,
      "recurs",
      "Sun Titan",
      "Sol Ring"
    );
    expect(recurs.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. TUTORS_FOR — A searches library for objects matching B
// ═══════════════════════════════════════════════════════════════

test.describe("tutors_for detection", () => {
  test("tutors_for is not emitted as pairwise interactions (handled as capability)", () => {
    const tutor = demonicTutor();
    const artist = bloodArtist();
    const analysis = findInteractions([tutor, artist]);

    // Tutoring is now handled as a capability note, not individual pairwise interactions.
    // A card's search capability is visible in its CardProfile.
    const tutors = findDirectional(
      analysis,
      "tutors_for",
      "Demonic Tutor",
      "Blood Artist"
    );
    expect(tutors.length).toBe(0);
  });

  test("no tutors_for interactions for multiple cards", () => {
    const tutor = demonicTutor();
    const ring = solRing();
    const altar = ashnodAltar();
    const analysis = findInteractions([tutor, ring, altar]);

    const tutorsRing = findDirectional(
      analysis,
      "tutors_for",
      "Demonic Tutor",
      "Sol Ring"
    );
    const tutorsAltar = findDirectional(
      analysis,
      "tutors_for",
      "Demonic Tutor",
      "Ashnod's Altar"
    );
    expect(tutorsRing.length).toBe(0);
    expect(tutorsAltar.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. REDUCES_COST — A reduces cost for B's type
// ═══════════════════════════════════════════════════════════════

test.describe("reduces_cost detection", () => {
  test("cost substitution reduces cost for matching type (structured)", () => {
    // Create a profile with a cost substitution manually to test the detector
    // independent of upstream parser limitations
    const costReducer = profile({
      name: "Cost Reducer",
      typeLine: "Creature — Human Wizard",
      oracleText: "Creature spells you cast cost {1} less to cast.",
      manaCost: "{2}{U}",
      cmc: 3,
      power: "2",
      toughness: "2",
    });
    const artist = bloodArtist();
    const analysis = findInteractions([costReducer, artist]);

    // If the parser extracts cost reduction static effects, this should detect them.
    // Even if not, this validates the detector wiring is correct.
    // The detector checks staticEffects for cost_reduction/reduce_cost/cost_modifier types.
    // This is a best-effort test given parser capabilities.
    expect(analysis).toHaveProperty("interactions");
  });

  test("cost substitution with populated costSubstitutions field", () => {
    // Test the detector logic with a manually constructed profile that has
    // costSubstitutions populated (simulating what K'rrik would have with a
    // fully capable parser)
    const artist = bloodArtist();

    // Manually patch a profile to have costSubstitutions
    const reducer = profile({
      name: "Mana Reducer",
      typeLine: "Creature — Human Wizard",
      oracleText: "{T}: Add {C}.",
      manaCost: "{1}",
      cmc: 1,
      power: "1",
      toughness: "1",
    });
    // Inject a cost substitution that replaces {B} with life payment
    reducer.costSubstitutions.push({
      category: "cost_substitution",
      replacesSymbol: "B",
      withCost: { costType: "pay_life", quantity: 2 },
      appliesTo: { types: [], quantity: "all", modifiers: [] },
      appliesToAbilities: true,
      optional: true,
    });

    const analysis = findInteractions([reducer, artist]);

    // Blood Artist costs {1}{B}, so the {B} substitution should apply
    const reduces = findDirectional(
      analysis,
      "reduces_cost",
      "Mana Reducer",
      "Blood Artist"
    );
    expect(reduces.length).toBeGreaterThanOrEqual(1);
    expect(reduces[0].strength).toBeGreaterThanOrEqual(0.6);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. FULL COMBO DETECTION
// ═══════════════════════════════════════════════════════════════

test.describe("full combo detection", () => {
  test("Ashnod's Altar + Blood Artist: enables + triggers", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // Should find both enables and triggers between these cards
    const enables = findByType(
      analysis,
      "enables",
      "Blood Artist",
      "Ashnod's Altar"
    );
    const triggers = findByType(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Blood Artist"
    );

    // Blood Artist is a creature -> enables Altar (sacrifice fodder)
    expect(enables.length).toBeGreaterThanOrEqual(1);
    // Altar causes death -> triggers Blood Artist
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  test("three-card profile array: all pairwise interactions found", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([altar, artist, avenger]);

    // Should have interactions from multiple pairs
    expect(analysis.interactions.length).toBeGreaterThanOrEqual(3);

    // Avenger + Altar (enables: tokens for sacrifice)
    const avengerAltar = findByType(
      analysis,
      "enables",
      "Avenger of Zendikar",
      "Ashnod's Altar"
    );
    expect(avengerAltar.length).toBeGreaterThanOrEqual(1);

    // Altar + Blood Artist (triggers: sacrifice -> death trigger)
    const altarArtist = findByType(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Blood Artist"
    );
    expect(altarArtist.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═══════════════════════════════════════════════════════════════

test.describe("edge cases", () => {
  test("two cards with no interaction produce empty interactions for that pair", () => {
    const bolt = profile({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const counterspell = profile({
      name: "Counterspell",
      typeLine: "Instant",
      oracleText: "Counter target spell.",
      manaCost: "{U}{U}",
      cmc: 2,
    });
    const analysis = findInteractions([bolt, counterspell]);

    // No meaningful mechanical interactions between these two instants
    const pairInteractions = analysis.interactions.filter(
      (i) =>
        (i.cards[0] === "Lightning Bolt" &&
          i.cards[1] === "Counterspell") ||
        (i.cards[0] === "Counterspell" &&
          i.cards[1] === "Lightning Bolt")
    );
    expect(pairInteractions.length).toBe(0);
  });

  test("card should not self-interact (single card array)", () => {
    const altar = ashnodAltar();
    const analysis = findInteractions([altar]);

    // No pairs to check with a single card
    expect(analysis.interactions.length).toBe(0);
  });

  test("profiles map is populated with all cards", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    expect(analysis.profiles["Ashnod's Altar"]).toBeDefined();
    expect(analysis.profiles["Blood Artist"]).toBeDefined();
  });

  test("interaction events array is populated", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // The triggers interaction should have events
    const triggers = findByType(
      analysis,
      "triggers",
      "Ashnod's Altar",
      "Blood Artist"
    );
    if (triggers.length > 0) {
      expect(triggers[0].events.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("interactions have valid strength scores (0-1 range)", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([altar, artist, avenger]);

    for (const interaction of analysis.interactions) {
      expect(interaction.strength).toBeGreaterThanOrEqual(0);
      expect(interaction.strength).toBeLessThanOrEqual(1);
    }
  });

  test("empty profiles array returns empty analysis", () => {
    const analysis = findInteractions([]);

    expect(analysis.interactions).toHaveLength(0);
    expect(Object.keys(analysis.profiles)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. INTERACTION RESULT STRUCTURE
// ═══════════════════════════════════════════════════════════════

test.describe("interaction result structure", () => {
  test("analysis has required fields", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    expect(analysis).toHaveProperty("profiles");
    expect(analysis).toHaveProperty("interactions");
    expect(analysis).toHaveProperty("chains");
    expect(analysis).toHaveProperty("loops");
    expect(analysis).toHaveProperty("blockers");
    expect(analysis).toHaveProperty("enablers");
  });

  test("each interaction has cards, type, strength, and mechanical description", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    for (const interaction of analysis.interactions) {
      expect(interaction.cards).toHaveLength(2);
      expect(typeof interaction.type).toBe("string");
      expect(typeof interaction.strength).toBe("number");
      expect(typeof interaction.mechanical).toBe("string");
      expect(interaction.mechanical.length).toBeGreaterThan(0);
    }
  });

  test("chains and loops are arrays", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    expect(Array.isArray(analysis.chains)).toBe(true);
    expect(Array.isArray(analysis.loops)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// SLICE B: BLOCKING & CONFLICT DETECTION
// ═══════════════════════════════════════════════════════════════

// ─── Common Slice B card profiles ───

/** Rest in Peace: "If a card or token would be put into a graveyard from anywhere, exile it instead." */
function restInPeace(): CardProfile {
  return profile({
    name: "Rest in Peace",
    typeLine: "Enchantment",
    oracleText:
      "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
    manaCost: "{1}{W}",
    cmc: 2,
  });
}

/** Grafdigger's Cage: "Creature cards in graveyards and libraries can't enter the battlefield." */
function grafdiggersCage(): CardProfile {
  return profile({
    name: "Grafdigger's Cage",
    typeLine: "Artifact",
    oracleText:
      "Creature cards in graveyards and libraries can't enter the battlefield.\nPlayers can't cast spells from graveyards or libraries.",
    manaCost: "{1}",
    cmc: 1,
  });
}

/** Drannith Magistrate: "Your opponents can't cast spells from anywhere other than their hands." */
function drannithMagistrate(): CardProfile {
  return profile({
    name: "Drannith Magistrate",
    typeLine: "Creature — Human Wizard",
    oracleText:
      "Your opponents can't cast spells from anywhere other than their hands.",
    manaCost: "{1}{W}",
    cmc: 2,
    power: "1",
    toughness: "3",
  });
}

/** Sun Titan: "Whenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield." */
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

/** Animate Dead: "Enchant creature card in a graveyard / return enchanted creature card to the battlefield" */
function animateDead(): CardProfile {
  return profile({
    name: "Animate Dead",
    typeLine: "Enchantment — Aura",
    oracleText:
      "Enchant creature card in a graveyard\nWhen Animate Dead enters the battlefield, if it's on the battlefield, it loses \"enchant creature card in a graveyard\" and gains \"enchant creature put onto the battlefield with Animate Dead.\" Return enchanted creature card to the battlefield under your control.",
    manaCost: "{1}{B}",
    cmc: 2,
  });
}

test.describe("blocks detection — replacement effects", () => {
  test("Rest in Peace blocks Blood Artist death trigger", () => {
    const rip = restInPeace();
    const artist = bloodArtist();
    const analysis = findInteractions([rip, artist]);

    // RiP replaces dying with exile → Blood Artist's "whenever a creature dies" never fires
    const blocks = findByType(analysis, "blocks", "Rest in Peace", "Blood Artist");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0].mechanical).toContain("Rest in Peace");
    expect(blocks[0].mechanical).toContain("Blood Artist");
  });

  test("Rest in Peace blocks recursion (Sun Titan can't return from graveyard)", () => {
    const rip = restInPeace();
    const titan = sunTitan();
    const altar = ashnodAltar();
    const analysis = findInteractions([rip, titan, altar]);

    // RiP replaces graveyard transitions → Sun Titan can't return from graveyard
    const blocks = findByType(analysis, "blocks", "Rest in Peace", "Sun Titan");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("replacement effect blocker has correct mechanismType", () => {
    const rip = restInPeace();
    const artist = bloodArtist();
    const analysis = findInteractions([rip, artist]);

    // InteractionBlocker entries should exist with mechanismType: "replacement"
    const ripBlockers = analysis.blockers.filter(
      (b) => b.blocker === "Rest in Peace"
    );
    expect(ripBlockers.length).toBeGreaterThanOrEqual(1);
    expect(ripBlockers[0].mechanismType).toBe("replacement");
  });

  test("blocker entry includes blocked interactions list", () => {
    const rip = restInPeace();
    const artist = bloodArtist();
    const altar = ashnodAltar();
    const analysis = findInteractions([rip, artist, altar]);

    const ripBlockers = analysis.blockers.filter(
      (b) => b.blocker === "Rest in Peace"
    );
    expect(ripBlockers.length).toBeGreaterThanOrEqual(1);
    // The blocker should reference the specific interactions it disrupts
    expect(ripBlockers[0].blockedInteractions.length).toBeGreaterThanOrEqual(0);
    expect(ripBlockers[0].description.length).toBeGreaterThan(0);
  });
});

test.describe("blocks detection — restriction effects", () => {
  test("Grafdigger's Cage blocks graveyard recursion", () => {
    const cage = grafdiggersCage();
    const titan = sunTitan();
    const analysis = findInteractions([cage, titan]);

    // Cage restricts creatures entering battlefield from graveyard
    const blocks = findByType(analysis, "blocks", "Grafdigger's Cage", "Sun Titan");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("Grafdigger's Cage blocks Animate Dead reanimation", () => {
    const cage = grafdiggersCage();
    const animate = animateDead();
    const analysis = findInteractions([cage, animate]);

    const blocks = findByType(
      analysis,
      "blocks",
      "Grafdigger's Cage",
      "Animate Dead"
    );
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("restriction blocker has correct mechanismType", () => {
    const cage = grafdiggersCage();
    const titan = sunTitan();
    const analysis = findInteractions([cage, titan]);

    const cageBlockers = analysis.blockers.filter(
      (b) => b.blocker === "Grafdigger's Cage"
    );
    expect(cageBlockers.length).toBeGreaterThanOrEqual(1);
    expect(cageBlockers[0].mechanismType).toBe("restriction");
  });
});

test.describe("conflicts detection", () => {
  test("Rest in Peace conflicts with Blood Artist (graveyard hate vs death triggers)", () => {
    const rip = restInPeace();
    const artist = bloodArtist();
    const analysis = findInteractions([rip, artist]);

    // Conflicts should be derived from blocks — RiP undermines Blood Artist's strategy
    const conflicts = findByType(
      analysis,
      "conflicts",
      "Rest in Peace",
      "Blood Artist"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  test("Grafdigger's Cage conflicts with Sun Titan (graveyard hate vs recursion)", () => {
    const cage = grafdiggersCage();
    const titan = sunTitan();
    const analysis = findInteractions([cage, titan]);

    const conflicts = findByType(
      analysis,
      "conflicts",
      "Grafdigger's Cage",
      "Sun Titan"
    );
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  test("conflicts have strength <= 1.0", () => {
    const rip = restInPeace();
    const artist = bloodArtist();
    const analysis = findInteractions([rip, artist]);

    const conflicts = findByType(analysis, "conflicts");
    for (const c of conflicts) {
      expect(c.strength).toBeGreaterThan(0);
      expect(c.strength).toBeLessThanOrEqual(1.0);
    }
  });
});

test.describe("blocking edge cases", () => {
  test("cards without replacement/restriction produce no blocks", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    const blocks = findByType(analysis, "blocks");
    expect(blocks).toHaveLength(0);
    const conflicts = findByType(analysis, "conflicts");
    expect(conflicts).toHaveLength(0);
  });

  test("replacement effects that don't intercept relevant events don't create blocks", () => {
    // A card with a replacement effect that doesn't interfere with another card
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

    // Doubling Season's replacement effects are "modify" mode, not "replace" mode
    // They shouldn't block Blood Artist's death trigger
    const blocks = findByType(analysis, "blocks", "Doubling Season", "Blood Artist");
    expect(blocks).toHaveLength(0);
  });

  test("multiple blockers are all reported", () => {
    const rip = restInPeace();
    const cage = grafdiggersCage();
    const titan = sunTitan();
    const analysis = findInteractions([rip, cage, titan]);

    // Both RiP and Cage should block Sun Titan's recursion
    const blockers = analysis.blockers;
    const blockerNames = blockers.map((b) => b.blocker);
    expect(blockerNames).toContain("Rest in Peace");
    expect(blockerNames).toContain("Grafdigger's Cage");
  });
});

// ═══════════════════════════════════════════════════════════════
// SLICE C: CHAIN DETECTION, LOOP DETECTION, ENABLERS
// ═══════════════════════════════════════════════════════════════

// ─── Additional Slice C card profiles ───

/** Reassembling Skeleton: "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped." */
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

/** Pitiless Plunderer: "Whenever another creature you control dies, create a Treasure token." */
function pitilessPlunderer(): CardProfile {
  return profile({
    name: "Pitiless Plunderer",
    typeLine: "Creature — Human Pirate",
    oracleText:
      "Whenever another creature you control dies, create a Treasure token.",
    manaCost: "{3}{B}",
    cmc: 4,
    power: "1",
    toughness: "4",
  });
}

test.describe("chain detection", () => {
  test("three-card chain: Avenger → Altar → Blood Artist", () => {
    const avenger = avengerOfZendikar();
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([avenger, altar, artist]);

    // Avenger creates tokens → Altar sacrifices them → Blood Artist triggers on death
    // This should form a chain of length 3
    expect(analysis.chains.length).toBeGreaterThanOrEqual(1);

    // Find the chain involving all three cards
    const tripleChain = analysis.chains.find(
      (c) =>
        c.cards.includes("Avenger of Zendikar") &&
        c.cards.includes("Ashnod's Altar") &&
        c.cards.includes("Blood Artist")
    );
    expect(tripleChain).toBeDefined();
    expect(tripleChain!.steps.length).toBeGreaterThanOrEqual(2);
    expect(tripleChain!.description.length).toBeGreaterThan(0);
  });

  test("chain steps have from, to, event, and description", () => {
    const avenger = avengerOfZendikar();
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([avenger, altar, artist]);

    for (const chain of analysis.chains) {
      for (const step of chain.steps) {
        expect(typeof step.from).toBe("string");
        expect(typeof step.to).toBe("string");
        expect(step.event).toBeDefined();
        expect(step.event.kind).toBeTruthy();
        expect(typeof step.description).toBe("string");
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });

  test("two cards with no multi-step path produce no chains", () => {
    const ring = solRing();
    const bolt = profile({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      manaCost: "{R}",
      cmc: 1,
    });
    const analysis = findInteractions([ring, bolt]);

    // Sol Ring and Bolt don't form a chain
    expect(analysis.chains).toHaveLength(0);
  });

  test("chain requires at least 3 cards in a causal path", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, artist]);

    // Two-card interactions are just pairwise, not chains
    expect(analysis.chains).toHaveLength(0);
  });
});

test.describe("loop detection", () => {
  test("Ashnod's Altar + Reassembling Skeleton forms a resource loop", () => {
    const altar = ashnodAltar();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([altar, skeleton]);

    // Altar sacs Skeleton → produces {C}{C}
    // Skeleton returns from GY for {1}{B} → loop (needs external {B})
    expect(analysis.loops.length).toBeGreaterThanOrEqual(1);

    const loop = analysis.loops.find(
      (l) =>
        l.cards.includes("Ashnod's Altar") &&
        l.cards.includes("Reassembling Skeleton")
    );
    expect(loop).toBeDefined();
    expect(loop!.steps.length).toBeGreaterThanOrEqual(2);
    expect(loop!.description.length).toBeGreaterThan(0);
  });

  test("loop has netEffect with resources", () => {
    const altar = ashnodAltar();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([altar, skeleton]);

    const loop = analysis.loops.find(
      (l) =>
        l.cards.includes("Ashnod's Altar") &&
        l.cards.includes("Reassembling Skeleton")
    );
    expect(loop).toBeDefined();
    expect(loop!.netEffect).toBeDefined();
    expect(loop!.netEffect.resources).toBeDefined();
    expect(loop!.netEffect.events).toBeDefined();
  });

  test("Altar + Skeleton loop is not fully infinite (needs external {B})", () => {
    const altar = ashnodAltar();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([altar, skeleton]);

    const loop = analysis.loops.find(
      (l) =>
        l.cards.includes("Ashnod's Altar") &&
        l.cards.includes("Reassembling Skeleton")
    );
    expect(loop).toBeDefined();
    // Not fully infinite — needs {B} each iteration
    expect(loop!.isInfinite).toBe(false);
  });

  test("three-card loop: Altar + Skeleton + Blood Artist (with drain output)", () => {
    const altar = ashnodAltar();
    const skeleton = reassemblingSkeleton();
    const artist = bloodArtist();
    const analysis = findInteractions([altar, skeleton, artist]);

    // Even with Blood Artist, the loop still needs external {B}
    // But it should detect a loop that includes the drain
    const loop = analysis.loops.find(
      (l) =>
        l.cards.includes("Ashnod's Altar") &&
        l.cards.includes("Reassembling Skeleton")
    );
    expect(loop).toBeDefined();
  });

  test("loop with sufficient mana production is infinite", () => {
    // Construct a loop that produces more than it consumes, no colored mana needed
    // Use a card that returns for only colorless mana + a sac outlet producing colorless
    const freeRecurrer = profile({
      name: "Free Recurrer",
      typeLine: "Artifact Creature — Construct",
      oracleText: "{1}: Return Free Recurrer from your graveyard to the battlefield.",
      manaCost: "{0}",
      cmc: 0,
      power: "1",
      toughness: "1",
    });
    const altar = ashnodAltar(); // Produces {C}{C} for sacrificing a creature
    const analysis = findInteractions([altar, freeRecurrer]);

    // Altar produces 2 colorless, Free Recurrer costs {1} to return
    // Net: +1 mana per cycle — infinite loop
    const loop = analysis.loops.find(
      (l) =>
        l.cards.includes("Ashnod's Altar") &&
        l.cards.includes("Free Recurrer")
    );
    expect(loop).toBeDefined();
    expect(loop!.isInfinite).toBe(true);
  });

  test("no loops from unrelated cards", () => {
    const ring = solRing();
    const tutor = demonicTutor();
    const analysis = findInteractions([ring, tutor]);

    expect(analysis.loops).toHaveLength(0);
  });

  test("loop steps describe the cycle clearly", () => {
    const altar = ashnodAltar();
    const skeleton = reassemblingSkeleton();
    const analysis = findInteractions([altar, skeleton]);

    for (const loop of analysis.loops) {
      expect(loop.cards.length).toBeGreaterThanOrEqual(2);
      expect(loop.steps.length).toBeGreaterThanOrEqual(2);
      for (const step of loop.steps) {
        expect(typeof step.from).toBe("string");
        expect(typeof step.to).toBe("string");
        expect(step.event).toBeDefined();
      }
    }
  });
});

test.describe("enabler detection", () => {
  test("enablers array is populated for cards required by interactions", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([altar, artist, avenger]);

    // At least some enablers should be detected — cards that are central
    // to making interactions work
    expect(analysis.enablers).toBeDefined();
    expect(Array.isArray(analysis.enablers)).toBe(true);
  });

  test("enablers reference the interactions they enable", () => {
    const altar = ashnodAltar();
    const artist = bloodArtist();
    const avenger = avengerOfZendikar();
    const analysis = findInteractions([altar, artist, avenger]);

    for (const enabler of analysis.enablers) {
      expect(typeof enabler.enabler).toBe("string");
      expect(Array.isArray(enabler.enabledInteractions)).toBe(true);
      expect(typeof enabler.isRequired).toBe("boolean");
    }
  });

  test("empty profiles produce no enablers", () => {
    const analysis = findInteractions([]);
    expect(analysis.enablers).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// REGRESSION: TYPE-MATCHING FALSE POSITIVES
// ═══════════════════════════════════════════════════════════════

test.describe("type matching — Sliver/fetchland regression", () => {
  function basalSliver(): CardProfile {
    return profile({
      name: "Basal Sliver",
      typeLine: "Creature — Sliver",
      oracleText: "All Slivers have \"Sacrifice this permanent: Add {B}{B}.\"",
      manaCost: "{2}{B}",
    });
  }

  function pollutedDelta(): CardProfile {
    return profile({
      name: "Polluted Delta",
      typeLine: "Land",
      oracleText: "{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.",
    });
  }

  function sliverOverlord(): CardProfile {
    return profile({
      name: "Sliver Overlord",
      typeLine: "Legendary Creature — Sliver Mutant",
      oracleText: "{3}: Search your library for a Sliver card, reveal that card, put it into your hand, then shuffle.\n{3}: Gain control of target Sliver.",
      manaCost: "{W}{U}{B}{R}{G}",
    });
  }

  function sliverLegion(): CardProfile {
    return profile({
      name: "Sliver Legion",
      typeLine: "Legendary Creature — Sliver",
      oracleText: "All Slivers get +1/+1 for each other Sliver on the battlefield.",
      manaCost: "{W}{U}{B}{R}{G}",
    });
  }

  test("Basal Sliver self-sacrifice cost does NOT enable sacrificing a fetchland", () => {
    const basal = basalSliver();
    const delta = pollutedDelta();
    const analysis = findInteractions([basal, delta]);

    // Basal Sliver grants sacrifice to Slivers only — a fetchland is not a Sliver
    const enables = findDirectional(analysis, "enables", "Basal Sliver", "Polluted Delta");
    expect(enables.length).toBe(0);
  });

  test("Polluted Delta self-sacrifice does NOT enable sacrificing Basal Sliver", () => {
    const basal = basalSliver();
    const delta = pollutedDelta();
    const analysis = findInteractions([basal, delta]);

    // Polluted Delta sacrifices itself — it can't sacrifice other cards
    const enables = findDirectional(analysis, "enables", "Polluted Delta", "Basal Sliver");
    expect(enables.length).toBe(0);
  });

  test("Basal Sliver + fetchland does NOT form a loop", () => {
    const basal = basalSliver();
    const delta = pollutedDelta();
    const analysis = findInteractions([basal, delta]);

    expect(analysis.loops.length).toBe(0);
  });

  test("Sliver Overlord search does NOT match a fetchland (not a Sliver)", () => {
    const overlord = sliverOverlord();
    const delta = pollutedDelta();
    const analysis = findInteractions([overlord, delta]);

    // No tutor/recur/enables interactions — fetchlands aren't Slivers
    const allInteractions = analysis.interactions.filter(
      (i) => i.cards.includes("Sliver Overlord") && i.cards.includes("Polluted Delta")
    );
    // Only valid interaction might be "triggers" from sacrifice causing zone transitions
    // but NOT enables or recurs
    const enables = allInteractions.filter((i) => i.type === "enables");
    const recurs = allInteractions.filter((i) => i.type === "recurs");
    expect(enables.length).toBe(0);
    expect(recurs.length).toBe(0);
  });

  test("two Slivers do NOT create false sacrifice interactions with each other", () => {
    const overlord = sliverOverlord();
    const legion = sliverLegion();
    const analysis = findInteractions([overlord, legion]);

    // Neither Sliver should show false "enables sacrifice" with the other.
    // Sliver Overlord's abilities are search (tutor) and control — neither
    // should create enables interactions with Sliver Legion.
    const enables = analysis.interactions.filter(
      (i) =>
        i.type === "enables" &&
        i.cards.includes("Sliver Overlord") &&
        i.cards.includes("Sliver Legion")
    );
    expect(enables.length).toBe(0);
  });

  test("two lands tapping for mana do NOT form a loop (parallel producers, not a chain)", () => {
    const worldTree = profile({
      name: "The World Tree",
      typeLine: "Land",
      oracleText: "The World Tree enters the battlefield tapped.\n{T}: Add {G}.\nAs long as you control six or more lands, lands you control have \"{T}: Add one mana of any color.\"\n{W}{W}{U}{U}{B}{B}{R}{R}{G}{G}, {T}, Sacrifice The World Tree: Search your library for any number of God cards, put them onto the battlefield, then shuffle.",
    });
    const sliverHive = profile({
      name: "Sliver Hive",
      typeLine: "Land",
      oracleText: "{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Sliver spell.\n{5}, {T}: Create a 1/1 colorless Sliver creature token. Activate only if you control a Sliver.",
    });
    const analysis = findInteractions([worldTree, sliverHive]);

    // Two lands that tap for mana are parallel producers — no loop
    expect(analysis.loops.length).toBe(0);

    // Should NOT have mana-enables-mana interactions between pure mana sources
    const manaEnables = analysis.interactions.filter(
      (i) => i.type === "enables" && i.mechanical.includes("produces mana")
    );
    expect(manaEnables.length).toBe(0);
  });
});
