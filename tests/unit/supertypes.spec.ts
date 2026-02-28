import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import type { EnrichedCard } from "../../src/lib/types";

// These functions will be implemented in src/lib/supertypes.ts
import {
  isHistoric,
  identifySupertypeAnchors,
  computeSupertypeBreakdown,
} from "../../src/lib/supertypes";

test.describe("isHistoric", () => {
  test("Legendary creature is historic", () => {
    const card = makeCard({
      name: "Thalia, Guardian of Thraben",
      typeLine: "Legendary Creature — Human Soldier",
      supertypes: ["Legendary"],
      subtypes: ["Human", "Soldier"],
    });
    expect(isHistoric(card)).toBe(true);
  });

  test("Artifact is historic", () => {
    const card = makeCard({
      name: "Sol Ring",
      typeLine: "Artifact",
      supertypes: [],
      subtypes: [],
    });
    expect(isHistoric(card)).toBe(true);
  });

  test("Saga is historic", () => {
    const card = makeCard({
      name: "The Eldest Reborn",
      typeLine: "Enchantment — Saga",
      supertypes: [],
      subtypes: ["Saga"],
    });
    expect(isHistoric(card)).toBe(true);
  });

  test("Legendary Artifact is historic", () => {
    const card = makeCard({
      name: "Mox Amber",
      typeLine: "Legendary Artifact",
      supertypes: ["Legendary"],
      subtypes: [],
    });
    expect(isHistoric(card)).toBe(true);
  });

  test("Regular creature is NOT historic", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      supertypes: [],
      subtypes: ["Bear"],
    });
    expect(isHistoric(card)).toBe(false);
  });

  test("Regular instant is NOT historic", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
    });
    expect(isHistoric(card)).toBe(false);
  });

  test("Regular enchantment (non-Saga) is NOT historic", () => {
    const card = makeCard({
      name: "Rhystic Study",
      typeLine: "Enchantment",
      supertypes: [],
      subtypes: [],
    });
    expect(isHistoric(card)).toBe(false);
  });
});

test.describe("identifySupertypeAnchors", () => {
  test("Jodah commander identifies legendary anchor", () => {
    const jodah = makeCard({
      name: "Jodah, the Unifier",
      typeLine: "Legendary Creature — Human Wizard",
      supertypes: ["Legendary"],
      subtypes: ["Human", "Wizard"],
      oracleText:
        "Whenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken spell that costs less. You may cast that spell without paying its mana cost. Legendary creatures you control get +1/+1.",
    });

    const cardNames = ["Jodah, the Unifier"];
    const cardMap: Record<string, EnrichedCard> = {
      "Jodah, the Unifier": jodah,
    };

    const anchors = identifySupertypeAnchors([jodah], cardNames, cardMap);
    expect(anchors).toContain("legendary");
  });

  test("Narfi commander identifies snow anchor", () => {
    const narfi = makeCard({
      name: "Narfi, Betrayer King",
      typeLine: "Legendary Snow Creature — Zombie Wizard",
      supertypes: ["Legendary", "Snow"],
      subtypes: ["Zombie", "Wizard"],
      oracleText:
        "Other snow and Zombie creatures you control get +1/+1.\n{S}{S}{S}: Return Narfi, Betrayer King from your graveyard to the battlefield tapped.",
      manaCost: "{3}{U}{B}",
    });

    const cardNames = ["Narfi, Betrayer King"];
    const cardMap: Record<string, EnrichedCard> = {
      "Narfi, Betrayer King": narfi,
    };

    const anchors = identifySupertypeAnchors([narfi], cardNames, cardMap);
    expect(anchors).toContain("snow");
  });

  test("Jhoira commander identifies historic anchor", () => {
    const jhoira = makeCard({
      name: "Jhoira, Weatherlight Captain",
      typeLine: "Legendary Creature — Human Artificer",
      supertypes: ["Legendary"],
      subtypes: ["Human", "Artificer"],
      oracleText: "Whenever you cast a historic spell, draw a card.",
    });

    const cardNames = ["Jhoira, Weatherlight Captain"];
    const cardMap: Record<string, EnrichedCard> = {
      "Jhoira, Weatherlight Captain": jhoira,
    };

    const anchors = identifySupertypeAnchors([jhoira], cardNames, cardMap);
    expect(anchors).toContain("historic");
  });

  test("Yarok (Legendary, no legendary oracle text) with 10 legendaries does NOT anchor", () => {
    // Yarok is Legendary but doesn't care about legendary permanents.
    // 10 legendaries is below the 20 density threshold.
    const yarok = makeCard({
      name: "Yarok, the Desecrated",
      typeLine: "Legendary Creature — Elemental Horror",
      supertypes: ["Legendary"],
      subtypes: ["Elemental", "Horror"],
      oracleText:
        "Deathtouch, lifelink\nIf a permanent entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
    });

    const cardNames = ["Yarok, the Desecrated"];
    // Add 10 other legendary creatures (below 20 threshold)
    for (let i = 0; i < 10; i++) {
      cardNames.push(`Legendary Creature ${i}`);
    }

    const cardMap: Record<string, EnrichedCard> = {
      "Yarok, the Desecrated": yarok,
    };
    for (let i = 0; i < 10; i++) {
      cardMap[`Legendary Creature ${i}`] = makeCard({
        name: `Legendary Creature ${i}`,
        typeLine: "Legendary Creature — Human",
        supertypes: ["Legendary"],
        subtypes: ["Human"],
      });
    }

    const anchors = identifySupertypeAnchors([yarok], cardNames, cardMap);
    expect(anchors).not.toContain("legendary");
  });

  test("Jodah with 20+ legendary permanents has boosted anchor score from density", () => {
    const jodah = makeCard({
      name: "Jodah, the Unifier",
      typeLine: "Legendary Creature — Human Wizard",
      supertypes: ["Legendary"],
      subtypes: ["Human", "Wizard"],
      oracleText:
        "Whenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken spell that costs less. You may cast that spell without paying its mana cost. Legendary creatures you control get +1/+1.",
    });

    const cardNames = ["Jodah, the Unifier"];
    // Add 20 legendary creatures to hit density threshold
    for (let i = 0; i < 20; i++) {
      cardNames.push(`Legend ${i}`);
    }

    const cardMap: Record<string, EnrichedCard> = {
      "Jodah, the Unifier": jodah,
    };
    for (let i = 0; i < 20; i++) {
      cardMap[`Legend ${i}`] = makeCard({
        name: `Legend ${i}`,
        typeLine: "Legendary Creature — Human",
        supertypes: ["Legendary"],
        subtypes: ["Human"],
      });
    }

    const anchors = identifySupertypeAnchors([jodah], cardNames, cardMap);
    expect(anchors).toContain("legendary");
    // With both oracle text refs AND density, legendary should be first anchor
    expect(anchors[0]).toBe("legendary");
  });

  test("Returns empty array when no supertype anchors qualify", () => {
    const generic = makeCard({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      supertypes: [],
      subtypes: ["Bear"],
      oracleText: "",
    });

    const anchors = identifySupertypeAnchors(
      [generic],
      ["Grizzly Bears"],
      { "Grizzly Bears": generic }
    );
    expect(anchors).toHaveLength(0);
  });
});

