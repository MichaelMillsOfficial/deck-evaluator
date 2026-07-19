import type { DeckData } from "@/lib/types";

/**
 * EDHREC "Stock ↔ Spicy" meta scoring.
 *
 * Given a commander's per-card inclusion rates (fraction of registered decks
 * that run each card, 0..1), we read how *conventional* a deck's choices are.
 * The framing is always a neutral Stock ↔ Spicy spectrum — never a graded
 * score. The payoff is surfacing which cards are the builder's spice, not
 * judging the aggregate.
 *
 * This module is pure (no fetch) so it stays unit-testable; the network + cache
 * layer lives in `src/app/api/deck-meta/route.ts`.
 */

export type MetaBand = "staple" | "standard" | "niche" | "spice";
export type MetaSource = "pair" | "combined" | "primary";
export type MetaStatus = "ok" | "thin" | "no-data" | "error";
export type MetaLens = "coverage" | "percentile" | "mean";

export interface CardInclusion {
  name: string;
  /** Inclusion rate 0..1 (0 when EDHREC has never seen the card). */
  inclusion: number;
  band: MetaBand;
}

export interface DeckMetaResult {
  status: MetaStatus;
  source: MetaSource | null;
  /** Human label for the commander(s) the score is based on. */
  commanderLabel: string;
  /** Sample size (potential_decks) — powers the low-confidence gate. */
  potentialDecks: number;
  /** One entry per scored (non-land, non-commander) deck card. */
  cards: CardInclusion[];
  /** Staple coverage: how many of the top-N staples the deck runs. */
  coverage: { pct: number; have: number; of: number };
  /** Count of scored cards below the spice threshold. */
  spiceCount: number;
  /** Mean inclusion across the scored set (0..1). */
  meanInclusion: number;
  /** Approximate rank vs the commander's inclusion distribution (0..100). */
  fieldPercentile: number;
  bandCounts: Record<MetaBand, number>;
}

/** Number of top staples used for the coverage axis. */
export const COVERAGE_TOP_N = 30;
/** Below this `potential_decks`, the read is flagged low-confidence. */
export const THIN_SAMPLE_THRESHOLD = 100;
/** Inclusion at or below this is "spice". */
export const SPICE_MAX = 0.1;

const BASIC_LANDS = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
  "snow-covered plains",
  "snow-covered island",
  "snow-covered swamp",
  "snow-covered mountain",
  "snow-covered forest",
]);

/** Normalize a card name for matching against EDHREC's list: lowercase, trim,
 * and take the front face of a `A // B` split card. */
export function normalizeCardName(name: string): string {
  return name.split(" // ")[0].trim().toLowerCase();
}

export function isBasicLandName(name: string): boolean {
  return BASIC_LANDS.has(normalizeCardName(name));
}

export function bandFor(inclusion: number): MetaBand {
  if (inclusion >= 0.9) return "staple";
  if (inclusion >= 0.5) return "standard";
  if (inclusion >= 0.1) return "niche";
  return "spice";
}

/** Union several inclusion maps, taking the max rate for each card. Used to
 * combine two single-commander lists when no partner pair page exists. */
export function mergeInclusionMaps(
  maps: Array<Record<string, number>>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const map of maps) {
    for (const [name, v] of Object.entries(map)) {
      merged[name] = Math.max(merged[name] ?? 0, v);
    }
  }
  return merged;
}

