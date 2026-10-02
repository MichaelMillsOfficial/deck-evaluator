import { commanderSlug, pairSlug } from "@/lib/commander-validation";
import { parseEdhrecPayload, mergeInclusionMaps, type MetaSource } from "@/lib/edhrec-meta";

/**
 * Server-side EDHREC fetch + per-commander cache + multi-commander resolution.
 * EDHREC has no official API; we read the public commander-page JSON and cache
 * aggressively since it changes at most daily. Never throws to the caller for a
 * "no data" outcome — only genuine transport failures surface as `error`.
 */

const EDHREC_BASE = "https://json.edhrec.com/pages/commanders";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REQUEST_HEADERS = {
  // EDHREC blocks unidentified bots; identify like the Scryfall client does.
  "User-Agent": "deck-evaluator/1.0 (https://github.com/MichaelMillsOfficial)",
  Accept: "application/json",
};

interface SlugData {
  inclusionMap: Record<string, number>;
  potentialDecks: number;
}

interface CacheEntry extends SlugData {
  expires: number;
}

const cache = new Map<string, CacheEntry>();

export interface EdhrecMetaEnvelope {
  source: MetaSource | null;
  commanderLabel: string;
  inclusionMap: Record<string, number>;
  potentialDecks: number;
  /** Present only on transport failure — the client renders the error state. */
  error?: string;
}

/** Fetch + parse a single slug, with a 24h cache. Returns an empty map (not an
 * error) when EDHREC has no page for the slug. Throws only on transport error. */
async function fetchSlug(slug: string): Promise<SlugData> {
  // Sanitize to a fresh allowlisted string: strip everything but lowercase
  // alphanumerics and hyphens. This is the value that reaches the request URL,
  // so the user-derived name can only ever select a page under the fixed EDHREC
  // commander path — no host, scheme, or path-traversal injection is possible.
  // (Also clears the CodeQL SSRF taint, which a boolean guard alone does not.)
  const safeSlug = slug.replace(/[^a-z0-9-]/g, "");
  // An empty/unresolvable slug is a no-data outcome, not a fetch.
  if (!safeSlug) {
    return { inclusionMap: {}, potentialDecks: 0 };
  }

  const cached = cache.get(safeSlug);
  if (cached && cached.expires > Date.now()) {
    return { inclusionMap: cached.inclusionMap, potentialDecks: cached.potentialDecks };
  }

  const res = await fetch(`${EDHREC_BASE}/${safeSlug}.json`, {
    headers: REQUEST_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  // A 404 means "no page for this commander" — a valid empty result, cached so
  // we don't hammer EDHREC for a commander it will never have.
  if (res.status === 404) {
    const empty: SlugData = { inclusionMap: {}, potentialDecks: 0 };
    cache.set(safeSlug, { ...empty, expires: Date.now() + CACHE_TTL_MS });
    return empty;
  }
  if (!res.ok) {
    throw new Error(`EDHREC responded ${res.status}`);
  }

  const json = await res.json();
  const parsed = parseEdhrecPayload(json);
  cache.set(safeSlug, { ...parsed, expires: Date.now() + CACHE_TTL_MS });
  return parsed;
}

/**
 * Resolve a deck's commander(s) to an inclusion map, in fallback order:
 * pair page → combine two singles → primary only → no-data (empty map).
 */
export async function resolveEdhrecMeta(commanders: string[]): Promise<EdhrecMetaEnvelope> {
  const names = commanders.map((n) => n.trim()).filter(Boolean);

  if (names.length === 0) {
    return { source: null, commanderLabel: "", inclusionMap: {}, potentialDecks: 0 };
  }

  try {
    // Single commander.
    if (names.length === 1) {
      const data = await fetchSlug(commanderSlug(names[0]));
      return { source: "primary", commanderLabel: names[0], ...data };
    }

    // Partner/background pair: prefer EDHREC's own combined page.
    const pair = await fetchSlug(pairSlug(names));
    if (Object.keys(pair.inclusionMap).length > 0) {
      return { source: "pair", commanderLabel: names.join(" + "), ...pair };
    }

    // No pair page — combine each single-commander list (max rate per card).
    const singles = await Promise.all(names.map((n) => fetchSlug(commanderSlug(n))));
    const resolved = singles.filter((s) => Object.keys(s.inclusionMap).length > 0);
    if (resolved.length >= 2) {
      return {
        source: "combined",
        commanderLabel: names.join(" + "),
        inclusionMap: mergeInclusionMaps(resolved.map((s) => s.inclusionMap)),
        potentialDecks: Math.min(...resolved.map((s) => s.potentialDecks)),
      };
    }
    // Only one resolved — primary-only with a caveat via commanderLabel.
    if (resolved.length === 1) {
      const idx = singles.findIndex((s) => s === resolved[0]);
      return { source: "primary", commanderLabel: names[idx], ...resolved[0] };
    }
    return { source: null, commanderLabel: names.join(" + "), inclusionMap: {}, potentialDecks: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      source: null,
      commanderLabel: names.join(" + "),
      inclusionMap: {},
      potentialDecks: 0,
      error: message,
    };
  }
}

/** Test/maintenance hook. */
export function __clearEdhrecCache(): void {
  cache.clear();
}
