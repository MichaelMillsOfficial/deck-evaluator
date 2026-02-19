// Scryfall API client — stubbed for Phase 1.
// Phase 2 will use this for card data enrichment.
// Rate limit: max 10 req/sec, 50-100ms delay between requests.
// See: https://scryfall.com/docs/api

const SCRYFALL_API_BASE = "https://api.scryfall.com";

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
}

export async function fetchCardByName(
  name: string
): Promise<ScryfallCard | null> {
  const res = await fetch(
    `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(name)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall API error: ${res.status}`);

  return res.json() as Promise<ScryfallCard>;
}
