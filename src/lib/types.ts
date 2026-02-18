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
