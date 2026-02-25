import type { DeckData, EnrichedCard } from "./types";
import { generateTags } from "./card-tags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProbabilityPoint {
  turn: number;
  probability: number;
}

export interface PrecomputedQuery {
  label: string;
  description: string;
  probability: number;
  category: string;
  successCount: number;
  drawCount: number;
  desiredSuccesses: number;
}

export interface AvailableCategory {
  label: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Log-space binomial coefficient
// ---------------------------------------------------------------------------

/**
 * Compute log(C(n, k)) in log-space to avoid integer overflow.
 * Returns -Infinity when k > n, k < 0, or the combination is impossible.
 *
 * Uses log-gamma (Stirling-like) via the log-factorial approach:
 *   logC(n,k) = logFactorial(n) - logFactorial(k) - logFactorial(n-k)
 *
 * We compute log(n!) as sum of log(i) for i in 1..n.
 * For large values, this is exact enough for our purposes.
 */
export function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0; // log(1) = 0

  // Symmetry optimization: C(n,k) = C(n, n-k)
  const kk = k > n - k ? n - k : k;

  // Compute log(C(n,k)) = sum_{i=0}^{k-1} log(n - i) - log(i + 1)
  let result = 0;
  for (let i = 0; i < kk; i++) {
    result += Math.log(n - i) - Math.log(i + 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hypergeometric PMF — P(X = k)
// ---------------------------------------------------------------------------

/**
 * Hypergeometric probability mass function.
 *
 * Models drawing n cards from a deck of N total cards, of which K are
 * "successes". Returns the probability of drawing exactly k successes.
 *
 * P(X = k) = C(K,k) * C(N-K, n-k) / C(N,n)
 *
 * Computation is done in log-space to avoid overflow.
 */
export function hypergeometricPmf(
  N: number, // population size (deck size)
  K: number, // success states in population (e.g. lands)
  n: number, // draws (cards seen)
  k: number  // desired successes
): number {
  // Validate inputs
  if (k < 0 || k > K || k > n || n - k > N - K) return 0;
  if (n === 0 && k === 0) return 1;
  if (n === 0) return 0;

  const logP =
    logChoose(K, k) +
    logChoose(N - K, n - k) -
    logChoose(N, n);

  if (!isFinite(logP)) return 0;
  return Math.exp(logP);
}

// ---------------------------------------------------------------------------
// Hypergeometric CDF — P(X >= k)
// ---------------------------------------------------------------------------

/**
 * Cumulative probability P(X >= k), i.e. the chance of drawing at least
 * k successes from a deck of N cards (with K successes) when drawing n cards.
 *
 * Computed as: 1 - P(X < k) = 1 - sum_{i=0}^{k-1} P(X = i)
 */
export function hypergeometricCdf(
  N: number, // deck size
  K: number, // successes in deck
  n: number, // cards drawn
  k: number  // minimum successes desired
): number {
  if (k <= 0) return 1.0;
  if (K === 0) return 0;

  // Clamp n to valid range
  const draws = Math.min(n, N);

  // P(X >= k) = 1 - P(X < k)
  let pLessThanK = 0;
  for (let i = 0; i < k; i++) {
    pLessThanK += hypergeometricPmf(N, K, draws, i);
  }

  return Math.max(0, Math.min(1, 1 - pLessThanK));
}

// ---------------------------------------------------------------------------
// Probability curve across turns
// ---------------------------------------------------------------------------

/**
 * Compute the probability of drawing at least `kMin` successes for each
 * turn from 1 to maxTurns.
 *
 * At turn T, you have seen: openingHandSize + (T - 1) cards.
 * (Opening hand is drawn at turn 1; one card drawn each subsequent turn.)
 */
export function computeProbabilityCurve(
  N: number,            // deck size
  K: number,            // successes in deck
  kMin: number,         // minimum successes desired
  maxTurns: number,     // how many turns to compute
  openingHandSize = 7   // typically 7 for Commander
): ProbabilityPoint[] {
  const points: ProbabilityPoint[] = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const draws = openingHandSize + (turn - 1);
    const probability = hypergeometricCdf(N, K, draws, kMin);
    points.push({ turn, probability });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Deck query helpers
// ---------------------------------------------------------------------------

/**
 * Get all cards (commanders + mainboard) — excludes sideboard since those
 * cards are not in the library at game start.
 */
function getLibraryCards(deck: DeckData) {
  return [...deck.commanders, ...deck.mainboard];
}

/**
 * Count the total quantity of cards in the library (commanders + mainboard).
 * Sideboard is excluded.
 */
export function getDeckSize(deck: DeckData): number {
  return getLibraryCards(deck).reduce((sum, c) => sum + c.quantity, 0);
}

/**
 * Count the total quantity of cards with the given tag in the library.
 * Uses `generateTags` from card-tags.ts for consistency.
 */
export function countCardsByTag(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tag: string
): number {
  return getLibraryCards(deck).reduce((sum, card) => {
    const enriched = cardMap[card.name];
    if (!enriched) return sum;
    const tags = generateTags(enriched);
    return tags.includes(tag) ? sum + card.quantity : sum;
  }, 0);
}

/**
 * Count the quantity of a specific card in the library (by name).
 */
export function countCardsByName(deck: DeckData, cardName: string): number {
  return getLibraryCards(deck)
    .filter((c) => c.name === cardName)
    .reduce((sum, c) => sum + c.quantity, 0);
}

/**
 * Count how many lands are in the library.
 * Lands are identified by their type line containing "Land".
 */
function countLands(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  return getLibraryCards(deck).reduce((sum, card) => {
    const enriched = cardMap[card.name];
    if (!enriched) return sum;
    return enriched.typeLine.includes("Land") ? sum + card.quantity : sum;
  }, 0);
}

// ---------------------------------------------------------------------------
// Pre-computed queries
// ---------------------------------------------------------------------------

/**
 * Auto-generate standard probability queries for a deck.
 *
 * Queries:
 * 1. "3+ lands in opening 7" — P(X >= 3) from 7 draws
 * 2. "At least 1 ramp by turn 3" — P(X >= 1) from 9 draws
 * 3. "At least 1 removal by turn 5" — P(X >= 1) from 11 draws
 * 4. "At least 1 card draw by turn 4" — P(X >= 1) from 10 draws
 *
 * Queries are skipped when category count is 0.
 */
export function computePrecomputedQueries(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): PrecomputedQuery[] {
  const N = getDeckSize(deck);
  if (N === 0) return [];

  const queries: PrecomputedQuery[] = [];

  // 1. Land drops — P(X >= 3) in opening hand (7 draws)
  const landCount = countLands(deck, cardMap);
  if (landCount > 0) {
    queries.push({
      label: "3+ Lands in Opening 7",
      description: `${landCount} lands in deck — P(≥3 lands) in opening hand`,
      probability: hypergeometricCdf(N, landCount, 7, 3),
      category: "Lands",
      successCount: landCount,
      drawCount: 7,
      desiredSuccesses: 3,
    });
  }

  // 2. Ramp by turn 3 — 9 cards drawn (7 opening + 2 draws)
  const rampCount = countCardsByTag(deck, cardMap, "Ramp");
  if (rampCount > 0) {
    queries.push({
      label: "Ramp by Turn 3",
      description: `${rampCount} ramp spells — P(≥1 ramp) by turn 3`,
      probability: hypergeometricCdf(N, rampCount, 9, 1),
      category: "Ramp",
      successCount: rampCount,
      drawCount: 9,
      desiredSuccesses: 1,
    });
  }

  // 3. Removal by turn 5 — 11 cards drawn (7 opening + 4 draws)
  const removalCount = countCardsByTag(deck, cardMap, "Removal");
  if (removalCount > 0) {
    queries.push({
      label: "Removal by Turn 5",
      description: `${removalCount} removal spells — P(≥1 removal) by turn 5`,
      probability: hypergeometricCdf(N, removalCount, 11, 1),
      category: "Removal",
      successCount: removalCount,
      drawCount: 11,
      desiredSuccesses: 1,
    });
  }

  // 4. Card draw by turn 4 — 10 cards drawn (7 opening + 3 draws)
  const drawCount = countCardsByTag(deck, cardMap, "Card Draw");
  if (drawCount > 0) {
    queries.push({
      label: "Card Draw by Turn 4",
      description: `${drawCount} card draw spells — P(≥1 draw) by turn 4`,
      probability: hypergeometricCdf(N, drawCount, 10, 1),
      category: "Card Draw",
      successCount: drawCount,
      drawCount: 10,
      desiredSuccesses: 1,
    });
  }

  return queries;
}

// ---------------------------------------------------------------------------
// Available categories for the custom query builder
// ---------------------------------------------------------------------------

/**
 * Return all tag categories present in the deck (count > 0), sorted by
 * count descending. "Lands" is always checked first.
 */
export function getAvailableCategories(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): AvailableCategory[] {
  const N = getDeckSize(deck);
  if (N === 0) return [];

  const categories: AvailableCategory[] = [];

  // Always check Lands first
  const landCount = countLands(deck, cardMap);
  if (landCount > 0) {
    categories.push({ label: "Lands", count: landCount });
  }

  // All tag categories from card-tags.ts
  const tagLabels = [
    "Ramp",
    "Card Draw",
    "Card Advantage",
    "Removal",
    "Board Wipe",
    "Counterspell",
    "Tutor",
    "Cost Reduction",
    "Protection",
    "Recursion",
  ];

  for (const tag of tagLabels) {
    const count = countCardsByTag(deck, cardMap, tag);
    if (count > 0) {
      categories.push({ label: tag, count });
    }
  }

  // Sort by count descending
  categories.sort((a, b) => b.count - a.count);

  return categories;
}
