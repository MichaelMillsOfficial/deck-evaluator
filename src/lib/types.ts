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

// Raw Moxfield API types
export interface MoxfieldCardEntry {
  quantity: number;
  card: { name: string };
}

export interface MoxfieldDeckSection {
  [cardName: string]: MoxfieldCardEntry;
}

export interface MoxfieldApiResponse {
  name: string;
  mainboard: MoxfieldDeckSection;
  commanders: MoxfieldDeckSection;
  sideboard: MoxfieldDeckSection;
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
}
