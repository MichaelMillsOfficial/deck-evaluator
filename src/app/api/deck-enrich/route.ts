import {
  fetchCardCollection,
  normalizeToEnrichedCard,
} from "@/lib/scryfall";
import type { EnrichedCard } from "@/lib/types";

const MAX_UNIQUE_NAMES = 250;
const MAX_NAME_LENGTH = 200;

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

  if (
    body === null ||
    typeof body !== "object" ||
    !("cardNames" in body) ||
    !Array.isArray((body as Record<string, unknown>).cardNames)
  ) {
    return Response.json(
      { error: "Missing required field: cardNames (must be an array)" },
      { status: 400 }
    );
  }

  const rawNames = (body as { cardNames: unknown[] }).cardNames;

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
      const requestedName =
        requestedByLower.get(card.name.toLowerCase()) ?? card.name;
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
