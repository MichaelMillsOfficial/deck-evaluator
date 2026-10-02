import type { DeckCard, EnrichedCard } from "@/lib/types";
import { getTagsCached } from "@/lib/card-tags";
import { SYNERGY_AXES } from "@/lib/synergy-axes";
import { extractCardType } from "@/lib/mana-curve";
import { TEMPLATE_COMMAND_ZONE } from "@/lib/deck-composition";
import { isBasicLandName, normalizeCardName } from "@/lib/edhrec-meta";

export const UNCATEGORIZED_LABEL = "Uncategorized";
export const LANDS_LABEL = "Lands";
export const UNALIGNED_AXIS_ID = "unaligned";
export const UNRESOLVED_LABEL = "Unresolved";
export const UNRESOLVED_GROUP_ID = "unresolved";

/** Minimum axis relevance for a card to be considered aligned to that axis. */
export const AXIS_RELEVANCE_MIN = 0.2;

export interface CrucibleGroup {
  id: string;
  label: string;
  cards: DeckCard[];
}

export interface AxisGroupCard extends DeckCard {
  /** The card's relevance to this axis (0-1). */
  relevance: number;
  /** Names of other axes where this card also clears AXIS_RELEVANCE_MIN. */
  otherAxes: string[];
}

export interface AxisGroup {
  axisId: string;
  axisName: string;
  /** Mean relevance of this axis across the whole pool (0-1). */
  strength: number;
  cards: AxisGroupCard[];
}

const LAND_RE = /\bLand\b/;

function isLand(typeLine: string): boolean {
  return LAND_RE.test(typeLine);
}

function byName(a: DeckCard, b: DeckCard): number {
  return a.name.localeCompare(b.name);
}

function unresolvedCards(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): DeckCard[] {
  return pool.filter((card) => !cardMap[card.name]).sort(byName);
}

/** Append an "Unresolved" group for names enrichment could not resolve, so
 * every grouped lens accounts for the full pool. */
function withUnresolved(
  groups: CrucibleGroup[],
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): CrucibleGroup[] {
  const unresolved = unresolvedCards(pool, cardMap);
  if (unresolved.length > 0) {
    groups.push({
      id: UNRESOLVED_GROUP_ID,
      label: UNRESOLVED_LABEL,
      cards: unresolved,
    });
  }
  return groups;
}

/**
 * Group the pool by card tag. A card with several tags appears in each of its
 * tag groups (its triage status is shared, so deciding once decides
 * everywhere). Lands get their own group; tagless cards land in
 * "Uncategorized". Groups follow the Command Zone template order for known
 * tags, then remaining tags by size, with Uncategorized last.
 */
export function groupByCategory(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): CrucibleGroup[] {
  const tagGroups = new Map<string, DeckCard[]>();
  const lands: DeckCard[] = [];
  const untagged: DeckCard[] = [];

  for (const card of pool) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    if (isLand(enriched.typeLine)) {
      lands.push(card);
      continue;
    }
    const tags = getTagsCached(enriched, tagCache);
    if (tags.length === 0) {
      untagged.push(card);
      continue;
    }
    for (const tag of tags) {
      const existing = tagGroups.get(tag);
      if (existing) existing.push(card);
      else tagGroups.set(tag, [card]);
    }
  }

  const templateOrder = new Map<string, number>(
    TEMPLATE_COMMAND_ZONE.categories.map((c, i) => [c.tag, i])
  );
  const sortedTags = Array.from(tagGroups.keys()).sort((a, b) => {
    const ai = templateOrder.get(a);
    const bi = templateOrder.get(b);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    const sizeDiff = tagGroups.get(b)!.length - tagGroups.get(a)!.length;
    return sizeDiff !== 0 ? sizeDiff : a.localeCompare(b);
  });

  const groups: CrucibleGroup[] = [];
  if (lands.length > 0) {
    groups.push({ id: "lands", label: LANDS_LABEL, cards: lands.sort(byName) });
  }
  for (const tag of sortedTags) {
    groups.push({ id: `tag:${tag}`, label: tag, cards: tagGroups.get(tag)!.sort(byName) });
  }
  if (untagged.length > 0) {
    groups.push({
      id: "uncategorized",
      label: UNCATEGORIZED_LABEL,
      cards: untagged.sort(byName),
    });
  }
  return withUnresolved(groups, pool, cardMap);
}

