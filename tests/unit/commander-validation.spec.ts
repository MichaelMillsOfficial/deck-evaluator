import { test, expect } from "@playwright/test";
import {
  isSingletonExempt,
  getMaxQuantity,
  validateCommanderDeck,
  canPairCommanders,
  isLegalCommander,
  validateCommanderSelection,
  validateCommanderLegality,
  buildEdhrecUrl,
  BASIC_LAND_NAMES,
} from "../../src/lib/commander-validation";
import type { EnrichedCard } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

// --- isSingletonExempt ---

test.describe("isSingletonExempt", () => {
  const gameChangerNames = new Set(["Relentless Rats", "Rat Colony", "Seven Dwarves"]);

  test("basic lands are exempt", () => {
    for (const land of BASIC_LAND_NAMES) {
      expect(isSingletonExempt(land, {}, gameChangerNames)).toBe(true);
    }
  });

  test("game changer cards are exempt", () => {
    expect(isSingletonExempt("Relentless Rats", {}, gameChangerNames)).toBe(true);
    expect(isSingletonExempt("Rat Colony", {}, gameChangerNames)).toBe(true);
  });

  test("normal cards are not exempt", () => {
    expect(isSingletonExempt("Sol Ring", {}, gameChangerNames)).toBe(false);
    expect(isSingletonExempt("Lightning Bolt", {}, gameChangerNames)).toBe(false);
  });
});

// --- getMaxQuantity ---

test.describe("getMaxQuantity", () => {
  const gameChangerNames = new Set(["Relentless Rats", "Rat Colony", "Seven Dwarves"]);

  test("returns Infinity for basic lands", () => {
    expect(getMaxQuantity("Plains", {}, gameChangerNames)).toBe(Infinity);
    expect(getMaxQuantity("Forest", {}, gameChangerNames)).toBe(Infinity);
  });

  test("returns Infinity for most game changers", () => {
    expect(getMaxQuantity("Relentless Rats", {}, gameChangerNames)).toBe(Infinity);
    expect(getMaxQuantity("Rat Colony", {}, gameChangerNames)).toBe(Infinity);
  });

  test("returns 7 for Seven Dwarves", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Seven Dwarves": makeCard({
        name: "Seven Dwarves",
        oracleText:
          "A deck can have up to seven cards named Seven Dwarves.",
      }),
    };
    expect(getMaxQuantity("Seven Dwarves", cardMap, gameChangerNames)).toBe(7);
  });

  test("returns 1 for normal cards", () => {
    expect(getMaxQuantity("Sol Ring", {}, gameChangerNames)).toBe(1);
  });
});

// --- validateCommanderDeck ---

