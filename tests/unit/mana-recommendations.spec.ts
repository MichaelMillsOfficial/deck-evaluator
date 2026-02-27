import { test, expect } from "@playwright/test";
import {
  computeManaBaseRecommendations,
  type ManaRecommendation,
  type ManaBaseRecommendationsResult,
} from "../../src/lib/mana-recommendations";
import type { DeckData, EnrichedCard, ManaPips } from "../../src/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<DeckData> = {}): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: [],
    mainboard: [],
    sideboard: [],
    ...overrides,
  };
}

const ZERO_PIPS: ManaPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Creature",
    supertypes: [],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { ...ZERO_PIPS },
    producedMana: [],
    flavorName: null,
    ...overrides,
  };
}

/** Build a simple commander deck with lands and non-land cards */
function buildDeck(opts: {
  commander?: { name: string; colorIdentity: string[] };
  lands?: { name: string; quantity: number }[];
  spells?: { name: string; quantity: number }[];
}): { deck: DeckData; cardMap: Record<string, EnrichedCard> } {
  const deck = makeDeck({
    commanders: opts.commander
      ? [{ name: opts.commander.name, quantity: 1 }]
      : [],
    mainboard: [
      ...(opts.lands ?? []).map((l) => ({ name: l.name, quantity: l.quantity })),
      ...(opts.spells ?? []).map((s) => ({
        name: s.name,
        quantity: s.quantity,
      })),
    ],
  });
  return { deck, cardMap: {} };
}

function findByCategory(
  recs: ManaRecommendation[],
  category: string
): ManaRecommendation[] {
  return recs.filter((r) => r.category === category);
}

function findByCategoryFirst(
  recs: ManaRecommendation[],
  category: string
): ManaRecommendation | undefined {
  return recs.find((r) => r.category === category);
}

// ---------------------------------------------------------------------------
// Category 1: Land Count
// ---------------------------------------------------------------------------

