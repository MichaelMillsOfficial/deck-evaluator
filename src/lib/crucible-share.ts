// ---------------------------------------------------------------------------
// Crucible Share Codec - serialize/deserialize an in-progress pile
//
// Two shapes:
//   1. A shareable URL payload: a compact JSON view of the pile (pool,
//      triage statuses, kept quantities, commanders), gzip-compressed and
//      base64url-encoded. Mirrors the low-level helpers in deck-codec.ts.
//   2. A downloadable Forge-style `.dck` INI text file, human readable and
//      round-trippable.
//
// The volatile session fields (crucibleId, createdAt) are dropped on encode
// and regenerated on decode: a shared pile always lands in a FRESH session.
// ---------------------------------------------------------------------------

import {
  generateCrucibleId,
  type CruciblePayload,
  type CrucibleCardStatus,
} from "./crucible-session";
import type { DeckCard } from "./types";

// ---------------------------------------------------------------------------
// Compact payload shape
// ---------------------------------------------------------------------------

/** Status codes keep the encoded blob small. "undecided" is the default and
 * is never stored explicitly. */
type StatusCode = "k" | "c";

interface CompactPile {
  v: 1;
  /** pool: [name, quantity][] */
  p: [string, number][];
  /** non-undecided statuses: name -> "k" | "c" */
  s: Record<string, StatusCode>;
  /** partial kept counts: name -> count */
  k: Record<string, number>;
  /** chosen commander names */
  c: string[];
}

function statusToCode(status: CrucibleCardStatus): StatusCode | null {
  if (status === "keep") return "k";
  if (status === "cut") return "c";
  return null; // undecided - omitted
}

function codeToStatus(code: unknown): CrucibleCardStatus {
  if (code === "k") return "keep";
  if (code === "c") return "cut";
  return "undecided";
}

function buildCompactPile(payload: CruciblePayload): CompactPile {
  const s: Record<string, StatusCode> = {};
  for (const [name, status] of Object.entries(payload.statuses)) {
    const code = statusToCode(status);
    if (code) s[name] = code;
  }
  return {
    v: 1,
    p: payload.pool.map((card) => [card.name, card.quantity]),
    s,
    k: { ...payload.keptQuantities },
    c: [...payload.commanders],
  };
}

function compactToPayload(parsed: unknown): CruciblePayload | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1 || !Array.isArray(obj.p)) return null;

  const pool: DeckCard[] = [];
  for (const entry of obj.p) {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "number"
    ) {
      return null;
    }
    pool.push({ name: entry[0], quantity: entry[1] });
  }

  const rawStatuses =
    obj.s && typeof obj.s === "object"
      ? (obj.s as Record<string, unknown>)
      : {};
  const statuses: Record<string, CrucibleCardStatus> = {};
  // Every pool name gets an entry, defaulting to undecided.
  for (const card of pool) {
    statuses[card.name] = codeToStatus(rawStatuses[card.name]);
  }

  const rawKept =
    obj.k && typeof obj.k === "object"
      ? (obj.k as Record<string, unknown>)
      : {};
  const keptQuantities: Record<string, number> = {};
  for (const [name, value] of Object.entries(rawKept)) {
    if (typeof value === "number") keptQuantities[name] = value;
  }

  const commanders = Array.isArray(obj.c)
    ? obj.c.filter((name): name is string => typeof name === "string")
    : [];

  return {
    crucibleId: generateCrucibleId(),
    pool,
    statuses,
    keptQuantities,
    commanders,
    parseWarnings: [],
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Base64url helpers (no +, /, or = padding) - mirrors deck-codec.ts
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
// Compression helpers - mirrors deck-codec.ts
// ---------------------------------------------------------------------------

async function compressGzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  const copy = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  void writer.write(new Uint8Array(copy));
  void writer.close();

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
  const copy = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  void writer.write(new Uint8Array(copy));
  void writer.close();

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
// Public encode / decode
// ---------------------------------------------------------------------------

/** Encode an in-progress pile to a base64url gzip string for a share URL. */
export async function encodeCruciblePile(
  payload: CruciblePayload
): Promise<string> {
  const compact = buildCompactPile(payload);
  const json = JSON.stringify(compact);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compressGzip(encoded);
  return toBase64Url(compressed);
}

/**
 * Decode a shared pile back into a fresh CruciblePayload. Returns null for
 * corrupt encodings or foreign (non-crucible) payloads so callers can fall
 * back to the normal import screen gracefully.
 */
export async function decodeCruciblePile(
  encoded: string
): Promise<CruciblePayload | null> {
  if (!encoded) return null;
  try {
    const compressed = fromBase64Url(encoded);
    const decompressed = await decompressGzip(compressed);
    const json = new TextDecoder().decode(decompressed);
    return compactToPayload(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forge-style .dck serializer
// ---------------------------------------------------------------------------

const DEFAULT_DCK_NAME = "Crucible Pile";

/**
 * Serialize a pile to a Forge-style INI `.dck` file: a `[metadata]` section
 * with a `Name` line, a `[Commander]` section listing chosen commanders (one
 * `1 <name>` per line), and a `[Main]` section listing every pool card as
 * `<qty> <name>`. Human readable and round-trippable.
 */
export function serializePileToDck(
  payload: CruciblePayload,
  name: string = DEFAULT_DCK_NAME
): string {
  const trimmed = name.trim() || DEFAULT_DCK_NAME;
  const lines: string[] = [];
  lines.push("[metadata]");
  lines.push(`Name=${trimmed}`);
  lines.push("");
  lines.push("[Commander]");
  for (const commander of payload.commanders) {
    lines.push(`1 ${commander}`);
  }
  lines.push("");
  lines.push("[Main]");
  // Commanders live in payload.pool but belong only in the command zone;
  // emitting them in [Main] too would double-count them on re-import.
  const commanders = new Set(payload.commanders);
  for (const card of payload.pool) {
    if (commanders.has(card.name)) continue;
    lines.push(`${card.quantity} ${card.name}`);
  }
  return lines.join("\n") + "\n";
}
