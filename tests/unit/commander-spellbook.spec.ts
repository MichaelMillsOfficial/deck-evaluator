import { test, expect } from "@playwright/test";
import {
  buildSpellbookRequest,
  normalizeVariant,
  normalizeSpellbookResponse,
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
    // Card A is in deck, Card B is missing; Card C-E are all missing
    const deckCardNames = new Set(["Card A"]);
    const result = normalizeSpellbookResponse(response, deckCardNames);

    expect(result.nearCombos[0].missingCards.length).toBeLessThanOrEqual(
      result.nearCombos[1].missingCards.length
    );
  });

  test("caps near combos at 20 results", () => {
    const nearVariants = Array.from({ length: 25 }, (_, i) =>
      mockVariant({
        id: `near-${i}`,
        uses: [
          {
            card: { id: i, name: `Card ${i}`, oracleId: null, typeLine: "", oracleText: "", manaValue: 0, identity: "" },
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
    const deckCardNames = new Set<string>();
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
});