test.describe("land count recommendations", () => {
  test("no recommendation for low-curve deck with appropriate land count", () => {
    // Avg CMC ~2.0 with 33 lands → target range 33–35, within range
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 33 },
        { name: "Spell", quantity: 65 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const landRecs = findByCategory(result.recommendations, "land-count");
    expect(landRecs).toHaveLength(0);
  });

  test("critical when high-curve deck has very few lands", () => {
    // Avg CMC ~3.5, only 28 lands → target 36-38, way below
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 28 },
        { name: "BigSpell", quantity: 70 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 5,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 2 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      BigSpell: makeCard({
        name: "BigSpell",
        typeLine: "Creature",
        cmc: 3.5,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const landRecs = findByCategory(result.recommendations, "land-count");
    expect(landRecs.length).toBeGreaterThanOrEqual(1);
    expect(landRecs[0].severity).toBe("critical");
  });

  test("warning when low-curve deck has too many lands", () => {
    // Avg CMC ~1.5, 42 lands → target 28-30, way above
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 42 },
        { name: "CheapSpell", quantity: 56 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 2,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      CheapSpell: makeCard({
        name: "CheapSpell",
        typeLine: "Creature",
        cmc: 1.5,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const landRecs = findByCategory(result.recommendations, "land-count");
    expect(landRecs.length).toBeGreaterThanOrEqual(1);
    expect(landRecs[0].severity).toBe("warning");
  });

  test("ramp reduces land target", () => {
    // Avg CMC ~3.0, target 36–38. 12 ramp cards → adjustment -3 → target 33–35.
    // 34 lands should be fine with ramp adjustment.
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 34 },
        { name: "Ramp", quantity: 12 },
        { name: "Spell", quantity: 52 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Ramp: makeCard({
        name: "Ramp",
        typeLine: "Sorcery",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
        oracleText:
          "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const landRecs = findByCategory(result.recommendations, "land-count");
    expect(landRecs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category 2: Color Balance
// ---------------------------------------------------------------------------

test.describe("color balance recommendations", () => {
  test("no recommendation for balanced 2-color deck", () => {
    // 18 Forest + 15 dual = 33 green sources, 18 Island + 15 dual = 33 blue sources
    // 15 GSpell = 15 green pips, 15 USpell = 15 blue pips → ratios well above 1.0
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 18 },
        { name: "Island", quantity: 18 },
        { name: "DualLand", quantity: 1 },
        { name: "GSpell", quantity: 15 },
        { name: "USpell", quantity: 15 },
        { name: "Colorless", quantity: 31 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "U"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1 },
        producedMana: [],
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      GSpell: makeCard({
        name: "GSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      USpell: makeCard({
        name: "USpell",
        typeLine: "Instant",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, U: 1 },
      }),
      Colorless: makeCard({
        name: "Colorless",
        typeLine: "Artifact",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, C: 2 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const colorRecs = findByCategory(result.recommendations, "color-balance");
    expect(colorRecs).toHaveLength(0);
  });

  test("critical when severely lacking a color", () => {
    // 3 green sources for 20 green pips (ratio 0.15)
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 3 },
        { name: "Swamp", quantity: 34 },
        { name: "GSpell", quantity: 20 },
        { name: "BSpell", quantity: 41 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Swamp: makeCard({
        name: "Swamp",
        typeLine: "Basic Land — Swamp",
        supertypes: ["Basic"],
        subtypes: ["Swamp"],
        producedMana: ["B"],
      }),
      GSpell: makeCard({
        name: "GSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      BSpell: makeCard({
        name: "BSpell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, B: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const colorRecs = findByCategory(result.recommendations, "color-balance");
    const greenRec = colorRecs.find((r) => r.explanation.includes("green"));
    expect(greenRec).toBeDefined();
    expect(greenRec!.severity).toBe("critical");
  });

  test("colors with < 5 pips demand are skipped", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 35 },
        { name: "GSpell", quantity: 60 },
        // Only 2 red pips total — below threshold
        { name: "SplashSpell", quantity: 2 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G", "R"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      GSpell: makeCard({
        name: "GSpell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      SplashSpell: makeCard({
        name: "SplashSpell",
        typeLine: "Instant",
        cmc: 1,
        manaPips: { ...ZERO_PIPS, R: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const colorRecs = findByCategory(result.recommendations, "color-balance");
    const redRec = colorRecs.find((r) => r.explanation.includes("red"));
    expect(redRec).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Category 3: ETB Tempo
// ---------------------------------------------------------------------------

test.describe("ETB tempo recommendations", () => {
  test("no recommendation when all lands are untapped", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 37 },
        { name: "Spell", quantity: 62 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const etbRecs = findByCategory(result.recommendations, "etb-tempo");
    expect(etbRecs).toHaveLength(0);
  });

  test("critical when most lands enter tapped", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 5 },
        { name: "TapLand", quantity: 32 },
        { name: "Spell", quantity: 62 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      TapLand: makeCard({
        name: "TapLand",
        typeLine: "Land",
        oracleText:
          "TapLand enters the battlefield tapped.\n{T}: Add {G} or {B}.",
        producedMana: ["G", "B"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const etbRecs = findByCategory(result.recommendations, "etb-tempo");
    expect(etbRecs).toHaveLength(1);
    expect(etbRecs[0].severity).toBe("critical");
  });

  test("suggestion when moderate tapped lands", () => {
    // ~30% tapped (11 of 37) → untapped ratio ~70% → suggestion
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 26 },
        { name: "TapLand", quantity: 11 },
        { name: "Spell", quantity: 62 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      TapLand: makeCard({
        name: "TapLand",
        typeLine: "Land",
        oracleText:
          "TapLand enters the battlefield tapped.\n{T}: Add {G} or {B}.",
        producedMana: ["G", "B"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const etbRecs = findByCategory(result.recommendations, "etb-tempo");
    expect(etbRecs).toHaveLength(1);
    expect(etbRecs[0].severity).toBe("suggestion");
  });
});

// ---------------------------------------------------------------------------
// Category 4: Mana Fixing Quality
// ---------------------------------------------------------------------------

test.describe("mana fixing recommendations", () => {
  test("no recommendation for mono-color deck", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 37 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const fixingRecs = findByCategory(result.recommendations, "mana-fixing");
    expect(fixingRecs).toHaveLength(0);
  });

  test("critical for 3-color deck with almost no fixing", () => {
    // 3 colors, 37 lands, only 2 produce 2+ colors (5.4%)
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 13 },
        { name: "Island", quantity: 12 },
        { name: "Swamp", quantity: 10 },
        { name: "DualLand", quantity: 2 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "U", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      Swamp: makeCard({
        name: "Swamp",
        typeLine: "Basic Land — Swamp",
        supertypes: ["Basic"],
        subtypes: ["Swamp"],
        producedMana: ["B"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const fixingRecs = findByCategory(result.recommendations, "mana-fixing");
    expect(fixingRecs).toHaveLength(1);
    expect(fixingRecs[0].severity).toBe("critical");
  });

  test("no recommendation when 3-color deck has sufficient fixing", () => {
    // 3 colors, 37 lands, 12 produce 2+ colors (~32%)
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 9 },
        { name: "Island", quantity: 8 },
        { name: "Swamp", quantity: 8 },
        { name: "DualLand", quantity: 12 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "U", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      Swamp: makeCard({
        name: "Swamp",
        typeLine: "Basic Land — Swamp",
        supertypes: ["Basic"],
        subtypes: ["Swamp"],
        producedMana: ["B"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const fixingRecs = findByCategory(result.recommendations, "mana-fixing");
    expect(fixingRecs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category 5: Basic Land Ratio
// ---------------------------------------------------------------------------

test.describe("basic land ratio recommendations", () => {
  test("suggestion when 3-color deck has too many basics", () => {
    // 3 colors, 30 of 37 lands are basic (~81%) — ideal is ~40%
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 10 },
        { name: "Island", quantity: 10 },
        { name: "Swamp", quantity: 10 },
        { name: "DualLand", quantity: 7 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "U", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      Swamp: makeCard({
        name: "Swamp",
        typeLine: "Basic Land — Swamp",
        supertypes: ["Basic"],
        subtypes: ["Swamp"],
        producedMana: ["B"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const basicRecs = findByCategory(result.recommendations, "basic-ratio");
    expect(basicRecs.length).toBeGreaterThanOrEqual(1);
    expect(basicRecs[0].severity).toBe("suggestion");
  });

  test("no recommendation for mono-color deck with all basics", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 37 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const basicRecs = findByCategory(result.recommendations, "basic-ratio");
    expect(basicRecs).toHaveLength(0);
  });

  test("suggestion when basics are very low for multi-color deck", () => {
    // 3 colors, only 2 of 37 lands are basic (~5%) — ideal is ~40%
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 1 },
        { name: "Island", quantity: 1 },
        { name: "DualLand", quantity: 35 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "U", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const basicRecs = findByCategory(result.recommendations, "basic-ratio");
    expect(basicRecs.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Category 6: Ramp Compatibility
// ---------------------------------------------------------------------------

test.describe("ramp compatibility recommendations", () => {
  test("warning when basic-only fetchers outnumber basics", () => {
    // 5 basic-only fetchers, only 4 basics → threshold is 5*2+3=13
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 4 },
        { name: "DualLand", quantity: 33 },
        { name: "Cultivate", quantity: 5 },
        { name: "Spell", quantity: 56 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 2 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Cultivate: makeCard({
        name: "Cultivate",
        typeLine: "Sorcery",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
        oracleText:
          "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const rampRecs = findByCategory(result.recommendations, "ramp-compat");
    expect(rampRecs.length).toBeGreaterThanOrEqual(1);
    expect(rampRecs[0].severity).toBe("warning");
  });

  test("warning when type fetcher targets nonexistent type", () => {
    // Nature's Lore searches for Forest, but deck has no forests
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Island", quantity: 37 },
        { name: "NaturesLore", quantity: 1 },
        { name: "Spell", quantity: 60 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G", "U"],
        manaPips: { ...ZERO_PIPS, G: 1, U: 1 },
      }),
      Island: makeCard({
        name: "Island",
        typeLine: "Basic Land — Island",
        supertypes: ["Basic"],
        subtypes: ["Island"],
        producedMana: ["U"],
      }),
      NaturesLore: makeCard({
        name: "NaturesLore",
        typeLine: "Sorcery",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
        oracleText:
          "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, U: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const rampRecs = findByCategory(result.recommendations, "ramp-compat");
    const forestRec = rampRecs.find((r) => r.explanation.includes("Forest"));
    expect(forestRec).toBeDefined();
    expect(forestRec!.severity).toBe("warning");
  });

  test("no ramp-compat recommendation when setup is compatible", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 15 },
        { name: "DualLand", quantity: 22 },
        { name: "Cultivate", quantity: 3 },
        { name: "Spell", quantity: 58 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 2 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      DualLand: makeCard({
        name: "DualLand",
        typeLine: "Land",
        producedMana: ["G", "U"],
      }),
      Cultivate: makeCard({
        name: "Cultivate",
        typeLine: "Sorcery",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
        oracleText:
          "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const rampRecs = findByCategory(result.recommendations, "ramp-compat");
    expect(rampRecs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category 7: Opening Hand Probability
// ---------------------------------------------------------------------------

test.describe("opening hand probability recommendations", () => {
  test("no recommendation with 37 lands in 99-card deck", () => {
    // Commander (1) + 37 lands + 61 spells = 99 total
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 37 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const handRecs = findByCategory(result.recommendations, "opening-hand");
    expect(handRecs).toHaveLength(0);
  });

  test("critical with very few lands", () => {
    // 15 lands in 99 cards → P(≥3 in 7) is very low (~15%)
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 15 },
        { name: "Spell", quantity: 83 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 2,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const handRecs = findByCategory(result.recommendations, "opening-hand");
    expect(handRecs).toHaveLength(1);
    expect(handRecs[0].severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// Overall result
// ---------------------------------------------------------------------------

test.describe("overall result", () => {
  test("healthy deck produces no recommendations", () => {
    // Well-built mono-green: commander(1) + 37 lands + 61 spells = 99 total
    // Avg CMC 3.0 → target 36–38, land count 37 is right on target
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 37 },
        { name: "Spell", quantity: 61 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 3,
        colorIdentity: ["G"],
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      Spell: makeCard({
        name: "Spell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    expect(result.overallHealth).toBe("healthy");
    expect(result.recommendations).toHaveLength(0);
  });

  test("deck with critical issues has critical-issues health", () => {
    // Very few lands, terrible color balance
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 15 },
        { name: "BSpell", quantity: 42 },
        { name: "GSpell", quantity: 41 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      BSpell: makeCard({
        name: "BSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, B: 1 },
      }),
      GSpell: makeCard({
        name: "GSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    expect(result.overallHealth).toBe("critical-issues");
    expect(
      result.recommendations.some((r) => r.severity === "critical")
    ).toBe(true);
  });

  test("recommendations are sorted by severity", () => {
    // Deck with mix of severities
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Forest", quantity: 20 },
        { name: "TapLand", quantity: 10 },
        { name: "BSpell", quantity: 34 },
        { name: "GSpell", quantity: 34 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({
        name: "Commander",
        typeLine: "Legendary Creature",
        cmc: 4,
        colorIdentity: ["G", "B"],
        manaPips: { ...ZERO_PIPS, G: 1, B: 1 },
      }),
      Forest: makeCard({
        name: "Forest",
        typeLine: "Basic Land — Forest",
        supertypes: ["Basic"],
        subtypes: ["Forest"],
        producedMana: ["G"],
      }),
      TapLand: makeCard({
        name: "TapLand",
        typeLine: "Land",
        oracleText:
          "TapLand enters the battlefield tapped.\n{T}: Add {G} or {B}.",
        producedMana: ["G", "B"],
      }),
      BSpell: makeCard({
        name: "BSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, B: 1 },
      }),
      GSpell: makeCard({
        name: "GSpell",
        typeLine: "Creature",
        cmc: 3,
        manaPips: { ...ZERO_PIPS, G: 1 },
      }),
    };
    const result = computeManaBaseRecommendations(deck, cardMap);
    const severityOrder = { critical: 0, warning: 1, suggestion: 2 };
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(
        severityOrder[result.recommendations[i].severity]
      ).toBeGreaterThanOrEqual(
        severityOrder[result.recommendations[i - 1].severity]
      );
    }
  });
});