test.describe("validateCommanderDeck", () => {
  const bannedSet = new Set(["Flash", "Paradox Engine"]);
  const gameChangerNames = new Set(["Relentless Rats"]);

  test("no commander → hasCommander false, errors about no commander", () => {
    const deck = makeDeck({ commanders: [], mainboard: [] });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.hasCommander).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /commander/i.test(e.message))).toBe(true);
  });

  test("valid 100-card deck with commander", () => {
    const commanders = [{ name: "Atraxa, Praetors' Voice", quantity: 1 }];
    // 99 unique cards in mainboard
    const mainboard = Array.from({ length: 99 }, (_, i) => ({
      name: `Card ${i + 1}`,
      quantity: 1,
    }));
    const deck = makeDeck({ commanders, mainboard });
    const cardMap: Record<string, EnrichedCard> = {};
    const result = validateCommanderDeck(deck, cardMap, bannedSet, gameChangerNames);
    expect(result.hasCommander).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("wrong card count → error", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = Array.from({ length: 80 }, (_, i) => ({
      name: `Card ${i + 1}`,
      quantity: 1,
    }));
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /card count/i.test(e.message) || /100/i.test(e.message))).toBe(true);
  });

  test("duplicate non-exempt cards → error listing the card names", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Sol Ring", quantity: 2 },
      ...Array.from({ length: 97 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) => /singleton/i.test(e.message) || /duplicate/i.test(e.message)
      )
    ).toBe(true);
    expect(result.errors.some((e) => e.cards?.includes("Sol Ring"))).toBe(true);
  });

  test("banned cards → error listing banned card names", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Flash", quantity: 1 },
      ...Array.from({ length: 98 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /banned/i.test(e.message))).toBe(true);
    expect(result.errors.some((e) => e.cards?.includes("Flash"))).toBe(true);
  });

  test("multiple errors are all reported", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Flash", quantity: 2 }, // banned AND duplicate
      ...Array.from({ length: 80 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    // Should have at least: card count error, singleton error, banned error
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("basic lands and game changers are allowed in multiples", () => {
    const commanders = [{ name: "Commander", quantity: 1 }];
    const mainboard = [
      { name: "Plains", quantity: 30 },
      { name: "Relentless Rats", quantity: 60 },
      ...Array.from({ length: 9 }, (_, i) => ({
        name: `Card ${i + 1}`,
        quantity: 1,
      })),
    ];
    const deck = makeDeck({ commanders, mainboard });
    const result = validateCommanderDeck(deck, {}, bannedSet, gameChangerNames);
    // Should be valid (100 cards total, no singleton violations)
    expect(result.isValid).toBe(true);
  });

  const PARTNER_REMINDER =
    "Partner (You can have two commanders if both have partner.)";

  function twoCommanderDeck(a: string, b: string) {
    const commanders = [
      { name: a, quantity: 1 },
      { name: b, quantity: 1 },
    ];
    const mainboard = Array.from({ length: 98 }, (_, i) => ({
      name: `Card ${i + 1}`,
      quantity: 1,
    }));
    return makeDeck({ commanders, mainboard });
  }

  test("two commanders that both have Partner validate", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Thrasios, Triton Hero": makeCard({
        name: "Thrasios, Triton Hero",
        typeLine: "Legendary Creature — Merfolk Wizard",
        supertypes: ["Legendary"],
        oracleText: `{4}: Scry 1.\n${PARTNER_REMINDER}`,
      }),
      "Tymna the Weaver": makeCard({
        name: "Tymna the Weaver",
        typeLine: "Legendary Creature — Human Cleric",
        supertypes: ["Legendary"],
        oracleText: `Lifelink\n${PARTNER_REMINDER}`,
      }),
    };
    const deck = twoCommanderDeck("Thrasios, Triton Hero", "Tymna the Weaver");
    const result = validateCommanderDeck(deck, cardMap, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(true);
  });

  test("two commanders without a legal pairing produce a validation error", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Atraxa, Praetors' Voice": makeCard({
        name: "Atraxa, Praetors' Voice",
        typeLine: "Legendary Creature — Phyrexian Angel Horror",
        supertypes: ["Legendary"],
        oracleText: "Flying, vigilance, deathtouch, lifelink",
      }),
      "Ezuri, Stalker of Spheres": makeCard({
        name: "Ezuri, Stalker of Spheres",
        typeLine: "Legendary Creature — Phyrexian Elf",
        supertypes: ["Legendary"],
        oracleText: "Whenever you cast a noncreature spell, draw a card.",
      }),
    };
    const deck = twoCommanderDeck(
      "Atraxa, Praetors' Voice",
      "Ezuri, Stalker of Spheres"
    );
    const result = validateCommanderDeck(deck, cardMap, bannedSet, gameChangerNames);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /cannot be paired/i.test(e.message))).toBe(true);
  });
});

// --- canPairCommanders ---

