// ---------------------------------------------------------------------------
// Deck Codec — serialize/deserialize deck payloads for share URLs
// Uses CompressionStream (browser API) for gzip compression
// ---------------------------------------------------------------------------

import type { DeckData, EnrichedCard } from "./types";

interface DeckPayload {
  t: string;       // decklist text
  c?: string[];    // commander names
}

// ---------------------------------------------------------------------------
// v2 compact payload types
// ---------------------------------------------------------------------------

export interface CompactDeckPayload {
  v: 2;
  n: string;                          // deck name
  c: [string, string, number][];      // commanders: [set, collectorNum, qty]
  m: [string, string, number][];      // mainboard
  s?: [string, string, number][];     // sideboard (omitted if empty)
}

// ---------------------------------------------------------------------------
// Discriminated union for decoded payloads
// ---------------------------------------------------------------------------

export type DecodedPayload =
  | { version: 1; text: string; commanders?: string[] }
  | {
      version: 2;
      name: string;
      commanders: [string, string, number][];
      mainboard: [string, string, number][];
      sideboard: [string, string, number][];
    };

// ---------------------------------------------------------------------------
// v1 serialize/deserialize
// ---------------------------------------------------------------------------

export function serializePayload(text: string, commanders?: string[]): string {
  const payload: DeckPayload = { t: text };
  if (commanders && commanders.length > 0) {
    payload.c = commanders;
  }
  return JSON.stringify(payload);
}

export function deserializePayload(json: string): DecodedPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON payload");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid payload: not an object");
  }

  const obj = parsed as Record<string, unknown>;

  // v2 detection
  if (obj.v === 2) {
    return {
      version: 2,
      name: (obj.n as string) ?? "",
      commanders: (obj.c as [string, string, number][]) ?? [],
      mainboard: (obj.m as [string, string, number][]) ?? [],
      sideboard: (obj.s as [string, string, number][]) ?? [],
    };
  }

  // v1 path
  if (typeof obj.t !== "string") {
    throw new Error("Invalid payload: missing or invalid 't' field");
  }

  return {
    version: 1,
    text: obj.t,
    commanders: Array.isArray(obj.c) ? (obj.c as string[]) : undefined,
  };
}

// ---------------------------------------------------------------------------
// v2 compact payload builders
// ---------------------------------------------------------------------------

function cardToTuple(
  card: { name: string; quantity: number },
  cardMap: Record<string, EnrichedCard>
): [string, string, number] {
  const enriched = cardMap[card.name];
  if (enriched && enriched.setCode) {
    return [enriched.setCode, enriched.collectorNumber, card.quantity];
  }
  // Fallback: name-based tuple
  return ["_", card.name, card.quantity];
}

export function buildCompactPayload(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): CompactDeckPayload {
  const payload: CompactDeckPayload = {
    v: 2,
    n: deck.name,
    c: deck.commanders.map((c) => cardToTuple(c, cardMap)),
    m: deck.mainboard.map((c) => cardToTuple(c, cardMap)),
  };
  if (deck.sideboard.length > 0) {
    payload.s = deck.sideboard.map((c) => cardToTuple(c, cardMap));
  }
  return payload;
}

export function serializeCompactPayload(payload: CompactDeckPayload): string {
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// Base64url helpers (no +, /, or = padding)
// ---------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Compression helpers
// ---------------------------------------------------------------------------

async function compressGzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(data.buffer as ArrayBuffer));
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  return compressed;
}

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data.buffer as ArrayBuffer));
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const decompressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    decompressed.set(chunk, offset);
    offset += chunk.length;
  }
  return decompressed;
}

// ---------------------------------------------------------------------------
// Encode/Decode with CompressionStream
// ---------------------------------------------------------------------------

export async function encodeDeckPayload(
  text: string,
  commanders?: string[]
): Promise<string> {
  const json = serializePayload(text, commanders);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compressGzip(encoded);
  return toBase64Url(compressed);
}

export async function encodeCompactDeckPayload(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): Promise<string> {
  const payload = buildCompactPayload(deck, cardMap);
  const json = serializeCompactPayload(payload);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compressGzip(encoded);
  return toBase64Url(compressed);
}

export async function decodeDeckPayload(
  encoded: string
): Promise<DecodedPayload> {
  const compressed = fromBase64Url(encoded);
  const decompressed = await decompressGzip(compressed);
  const json = new TextDecoder().decode(decompressed);
  return deserializePayload(json);
}

// ---------------------------------------------------------------------------
// Reconstruct DeckData from v2 compact payload + enriched card map
// ---------------------------------------------------------------------------

function tuplesToDeckCards(
  tuples: [string, string, number][],
  cardMap: Record<string, EnrichedCard>
): { name: string; quantity: number }[] {
  return tuples.map(([set, numOrName, qty]) => {
    if (set === "_") {
      // Fallback tuple — numOrName is the card name
      return { name: numOrName, quantity: qty };
    }
    // Find card by set+number in cardMap
    for (const card of Object.values(cardMap)) {
      if (card.setCode === set && card.collectorNumber === numOrName) {
        return { name: card.name, quantity: qty };
      }
    }
    // Card not found in map — use a placeholder
    return { name: `${set}/${numOrName}`, quantity: qty };
  });
}

export function buildDeckFromCompactPayload(
  payload: Extract<DecodedPayload, { version: 2 }>,
  cardMap: Record<string, EnrichedCard>
): DeckData {
  return {
    name: payload.name,
    source: "text",
    url: "",
    commanders: tuplesToDeckCards(payload.commanders, cardMap),
    mainboard: tuplesToDeckCards(payload.mainboard, cardMap),
    sideboard: tuplesToDeckCards(payload.sideboard, cardMap),
  };
}