/**
 * Group the pool by synergy axis. Each card appears exactly once, under its
 * strongest axis (ties broken by axis order); its other qualifying axes are
 * listed on the entry. Cards with no axis clearing AXIS_RELEVANCE_MIN collect
 * in the "Unaligned" bucket — prime cut candidates. Groups sort by pool-wide
 * strength; cards within a group sort by relevance desc, then name.
 */
export function groupBySynergyAxis(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): AxisGroup[] {
  const assignments = new Map<string, AxisGroupCard[]>();
  const axisTotals = new Map<string, number>();
  const unaligned: AxisGroupCard[] = [];
  let enrichedCount = 0;

  for (const card of pool) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    enrichedCount++;

    let bestAxisId: string | null = null;
    let bestRelevance = 0;
    const qualifying: { axisId: string; axisName: string; relevance: number }[] = [];

    for (const axis of SYNERGY_AXES) {
      const relevance = axis.detect(enriched);
      axisTotals.set(axis.id, (axisTotals.get(axis.id) ?? 0) + relevance);
      if (relevance >= AXIS_RELEVANCE_MIN) {
        qualifying.push({ axisId: axis.id, axisName: axis.name, relevance });
        if (relevance > bestRelevance) {
          bestRelevance = relevance;
          bestAxisId = axis.id;
        }
      }
    }

    if (bestAxisId === null) {
      unaligned.push({ ...card, relevance: 0, otherAxes: [] });
      continue;
    }
    const entry: AxisGroupCard = {
      ...card,
      relevance: bestRelevance,
      otherAxes: qualifying
        .filter((q) => q.axisId !== bestAxisId)
        .map((q) => q.axisName),
    };
    const existing = assignments.get(bestAxisId);
    if (existing) existing.push(entry);
    else assignments.set(bestAxisId, [entry]);
  }

  const byRelevance = (a: AxisGroupCard, b: AxisGroupCard) =>
    b.relevance - a.relevance || a.name.localeCompare(b.name);

  const groups: AxisGroup[] = [];
  for (const axis of SYNERGY_AXES) {
    const cards = assignments.get(axis.id);
    if (!cards || cards.length === 0) continue;
    groups.push({
      axisId: axis.id,
      axisName: axis.name,
      strength: enrichedCount > 0 ? (axisTotals.get(axis.id) ?? 0) / enrichedCount : 0,
      cards: cards.sort(byRelevance),
    });
  }
  groups.sort((a, b) => b.strength - a.strength || a.axisName.localeCompare(b.axisName));

  if (unaligned.length > 0) {
    groups.push({
      axisId: UNALIGNED_AXIS_ID,
      axisName: "Unaligned",
      strength: 0,
      cards: unaligned.sort(byRelevance),
    });
  }

  const unresolved = unresolvedCards(pool, cardMap);
  if (unresolved.length > 0) {
    groups.push({
      axisId: UNRESOLVED_GROUP_ID,
      axisName: UNRESOLVED_LABEL,
      strength: 0,
      cards: unresolved.map((card) => ({ ...card, relevance: 0, otherAxes: [] })),
    });
  }
  return groups;
}

/** Group by primary card type, with lands separate and unknowns in "Other". */
export function groupByTypeLine(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): CrucibleGroup[] {
  const buckets = new Map<string, DeckCard[]>();
  for (const card of pool) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const label = isLand(enriched.typeLine)
      ? LANDS_LABEL
      : extractCardType(enriched.typeLine) ?? "Other";
    const existing = buckets.get(label);
    if (existing) existing.push(card);
    else buckets.set(label, [card]);
  }
  const groups = Array.from(buckets, ([label, cards]) => ({
    id: `type:${label}`,
    label,
    cards: cards.sort(byName),
  })).sort((a, b) => b.cards.length - a.cards.length || a.label.localeCompare(b.label));
  return withUnresolved(groups, pool, cardMap);
}

const MV_BUCKETS = ["0–1", "2", "3", "4", "5", "6", "7+"] as const;

