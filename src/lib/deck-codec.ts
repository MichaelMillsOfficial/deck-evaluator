// ---------------------------------------------------------------------------
// Deck Codec — serialize/deserialize deck payloads for share URLs
// Uses CompressionStream (browser API) for gzip compression
// ---------------------------------------------------------------------------

interface DeckPayload {
  t: string;       // decklist text
  c?: string[];    // commander names
}

export function serializePayload(text: string, commanders?: string[]): string {
  const payload: DeckPayload = { t: text };
  if (commanders && commanders.length > 0) {
    payload.c = commanders;
  }
  return JSON.stringify(payload);
}

export function deserializePayload(json: string): {
  text: string;
  commanders?: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON payload");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as DeckPayload).t !== "string"
  ) {
    throw new Error("Invalid payload: missing or invalid 't' field");
  }

  const p = parsed as DeckPayload;
  return {
    text: p.t,
    commanders: Array.isArray(p.c) ? p.c : undefined,
  };
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
// Encode/Decode with CompressionStream
// ---------------------------------------------------------------------------

export async function encodeDeckPayload(
  text: string,
  commanders?: string[]
): Promise<string> {
  const json = serializePayload(text, commanders);
  const encoded = new TextEncoder().encode(json);

  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(encoded);
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

  return toBase64Url(compressed);
}

export async function decodeDeckPayload(
  encoded: string
): Promise<{ text: string; commanders?: string[] }> {
  const compressed = fromBase64Url(encoded);

  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed.buffer as ArrayBuffer));
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

  const json = new TextDecoder().decode(decompressed);
  return deserializePayload(json);
}
