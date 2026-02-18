import type { NextRequest } from "next/server";
import type { DeckData } from "@/lib/types";
import {
  isArchidektUrl,
  extractArchidektDeckId,
  fetchArchidektDeck,
  normalizeArchidektCards,
} from "@/lib/archidekt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const deckUrl = request.nextUrl.searchParams.get("url");

  if (!deckUrl) {
    return Response.json(
      { error: "Missing required query parameter: url" },
      { status: 400 }
    );
  }

  let trimmedUrl: string;
  try {
    const parsed = new URL(deckUrl);
    trimmedUrl = parsed.href;
  } catch {
    return Response.json({ error: "Invalid URL format" }, { status: 400 });
  }

  try {
    if (isArchidektUrl(trimmedUrl)) {
      const deckId = extractArchidektDeckId(trimmedUrl);
      if (!deckId) {
        return Response.json(
          { error: "Could not extract Archidekt deck ID from URL" },
          { status: 400 }
        );
      }

      const raw = await fetchArchidektDeck(deckId);
      const { commanders, mainboard, sideboard } =
        normalizeArchidektCards(raw);

      const deckData: DeckData = {
        name: raw.name,
        source: "archidekt",
        url: trimmedUrl,
        commanders,
        mainboard,
        sideboard,
      };

      return Response.json(deckData);
    } else {
      return Response.json(
        {
          error:
            "Unsupported deck URL. Only Archidekt URLs are supported. For Moxfield decks, use the \"Paste Decklist\" tab to paste your exported decklist.",
        },
        { status: 422 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[deck API] fetch error:", message);
    return Response.json(
      { error: `Failed to fetch deck: ${message}` },
      { status: 502 }
    );
  }
}
