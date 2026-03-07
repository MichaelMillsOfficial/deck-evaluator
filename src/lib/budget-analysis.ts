import type { DeckData, EnrichedCard } from "./types";
import { parseTypeLine } from "./mana";
import { getTagsCached } from "./card-tags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardPriceEntry {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PriceDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface TypePriceSummary {
  type: string;
  totalCost: number;
  cardCount: number;
  averagePrice: number;
}

export interface RolePriceSummary {
  tag: string;
  totalCost: number;
  cardCount: number;
  averagePrice: number;
}

export interface BudgetAnalysisResult {
  totalCost: number;
  totalCostFormatted: string;
  averagePricePerCard: number;
  medianPricePerCard: number;
  unknownPriceCount: number;
  mostExpensive: CardPriceEntry[];
  distribution: PriceDistributionBucket[];
  byType: TypePriceSummary[];
  byRole: RolePriceSummary[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PRICE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "$0-1", min: 0, max: 1 },
  { label: "$1-5", min: 1, max: 5 },
  { label: "$5-10", min: 5, max: 10 },
  { label: "$10-25", min: 10, max: 25 },
  { label: "$25-50", min: 25, max: 50 },
  { label: "$50+", min: 50, max: Infinity },
];

const CARD_TYPES = [
  "Creature",
  "Land",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Planeswalker",
  "Battle",
  "Kindred",
];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Determines the mutually exclusive type bucket for a card.
 * Priority: Creature > Land > leftmost card type.
 */
export function getCardTypeBucket(typeLine: string): string {
  const { cardType } = parseTypeLine(typeLine);
  const types = cardType.split(/\s+/).filter(Boolean);

  if (types.includes("Creature")) return "Creature";
  if (types.includes("Land")) return "Land";

  for (const t of types) {
    if (CARD_TYPES.includes(t)) return t;
  }

  return "Other";
}

/**
 * Builds a sorted list of cards with prices (sorted by totalPrice desc).
 * Cards without USD prices are excluded.
 */
export function buildCardPriceList(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): CardPriceEntry[] {
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
  const entries: CardPriceEntry[] = [];

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || enriched.prices.usd == null) continue;

    entries.push({
      name: card.name,
      quantity: card.quantity,
      unitPrice: enriched.prices.usd,
      totalPrice: enriched.prices.usd * card.quantity,
    });
  }

  entries.sort((a, b) => b.totalPrice - a.totalPrice);
  return entries;
}

/**
 * Assigns cards into price distribution buckets by unit price.
 */
export function computePriceDistribution(
  priceList: CardPriceEntry[]
): PriceDistributionBucket[] {
  const buckets: PriceDistributionBucket[] = PRICE_BUCKETS.map((b) => ({
    ...b,
    count: 0,
  }));

  for (const entry of priceList) {
    for (const bucket of buckets) {
      if (
        entry.unitPrice >= bucket.min &&
        (bucket.max === Infinity || entry.unitPrice < bucket.max)
      ) {
        bucket.count += entry.quantity;
        break;
      }
    }
  }

  return buckets;
}

/**
 * Computes spending by card type (mutually exclusive).
 */
export function computePriceByType(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): TypePriceSummary[] {
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
  const typeMap = new Map<string, { totalCost: number; cardCount: number }>();

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || enriched.prices.usd == null) continue;

    const bucket = getCardTypeBucket(enriched.typeLine);
    const existing = typeMap.get(bucket) ?? { totalCost: 0, cardCount: 0 };
    existing.totalCost += enriched.prices.usd * card.quantity;
    existing.cardCount += card.quantity;
    typeMap.set(bucket, existing);
  }

  const result: TypePriceSummary[] = [];
  for (const [type, data] of typeMap) {
    if (data.totalCost > 0) {
      result.push({
        type,
        totalCost: data.totalCost,
        cardCount: data.cardCount,
        averagePrice: data.totalCost / data.cardCount,
      });
    }
  }

  result.sort((a, b) => b.totalCost - a.totalCost);
  return result;
}

/**
 * Computes spending by role (tag-based, cards can overlap).
 */
export function computePriceByRole(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): RolePriceSummary[] {
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
  const roleMap = new Map<string, { totalCost: number; cardCount: number }>();

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || enriched.prices.usd == null) continue;

    const tags = getTagsCached(enriched, tagCache);
    if (tags.length === 0) continue;

    for (const tag of tags) {
      const existing = roleMap.get(tag) ?? { totalCost: 0, cardCount: 0 };
      existing.totalCost += enriched.prices.usd * card.quantity;
      existing.cardCount += card.quantity;
      roleMap.set(tag, existing);
    }
  }

  const result: RolePriceSummary[] = [];
  for (const [tag, data] of roleMap) {
    if (data.totalCost > 0) {
      result.push({
        tag,
        totalCost: data.totalCost,
        cardCount: data.cardCount,
        averagePrice: data.totalCost / data.cardCount,
      });
    }
  }

  result.sort((a, b) => b.totalCost - a.totalCost);
  return result;
}

/**
 * Computes the median unit price from a price list.
 */
export function computeMedianPrice(priceList: CardPriceEntry[]): number {
  if (priceList.length === 0) return 0;

  const sorted = [...priceList].sort((a, b) => a.unitPrice - b.unitPrice);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1].unitPrice + sorted[mid].unitPrice) / 2;
  }

  return sorted[mid].unitPrice;
}

/**
 * Formats a number as USD currency.
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Orchestrates all budget analysis sub-functions.
 */
export function computeBudgetAnalysis(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): BudgetAnalysisResult {
  const priceList = buildCardPriceList(deck, cardMap);
  const totalCost = priceList.reduce((sum, e) => sum + e.totalPrice, 0);

  // Count cards without price data
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
  let unknownPriceCount = 0;
  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || enriched.prices.usd == null) {
      unknownPriceCount += card.quantity;
    }
  }

  const pricedCardCount = priceList.reduce((sum, e) => sum + e.quantity, 0);

  return {
    totalCost,
    totalCostFormatted: formatUSD(totalCost),
    averagePricePerCard: pricedCardCount > 0 ? totalCost / pricedCardCount : 0,
    medianPricePerCard: computeMedianPrice(priceList),
    unknownPriceCount,
    mostExpensive: priceList,
    distribution: computePriceDistribution(priceList),
    byType: computePriceByType(deck, cardMap),
    byRole: computePriceByRole(deck, cardMap, tagCache),
  };
}
