export interface DeckCard {
  name: string;
  quantity: number;
}

export interface DeckData {
  name: string;
  source: "moxfield" | "archidekt" | "text";
  url: string;
  commanders: DeckCard[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
}

// Raw Archidekt API types
export interface ArchidektCard {
  quantity: number;
  card: { oracleCard: { name: string } };
  categories: string[];
}

export interface ArchidektApiResponse {
  name: string;
  cards: ArchidektCard[];
}

export interface CardPrices {
  usd: number | null;
  usdFoil: number | null;
  eur: number | null;
}

// Per-face data for multi-faced cards (DFCs, adventures, splits, etc.)
export interface CardFace {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  imageUris: { small: string; normal: string; large: string } | null;
}

// Enriched card data (from Scryfall)
export interface ManaPips {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export interface EnrichedCard {
  name: string;
  manaCost: string;
  cmc: number;
  colorIdentity: string[];
  colors: string[];
  typeLine: string;
  supertypes: string[];
  subtypes: string[];
  oracleText: string;
  keywords: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string;
  imageUris: { small: string; normal: string; large: string } | null;
  manaPips: ManaPips;
  producedMana: string[];
  flavorName: string | null;
  isGameChanger: boolean;
  prices: CardPrices;
  setCode: string;
  collectorNumber: string;
  layout: string;
  cardFaces: CardFace[];
}

// Synergy analysis types

/** How strongly a card participates in a synergy axis */
export interface CardAxisScore {
  axisId: string;
  axisName: string;
  relevance: number; // 0-1
}

/** A detected synergy relationship between cards */
export interface SynergyPair {
  cards: string[];
  axisId: string | null; // null for known combos
  type: "synergy" | "anti-synergy" | "combo";
  strength: number; // 0-1
  description: string;
}

/** Per-card synergy summary */
export interface CardSynergyScore {
  cardName: string;
  score: number; // 0-100
  axes: CardAxisScore[];
  pairs: SynergyPair[];
}

/** Detected deck theme/strategy */
export interface DeckTheme {
  axisId: string;
  axisName: string;
  strength: number;
  cardCount: number;
  /** Optional detail for the theme, e.g. primary creature type for tribal */
  detail?: string;
}

/** Full deck synergy analysis result */
export interface DeckSynergyAnalysis {
  cardScores: Record<string, CardSynergyScore>;
  topSynergies: SynergyPair[];
  antiSynergies: SynergyPair[];
  knownCombos: SynergyPair[];
  deckThemes: DeckTheme[];
}
