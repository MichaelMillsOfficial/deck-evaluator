import type { DeckData } from "./types";

// ---------------------------------------------------------------------------
// Commander Spellbook API Request Types
// ---------------------------------------------------------------------------

export interface SpellbookCardRequest {
  card: string;
  quantity: number;
}

export interface SpellbookDeckRequest {
  main: SpellbookCardRequest[];
  commanders: SpellbookCardRequest[];
}

// ---------------------------------------------------------------------------
// Commander Spellbook API Response Types
// ---------------------------------------------------------------------------

export interface SpellbookCard {
  id: number;
  name: string;
  oracleId: string | null;
  typeLine: string;
  oracleText: string;
  manaValue: number;
  identity: string;
}

export interface SpellbookFeature {
  feature: { id: number; name: string };
  quantity: number;
}

export interface SpellbookCardInVariant {
  card: SpellbookCard;
  zoneLocations: string[];
  battlefieldCardState: string;
  mustBeCommander: boolean;
  quantity: number;
}

export interface SpellbookTemplateInVariant {
  template: { id: number; name: string; scryfallQuery: string | null };
  zoneLocations: string[];
  quantity: number;
}

export interface SpellbookVariant {
  id: string;
  status: string;
  uses: SpellbookCardInVariant[];
  requires: SpellbookTemplateInVariant[];
  produces: SpellbookFeature[];
  identity: string;
  manaNeeded: string;
  manaValueNeeded: number;
  description: string;
  bracketTag: string;
  prices: { tcgplayer: string; cardkingdom: string; cardmarket: string };
}

export interface SpellbookFindMyCombosResponse {
  results: {
    identity: string;
    included: SpellbookVariant[];
    almostIncluded: SpellbookVariant[];
    almostIncludedByAddingColors: SpellbookVariant[];
    includedByChangingCommanders: SpellbookVariant[];
    almostIncludedByChangingCommanders: SpellbookVariant[];
    almostIncludedByAddingColorsAndChangingCommanders: SpellbookVariant[];
  };
}

// ---------------------------------------------------------------------------
// Normalized Internal Types
// ---------------------------------------------------------------------------

export interface SpellbookCombo {
  id: string;
  cards: string[];
  description: string;
  produces: string[];
  missingCards: string[];
  templateRequirements: string[];
  manaNeeded: string;
  bracketTag: string;
  identity: string;
  type: "exact" | "near";
}

// ---------------------------------------------------------------------------
// Request Building
// ---------------------------------------------------------------------------

/**
 * Build a Commander Spellbook API request from a DeckData object.
 * Maps commanders and mainboard to the API format, excludes sideboard.
 */
export function buildSpellbookRequest(deck: DeckData): SpellbookDeckRequest {
  return {
    commanders: deck.commanders.map((c) => ({
      card: c.name,
      quantity: c.quantity,
    })),
    main: deck.mainboard.map((c) => ({
      card: c.name,
      quantity: c.quantity,
    })),
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const SPELLBOOK_API_URL =
  "https://backend.commanderspellbook.com/find-my-combos/";
const SPELLBOOK_TIMEOUT = 15_000;

/**
 * POST to Commander Spellbook API to find combos for a given deck.
 * Throws on non-200 response or network error.
 */
export async function fetchSpellbookCombos(
  request: SpellbookDeckRequest,
  signal?: AbortSignal
): Promise<SpellbookFindMyCombosResponse> {
  const fetchSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(SPELLBOOK_TIMEOUT)])
    : AbortSignal.timeout(SPELLBOOK_TIMEOUT);

  const res = await fetch(SPELLBOOK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: fetchSignal,
  });

  if (!res.ok) {
    throw new Error(
      `Commander Spellbook API returned ${res.status}: ${res.statusText}`
    );
  }

  return res.json() as Promise<SpellbookFindMyCombosResponse>;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a single SpellbookVariant into our internal SpellbookCombo type.
 * Computes missingCards by diffing variant card names against deck card names.
 */
export function normalizeVariant(
  variant: SpellbookVariant,
  deckCardNames: Set<string>
): SpellbookCombo {
  // Extract unique card names from uses
  const cardNames: string[] = [];
  const seen = new Set<string>();
  for (const use of variant.uses) {
    if (!seen.has(use.card.name)) {
      seen.add(use.card.name);
      cardNames.push(use.card.name);
    }
  }

  // Compute missing cards
  const missingCards = cardNames.filter((name) => !deckCardNames.has(name));

  // Map produces features to readable strings
  const produces = variant.produces.map((p) => p.feature.name);

  // Extract template requirements
  const templateRequirements = variant.requires.map((r) => r.template.name);

  return {
    id: variant.id,
    cards: cardNames,
    description: variant.description,
    produces,
    missingCards,
    templateRequirements,
    manaNeeded: variant.manaNeeded,
    bracketTag: variant.bracketTag,
    identity: variant.identity,
    type: missingCards.length === 0 ? "exact" : "near",
  };
}

const NEAR_COMBOS_CAP = 20;
const NEAR_COMBOS_MAX_MISSING = 2;

/**
 * Normalize the full Commander Spellbook API response into categorized combos.
 * - `included` variants become exactCombos
 * - `almostIncluded` variants become nearCombos
 * - Filters out variants with status "NW" (not working)
 * - Filters out near combos where no combo cards are in the deck
 * - Filters out near combos missing more than 2 cards
 * - Sorts exact by card count ascending
 * - Sorts near by missing count ascending, then card count ascending
 * - Caps near combos at 20 results
 */
export function normalizeSpellbookResponse(
  response: SpellbookFindMyCombosResponse,
  deckCardNames: Set<string>
): { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] } {
  const workingFilter = (v: SpellbookVariant) => v.status !== "NW";

  const exactCombos = response.results.included
    .filter(workingFilter)
    .map((v) => normalizeVariant(v, deckCardNames))
    .sort((a, b) => a.cards.length - b.cards.length);

  const nearCombos = response.results.almostIncluded
    .filter(workingFilter)
    .map((v) => normalizeVariant(v, deckCardNames))
    .filter((combo) => {
      // Must have at least 1 combo card already in the deck
      if (combo.cards.length > 0 && combo.missingCards.length === combo.cards.length) {
        return false;
      }
      // Only show combos missing at most 2 cards
      if (combo.missingCards.length > NEAR_COMBOS_MAX_MISSING) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const missingDiff = a.missingCards.length - b.missingCards.length;
      if (missingDiff !== 0) return missingDiff;
      return a.cards.length - b.cards.length;
    })
    .slice(0, NEAR_COMBOS_CAP);

  return { exactCombos, nearCombos };
}