test.describe("canPairCommanders", () => {
  const PARTNER_REMINDER =
    "Partner (You can have two commanders if both have partner.)";

  test("both plain Partner pair; one-sided Partner does not", () => {
    const a = makeCard({ name: "A", oracleText: `Vigilance\n${PARTNER_REMINDER}` });
    const b = makeCard({ name: "B", oracleText: `Flying\n${PARTNER_REMINDER}` });
    const c = makeCard({ name: "C", oracleText: "Flying" });
    expect(canPairCommanders(a, b)).toBe(true);
    expect(canPairCommanders(a, c)).toBe(false);
  });

  test("mutual 'Partner with' pairs; naming a different card does not", () => {
    const brallin = makeCard({
      name: "Brallin, Skyshark Rider",
      oracleText: "Partner with Shabraz, the Skyshark",
    });
    const shabraz = makeCard({
      name: "Shabraz, the Skyshark",
      oracleText: "Partner with Brallin, Skyshark Rider",
    });
    const stranger = makeCard({
      name: "Stranger",
      oracleText: "Partner with Someone Else",
    });
    expect(canPairCommanders(brallin, shabraz)).toBe(true);
    expect(canPairCommanders(brallin, stranger)).toBe(false);
    // "Partner with" is not plain Partner.
    expect(canPairCommanders(brallin, makeCard({ name: "P", oracleText: PARTNER_REMINDER }))).toBe(false);
  });

  test("restricted-group Partner pairs only within the same group", () => {
    const alphaOne = makeCard({
      name: "Alpha One",
      oracleText: "Partner — Advisors (You can have two commanders if both have partner with the same group.)",
    });
    const alphaTwo = makeCard({
      name: "Alpha Two",
      oracleText: "Partner — Advisors (You can have two commanders if both have partner with the same group.)",
    });
    const betaOne = makeCard({
      name: "Beta One",
      oracleText: "Partner — Warlords (You can have two commanders if both have partner with the same group.)",
    });
    const plainPartner = makeCard({ name: "Plain", oracleText: PARTNER_REMINDER });
    expect(canPairCommanders(alphaOne, alphaTwo)).toBe(true);
    expect(canPairCommanders(alphaOne, betaOne)).toBe(false);
    expect(canPairCommanders(alphaOne, plainPartner)).toBe(false);
  });

  test("Friends forever on both pairs", () => {
    const a = makeCard({
      name: "Bjorna",
      oracleText: "Friends forever (You can have two commanders if both have friends forever.)",
    });
    const b = makeCard({
      name: "Elmar",
      oracleText: "Friends forever (You can have two commanders if both have friends forever.)",
    });
    expect(canPairCommanders(a, b)).toBe(true);
    expect(canPairCommanders(a, makeCard({ name: "C", oracleText: "" }))).toBe(false);
  });

  test("Choose a Background pairs with a Background enchantment, either order", () => {
    const wilson = makeCard({
      name: "Wilson, Refined Grizzly",
      typeLine: "Legendary Creature — Bear",
      oracleText: "Choose a Background (You can have a Background as a second commander.)",
    });
    const background = makeCard({
      name: "Raised by Giants",
      typeLine: "Legendary Enchantment — Background",
      oracleText: "Commander creatures you own have base power and toughness 10/10.",
    });
    expect(canPairCommanders(wilson, background)).toBe(true);
    expect(canPairCommanders(background, wilson)).toBe(true);
    expect(
      canPairCommanders(background, makeCard({ name: "C", oracleText: "" }))
    ).toBe(false);
  });

  test("a Time Lord Doctor pairs with a Doctor's companion", () => {
    const doctor = makeCard({
      name: "The Tenth Doctor",
      typeLine: "Legendary Creature — Time Lord Doctor",
      oracleText: "Allons-y!",
    });
    const companion = makeCard({
      name: "Rose Tyler",
      typeLine: "Legendary Creature — Human",
      oracleText:
        "Doctor's companion (You can have two commanders if the other is the Doctor.)",
    });
    expect(canPairCommanders(doctor, companion)).toBe(true);
    expect(canPairCommanders(companion, doctor)).toBe(true);
    expect(canPairCommanders(doctor, makeCard({ name: "C", oracleText: "" }))).toBe(false);
  });
});

// --- isLegalCommander ---

