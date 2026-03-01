import {
  fetchCardCollection,
  fetchCardCollectionByIds,
  normalizeToEnrichedCard,
} from "@/lib/scryfall";
import type { EnrichedCard } from "@/lib/types";

const MAX_UNIQUE_NAMES = 250;
const MAX_NAME_LENGTH = 200;
const MAX_IDENTIFIERS = 250;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body === null || typeof body !== "object") {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const obj = body as Record<string, unknown>;

  // Branch: set+collector_number identifiers (v2 compact share URLs)
  if (Array.isArray(obj.identifiers)) {
    return handleIdentifiers(obj.identifiers);
  }

  // Branch: card names (original path)
  if (Array.isArray(obj.cardNames)) {
    return handleCardNames(obj.cardNames);
  }

  return Response.json(
    { error: "Missing required field: cardNames (array) or identifiers (array)" },
    { status: 400 }
  );
}

async function handleIdentifiers(rawIds: unknown[]): Promise<Response> {
  const cleaned: Array<{ set: string; collector_number: string }> = [];
  for (const id of rawIds) {
    if (
      typeof id !== "object" ||
      id === null ||
      typeof (id as Record<string, unknown>).set !== "string" ||
      typeof (id as Record<string, unknown>).collector_number !== "string"
    ) {
      continue;
    }
    const { set, collector_number } = id as { set: string; collector_number: string };
    if (set && collector_number) {
      cleaned.push({ set, collector_number });
    }
  }

  if (cleaned.length === 0) {
    return Response.json(
      { error: "No valid identifiers provided" },
      { status: 400 }
    );
  }

  if (cleaned.length > MAX_IDENTIFIERS) {
    return Response.json(
      { error: `Too many identifiers (${cleaned.length}). Maximum is ${MAX_IDENTIFIERS}.` },
      { status: 400 }
    );
  }

  try {
    const { data: scryfallCards, not_found } =
      await fetchCardCollectionByIds(cleaned);

    const cards: Record<string, EnrichedCard> = {};
    for (const card of scryfallCards) {
      cards[card.name] = normalizeToEnrichedCard(card);
    }

    return Response.json({ cards, notFound: not_found });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[deck-enrich] error:", message);
    return Response.json(
      { error: "Failed to fetch card data from Scryfall" },
      { status: 502 }
    );
  }
}

async function handleCardNames(rawNames: unknown[]): Promise<Response> {
  // Validate, trim, and filter
  const cleaned: string[] = [];
  for (const name of rawNames) {
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_NAME_LENGTH) {
      return Response.json(
        { error: `Card name exceeds maximum length of ${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }
    cleaned.push(trimmed);
  }

  // Deduplicate (case-insensitive)
  const seen = new Map<string, string>();
  for (const name of cleaned) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, name);
    }
  }
  const uniqueNames = Array.from(seen.values());

  if (uniqueNames.length === 0) {
    return Response.json(
      { error: "No valid card names provided" },
      { status: 400 }
    );
  }

  if (uniqueNames.length > MAX_UNIQUE_NAMES) {
    return Response.json(
      {
        error: `Too many unique card names (${uniqueNames.length}). Maximum is ${MAX_UNIQUE_NAMES}.`,
      },
      { status: 400 }
    );
  }

  try {
    const { data: scryfallCards, not_found } =
      await fetchCardCollection(uniqueNames);

    // Map Scryfall canonical names back to originally-requested names
    const requestedByLower = new Map(
      uniqueNames.map((n) => [n.toLowerCase(), n])
    );

    const cards: Record<string, EnrichedCard> = {};
    for (const card of scryfallCards) {
      // Try full name, then front face of DFC (before " // "), then flavor name
      const frontFaceName = card.name.includes(" // ")
        ? card.name.split(" // ")[0]
        : undefined;
      const requestedName =
        requestedByLower.get(card.name.toLowerCase()) ??
        (frontFaceName
          ? requestedByLower.get(frontFaceName.toLowerCase())
          : undefined) ??
        (card.flavor_name
          ? requestedByLower.get(card.flavor_name.toLowerCase())
          : undefined) ??
        card.name;
      cards[requestedName] = normalizeToEnrichedCard(card);
    }

    const notFound = not_found;

    return Response.json({ cards, notFound });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[deck-enrich] error:", message);
    return Response.json(
      { error: "Failed to fetch card data from Scryfall" },
      { status: 502 }
    );
  }
}