test.describe("computeSupertypeBreakdown", () => {
  test("Counts Legendary and Snow correctly", () => {
    const cardNames = ["Card A", "Card B", "Card C", "Card D"];
    const cardMap: Record<string, EnrichedCard> = {
      "Card A": makeCard({
        name: "Card A",
        typeLine: "Legendary Creature",
        supertypes: ["Legendary"],
      }),
      "Card B": makeCard({
        name: "Card B",
        typeLine: "Legendary Snow Creature",
        supertypes: ["Legendary", "Snow"],
      }),
      "Card C": makeCard({
        name: "Card C",
        typeLine: "Snow Creature",
        supertypes: ["Snow"],
      }),
      "Card D": makeCard({
        name: "Card D",
        typeLine: "Creature",
        supertypes: [],
      }),
    };

    const breakdown = computeSupertypeBreakdown(cardNames, cardMap);
    expect(breakdown.get("Legendary")).toBe(2);
    expect(breakdown.get("Snow")).toBe(2);
  });

  test("Empty deck returns empty Map", () => {
    const breakdown = computeSupertypeBreakdown([], {});
    expect(breakdown.size).toBe(0);
  });

  test("Deck with no supertypes returns empty Map", () => {
    const cardNames = ["Grizzly Bears"];
    const cardMap: Record<string, EnrichedCard> = {
      "Grizzly Bears": makeCard({
        name: "Grizzly Bears",
        typeLine: "Creature — Bear",
        supertypes: [],
      }),
    };

    const breakdown = computeSupertypeBreakdown(cardNames, cardMap);
    expect(breakdown.size).toBe(0);
  });

  test("Counts Basic supertype", () => {
    const cardNames = ["Plains", "Island"];
    const cardMap: Record<string, EnrichedCard> = {
      Plains: makeCard({
        name: "Plains",
        typeLine: "Basic Land — Plains",
        supertypes: ["Basic"],
        subtypes: ["Plains"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
      }),
    };

    const breakdown = computeSupertypeBreakdown(cardNames, cardMap);
    expect(breakdown.get("Basic")).toBe(2);
  });

  test("Handles Artifact type correctly via isHistoric count", () => {
    // computeSupertypeBreakdown counts supertypes, not card types
    // Artifacts are NOT supertypes, so they don't appear here
    const cardNames = ["Sol Ring"];
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        supertypes: [],
      }),
    };

    const breakdown = computeSupertypeBreakdown(cardNames, cardMap);
    expect(breakdown.has("Artifact")).toBe(false); // Artifact is not a supertype
  });
});
