import type { ArchidektApiResponse, DeckCard } from "./types";

const ARCHIDEKT_URL_PATTERN =
  /^https?:\/\/(?:www\.)?archidekt\.com\/decks\/(\d+)/;

export function isArchidektUrl(url: string): boolean {
  return ARCHIDEKT_URL_PATTERN.test(url);
}

export function extractArchidektDeckId(url: string): string | null {
  const match = url.match(ARCHIDEKT_URL_PATTERN);
  return match ? match[1] : null;
}

const COMMANDER_CATEGORIES = new Set([
  "Commander",
  "Oathbreaker",
  "Signature Spell",
]);

const SIDEBOARD_CATEGORIES = new Set([
  "Sideboard",
  "Maybeboard",
  "Considering",
]);

export async function fetchArchidektDeck(
  deckId: string
): Promise<ArchidektApiResponse> {
  const res = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Archidekt API returned ${res.status} for deck ${deckId}`
    );
  }

  return res.json() as Promise<ArchidektApiResponse>;
}

export function normalizeArchidektCards(raw: ArchidektApiResponse): {
  commanders: DeckCard[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
} {
  const commanders: DeckCard[] = [];
  const mainboard: DeckCard[] = [];
  const sideboard: DeckCard[] = [];

  for (const entry of raw.cards) {
    const card: DeckCard = {
      name: entry.card.oracleCard.name,
      quantity: entry.quantity,
    };

    const isCommander = entry.categories.some((c) =>
      COMMANDER_CATEGORIES.has(c)
    );
    const isSideboard = entry.categories.some((c) =>
      SIDEBOARD_CATEGORIES.has(c)
    );

    if (isCommander) {
      commanders.push(card);
    } else if (isSideboard) {
      sideboard.push(card);
    } else {
      mainboard.push(card);
    }
  }

  const byName = (a: DeckCard, b: DeckCard) => a.name.localeCompare(b.name);
  return {
    commanders: commanders.sort(byName),
    mainboard: mainboard.sort(byName),
    sideboard: sideboard.sort(byName),
  };
}
