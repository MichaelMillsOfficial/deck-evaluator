const SCRYFALL_SEARCH = "https://api.scryfall.com/cards/search";

interface ScryfallListPage {
  data: { name: string; oracle_text?: string }[];
  has_more: boolean;
  next_page?: string;
}

/**
 * Paginate through a Scryfall search query, collecting all card names.
 */
async function fetchAllNames(
  query: string
): Promise<{ name: string; oracleText: string }[]> {
  const results: { name: string; oracleText: string }[] = [];
  let url: string | null = `${SCRYFALL_SEARCH}?q=${encodeURIComponent(query)}`;

  while (url) {
    const res = await fetch(url, {
      headers: { "User-Agent": "DeckEvaluator/1.0" },
    });

    if (res.status === 404) break; // no results

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

export async function GET(): Promise<Response> {
  try {
    const [bannedCards, gameChangerCards] = await Promise.all([
      fetchAllNames("banned:commander"),
      fetchAllNames(
        'o:"a deck can have any number of cards named" or o:"a deck can have up to seven cards named"'
      ),
    ]);

    const banned = bannedCards.map((c) => c.name);
    const gameChangers = gameChangerCards.map((c) => ({
      name: c.name,
      oracleText: c.oracleText,
    }));

    return Response.json({ banned, gameChangers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[commander-rules] error:", message);
    return Response.json(
      { error: "Failed to fetch Commander rules from Scryfall" },
      { status: 502 }
    );
  }
}