function manaValueBucket(cmc: number): (typeof MV_BUCKETS)[number] {
  if (cmc <= 1) return "0–1";
  if (cmc >= 7) return "7+";
  return String(Math.floor(cmc)) as (typeof MV_BUCKETS)[number];
}

/** Group by mana value buckets (0–1, 2 … 7+), with lands in their own group. */
export function groupByManaValue(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): CrucibleGroup[] {
  const buckets = new Map<string, DeckCard[]>();
  for (const card of pool) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const label = isLand(enriched.typeLine) ? LANDS_LABEL : manaValueBucket(enriched.cmc);
    const existing = buckets.get(label);
    if (existing) existing.push(card);
    else buckets.set(label, [card]);
  }
  const order: string[] = [...MV_BUCKETS, LANDS_LABEL];
  const groups = order
    .filter((label) => buckets.has(label))
    .map((label) => ({
      id: `mv:${label}`,
      label,
      cards: buckets.get(label)!.sort(byName),
    }));
  return withUnresolved(groups, pool, cardMap);
}

const COLOR_LABELS: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

/** Group by color identity: mono colors, Multicolor, Colorless. */
export function groupByColorIdentity(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): CrucibleGroup[] {
  const buckets = new Map<string, DeckCard[]>();
  for (const card of pool) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const identity = enriched.colorIdentity;
    const label =
      identity.length === 0
        ? "Colorless"
        : identity.length === 1
          ? COLOR_LABELS[identity[0]] ?? "Colorless"
          : "Multicolor";
    const existing = buckets.get(label);
    if (existing) existing.push(card);
    else buckets.set(label, [card]);
  }
  const order = ["White", "Blue", "Black", "Red", "Green", "Multicolor", "Colorless"];
  const groups = order
    .filter((label) => buckets.has(label))
    .map((label) => ({
      id: `color:${label}`,
      label,
      cards: buckets.get(label)!.sort(byName),
    }));
  return withUnresolved(groups, pool, cardMap);
}

/** Cards flagged as game changers (bracket-relevant). */
export function gameChangers(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>
): DeckCard[] {
  return pool
    .filter((card) => cardMap[card.name]?.isGameChanger)
    .sort(byName);
}

/**
 * Group the pool by EDHREC "stock ↔ spicy" standing for build-time triage:
 * Staples (inclusion ≥ 50%, safe keeps), Flex (10–50%, real choices), and
 * Spice (< 10%, the builder's call). Cards with no EDHREC data fall into their
 * own Unrated group rather than Spice. Basic lands get their own group (no
 * meaningful meta signal); names enrichment could not resolve fall into
 * Unresolved. Empty groups are omitted.
 */
export function groupByMeta(
  pool: DeckCard[],
  cardMap: Record<string, EnrichedCard>,
  inclusionMap: Record<string, number>
): CrucibleGroup[] {
  const staples: DeckCard[] = [];
  const flex: DeckCard[] = [];
  const spice: DeckCard[] = [];
  const unrated: DeckCard[] = [];
  const lands: DeckCard[] = [];

  for (const card of pool) {
    if (!cardMap[card.name]) continue; // handled by withUnresolved
    if (isBasicLandName(card.name)) {
      lands.push(card);
      continue;
    }
    const inclusion = inclusionMap[normalizeCardName(card.name)];
    if (typeof inclusion !== "number") {
      // EDHREC has no data for this card — honest "unrated", not spice.
      unrated.push(card);
    } else if (inclusion >= 0.5) staples.push(card);
    else if (inclusion >= 0.1) flex.push(card);
    else spice.push(card);
  }

  const groups: CrucibleGroup[] = [];
  if (staples.length) groups.push({ id: "staples", label: "Staples", cards: staples.sort(byName) });
  if (flex.length) groups.push({ id: "flex", label: "Flex", cards: flex.sort(byName) });
  if (spice.length) groups.push({ id: "spice", label: "Spice", cards: spice.sort(byName) });
  if (unrated.length)
    groups.push({ id: "meta-unrated", label: "Unrated (no EDHREC data)", cards: unrated.sort(byName) });
  if (lands.length) groups.push({ id: "lands", label: LANDS_LABEL, cards: lands.sort(byName) });

  return withUnresolved(groups, pool, cardMap);
}
