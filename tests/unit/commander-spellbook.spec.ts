import { test, expect } from "@playwright/test";
import {
  buildSpellbookRequest,
  normalizeVariant,
  normalizeSpellbookResponse,
  comboFitsIdentity,
} from "../../src/lib/commander-spellbook";
import type {
  SpellbookVariant,
  SpellbookFindMyCombosResponse,
} from "../../src/lib/commander-spellbook";
import type { DeckData } from "../../src/lib/types";

function mockDeck(
  mainboard: string[],
  commanders: string[] = [],
  sideboard: string[] = []
): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: mainboard.map((name) => ({ name, quantity: 1 })),
    sideboard: sideboard.map((name) => ({ name, quantity: 1 })),
  };
}

function mockVariant(overrides: Partial<SpellbookVariant> = {}): SpellbookVariant {
  return {
    id: "test-variant-1",
    status: "OK",
    uses: [
      {
        card: {
          id: 1,
          name: "Thassa's Oracle",
          oracleId: null,
          typeLine: "Creature — Merfolk Wizard",
          oracleText: "When Thassa's Oracle enters...",
          manaValue: 2,
          identity: "U",
        },
        zoneLocations: ["H"],
        battlefieldCardState: "",
        mustBeCommander: false,
        quantity: 1,
      },
      {
        card: {
          id: 2,
          name: "Demonic Consultation",
          oracleId: null,
          typeLine: "Instant",
          oracleText: "Name a card. Exile the top six...",
          manaValue: 1,
          identity: "B",
        },
        zoneLocations: ["H"],
        battlefieldCardState: "",
        mustBeCommander: false,
        quantity: 1,
      },
    ],
    requires: [],
    produces: [
      { feature: { id: 1, name: "Win the game" }, quantity: 1 },
    ],
    identity: "UB",
    manaNeeded: "{U}{U}{B}",
    manaValueNeeded: 3,
    description: "Cast Demonic Consultation naming a card not in your deck. Then cast Thassa's Oracle to win.",
    bracketTag: "4",
    prices: { tcgplayer: "10.00", cardkingdom: "12.00", cardmarket: "8.00" },
    ...overrides,
  };
}

test.describe("buildSpellbookRequest", () => {
  test("maps commanders to commanders array and mainboard to main array", () => {
    const deck = mockDeck(
      ["Sol Ring", "Arcane Signet"],
      ["Kenrith, the Returned King"]
    );
    const result = buildSpellbookRequest(deck);

    expect(result.commanders).toEqual([
      { card: "Kenrith, the Returned King", quantity: 1 },
    ]);
    expect(result.main).toEqual([
      { card: "Sol Ring", quantity: 1 },
      { card: "Arcane Signet", quantity: 1 },
    ]);
  });

  test("excludes sideboard cards", () => {
    const deck = mockDeck(
      ["Sol Ring"],
      ["Kenrith, the Returned King"],
      ["Rest in Peace"]
    );
    const result = buildSpellbookRequest(deck);

    const allCardNames = [
      ...result.commanders.map((c) => c.card),
      ...result.main.map((c) => c.card),
    ];
    expect(allCardNames).not.toContain("Rest in Peace");
  });

  test("handles empty commanders", () => {
    const deck = mockDeck(["Sol Ring", "Command Tower"]);
    const result = buildSpellbookRequest(deck);

    expect(result.commanders).toEqual([]);
    expect(result.main).toHaveLength(2);
  });

  test("preserves quantity for cards with quantity > 1", () => {
    const deck: DeckData = {
      name: "Test",
      source: "text",
      url: "",
      commanders: [],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Lightning Bolt", quantity: 4 },
      ],
      sideboard: [],
    };
    const result = buildSpellbookRequest(deck);

    expect(result.main).toContainEqual({ card: "Lightning Bolt", quantity: 4 });
  });
});

