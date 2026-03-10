import type { CardFace, EnrichedCard } from "./types";
import { parseManaPips, parseTypeLine } from "./mana";

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const BATCH_SIZE = 75;
const BATCH_DELAY_MS = 100;

export interface ScryfallCardFace {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  produced_mana?: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
}

export interface ScryfallCard {
  id: string;
  name: string;
  layout?: string;
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
  set: string;
  collector_number: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: ScryfallCardFace[];
  produced_mana?: string[];
  flavor_name?: string;
  game_changer?: boolean;
  prices?: { usd: string | null; usd_foil: string | null; eur: string | null };
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

type ScryfallIdentifier =
  | { name: string }
  | { set: string; collector_number: string };

interface CollectionResponse {
  data: ScryfallCard[];
  not_found: Array<{ name?: string; set?: string; collector_number?: string }>;
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

  // Fallback: retry not-found names via /cards/named?exact=
  // This resolves flavor names (Universes Beyond reprints) that
  // the collection endpoint doesn't match.
  if (allNotFound.length > 0) {
    const remaining: string[] = [];
    for (let i = 0; i < allNotFound.length; i++) {
      if (i > 0) await delay(BATCH_DELAY_MS);
      try {
        const card = await fetchCardByName(allNotFound[i]);
        if (card) {
          allCards.push(card);
        } else {
          remaining.push(allNotFound[i]);
        }
      } catch {
        remaining.push(allNotFound[i]);
      }
    }
    allNotFound.length = 0;
    allNotFound.push(...remaining);
  }

  return { data: allCards, not_found: allNotFound };
}

/**
 * Fetches card data by set+collector_number identifiers using Scryfall's /cards/collection.
 * Same batching/retry pattern as fetchCardCollection.
 */
export async function fetchCardCollectionByIds(
  ids: Array<{ set: string; collector_number: string }>
): Promise<{ data: ScryfallCard[]; not_found: Array<{ set: string; collector_number: string }> }> {
  const batches = chunk(ids, BATCH_SIZE);
  const allCards: ScryfallCard[] = [];
  const allNotFound: Array<{ set: string; collector_number: string }> = [];

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await delay(BATCH_DELAY_MS);

    try {
      const result = await fetchBatchWithRetry(batches[i]);
      allCards.push(...result.data);
      for (const nf of result.not_found) {
        if (nf.set && nf.collector_number) {
          allNotFound.push({ set: nf.set, collector_number: nf.collector_number });
        }
      }
    } catch (err) {
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

/**
 * Generic fetch-with-retry for Scryfall API calls.
 * Handles 429 rate limits (respects Retry-After header) and 5xx server errors.
 * Returns the raw Response on success; throws on exhausted retries or non-retryable errors.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(10_000),
    });

    if (res.ok) return res;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      const waitMs = Math.min(retryAfter * 1000, 10_000);
      console.warn(
        `[scryfall] rate limited (attempt ${attempt + 1}/${maxRetries + 1}), retrying after ${waitMs}ms`
      );
      await delay(waitMs);
      lastError = new Error(`Scryfall API rate limited: ${res.status}`);
      continue;
    }

    if (res.status >= 500 && attempt < maxRetries) {
      console.warn(
        `[scryfall] server error ${res.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying`
      );
      await delay(1000);
      lastError = new Error(`Scryfall API server error: ${res.status}`);
      continue;
    }

    throw new Error(`Scryfall API error: ${res.status}`);
  }

  throw lastError ?? new Error("Scryfall API error: retries exhausted");
}

async function fetchBatchWithRetry(
  identifiers: ScryfallIdentifier[],
  signal?: AbortSignal
): Promise<CollectionResponse> {
  const res = await fetchWithRetry(
    `${SCRYFALL_API_BASE}/cards/collection`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
      signal,
    }
  );
  return res.json() as Promise<CollectionResponse>;
}

function parsePrice(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? null : n;
}

/**
 * Builds a CardFace from a ScryfallCardFace (used for multi-face cards).
 */
function buildCardFace(
  face: ScryfallCardFace,
  fallbackName: string
): CardFace {
  const img = face.image_uris;
  return {
    name: face.name ?? fallbackName,
    manaCost: face.mana_cost ?? "",
    typeLine: face.type_line ?? "",
    oracleText: face.oracle_text ?? "",
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    imageUris: img
      ? { small: img.small, normal: img.normal, large: img.large }
      : null,
  };
}

/**
 * Normalizes a Scryfall card response into our EnrichedCard type.
 * Handles multi-face cards by building a cardFaces array and combining oracle text.
 * Top-level fields (manaCost, power, toughness, etc.) remain front-face values.
 */
export function normalizeToEnrichedCard(card: ScryfallCard): EnrichedCard {
  const layout = card.layout ?? "normal";
  const frontFace = card.card_faces?.[0];

  // Build cardFaces array
  const cardFaces: CardFace[] =
    card.card_faces && card.card_faces.length > 0
      ? card.card_faces.map((f) => buildCardFace(f, card.name))
      : [
          {
            name: card.name,
            manaCost: card.mana_cost ?? "",
            typeLine: card.type_line,
            oracleText: card.oracle_text ?? "",
            power: card.power ?? null,
            toughness: card.toughness ?? null,
            loyalty: card.loyalty ?? null,
            imageUris: card.image_uris
              ? { small: card.image_uris.small, normal: card.image_uris.normal, large: card.image_uris.large }
              : null,
          },
        ];

  // Front-face values for table row display
  const manaCost = card.mana_cost ?? frontFace?.mana_cost ?? "";
  const imageUris = card.image_uris ?? frontFace?.image_uris ?? null;

  // Combined oracle text from all faces for analysis
  const oracleText = card.card_faces && card.card_faces.length > 1
    ? card.card_faces
        .map((f) => f.oracle_text ?? "")
        .filter(Boolean)
        .join("\n\n")
    : card.oracle_text ?? frontFace?.oracle_text ?? "";

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
    power: card.power ?? frontFace?.power ?? null,
    toughness: card.toughness ?? frontFace?.toughness ?? null,
    loyalty: card.loyalty ?? frontFace?.loyalty ?? null,
    rarity: card.rarity,
    imageUris: imageUris
      ? { small: imageUris.small, normal: imageUris.normal, large: imageUris.large }
      : null,
    manaPips: parseManaPips(manaCost),
    producedMana: card.produced_mana ?? frontFace?.produced_mana ?? [],
    flavorName: card.flavor_name ?? null,
    isGameChanger: card.game_changer ?? false,
    prices: {
      usd: parsePrice(card.prices?.usd),
      usdFoil: parsePrice(card.prices?.usd_foil),
      eur: parsePrice(card.prices?.eur),
    },
    setCode: card.set ?? "",
    collectorNumber: card.collector_number ?? "",
    layout,
    cardFaces,
  };
}
