import type { DeckSynergyAnalysis, EnrichedCard } from "@/lib/types";
import type { CompositionScorecardResult } from "@/lib/deck-composition";
import type { CruciblePayload } from "@/lib/crucible-session";
import { WEAK_CARD_THRESHOLD } from "@/lib/card-suggestions";
import { LANDS_LABEL } from "@/lib/crucible-grouping";

export interface CutSuggestion {
  name: string;
  /** Human-readable reasons, e.g. "Low synergy (12)", "Off-identity (B)". */
  reasons: string[];
  /** Ranking weight; higher = stronger cut case. */
  score: number;
}

const OFF_IDENTITY_WEIGHT = 50;
const OVERFULL_WEIGHT = 10;

/**
 * Rank cut candidates for the Crucible's Suggested Cuts panel. Purely
 * advisory: nothing is cut without an explicit user action.
 *
 * Reasons, strongest first:
 *  - Off-identity: card's color identity is not a subset of the commanders'.
 *  - Low synergy: synergy score below WEAK_CARD_THRESHOLD (mirrors the
 *    weak-card detection in card-suggestions.ts).
 *  - Category overfull: for a scorecard category over its max, the
 *    (count - max) lowest-synergy members. The Lands category is skipped:
 *    land counts are tuned in the Charts lens, not by generic cuts.
 */
export function suggestCuts(
  payload: CruciblePayload,
  cardMap: Record<string, EnrichedCard>,
  synergy: DeckSynergyAnalysis | null,
  scorecard: CompositionScorecardResult | null,
  dismissed?: Set<string> | string[]
): CutSuggestion[] {
  const dismissedSet =
    dismissed instanceof Set ? dismissed : new Set(dismissed ?? []);
  const commanderSet = new Set(payload.commanders);

  const eligible = (name: string): boolean =>
    name in payload.statuses &&
    payload.statuses[name] !== "cut" &&
    !commanderSet.has(name) &&
    !dismissedSet.has(name);

  const suggestions = new Map<string, CutSuggestion>();
  const add = (name: string, reason: string, weight: number) => {
    const existing = suggestions.get(name);
    if (existing) {
      existing.reasons.push(reason);
      existing.score += weight;
    } else {
      suggestions.set(name, { name, reasons: [reason], score: weight });
    }
  };

  // Off-identity, once commanders are chosen.
  if (payload.commanders.length > 0) {
    const identity = new Set<string>();
    for (const name of payload.commanders) {
      for (const color of cardMap[name]?.colorIdentity ?? []) identity.add(color);
    }
    for (const card of payload.pool) {
      if (!eligible(card.name)) continue;
      const enriched = cardMap[card.name];
      if (!enriched) continue;
      const offColors = enriched.colorIdentity.filter((c) => !identity.has(c));
      if (offColors.length > 0) {
        add(card.name, `Off-identity (${offColors.join("")})`, OFF_IDENTITY_WEIGHT);
      }
    }
  }

  // Low synergy.
  if (synergy) {
    for (const card of payload.pool) {
      if (!eligible(card.name)) continue;
      const score = synergy.cardScores[card.name]?.score;
      if (score !== undefined && score < WEAK_CARD_THRESHOLD) {
        add(card.name, `Low synergy (${score})`, WEAK_CARD_THRESHOLD - score);
      }
    }
  }

  // Category overfull: weakest members beyond the max.
  if (scorecard) {
    for (const category of scorecard.categories) {
      if (category.label === LANDS_LABEL || category.tag === LANDS_LABEL) continue;
      const over = category.count - category.max;
      if (over <= 0) continue;
      const members = category.cards
        .filter((c) => eligible(c.name))
        .sort((a, b) => {
          const sa = synergy?.cardScores[a.name]?.score ?? 50;
          const sb = synergy?.cardScores[b.name]?.score ?? 50;
          return sa - sb || a.name.localeCompare(b.name);
        })
        .slice(0, over);
      for (const member of members) {
        add(
          member.name,
          `${category.label} overfull (${category.count}/${category.max})`,
          OVERFULL_WEIGHT
        );
      }
    }
  }

  return Array.from(suggestions.values()).sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
}
