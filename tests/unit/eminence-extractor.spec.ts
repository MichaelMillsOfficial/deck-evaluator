/**
 * Eminence Extractor Unit Tests
 *
 * Tests cover: extractEminenceAbilities, parsePartnerInfo, parseCompanionRestriction
 * for eminence commanders, partner variants, and companion cards.
 */

import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import {
  extractEminenceAbilities,
  parsePartnerInfo,
  parseCompanionRestriction,
  profileCard,
} from "../../src/lib/interaction-engine";
import type { AbilityNode } from "../../src/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// EMINENCE COMMANDERS
// ═══════════════════════════════════════════════════════════════

const edgarMarkov = makeCard({
  name: "Edgar Markov",
  manaCost: "{3}{R}{W}{B}",
  cmc: 6,
  typeLine: "Legendary Creature — Vampire Knight",
  oracleText:
    "Eminence — Whenever you cast a Vampire spell, if Edgar Markov is in the command zone or on the battlefield, create a 1/1 black Vampire creature token with lifelink.\nFirst strike, haste\nWhenever Edgar Markov attacks, put a +1/+1 counter on each Vampire you control.",
  keywords: ["Eminence", "First strike", "Haste"],
  power: "4",
  toughness: "4",
  colorIdentity: ["R", "W", "B"],
  colors: ["R", "W", "B"],
  supertypes: ["Legendary"],
  subtypes: ["Vampire", "Knight"],
});

const theUrDragon = makeCard({
  name: "The Ur-Dragon",
  manaCost: "{4}{W}{U}{B}{R}{G}",
  cmc: 9,
  typeLine: "Legendary Creature — Dragon Avatar",
  oracleText:
    "Eminence — As long as The Ur-Dragon is in the command zone or on the battlefield, other Dragon spells you cast cost {1} less to cast.\nFlying\nWhenever one or more Dragons you control attack, draw that many cards, then you may put a permanent card from your hand onto the battlefield.",
  keywords: ["Eminence", "Flying"],
  power: "10",
  toughness: "10",
  colorIdentity: ["W", "U", "B", "R", "G"],
  colors: ["W", "U", "B", "R", "G"],
  supertypes: ["Legendary"],
  subtypes: ["Dragon", "Avatar"],
});

const inallaArchmageRitualist = makeCard({
  name: "Inalla, Archmage Ritualist",
  manaCost: "{2}{U}{B}{R}",
  cmc: 5,
  typeLine: "Legendary Creature — Human Wizard",
  oracleText:
    "Eminence — Whenever another nontoken Wizard enters the battlefield under your control, if Inalla, Archmage Ritualist is in the command zone or on the battlefield, you may pay {1}. If you do, create a token that's a copy of that creature. The token gains haste. Exile it at the beginning of the next end step.\nTap five untapped Wizards you control: Target player loses 7 life.",
  keywords: ["Eminence"],
  power: "4",
  toughness: "5",
  colorIdentity: ["U", "B", "R"],
  colors: ["U", "B", "R"],
  supertypes: ["Legendary"],
  subtypes: ["Human", "Wizard"],
});

const arahboRoarOfTheWorld = makeCard({
  name: "Arahbo, Roar of the World",
  manaCost: "{3}{G}{W}",
  cmc: 5,
  typeLine: "Legendary Creature — Cat Avatar",
  oracleText:
    "Eminence — At the beginning of combat on your turn, if Arahbo, Roar of the World is in the command zone or on the battlefield, another target Cat you control gets +3/+3 until end of turn.\nWhenever another Cat you control attacks, you may pay {1}{G}{W}. If you do, that creature gets +X/+X until end of turn, where X is its power, and gains trample until end of turn.",
  keywords: ["Eminence"],
  power: "5",
  toughness: "5",
  colorIdentity: ["G", "W"],
  colors: ["G", "W"],
  supertypes: ["Legendary"],
  subtypes: ["Cat", "Avatar"],
});

