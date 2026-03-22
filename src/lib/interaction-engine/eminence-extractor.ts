/**
 * Eminence Extractor — Command Zone Interaction Support
 *
 * Extracts eminence abilities, partner information, and companion
 * restrictions from EnrichedCard data. These populate the CardProfile.commander
 * fields so the interaction detector can reason about command zone effects.
 */

import type { EnrichedCard } from "../types";
import type { AbilityNode, PartnerType } from "./types";

/**
 * Detect eminence abilities on a card.
 *
 * Eminence is a keyword ability that functions from the command zone
 * or the battlefield. Only four commanders have it:
 * Edgar Markov, The Ur-Dragon, Inalla, and Arahbo.
 */
export function extractEminenceAbilities(
  card: EnrichedCard,
  parsedAbilities: AbilityNode[]
): { eminenceAbilities: AbilityNode[]; isEminence: boolean } {
  const oracle = (card.oracleText || "").toLowerCase();
  const keywords = (card.keywords || []).map((k) => k.toLowerCase());

  const isEminence = keywords.includes("eminence") || oracle.includes("eminence");
  if (!isEminence) return { eminenceAbilities: [], isEminence: false };

  // Filter abilities that correspond to the eminence paragraph.
  // Eminence abilities are triggered or static abilities that reference
  // the command zone. Take the first matching ability.
  const eminenceAbilities = parsedAbilities
    .filter((ability) => {
      return ability.abilityType === "triggered" || ability.abilityType === "static";
    })
    .slice(0, 1);

  return { eminenceAbilities, isEminence };
}

/**
 * Parse partner information from a card.
 *
 * Partner variants:
 * - Generic "Partner" keyword (e.g., Thrasios)
 * - "Partner with [Name]" (e.g., Pir + Toothy)
 * - "Friends forever" (Stranger Things cards)
 * - "Choose a Background" (Baldur's Gate legends)
 * - "Doctor's companion" (Doctor Who cards)
 */
export function parsePartnerInfo(card: EnrichedCard): {
  hasPartner: boolean;
  hasBackground: boolean;
  partnerWith: string | null;
  partnerType: PartnerType | null;
} {
  const oracle = card.oracleText || "";
  const oracleLower = oracle.toLowerCase();
  const keywords = (card.keywords || []).map((k) => k.toLowerCase());

  // "Partner with [Name]" — check first (more specific than generic Partner)
  const partnerWithMatch = oracle.match(/Partner with ([^\n(]+)/i);
  if (partnerWithMatch) {
    return {
      hasPartner: true,
      partnerWith: partnerWithMatch[1].trim(),
      partnerType: "named",
      hasBackground: false,
    };
  }

  // Doctor's Companion
  if (
    keywords.includes("doctor's companion") ||
    oracleLower.includes("doctor's companion")
  ) {
    return {
      hasPartner: true,
      partnerWith: null,
      partnerType: "doctors_companion",
      hasBackground: false,
    };
  }

  // Friends Forever
  if (
    keywords.includes("friends forever") ||
    oracleLower.includes("friends forever")
  ) {
    return {
      hasPartner: true,
      partnerWith: null,
      partnerType: "friends_forever",
      hasBackground: false,
    };
  }

  // Choose a Background
  if (
    keywords.includes("choose a background") ||
    oracleLower.includes("choose a background")
  ) {
    return {
      hasPartner: false,
      partnerWith: null,
      partnerType: "choose_background",
      hasBackground: true,
    };
  }

  // Generic Partner
  if (keywords.includes("partner")) {
    return {
      hasPartner: true,
      partnerWith: null,
      partnerType: "generic",
      hasBackground: false,
    };
  }

  return {
    hasPartner: false,
    partnerWith: null,
    partnerType: null,
    hasBackground: false,
  };
}

/**
 * Parse companion restriction from oracle text.
 *
 * Companion cards have the format:
 * "Companion — <restriction text>."
 *
 * Returns the restriction text (without trailing period) or null.
 */
export function parseCompanionRestriction(card: EnrichedCard): string | null {
  const oracle = card.oracleText || "";
  const match = oracle.match(/Companion\s*[-\u2014\u2013]\s*(.+?)(?:\n|$)/i);
  if (!match) return null;
  return match[1].trim().replace(/\.$/, "");
}
