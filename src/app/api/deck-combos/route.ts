import {
  buildSpellbookRequest,
  fetchSpellbookCombos,
  normalizeSpellbookResponse,
} from "@/lib/commander-spellbook";
import type { DeckData } from "@/lib/types";

const MAX_CARD_NAMES = 250;
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

  // Validate and clean card names
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

  if (cleaned.length === 0) {
    return Response.json(
      { error: "No valid card names provided" },
      { status: 400 }
    );
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

  if (uniqueNames.length > MAX_CARD_NAMES) {
    return Response.json(
      {
        error: `Too many unique card names (${uniqueNames.length}). Maximum is ${MAX_CARD_NAMES}.`,
      },
      { status: 400 }
    );
  }

  // Extract optional commanders
  const rawCommanders = (body as Record<string, unknown>).commanders;
  const commanders: string[] = [];
  if (Array.isArray(rawCommanders)) {
    for (const name of rawCommanders) {
      if (typeof name === "string" && name.trim()) {
        commanders.push(name.trim());
      }
    }
  }

  // Build DeckData-like structure for the spellbook request builder
  const deck: DeckData = {
    name: "",
    source: "text",
    url: "",
    commanders: commanders.map((name) => ({ name, quantity: 1 })),
    mainboard: uniqueNames.map((name) => ({ name, quantity: 1 })),
    sideboard: [],
  };

  const spellbookRequest = buildSpellbookRequest(deck);

  try {
    const spellbookResponse = await fetchSpellbookCombos(spellbookRequest);
    const deckCardNames = new Set([...uniqueNames, ...commanders]);
    const normalized = normalizeSpellbookResponse(
      spellbookResponse,
      deckCardNames
    );

    return Response.json(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[deck-combos] Commander Spellbook error:", message);

    // Graceful degradation: return empty combos with error message, 200 status
    return Response.json({
      exactCombos: [],
      nearCombos: [],
      error: "Commander Spellbook unavailable",
    });
  }
}