const atraxa = makeCard({
  name: "Atraxa, Praetors' Voice",
  manaCost: "{G}{W}{U}{B}",
  cmc: 4,
  typeLine: "Legendary Creature — Phyrexian Angel Horror",
  oracleText:
    "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
  keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
  power: "4",
  toughness: "4",
  colorIdentity: ["G", "W", "U", "B"],
  colors: ["G", "W", "U", "B"],
  supertypes: ["Legendary"],
  subtypes: ["Phyrexian", "Angel", "Horror"],
});

// ═══════════════════════════════════════════════════════════════
// EMINENCE DETECTION
// ═══════════════════════════════════════════════════════════════

test.describe("extractEminenceAbilities", () => {
  test("detects Edgar Markov as eminence commander", () => {
    const result = extractEminenceAbilities(edgarMarkov, []);
    expect(result.isEminence).toBe(true);
  });

  test("detects The Ur-Dragon as eminence commander", () => {
    const result = extractEminenceAbilities(theUrDragon, []);
    expect(result.isEminence).toBe(true);
  });

  test("detects Inalla as eminence commander", () => {
    const result = extractEminenceAbilities(inallaArchmageRitualist, []);
    expect(result.isEminence).toBe(true);
  });

  test("detects Arahbo as eminence commander", () => {
    const result = extractEminenceAbilities(arahboRoarOfTheWorld, []);
    expect(result.isEminence).toBe(true);
  });

  test("returns isEminence false for non-eminence commander", () => {
    const result = extractEminenceAbilities(atraxa, []);
    expect(result.isEminence).toBe(false);
    expect(result.eminenceAbilities).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// PARTNER DETECTION
// ═══════════════════════════════════════════════════════════════

test.describe("parsePartnerInfo", () => {
  test("detects generic Partner keyword", () => {
    const thrasios = makeCard({
      name: "Thrasios, Triton Hero",
      typeLine: "Legendary Creature — Merfolk Wizard",
      oracleText:
        "{4}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise, draw a card.\nPartner",
      keywords: ["Partner"],
    });
    const result = parsePartnerInfo(thrasios);
    expect(result.hasPartner).toBe(true);
    expect(result.partnerType).toBe("generic");
    expect(result.partnerWith).toBeNull();
    expect(result.hasBackground).toBe(false);
  });

  test("detects 'Partner with [Name]'", () => {
    const pir = makeCard({
      name: "Pir, Imaginative Rascal",
      typeLine: "Legendary Creature — Human",
      oracleText:
        "Partner with Toothy, Imaginary Friend\nIf one or more counters would be put on a permanent your team controls, that many plus one of each of those kinds of counters are put on that permanent instead.",
      keywords: ["Partner with Toothy, Imaginary Friend"],
    });
    const result = parsePartnerInfo(pir);
    expect(result.hasPartner).toBe(true);
    expect(result.partnerType).toBe("named");
    expect(result.partnerWith).toBe("Toothy, Imaginary Friend");
    expect(result.hasBackground).toBe(false);
  });

  test("detects Friends Forever", () => {
    const will = makeCard({
      name: "Will the Wise",
      typeLine: "Legendary Creature — Human",
      oracleText:
        "When Will the Wise enters the battlefield, draw a card, then choose a card in your hand and put it on top of your library.\nFriends forever",
      keywords: ["Friends forever"],
    });
    const result = parsePartnerInfo(will);
    expect(result.hasPartner).toBe(true);
    expect(result.partnerType).toBe("friends_forever");
    expect(result.partnerWith).toBeNull();
    expect(result.hasBackground).toBe(false);
  });

  test("detects Choose a Background", () => {
    const abdel = makeCard({
      name: "Abdel Adrian, Gorion's Ward",
      typeLine: "Legendary Creature — Human Warrior",
      oracleText:
        "When Abdel Adrian, Gorion's Ward enters the battlefield, exile any number of other nonland permanents you control until Abdel Adrian leaves the battlefield. Create a 1/1 white Soldier creature token for each permanent exiled this way.\nChoose a Background",
      keywords: ["Choose a Background"],
    });
    const result = parsePartnerInfo(abdel);
    expect(result.hasPartner).toBe(false);
    expect(result.partnerType).toBe("choose_background");
    expect(result.partnerWith).toBeNull();
    expect(result.hasBackground).toBe(true);
  });

  test("detects Doctor's Companion", () => {
    const rose = makeCard({
      name: "Rose Tyler",
      typeLine: "Legendary Creature — Human",
      oracleText:
        "Whenever you create a token, if it isn't a Food, put a +1/+1 counter on Rose Tyler.\nDoctor's companion",
      keywords: ["Doctor's companion"],
    });
    const result = parsePartnerInfo(rose);
    expect(result.hasPartner).toBe(true);
    expect(result.partnerType).toBe("doctors_companion");
    expect(result.partnerWith).toBeNull();
    expect(result.hasBackground).toBe(false);
  });

  test("returns no partner for regular creatures", () => {
    const result = parsePartnerInfo(atraxa);
    expect(result.hasPartner).toBe(false);
    expect(result.partnerType).toBeNull();
    expect(result.partnerWith).toBeNull();
    expect(result.hasBackground).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// COMPANION DETECTION
// ═══════════════════════════════════════════════════════════════

test.describe("parseCompanionRestriction", () => {
  test("extracts companion restriction text", () => {
    const lurrus = makeCard({
      name: "Lurrus of the Dream-Den",
      typeLine: "Legendary Creature — Cat Nightmare",
      oracleText:
        "Companion — Each permanent card in your starting deck has mana value 2 or less.\nLifelink\nDuring each of your turns, you may cast one permanent spell with mana value 2 or less from your graveyard.",
      keywords: ["Companion", "Lifelink"],
    });
    const result = parseCompanionRestriction(lurrus);
    expect(result).toBe(
      "Each permanent card in your starting deck has mana value 2 or less"
    );
  });

  test("returns null for non-companion cards", () => {
    const result = parseCompanionRestriction(atraxa);
    expect(result).toBeNull();
  });

  test("extracts Gyruda companion restriction", () => {
    const gyruda = makeCard({
      name: "Gyruda, Doom of Depths",
      typeLine: "Legendary Creature — Demon Kraken",
      oracleText:
        "Companion — Each nonland card in your starting deck has an even mana value.\nWhen Gyruda, Doom of Depths enters the battlefield, each player mills four cards. Put a creature card with an even mana value from among the milled cards onto the battlefield under your control.",
      keywords: ["Companion"],
    });
    const result = parseCompanionRestriction(gyruda);
    expect(result).toBe(
      "Each nonland card in your starting deck has an even mana value"
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// INTEGRATION: profileCard populates commander fields
// ═══════════════════════════════════════════════════════════════

test.describe("profileCard commander integration", () => {
  test("populates eminence field for Edgar Markov", () => {
    const profile = profileCard(edgarMarkov);
    expect(profile.commander).toBeDefined();
    expect(profile.commander!.eminence).toBeDefined();
    expect(profile.commander!.eminence!.length).toBeGreaterThan(0);
  });

  test("populates partner fields for Thrasios", () => {
    const thrasios = makeCard({
      name: "Thrasios, Triton Hero",
      typeLine: "Legendary Creature — Merfolk Wizard",
      oracleText:
        "{4}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise, draw a card.\nPartner",
      keywords: ["Partner"],
    });
    const profile = profileCard(thrasios);
    expect(profile.commander).toBeDefined();
    expect(profile.commander!.hasPartner).toBe(true);
    expect(profile.commander!.partnerType).toBe("generic");
  });

  test("populates companion restriction for Lurrus", () => {
    const lurrus = makeCard({
      name: "Lurrus of the Dream-Den",
      typeLine: "Legendary Creature — Cat Nightmare",
      oracleText:
        "Companion — Each permanent card in your starting deck has mana value 2 or less.\nLifelink\nDuring each of your turns, you may cast one permanent spell with mana value 2 or less from your graveyard.",
      keywords: ["Companion", "Lifelink"],
    });
    const profile = profileCard(lurrus);
    expect(profile.commander).toBeDefined();
    expect(profile.commander!.companionRestriction).toBe(
      "Each permanent card in your starting deck has mana value 2 or less"
    );
  });

  test("does not set commander field for regular creatures", () => {
    const profile = profileCard(atraxa);
    expect(profile.commander).toBeUndefined();
  });
});
