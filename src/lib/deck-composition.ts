import type { DeckData, EnrichedCard } from "./types";
import { generateTags } from "./card-tags";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompositionTemplate {
  id: string;
  name: string;
  description: string;
  categories: CategoryTarget[];
}

export interface CategoryTarget {
  tag: string; // matches a tag from generateTags() or "Lands"
  label: string; // display name (may differ from tag)
  min: number; // recommended minimum
  max: number; // recommended maximum
  description: string; // explanation of the category's role
}

export type CategoryStatus = "good" | "low" | "high" | "critical";

export interface CategoryResult {
  tag: string;
  label: string;
  count: number;
  min: number;
  max: number;
  status: CategoryStatus;
  statusMessage: string; // e.g., "Need 3+ more" or "On target"
  cards: { name: string; quantity: number }[];
}

export type OverallHealth = "healthy" | "needs-attention" | "major-gaps";

export interface CompositionScorecardResult {
  templateId: string;
  templateName: string;
  categories: CategoryResult[];
  overallHealth: OverallHealth;
  healthSummary: string;
  untaggedCount: number;
  untaggedCards: { name: string; quantity: number }[];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const TEMPLATE_8X8: CompositionTemplate = {
  id: "8x8",
  name: "8\u00d78 Theory",
  description: "8 categories \u00d7 8 cards = 64 non-land spells + 36 lands",
  categories: [
    {
      tag: "Lands",
      label: "Lands",
      min: 35,
      max: 38,
      description: "Mana-producing lands",
    },
    {
      tag: "Ramp",
      label: "Ramp",
      min: 7,
      max: 9,
      description: "Mana acceleration and land search",
    },
    {
      tag: "Card Draw",
      label: "Card Draw",
      min: 7,
      max: 9,
      description: "Draw effects and card advantage",
    },
    {
      tag: "Removal",
      label: "Removal",
      min: 7,
      max: 9,
      description: "Single-target and mass removal",
    },
    {
      tag: "Board Wipe",
      label: "Board Wipes",
      min: 2,
      max: 4,
      description: "Mass removal effects",
    },
    {
      tag: "Counterspell",
      label: "Counterspells",
      min: 2,
      max: 4,
      description: "Spell interaction",
    },
    {
      tag: "Tutor",
      label: "Tutors",
      min: 2,
      max: 4,
      description: "Library search effects",
    },
    {
      tag: "Protection",
      label: "Protection",
      min: 3,
      max: 5,
      description: "Hexproof, indestructible, and similar",
    },
    {
      tag: "Recursion",
      label: "Recursion",
      min: 2,
      max: 4,
      description: "Graveyard recovery effects",
    },
  ],
};

export const TEMPLATE_COMMAND_ZONE: CompositionTemplate = {
  id: "command-zone",
  name: "Command Zone Template",
  description:
    "Josh Lee Kwai & Jimmy Wong's recommended starting framework",
  categories: [
    {
      tag: "Lands",
      label: "Lands",
      min: 36,
      max: 38,
      description: "Start at 37, adjust for curve and ramp",
    },
    {
      tag: "Ramp",
      label: "Ramp",
      min: 10,
      max: 12,
      description: "Mix of mana rocks and land-based ramp",
    },
    {
      tag: "Card Draw",
      label: "Card Draw",
      min: 10,
      max: 12,
      description: "Both burst and incremental draw",
    },
    {
      tag: "Removal",
      label: "Removal",
      min: 5,
      max: 8,
      description: "Instant-speed preferred",
    },
    {
      tag: "Board Wipe",
      label: "Board Wipes",
      min: 3,
      max: 4,
      description: "At least 2 creature wipes",
    },
    {
      tag: "Counterspell",
      label: "Counterspells",
      min: 2,
      max: 4,
      description: "Spell denial",
    },
    {
      tag: "Protection",
      label: "Protection",
      min: 3,
      max: 5,
      description: "Keep key pieces alive",
    },
    {
      tag: "Recursion",
      label: "Recursion",
      min: 2,
      max: 4,
      description: "Graveyard recovery",
    },
  ],
};

export const TEMPLATE_TRIBAL: CompositionTemplate = {
  id: "tribal",
  name: "Tribal Template",
  description: "Creature type-focused deck with lords, tribal payoffs, and critical mass of shared-type creatures",
  categories: [
    {
      tag: "Lands",
      label: "Lands",
      min: 35,
      max: 38,
      description: "Mana-producing lands",
    },
    {
      tag: "Lord",
      label: "Lords",
      min: 3,
      max: 6,
      description: "Type-specific creature buffs (+1/+1 or keyword grants)",
    },
    {
      tag: "Tribal Payoff",
      label: "Tribal Payoffs",
      min: 5,
      max: 10,
      description: "Cards that reward playing a specific creature type",
    },
    {
      tag: "Ramp",
      label: "Ramp",
      min: 7,
      max: 10,
      description: "Mana acceleration and land search",
    },
    {
      tag: "Card Draw",
      label: "Card Draw",
      min: 7,
      max: 10,
      description: "Draw effects and card advantage",
    },
    {
      tag: "Removal",
      label: "Removal",
      min: 5,
      max: 8,
      description: "Single-target and mass removal",
    },
    {
      tag: "Board Wipe",
      label: "Board Wipes",
      min: 2,
      max: 3,
      description: "Mass removal (prefer asymmetric like Kindred Dominance)",
    },
    {
      tag: "Protection",
      label: "Protection",
      min: 3,
      max: 5,
      description: "Keep your board alive",
    },
  ],
};

export const AVAILABLE_TEMPLATES: CompositionTemplate[] = [
  TEMPLATE_COMMAND_ZONE, // default first
  TEMPLATE_8X8,
  TEMPLATE_TRIBAL,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLand(typeLine: string): boolean {
  return typeLine.includes("Land");
}

function getAllCards(deck: DeckData): { name: string; quantity: number }[] {
  return [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
}

/**
 * Determine the effective tags for a card, mapping "Card Advantage" -> "Card Draw"
 * and deduplicating. Used to bucket cards into categories.
 */
function effectiveTags(enriched: EnrichedCard): string[] {
  const rawTags = generateTags(enriched);
  const result = new Set<string>(rawTags);
  // Card Advantage tagged cards also contribute to Card Draw
  if (rawTags.includes("Card Advantage")) {
    result.add("Card Draw");
  }
  return Array.from(result);
}

function computeStatus(count: number, min: number, max: number): CategoryStatus {
  if (count >= min && count <= max) return "good";
  if (count > max) return "high";
  // count < min
  if (count >= min - 2) return "low";
  return "critical";
}

function computeStatusMessage(
  count: number,
  min: number,
  max: number,
  status: CategoryStatus
): string {
  if (status === "good") return "On target";
  if (status === "high") return `Over by ${count - max}`;
  if (status === "low") return `Need ${min - count}+ more`;
  // critical
  return `Critically low \u2014 need ${min - count}+ more`;
}

function computeOverallHealth(categories: CategoryResult[]): OverallHealth {
  const hasCritical = categories.some((c) => c.status === "critical");
  if (hasCritical) return "major-gaps";
  const hasLow = categories.some((c) => c.status === "low");
  if (hasLow) return "needs-attention";
  return "healthy";
}

function computeHealthSummary(
  health: OverallHealth,
  categories: CategoryResult[]
): string {
  if (health === "healthy") {
    return "All categories on target";
  }
  if (health === "major-gaps") {
    const criticalCats = categories.filter((c) => c.status === "critical");
    const names = criticalCats.map((c) => c.label).join(", ");
    return `Critical gaps in: ${names}`;
  }
  // needs-attention
  const lowCats = categories.filter((c) => c.status === "low");
  const names = lowCats.map((c) => c.label).join(", ");
  return `Needs attention in: ${names}`;
}

// ---------------------------------------------------------------------------
// countCategoryCards helper
// ---------------------------------------------------------------------------

/**
 * Iterates deck cards, runs generateTags(), returns a Map<tag, cardList>
 * for tag-based categories, plus land count and land card list separately.
 * "Card Advantage" tagged cards also contribute to the "Card Draw" bucket.
 */
export function countCategoryCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): {
  tagMap: Map<string, { name: string; quantity: number }[]>;
  landCards: { name: string; quantity: number }[];
  untaggedCards: { name: string; quantity: number }[];
} {
  const tagMap = new Map<string, { name: string; quantity: number }[]>();
  const landCards: { name: string; quantity: number }[] = [];
  const untaggedCards: { name: string; quantity: number }[] = [];

  const allCards = getAllCards(deck);

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    if (isLand(enriched.typeLine)) {
      landCards.push({ name: card.name, quantity: card.quantity });
      continue;
    }

    const tags = effectiveTags(enriched);

    if (tags.length === 0) {
      untaggedCards.push({ name: card.name, quantity: card.quantity });
      continue;
    }

    for (const tag of tags) {
      const existing = tagMap.get(tag);
      if (existing) {
        existing.push({ name: card.name, quantity: card.quantity });
      } else {
        tagMap.set(tag, [{ name: card.name, quantity: card.quantity }]);
      }
    }
  }

  return { tagMap, landCards, untaggedCards };
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute the composition scorecard for a deck against a given template.
 */
export function computeCompositionScorecard(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  template: CompositionTemplate
): CompositionScorecardResult {
  const { tagMap, landCards, untaggedCards } = countCategoryCards(deck, cardMap);

  // Count total land quantity
  const landCount = landCards.reduce((sum, c) => sum + c.quantity, 0);
  const untaggedCount = untaggedCards.reduce((sum, c) => sum + c.quantity, 0);

  // Build category results
  const categories: CategoryResult[] = template.categories.map((catTarget) => {
    let count: number;
    let cards: { name: string; quantity: number }[];

    if (catTarget.tag === "Lands") {
      count = landCount;
      cards = landCards;
    } else {
      const categoryCards = tagMap.get(catTarget.tag) ?? [];
      count = categoryCards.reduce((sum, c) => sum + c.quantity, 0);
      cards = categoryCards;
    }

    const status = computeStatus(count, catTarget.min, catTarget.max);
    const statusMessage = computeStatusMessage(
      count,
      catTarget.min,
      catTarget.max,
      status
    );

    return {
      tag: catTarget.tag,
      label: catTarget.label,
      count,
      min: catTarget.min,
      max: catTarget.max,
      status,
      statusMessage,
      cards,
    };
  });

  const overallHealth = computeOverallHealth(categories);
  const healthSummary = computeHealthSummary(overallHealth, categories);

  return {
    templateId: template.id,
    templateName: template.name,
    categories,
    overallHealth,
    healthSummary,
    untaggedCount,
    untaggedCards,
  };
}
