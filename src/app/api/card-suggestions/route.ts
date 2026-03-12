import { NextResponse } from "next/server";
import {
  buildScryfallSearchQuery,
  RESULTS_PER_CATEGORY,
  RESULTS_PER_UPGRADE,
  SEARCH_DELAY_MS,
} from "@/lib/card-suggestions";
import type {
  GapDescriptor,
  UpgradeCandidate,
  CardSuggestion,
  CategoryFillRecommendation,
  UpgradeSuggestion,
  SuggestionsApiRequest,
  SuggestionsApiResponse,
} from "@/lib/card-suggestions";
import type { EnrichedCard } from "@/lib/types";
import { fetchScryfallSearch, normalizeToEnrichedCard } from "@/lib/scryfall";

export const dynamic = "force-dynamic";

const MAX_DECK_CARD_NAMES = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converts a ScryfallCard result into a CardSuggestion.
 */
function toCardSuggestion(
  scryfallCard: EnrichedCard,
  category: string
): CardSuggestion {
  const imageUri = scryfallCard.imageUris?.normal ?? null;
  return {
    cardName: scryfallCard.name,
    reason: `Fills the ${category} role`,
    category,
    scryfallUri: `https://scryfall.com/search?q=%21%22${encodeURIComponent(scryfallCard.name)}%22`,
    imageUri,
    manaCost: scryfallCard.manaCost,
    cmc: scryfallCard.cmc,
    typeLine: scryfallCard.typeLine,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const obj = body as Record<string, unknown>;

  // Validate required fields
  if (!Array.isArray(obj.gaps)) {
    return NextResponse.json(
      { error: "Missing required field: gaps (array)" },
      { status: 400 }
    );
  }
  if (!Array.isArray(obj.colorIdentity)) {
    return NextResponse.json(
      { error: "Missing required field: colorIdentity (array)" },
      { status: 400 }
    );
  }
  if (!Array.isArray(obj.deckCardNames)) {
    return NextResponse.json(
      { error: "Missing required field: deckCardNames (array)" },
      { status: 400 }
    );
  }
  if (!Array.isArray(obj.upgradeCandidates)) {
    return NextResponse.json(
      { error: "Missing required field: upgradeCandidates (array)" },
      { status: 400 }
    );
  }

  const req = obj as unknown as SuggestionsApiRequest;

  // Sanitize inputs
  const gaps: GapDescriptor[] = req.gaps
    .filter(
      (g) =>
        g &&
        typeof g.tag === "string" &&
        (g.status === "low" || g.status === "critical")
    )
    .slice(0, 15);

  const colorIdentity: string[] = req.colorIdentity
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toUpperCase())
    .filter((c) => ["W", "U", "B", "R", "G", "C"].includes(c));

  const deckCardNames: string[] = req.deckCardNames
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .slice(0, MAX_DECK_CARD_NAMES);

  // Set for O(1) post-fetch filtering (Scryfall query exclusions are capped
  // at 20, so cards beyond that limit can still appear in results)
  const deckCardNameSet = new Set(deckCardNames.map((n) => n.toLowerCase()));

  const upgradeCandidates: UpgradeCandidate[] = req.upgradeCandidates
    .filter(
      (c) =>
        c &&
        typeof c.cardName === "string" &&
        typeof c.score === "number" &&
        Array.isArray(c.tags)
    )
    .slice(0, 10);

  try {
    // -----------------------------------------------------------------------
    // Phase A: Category fill recommendations
    // -----------------------------------------------------------------------
    const categoryFills: CategoryFillRecommendation[] = [];

    for (let i = 0; i < gaps.length; i++) {
      if (i > 0) await delay(SEARCH_DELAY_MS);

      const gap = gaps[i];
      const query = buildScryfallSearchQuery(
        gap.tag,
        colorIdentity,
        deckCardNames
      );

      if (!query) {
        // Unknown tag — skip
        categoryFills.push({
          tag: gap.tag,
          label: gap.label,
          status: gap.status,
          currentCount: gap.currentCount,
          targetMin: gap.targetMin,
          gap: gap.gap,
          suggestions: [],
        });
        continue;
      }

      let suggestions: CardSuggestion[] = [];
      try {
        const scryfallCards = await fetchScryfallSearch(query, {
          limit: RESULTS_PER_CATEGORY * 3,
        });
        suggestions = scryfallCards
          .map((rawCard) => normalizeToEnrichedCard(rawCard))
          .filter((card) => !deckCardNameSet.has(card.name.toLowerCase()))
          .slice(0, RESULTS_PER_CATEGORY)
          .map((enriched) => toCardSuggestion(enriched, gap.label));
      } catch (err) {
        console.error(
          "[card-suggestions] category fill fetch failed for tag:",
          gap.tag,
          err instanceof Error ? err.message : err
        );
        // Continue with empty suggestions for this category
      }

      categoryFills.push({
        tag: gap.tag,
        label: gap.label,
        status: gap.status,
        currentCount: gap.currentCount,
        targetMin: gap.targetMin,
        gap: gap.gap,
        suggestions,
      });
    }

    // -----------------------------------------------------------------------
    // Phase B: Upgrade suggestions
    // -----------------------------------------------------------------------
    const upgrades: UpgradeSuggestion[] = [];

    for (let i = 0; i < upgradeCandidates.length; i++) {
      if (i > 0 || gaps.length > 0) await delay(SEARCH_DELAY_MS);

      const candidate = upgradeCandidates[i];
      // Use the first functional tag for the upgrade query
      const primaryTag = candidate.tags[0];
      if (!primaryTag) continue;

      const query = buildScryfallSearchQuery(
        primaryTag,
        colorIdentity,
        deckCardNames
      );

      if (!query) continue;

      // Add CMC constraint: suggest equal or cheaper alternatives
      const cmcConstraint = candidate.cmc > 0 ? ` cmc<=${candidate.cmc}` : "";
      const upgQuery = query + cmcConstraint;

      let upgradeCards: CardSuggestion[] = [];
      try {
        const scryfallCards = await fetchScryfallSearch(upgQuery, {
          limit: RESULTS_PER_UPGRADE * 3,
        });
        upgradeCards = scryfallCards
          .map((rawCard) => normalizeToEnrichedCard(rawCard))
          .filter((card) => !deckCardNameSet.has(card.name.toLowerCase()))
          .slice(0, RESULTS_PER_UPGRADE)
          .map((enriched) => toCardSuggestion(enriched, primaryTag));
      } catch (err) {
        console.error(
          "[card-suggestions] upgrade fetch failed for:",
          candidate.cardName,
          err instanceof Error ? err.message : err
        );
      }

      if (upgradeCards.length > 0) {
        upgrades.push({
          existingCard: candidate.cardName,
          existingCmc: candidate.cmc,
          existingTags: candidate.tags,
          upgrades: upgradeCards,
        });
      }
    }

    const response: SuggestionsApiResponse = {
      categoryFills,
      upgrades,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[card-suggestions] unhandled error:", message);
    return NextResponse.json(
      {
        categoryFills: [],
        upgrades: [],
        error: "Failed to fetch card suggestions from Scryfall",
      },
      { status: 502 }
    );
  }
}