test.describe("isLegalCommander", () => {
  test("legendary creature is a valid commander", () => {
    const card = makeCard({
      name: "Atraxa, Praetors' Voice",
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("non-legendary creature is not a valid commander", () => {
    const card = makeCard({
      name: "Llanowar Elves",
      typeLine: "Creature — Elf Druid",
      supertypes: [],
    });
    expect(isLegalCommander(card)).toBe(false);
  });

  test("legendary planeswalker is a valid commander", () => {
    const card = makeCard({
      name: "Teferi, Temporal Archmage",
      typeLine: "Legendary Planeswalker — Teferi",
      supertypes: ["Legendary"],
      oracleText: "Teferi, Temporal Archmage can be your commander.",
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("non-legendary card with 'can be your commander' is valid", () => {
    const card = makeCard({
      name: "Some Special Card",
      typeLine: "Planeswalker — Test",
      supertypes: [],
      oracleText: "Some Special Card can be your commander.",
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("legendary enchantment (not creature/planeswalker) is not valid", () => {
    const card = makeCard({
      name: "Smothering Tithe",
      typeLine: "Legendary Enchantment",
      supertypes: ["Legendary"],
    });
    expect(isLegalCommander(card)).toBe(false);
  });

  test("legendary artifact creature is valid", () => {
    const card = makeCard({
      name: "Traxos, Scourge of Kroog",
      typeLine: "Legendary Artifact Creature — Construct",
      supertypes: ["Legendary"],
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("legendary vehicle is a valid commander", () => {
    const card = makeCard({
      name: "Hearthull, the Worldseed",
      typeLine: "Legendary Artifact — Vehicle",
      supertypes: ["Legendary"],
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("legendary spacecraft is a valid commander", () => {
    const card = makeCard({
      name: "Some Legendary Spacecraft",
      typeLine: "Legendary Artifact — Spacecraft",
      supertypes: ["Legendary"],
    });
    expect(isLegalCommander(card)).toBe(true);
  });

  test("non-legendary vehicle is not a valid commander", () => {
    const card = makeCard({
      name: "Smuggler's Copter",
      typeLine: "Artifact — Vehicle",
      supertypes: [],
    });
    expect(isLegalCommander(card)).toBe(false);
  });
});

// --- validateCommanderSelection ---

test.describe("validateCommanderSelection", () => {
  test("valid single commander in decklist", () => {
    const result = validateCommanderSelection(
      ["Atraxa, Praetors' Voice"],
      ["Atraxa, Praetors' Voice", "Sol Ring", "Command Tower"]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("valid partner pair (2 commanders)", () => {
    const result = validateCommanderSelection(
      ["Thrasios, Triton Hero", "Tymna the Weaver"],
      ["Thrasios, Triton Hero", "Tymna the Weaver", "Sol Ring"]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("more than 2 commanders rejected", () => {
    const result = validateCommanderSelection(
      ["A", "B", "C"],
      ["A", "B", "C", "Sol Ring"]
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("2");
  });

  test("commander not in decklist is valid (will be added by parser)", () => {
    const result = validateCommanderSelection(
      ["Atraxa, Praetors' Voice"],
      ["Sol Ring", "Command Tower"]
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("empty commanders array is valid", () => {
    const result = validateCommanderSelection([], ["Sol Ring"]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// --- validateCommanderLegality ---

test.describe("validateCommanderLegality", () => {
  test("returns no warnings for legal commander", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Atraxa, Praetors' Voice": makeCard({
        name: "Atraxa, Praetors' Voice",
        typeLine: "Legendary Creature — Phyrexian Angel Horror",
        supertypes: ["Legendary"],
      }),
    };
    const result = validateCommanderLegality(
      ["Atraxa, Praetors' Voice"],
      cardMap
    );
    expect(result.warnings).toHaveLength(0);
  });

  test("returns warning for non-legendary commander", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Llanowar Elves": makeCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        supertypes: [],
      }),
    };
    const result = validateCommanderLegality(["Llanowar Elves"], cardMap);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Llanowar Elves");
  });

  test("returns warning for commander not found in card map", () => {
    const result = validateCommanderLegality(["Unknown Card"], {});
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Unknown Card");
  });

  test("returns no warnings for legendary vehicle commander", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Hearthull, the Worldseed": makeCard({
        name: "Hearthull, the Worldseed",
        typeLine: "Legendary Artifact — Vehicle",
        supertypes: ["Legendary"],
      }),
    };
    const result = validateCommanderLegality(
      ["Hearthull, the Worldseed"],
      cardMap
    );
    expect(result.warnings).toHaveLength(0);
  });

  test("returns warnings for each invalid commander in a pair", () => {
    const cardMap: Record<string, EnrichedCard> = {
      "Bird A": makeCard({ name: "Bird A", typeLine: "Creature — Bird", supertypes: [] }),
      "Bird B": makeCard({ name: "Bird B", typeLine: "Creature — Bird", supertypes: [] }),
    };
    const result = validateCommanderLegality(["Bird A", "Bird B"], cardMap);
    expect(result.warnings).toHaveLength(2);
  });
});

// --- buildEdhrecUrl ---

test.describe("buildEdhrecUrl", () => {
  test("single commander", () => {
    const url = buildEdhrecUrl(["Atraxa, Praetors' Voice"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/atraxa-praetors-voice"
    );
  });

  test("partner commanders", () => {
    const url = buildEdhrecUrl(["Thrasios, Triton Hero", "Tymna the Weaver"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/thrasios-triton-hero-tymna-the-weaver"
    );
  });

  test("special characters are stripped", () => {
    const url = buildEdhrecUrl(["Uro, Titan of Nature's Wrath"]);
    expect(url).toBe(
      "https://edhrec.com/commanders/uro-titan-of-natures-wrath"
    );
  });
});
