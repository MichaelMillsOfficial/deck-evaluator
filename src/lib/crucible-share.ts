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

// ---------------------------------------------------------------------------
// Untrusted-input limits
//
// A share URL (`/crucible?p=`) and an imported `.dck` file are attacker
// controllable: whoever opens a crafted link or file feeds this decoder. These
// caps bound the blast radius to a graceful "could not read" fallback instead
// of a hung or OOM'd tab (gzip bomb, giant pile, absurd quantities).
// ---------------------------------------------------------------------------

/** Hard cap on gzip-decompressed bytes, to defuse decompression bombs. A real
 * pile of a few thousand cards encodes to well under this. */
const MAX_DECODED_BYTES = 1_000_000;
/** Max distinct pool entries accepted from an untrusted payload/file. */
const MAX_POOL_ENTRIES = 2_000;
/** Max card-name length, matching the server API card-name cap. */
const MAX_NAME_LENGTH = 200;
/** Max per-card quantity. Guards against absurd counts driving allocation. */
const MAX_QUANTITY = 999;
/** Max raw `.dck` file text length accepted for import. */
const MAX_DCK_TEXT_LENGTH = 200_000;

/** Validate an untrusted quantity as a positive integer in range, or null.
 * Non-integers, NaN, Infinity, and out-of-range values are rejected rather
 * than silently coerced, so a tampered value fails loudly to the caller. */
function sanitizeQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_QUANTITY) return null;
  return value;
}

/** Reject an untrusted card name that is empty or over the length cap. */
function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH;
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
  if (obj.p.length > MAX_POOL_ENTRIES) return null;

  const pool: DeckCard[] = [];
  for (const entry of obj.p) {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      !isValidName(entry[0])
    ) {
      return null;
    }
    const quantity = sanitizeQuantity(entry[1]);
    if (quantity === null) return null;
    pool.push({ name: entry[0], quantity });
  }

  const poolNames = new Set(pool.map((card) => card.name));

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
    // Only accept kept counts for names actually in the pool, sanitized.
    if (!poolNames.has(name)) continue;
    const count = sanitizeQuantity(value);
    if (count !== null) keptQuantities[name] = count;
  }

  const commanders = Array.isArray(obj.c)
    ? obj.c.filter(
        (name): name is string =>
          typeof name === "string" && poolNames.has(name)
      )
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

async function decompressGzip(
  data: Uint8Array,
  maxBytes: number = MAX_DECODED_BYTES
): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const copy = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  // Swallow the write/close promises so that throwing mid-read (below) can't
  // surface an unhandled rejection when the stream tears down.
  const pump = writer
    .write(new Uint8Array(copy))
    .then(() => writer.close())
    .catch(() => {});

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  let totalLen = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalLen += value.length;
      // Bail out mid-stream once the output blows past the cap, so a tiny
      // "gzip bomb" cannot inflate into a memory-exhausting buffer.
      if (totalLen > maxBytes) {
        throw new Error("decompressed payload exceeds maximum size");
      }
      chunks.push(value);
    }
  } finally {
    // Cancel to release stream backpressure so the (swallowed) close settles;
    // both are caught so a mid-read throw never leaks an unhandled rejection.
    await reader.cancel().catch(() => {});
    await pump;
  }

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

// ---------------------------------------------------------------------------
// Forge-style .dck importer
// ---------------------------------------------------------------------------

/** Max commanders honored from an imported file (EDH command zone). Extra
 * `[Commander]` entries still land in the pool as ordinary cards. */
const MAX_DCK_COMMANDERS = 2;
const DCK_CARD_LINE = /^(\d+)\s+(.+?)\s*$/;

/**
 * Parse a Forge-style `.dck` file back into a fresh CruciblePayload: cards from
 * both `[Commander]` and `[Main]` become the pool, the `[Commander]` names are
 * pre-selected (and kept), and everything else starts undecided so the builder
 * re-triages. Returns null for empty, oversized, or unparseable input.
 *
 * `.dck` files are untrusted (uploaded by the user), so the same caps that
 * guard the share-URL decoder apply here: text length, pool size, per-card
 * quantity, and name length.
 */
export function parsePileFromDck(text: string): CruciblePayload | null {
  if (typeof text !== "string" || text.length > MAX_DCK_TEXT_LENGTH) {
    return null;
  }

  // Merge by name (case-insensitive), summing quantity, while preserving the
  // first-seen display casing - mirrors how the pile flattener dedups.
  const byKey = new Map<string, DeckCard>();
  const commanderNames: string[] = [];
  let section: "metadata" | "commander" | "main" | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    const lower = line.toLowerCase();
    if (lower === "[metadata]") {
      section = "metadata";
      continue;
    }
    if (lower === "[commander]") {
      section = "commander";
      continue;
    }
    if (lower === "[main]") {
      section = "main";
      continue;
    }
    if (line.startsWith("[")) {
      // Unknown section (e.g. [Sideboard]); fold its cards into the pool.
      section = "main";
      continue;
    }
    if (section === "metadata" || section === null) continue;

    const match = DCK_CARD_LINE.exec(line);
    if (!match) continue; // skip non-card lines (Name=, comments, etc.)
    const name = match[2].trim();
    if (!isValidName(name)) continue; // skip over-long / empty names
    const quantity = sanitizeQuantity(Number(match[1]));
    if (quantity === null) continue; // skip absurd / non-positive quantities

    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    } else {
      // A genuinely huge distinct-card count signals a hostile file: reject.
      if (byKey.size >= MAX_POOL_ENTRIES) return null;
      byKey.set(key, { name, quantity });
    }
    if (
      section === "commander" &&
      commanderNames.length < MAX_DCK_COMMANDERS &&
      !commanderNames.includes(name)
    ) {
      commanderNames.push(name);
    }
  }

  const pool = Array.from(byKey.values());
  if (pool.length === 0) return null;

  const commanderSet = new Set(commanderNames);
  const statuses: Record<string, CrucibleCardStatus> = {};
  for (const card of pool) {
    statuses[card.name] = commanderSet.has(card.name) ? "keep" : "undecided";
  }

  return {
    crucibleId: generateCrucibleId(),
    pool,
    statuses,
    keptQuantities: {},
    commanders: commanderNames,
    parseWarnings: [],
    createdAt: Date.now(),
  };
}
