import type { MoxfieldApiResponse, MoxfieldDeckSection, DeckCard } from "./types";

const MOXFIELD_URL_PATTERN =
  /^https?:\/\/(?:www\.)?moxfield\.com\/decks\/([A-Za-z0-9_-]+)/;

export function isMoxfieldUrl(url: string): boolean {
  return MOXFIELD_URL_PATTERN.test(url);
}

export function extractMoxfieldDeckId(url: string): string | null {
  const match = url.match(MOXFIELD_URL_PATTERN);
  return match ? match[1] : null;
}

export function normalizeMoxfieldSection(
  section: MoxfieldDeckSection,
  defaultQuantity = 1
): DeckCard[] {
  return Object.entries(section)
    .map(([, entry]) => ({
      name: entry.card.name,
      quantity: entry.quantity ?? defaultQuantity,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchMoxfieldDeck(
  deckId: string
): Promise<MoxfieldApiResponse> {
  const res = await fetch(
    `https://api2.moxfield.com/v2/decks/all/${deckId}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; deck-evaluator/1.0)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Moxfield API returned ${res.status} for deck ${deckId}`);
  }

  return res.json() as Promise<MoxfieldApiResponse>;
}
