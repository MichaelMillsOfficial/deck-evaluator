import type { EnrichedCard, DeckData } from "../src/lib/types";

export function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
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
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "",
    collectorNumber: "",
    layout: "normal",
    cardFaces: [
      {
        name: overrides.name ?? "Test Card",
        manaCost: overrides.manaCost ?? "",
        typeLine: overrides.typeLine ?? "Creature",
        oracleText: overrides.oracleText ?? "",
        power: overrides.power ?? null,
        toughness: overrides.toughness ?? null,
        loyalty: overrides.loyalty ?? null,
        imageUris: overrides.imageUris ?? null,
      },
    ],
    ...overrides,
  };
}

export function makeDeck(overrides: Partial<DeckData> = {}): DeckData {
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