test.describe("normalizeVariant", () => {
  test("extracts card names from uses", () => {
    const variant = mockVariant();
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.cards).toEqual(["Thassa's Oracle", "Demonic Consultation"]);
  });

  test("computes missing cards by diffing against deck card set", () => {
    const variant = mockVariant();
    const deckCardNames = new Set(["Thassa's Oracle"]); // Missing Demonic Consultation
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.missingCards).toEqual(["Demonic Consultation"]);
  });

  test("maps feature names to produces array", () => {
    const variant = mockVariant({
      produces: [
        { feature: { id: 1, name: "Win the game" }, quantity: 1 },
        { feature: { id: 2, name: "Infinite mana" }, quantity: 1 },
      ],
    });
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.produces).toEqual(["Win the game", "Infinite mana"]);
  });

  test("sets type to exact when no missing cards", () => {
    const variant = mockVariant();
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.type).toBe("exact");
    expect(result.missingCards).toHaveLength(0);
  });

  test("sets type to near when missing cards exist", () => {
    const variant = mockVariant();
    const deckCardNames = new Set(["Thassa's Oracle"]); // Missing one card
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.type).toBe("near");
    expect(result.missingCards.length).toBeGreaterThan(0);
  });

  test("preserves combo ID and description", () => {
    const variant = mockVariant({
      id: "abc-123",
      description: "Win with Oracle",
    });
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.id).toBe("abc-123");
    expect(result.description).toBe("Win with Oracle");
  });

  test("includes template name in templateRequirements", () => {
    const variant = mockVariant({
      requires: [
        {
          template: { id: 1, name: "A creature with ETB effect", scryfallQuery: null },
          zoneLocations: ["B"],
          quantity: 1,
        },
      ],
    });
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.templateRequirements).toContain("A creature with ETB effect");
  });

  test("preserves manaNeeded, bracketTag, and identity", () => {
    const variant = mockVariant({
      manaNeeded: "{U}{U}{B}",
      bracketTag: "4",
      identity: "UB",
    });
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.manaNeeded).toBe("{U}{U}{B}");
    expect(result.bracketTag).toBe("4");
    expect(result.identity).toBe("UB");
  });

  test("handles variant with 0 uses", () => {
    const variant = mockVariant({ uses: [] });
    const deckCardNames = new Set(["Some Card"]);
    const result = normalizeVariant(variant, deckCardNames);

    expect(result.cards).toEqual([]);
    expect(result.missingCards).toEqual([]);
    expect(result.type).toBe("exact");
  });

  test("handles duplicate card names in uses (deduplication)", () => {
    const variant = mockVariant({
      uses: [
        {
          card: { id: 1, name: "Sol Ring", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 1, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 1, name: "Sol Ring", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 1, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });
    const deckCardNames = new Set(["Sol Ring"]);
    const result = normalizeVariant(variant, deckCardNames);

    // Should deduplicate card names
    expect(result.cards).toEqual(["Sol Ring"]);
  });
});

test.describe("normalizeSpellbookResponse", () => {
  test("separates included from almostIncluded", () => {
    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [mockVariant({ id: "exact-1" })],
        almostIncluded: [mockVariant({ id: "near-1" })],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.exactCombos).toHaveLength(1);
    expect(result.exactCombos[0].id).toBe("exact-1");
    expect(result.nearCombos).toHaveLength(1);
    expect(result.nearCombos[0].id).toBe("near-1");
  });

  test("sorts exact combos by card count ascending", () => {
    const twoCard = mockVariant({ id: "2-card" });
    const threeCard = mockVariant({
      id: "3-card",
      uses: [
        ...mockVariant().uses,
        {
          card: { id: 3, name: "Mana Crypt", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });
    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [threeCard, twoCard],
        almostIncluded: [],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation", "Mana Crypt"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.exactCombos[0].cards.length).toBeLessThanOrEqual(
      result.exactCombos[1].cards.length
    );
  });

  test("sorts near combos by missing count ascending then card count ascending", () => {
    // 3-card combo: Card A (in deck), Card B (missing) -> 1 missing
    const oneMissing = mockVariant({
      id: "1-missing",
      uses: [
        {
          card: { id: 1, name: "Card A", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 2, name: "Card B", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });
    // 4-card combo: Card C (in deck), Card D (in deck), Card E (missing), Card F (missing) -> 2 missing
    const twoMissing = mockVariant({
      id: "2-missing",
      uses: [
        {
          card: { id: 3, name: "Card C", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 4, name: "Card D", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 5, name: "Card E", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 6, name: "Card F", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [],
        almostIncluded: [twoMissing, oneMissing],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    // Card A, C, D are in deck; Card B, E, F are missing
    const deckCardNames = new Set(["Card A", "Card C", "Card D"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos).toHaveLength(2);
    expect(result.nearCombos[0].missingCards.length).toBeLessThanOrEqual(
      result.nearCombos[1].missingCards.length
    );
  });

  test("caps near combos at 20 results", () => {
    // Each variant has 2 cards: "Shared Card" (in deck) and a unique missing card
    const nearVariants = Array.from({ length: 25 }, (_, i) =>
      mockVariant({
        id: `near-${i}`,
        uses: [
          {
            card: { id: 100, name: "Shared Card", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
            zoneLocations: ["H"],
            battlefieldCardState: "",
            mustBeCommander: false,
            quantity: 1,
          },
          {
            card: { id: i, name: `Missing Card ${i}`, oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
            zoneLocations: ["H"],
            battlefieldCardState: "",
            mustBeCommander: false,
            quantity: 1,
          },
        ],
      })
    );

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [],
        almostIncluded: nearVariants,
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    // "Shared Card" is in the deck, so each combo has 1 missing card (passes filter)
    const deckCardNames = new Set(["Shared Card"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos.length).toBeLessThanOrEqual(20);
  });

  test("handles empty response", () => {
    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "",
        included: [],
        almostIncluded: [],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set<string>();
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.exactCombos).toEqual([]);
    expect(result.nearCombos).toEqual([]);
  });

  test("filters out variants with status NW (not working)", () => {
    const okVariant = mockVariant({ id: "ok-1", status: "OK" });
    const nwVariant = mockVariant({ id: "nw-1", status: "NW" });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [okVariant, nwVariant],
        almostIncluded: [],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Thassa's Oracle", "Demonic Consultation"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.exactCombos).toHaveLength(1);
    expect(result.exactCombos[0].id).toBe("ok-1");
  });

  test("filters out near combos where all cards are missing from deck", () => {
    // Combo uses Stella Lee + Lightning Bolt -- neither is in the deck
    const allMissingVariant = mockVariant({
      id: "all-missing",
      uses: [
        {
          card: { id: 10, name: "Stella Lee, Wild Card", oracleId: null, typeLine: "Legendary Creature", oracleText: "", manaValue: 3, identity: "R" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 11, name: "Lightning Bolt", oracleId: null, typeLine: "Instant", oracleText: "", manaValue: 1, identity: "R" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    // Combo uses Sol Ring + Paradox Engine -- Sol Ring is in the deck
    const partialMissingVariant = mockVariant({
      id: "partial-missing",
      uses: [
        {
          card: { id: 12, name: "Sol Ring", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 1, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 13, name: "Paradox Engine", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 5, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [],
        almostIncluded: [allMissingVariant, partialMissingVariant],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    // Deck only contains Sol Ring -- Stella Lee combo should be filtered out
    const deckCardNames = new Set(["Sol Ring"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos).toHaveLength(1);
    expect(result.nearCombos[0].id).toBe("partial-missing");
  });

  test("filters out near combos with more than 2 missing cards", () => {
    // 4-card combo: Card A (in deck), Card B, Card C, Card D (3 missing)
    const threeMissingVariant = mockVariant({
      id: "3-missing",
      uses: [
        {
          card: { id: 20, name: "Card A", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 21, name: "Card B", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 22, name: "Card C", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 23, name: "Card D", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    // 3-card combo: Card A (in deck), Card E (missing) -- 1 missing, should pass
    const oneMissingVariant = mockVariant({
      id: "1-missing",
      uses: [
        {
          card: { id: 20, name: "Card A", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 24, name: "Card E", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [],
        almostIncluded: [threeMissingVariant, oneMissingVariant],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Card A"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    // Only the 1-missing variant passes the filter (3 missing > max of 2)
    expect(result.nearCombos).toHaveLength(1);
    expect(result.nearCombos[0].id).toBe("1-missing");
  });

  test("keeps near combos with exactly 2 missing cards when some cards are in deck", () => {
    // 4-card combo: Card A + Card B (in deck), Card C + Card D (missing) -- 2 missing, at limit
    const twoMissingVariant = mockVariant({
      id: "2-missing-ok",
      uses: [
        {
          card: { id: 30, name: "Card A", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 31, name: "Card B", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 32, name: "Card C", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 33, name: "Card D", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "WUBRG",
        included: [],
        almostIncluded: [twoMissingVariant],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Card A", "Card B"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos).toHaveLength(1);
    expect(result.nearCombos[0].missingCards).toEqual(["Card C", "Card D"]);
  });

  test("filters out near combos outside commander color identity", () => {
    // UB combo (Thassa's Oracle + Demonic Consultation) — identity "UB"
    const ubCombo = mockVariant({
      id: "ub-combo",
      identity: "UB",
      uses: [
        {
          card: { id: 1, name: "Thassa's Oracle", oracleId: null, typeLine: "Creature", oracleText: "", manaValue: 2, identity: "U" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 2, name: "Demonic Consultation", oracleId: null, typeLine: "Instant", oracleText: "", manaValue: 1, identity: "B" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    // Colorless combo (Sol Ring + Paradox Engine) — identity ""
    const colorlessCombo = mockVariant({
      id: "colorless-combo",
      identity: "",
      uses: [
        {
          card: { id: 3, name: "Sol Ring", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 1, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 4, name: "Paradox Engine", oracleId: null, typeLine: "Artifact", oracleText: "", manaValue: 5, identity: "" },
          zoneLocations: ["B"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "RG",
        included: [],
        almostIncluded: [ubCombo, colorlessCombo],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    // Deck has Thassa's Oracle and Sol Ring — both combos have overlap
    const deckCardNames = new Set(["Thassa's Oracle", "Sol Ring"]);
    // Commander identity is RG — the UB combo should be filtered out
    const result = normalizeSpellbookResponse(response, deckCardNames, "RG");

    expect(result.nearCombos).toHaveLength(1);
    expect(result.nearCombos[0].id).toBe("colorless-combo");
  });

  test("does not filter by color identity when no commander identity provided", () => {
    const ubCombo = mockVariant({
      id: "ub-combo",
      identity: "UB",
      uses: [
        {
          card: { id: 1, name: "Card A", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "U" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
        {
          card: { id: 2, name: "Card B", oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "B" },
          zoneLocations: ["H"],
          battlefieldCardState: "",
          mustBeCommander: false,
          quantity: 1,
        },
      ],
    });

    const response: SpellbookFindMyCombosResponse = {
      results: {
        identity: "",
        included: [],
        almostIncluded: [ubCombo],
        almostIncludedByAddingColors: [],
        includedByChangingCommanders: [],
        almostIncludedByChangingCommanders: [],
        almostIncludedByAddingColorsAndChangingCommanders: [],
      },
    };
    const deckCardNames = new Set(["Card A"]);
    // No commander identity — should NOT filter by color
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos).toHaveLength(1);
  });
});

test.describe("comboFitsIdentity", () => {
  test("combo within commander identity returns true", () => {
    expect(comboFitsIdentity("UB", "WUBRG")).toBe(true);
    expect(comboFitsIdentity("R", "RG")).toBe(true);
    expect(comboFitsIdentity("", "WU")).toBe(true); // colorless fits any
  });

  test("combo outside commander identity returns false", () => {
    expect(comboFitsIdentity("UB", "RG")).toBe(false);
    expect(comboFitsIdentity("WUBRG", "UB")).toBe(false);
    expect(comboFitsIdentity("W", "UBR")).toBe(false);
  });

  test("colorless combo fits any identity", () => {
    expect(comboFitsIdentity("", "")).toBe(true);
    expect(comboFitsIdentity("", "WUBRG")).toBe(true);
  });
});
