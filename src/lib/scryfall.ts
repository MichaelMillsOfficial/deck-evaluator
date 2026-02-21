import type { EnrichedCard } from "./types";
import { parseManaPips, parseTypeLine } from "./mana";

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const BATCH_SIZE = 75;
const BATCH_DELAY_MS = 100;

export interface ScryfallCardFace {
  mana_cost?: string;
  oracle_text?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
}

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: ScryfallCardFace[];
}

export async function fetchCardByName(
  name: string
): Promise<ScryfallCard | null> {
  const res = await fetch(
    `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(name)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall API error: ${res.status}`);

  return res.json() as Promise<ScryfallCard>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface CollectionResponse {
  data: ScryfallCard[];
  not_found: Array<{ name?: string }>;
}

/**
 * Fetches card data for multiple cards using Scryfall's /cards/collection endpoint.
 * Batches into groups of 75, with 100ms delay between requests.
 * Handles 429 rate limits with retry, and accumulates partial results on batch failures.
 */
export async function fetchCardCollection(
  names: string[]
): Promise<{ data: ScryfallCard[]; not_found: string[] }> {
  const batches = chunk(names, BATCH_SIZE);
  const allCards: ScryfallCard[] = [];
  const allNotFound: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await delay(BATCH_DELAY_MS);

    const identifiers = batches[i].map((name) => ({ name }));

    try {
      const result = await fetchBatchWithRetry(identifiers);
      allCards.push(...result.data);
      for (const nf of result.not_found) {
        if (nf.name) allNotFound.push(nf.name);
      }
    } catch (err) {
      // Partial batch failure — add all names from this batch as not_found
      console.error(
        `[scryfall] batch ${i + 1}/${batches.length} failed:`,
        err instanceof Error ? err.message : err
      );
      allNotFound.push(...batches[i]);
    }
  }

  return { data: allCards, not_found: allNotFound };
}

// TODO: add server-side LRU cache for card data
const MAX_RETRIES = 2;

async function fetchBatchWithRetry(
  identifiers: Array<{ name: string }>,
  signal?: AbortSignal
): Promise<CollectionResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${SCRYFALL_API_BASE}/cards/collection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ identifiers }),
      signal: signal ?? AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return res.json() as Promise<CollectionResponse>;
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      const waitMs = Math.min(retryAfter * 1000, 10_000);
      console.warn(
        `[scryfall] rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying after ${waitMs}ms`
      );
      await delay(waitMs);
      lastError = new Error(`Scryfall API rate limited: ${res.status}`);
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      console.warn(
        `[scryfall] server error ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying`
      );
      await delay(1000);
      lastError = new Error(`Scryfall API server error: ${res.status}`);
      continue;
    }

    throw new Error(`Scryfall API error: ${res.status}`);
  }

  throw lastError ?? new Error("Scryfall API error: retries exhausted");
}

/**
 * Normalizes a Scryfall card response into our EnrichedCard type.
 * Handles DFCs by falling back to card_faces[0] when top-level fields are undefined.
 */
export function normalizeToEnrichedCard(card: ScryfallCard): EnrichedCard {
  const frontFace = card.card_faces?.[0];

  const manaCost = card.mana_cost ?? frontFace?.mana_cost ?? "";
  const oracleText = card.oracle_text ?? frontFace?.oracle_text ?? "";
  const imageUris = card.image_uris ?? frontFace?.image_uris ?? null;

  const { supertypes, cardType: _cardType, subtypes } = parseTypeLine(
    card.type_line
  );

  return {
    name: card.name,
    manaCost,
    cmc: card.cmc,
    colorIdentity: card.color_identity,
    colors: card.colors,
    typeLine: card.type_line,
    supertypes,
    subtypes,
    oracleText,
    keywords: card.keywords,
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    rarity: card.rarity,
    imageUris: imageUris
      ? { small: imageUris.small, normal: imageUris.normal, large: imageUris.large }
      : null,
    manaPips: parseManaPips(manaCost),
  };
}
