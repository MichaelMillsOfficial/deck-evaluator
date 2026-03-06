const SCRYFALL_SEARCH = "https://api.scryfall.com/cards/search";
const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface ScryfallListPage {
  data: { name: string; oracle_text?: string }[];
  has_more: boolean;
  next_page?: string;
}

interface CachedRules {
  banned: string[];
  gameChangers: { name: string; oracleText: string }[];
  fetchedAt: number;
}

let cachedRules: CachedRules | null = null;
let inflight: Promise<CachedRules> | null = null;

/**
 * Paginate through a Scryfall search query, collecting all card names.
 * Includes pagination limit, timeout, and rate-limit retry.
 */
async function fetchAllNames(
  query: string
): Promise<{ name: string; oracleText: string }[]> {
  const results: { name: string; oracleText: string }[] = [];
  let url: string | null = `${SCRYFALL_SEARCH}?q=${encodeURIComponent(query)}`;
  let pages = 0;

  while (url) {
    if (++pages > MAX_PAGES) {
      console.warn(`[commander-rules] pagination limit (${MAX_PAGES}) reached for query: ${query}`);
      break;
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "DeckEvaluator/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 404) break; // no results

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "", 10);
      const delayMs = (Number.isFinite(retryAfter) ? retryAfter : 1) * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
      // Retry the same page (don't increment pages counter)
      pages--;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Scryfall search failed: ${res.status}`);
    }

    const page: ScryfallListPage = await res.json();
    for (const card of page.data) {
      results.push({
        name: card.name,
        oracleText: card.oracle_text ?? "",
      });
    }
    url = page.has_more && page.next_page ? page.next_page : null;
  }

  return results;
}

async function fetchRules(): Promise<CachedRules> {
  const [bannedCards, gameChangerCards] = await Promise.all([
    fetchAllNames("banned:commander"),
    fetchAllNames(
      'o:"a deck can have any number of cards named" or o:"a deck can have up to seven cards named"'
    ),
  ]);

  return {
    banned: bannedCards.map((c) => c.name),
    gameChangers: gameChangerCards.map((c) => ({
      name: c.name,
      oracleText: c.oracleText,
    })),
    fetchedAt: Date.now(),
  };
}

export async function GET(): Promise<Response> {
  try {
    // Return cached data if still fresh
    if (cachedRules && Date.now() - cachedRules.fetchedAt < CACHE_TTL_MS) {
      return Response.json(
        { banned: cachedRules.banned, gameChangers: cachedRules.gameChangers },
        { headers: { "Cache-Control": "public, max-age=14400" } }
      );
    }

    // Deduplicate concurrent requests
    if (!inflight) {
      inflight = fetchRules().finally(() => {
        inflight = null;
      });
    }

    cachedRules = await inflight;

    return Response.json(
      { banned: cachedRules.banned, gameChangers: cachedRules.gameChangers },
      { headers: { "Cache-Control": "public, max-age=14400" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[commander-rules] error:", message);
    return Response.json(
      { error: "Failed to fetch Commander rules from Scryfall" },
      { status: 502 }
    );
  }
}