export function computeDeckMeta(
  deck: DeckData,
  inclusionMap: Record<string, number>,
  potentialDecks: number,
  source: MetaSource,
  commanderLabel: string = deck.commanders.map((c) => c.name).join(" + ")
): DeckMetaResult {
  const commanderNames = new Set(deck.commanders.map((c) => normalizeCardName(c.name)));

  const scored: CardInclusion[] = [];
  for (const card of deck.mainboard) {
    const key = normalizeCardName(card.name);
    if (isBasicLandName(card.name) || commanderNames.has(key)) continue;
    const inclusion = inclusionMap[key] ?? 0;
    scored.push({ name: card.name, inclusion, band: bandFor(inclusion) });
  }

  const bandCounts: Record<MetaBand, number> = { staple: 0, standard: 0, niche: 0, spice: 0 };
  let inclusionSum = 0;
  let spiceCount = 0;
  for (const c of scored) {
    bandCounts[c.band] += 1;
    inclusionSum += c.inclusion;
    if (c.inclusion < SPICE_MAX) spiceCount += 1;
  }
  const meanInclusion = scored.length ? inclusionSum / scored.length : 0;

  // Coverage: of the commander's top-N cards by inclusion, how many the deck runs.
  const topStaples = Object.entries(inclusionMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, COVERAGE_TOP_N)
    .map(([name]) => name);
  const scoredKeys = new Set(scored.map((c) => normalizeCardName(c.name)));
  const have = topStaples.filter((name) => scoredKeys.has(name)).length;
  const of = topStaples.length;
  const coverage = { pct: of ? have / of : 0, have, of };

  // Field percentile (D6 approximation): where the deck's mean inclusion sits
  // within the commander's own card-inclusion distribution.
  const values = Object.values(inclusionMap);
  const fieldPercentile = values.length
    ? Math.round((values.filter((v) => v <= meanInclusion).length / values.length) * 100)
    : 0;

  const status: MetaStatus =
    values.length === 0 ? "no-data" : potentialDecks < THIN_SAMPLE_THRESHOLD ? "thin" : "ok";

  return {
    status,
    source,
    commanderLabel,
    potentialDecks,
    cards: scored,
    coverage,
    spiceCount,
    meanInclusion,
    fieldPercentile,
    bandCounts,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function metaHeadline(result: DeckMetaResult, lens: MetaLens): string {
  switch (lens) {
    case "coverage":
      return `${pct(result.coverage.pct)} coverage · ${result.spiceCount} spice`;
    case "percentile":
      return `More stock than ${result.fieldPercentile}%`;
    case "mean":
      return `${pct(result.meanInclusion)} mean inclusion`;
  }
}

interface EdhrecCardview {
  name?: string;
  num_decks?: number;
  potential_decks?: number;
  /** Some lists expose inclusion as a 0-100 percentage instead of raw counts. */
  inclusion?: number;
}

/** Parse an EDHREC commander-page JSON payload into a normalized inclusion map
 * (name → 0..1) and the commander's deck sample size. Defensive: unknown or
 * blank payloads yield an empty map, which the caller reads as "no-data". */
export function parseEdhrecPayload(json: unknown): {
  inclusionMap: Record<string, number>;
  potentialDecks: number;
} {
  const inclusionMap: Record<string, number> = {};
  let potentialDecks = 0;

  const cardlists = (json as { container?: { json_dict?: { cardlists?: unknown } } })?.container
    ?.json_dict?.cardlists;
  if (!Array.isArray(cardlists)) return { inclusionMap, potentialDecks };

  for (const list of cardlists) {
    const cardviews = (list as { cardviews?: unknown })?.cardviews;
    if (!Array.isArray(cardviews)) continue;
    for (const cv of cardviews as EdhrecCardview[]) {
      if (!cv?.name) continue;
      if (typeof cv.potential_decks === "number") {
        potentialDecks = Math.max(potentialDecks, cv.potential_decks);
      }
      let inclusion: number | null = null;
      if (typeof cv.num_decks === "number" && typeof cv.potential_decks === "number" && cv.potential_decks > 0) {
        inclusion = cv.num_decks / cv.potential_decks;
      } else if (typeof cv.inclusion === "number") {
        inclusion = cv.inclusion / 100;
      }
      if (inclusion !== null) {
        const key = normalizeCardName(cv.name);
        // Keep the highest rate if a card appears in multiple lists.
        inclusionMap[key] = Math.max(inclusionMap[key] ?? 0, Math.min(1, Math.max(0, inclusion)));
      }
    }
  }

  return { inclusionMap, potentialDecks };
}

/** Neutral italic descriptor for a 0..1 stock-ness value. Never a grade. */
export function stockSpicyLabel(value: number): string {
  if (value >= 0.75) return "Stock, netdecked";
  if (value >= 0.5) return "Tuned, with spice";
  if (value >= 0.25) return "Balanced brew";
  return "Spicy brew";
}
