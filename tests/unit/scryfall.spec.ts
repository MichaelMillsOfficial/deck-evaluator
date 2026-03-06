import { test, expect } from "@playwright/test";
import {
  normalizeToEnrichedCard,
  type ScryfallCard,
} from "../../src/lib/scryfall";

function makeScryfallCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: "test-id",
    name: "Test Card",
    cmc: 0,
    type_line: "Creature",
    colors: [],
    color_identity: [],
    keywords: [],
    rarity: "common",
    set: "tst",
    collector_number: "1",
    ...overrides,
  };
}

test.describe("normalizeToEnrichedCard", () => {
  test("maps standard single-faced card correctly", () => {
    const card = makeScryfallCard({
      name: "Sol Ring",
      mana_cost: "{1}",
      cmc: 1,
      type_line: "Artifact",
      oracle_text: "{T}: Add {C}{C}.",
      colors: [],
      color_identity: [],
      keywords: [],
      rarity: "uncommon",
      set: "c21",
      collector_number: "263",
      image_uris: {
        small: "https://example.com/small.jpg",
        normal: "https://example.com/normal.jpg",
        large: "https://example.com/large.jpg",
      },
      prices: { usd: "3.50", usd_foil: "5.00", eur: "3.00" },
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.name).toBe("Sol Ring");
    expect(result.manaCost).toBe("{1}");
    expect(result.cmc).toBe(1);
    expect(result.typeLine).toBe("Artifact");
    expect(result.oracleText).toBe("{T}: Add {C}{C}.");
    expect(result.rarity).toBe("uncommon");
    expect(result.setCode).toBe("c21");
    expect(result.collectorNumber).toBe("263");
    expect(result.imageUris).toEqual({
      small: "https://example.com/small.jpg",
      normal: "https://example.com/normal.jpg",
      large: "https://example.com/large.jpg",
    });
    expect(result.prices).toEqual({ usd: 3.5, usdFoil: 5.0, eur: 3.0 });
  });

  test("handles double-faced card (DFC) — falls back to card_faces[0]", () => {
    const card = makeScryfallCard({
      name: "Delver of Secrets // Insectile Aberration",
      cmc: 1,
      type_line: "Creature — Human Wizard // Creature — Human Insect",
      // Top-level fields are undefined for DFCs
      mana_cost: undefined,
      oracle_text: undefined,
      image_uris: undefined,
      card_faces: [
        {
          mana_cost: "{U}",
          oracle_text: "At the beginning of your upkeep...",
          image_uris: {
            small: "https://example.com/front-small.jpg",
            normal: "https://example.com/front-normal.jpg",
            large: "https://example.com/front-large.jpg",
          },
        },
        {
          mana_cost: "",
          oracle_text: "Flying",
          image_uris: {
            small: "https://example.com/back-small.jpg",
            normal: "https://example.com/back-normal.jpg",
            large: "https://example.com/back-large.jpg",
          },
        },
      ],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.manaCost).toBe("{U}");
    expect(result.oracleText).toBe("At the beginning of your upkeep...");
    expect(result.imageUris?.small).toBe("https://example.com/front-small.jpg");
  });

  test("handles missing optional fields gracefully", () => {
    const card = makeScryfallCard({
      // No power, toughness, loyalty, flavor_name, prices, image_uris
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.power).toBeNull();
    expect(result.toughness).toBeNull();
    expect(result.loyalty).toBeNull();
    expect(result.flavorName).toBeNull();
    expect(result.imageUris).toBeNull();
    expect(result.prices).toEqual({ usd: null, usdFoil: null, eur: null });
  });

  test("handles null price strings", () => {
    const card = makeScryfallCard({
      prices: { usd: null, usd_foil: null, eur: null },
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.prices.usd).toBeNull();
    expect(result.prices.usdFoil).toBeNull();
    expect(result.prices.eur).toBeNull();
  });

  test("parses valid price strings to numbers", () => {
    const card = makeScryfallCard({
      prices: { usd: "1.25", usd_foil: "0.50", eur: "1.00" },
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.prices.usd).toBe(1.25);
    expect(result.prices.usdFoil).toBe(0.5);
    expect(result.prices.eur).toBe(1.0);
  });

  test("handles zero-cost price", () => {
    const card = makeScryfallCard({
      prices: { usd: "0.00", usd_foil: null, eur: null },
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.prices.usd).toBe(0);
  });

  test("parses color identity correctly", () => {
    const card = makeScryfallCard({
      color_identity: ["W", "U", "B"],
      colors: ["W", "U"],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.colorIdentity).toEqual(["W", "U", "B"]);
    expect(result.colors).toEqual(["W", "U"]);
  });

  test("extracts keywords", () => {
    const card = makeScryfallCard({
      keywords: ["Flying", "Vigilance", "Lifelink"],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.keywords).toEqual(["Flying", "Vigilance", "Lifelink"]);
  });

  test("handles land cards (no mana cost)", () => {
    const card = makeScryfallCard({
      name: "Command Tower",
      type_line: "Land",
      mana_cost: undefined,
      cmc: 0,
      oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
      produced_mana: ["W", "U", "B", "R", "G"],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.manaCost).toBe("");
    expect(result.cmc).toBe(0);
    expect(result.producedMana).toEqual(["W", "U", "B", "R", "G"]);
  });

  test("handles card with {X} in mana cost", () => {
    const card = makeScryfallCard({
      name: "Fireball",
      mana_cost: "{X}{R}",
      cmc: 1,
      type_line: "Sorcery",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.manaCost).toBe("{X}{R}");
  });

  test("handles produced_mana from card_faces[0] for DFCs", () => {
    const card = makeScryfallCard({
      produced_mana: undefined,
      card_faces: [
        {
          produced_mana: ["G", "W"],
        },
      ],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.producedMana).toEqual(["G", "W"]);
  });

  test("maps game_changer field", () => {
    const card = makeScryfallCard({
      game_changer: true,
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.isGameChanger).toBe(true);
  });

  test("defaults game_changer to false when absent", () => {
    const card = makeScryfallCard({});

    const result = normalizeToEnrichedCard(card);
    expect(result.isGameChanger).toBe(false);
  });

  test("extracts supertypes and subtypes from type line", () => {
    const card = makeScryfallCard({
      type_line: "Legendary Creature — Human Wizard",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.supertypes).toContain("Legendary");
    expect(result.subtypes).toContain("Human");
    expect(result.subtypes).toContain("Wizard");
  });

  test("handles power and toughness", () => {
    const card = makeScryfallCard({
      power: "3",
      toughness: "4",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.power).toBe("3");
    expect(result.toughness).toBe("4");
  });

  test("handles loyalty for planeswalkers", () => {
    const card = makeScryfallCard({
      type_line: "Legendary Planeswalker — Jace",
      loyalty: "3",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.loyalty).toBe("3");
  });

  test("sets default collector number to empty string when absent", () => {
    const card = makeScryfallCard({
      collector_number: undefined as unknown as string,
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.collectorNumber).toBe("");
  });

  test("handles flavor_name field", () => {
    const card = makeScryfallCard({
      flavor_name: "Optimus Prime",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.flavorName).toBe("Optimus Prime");
  });
});
