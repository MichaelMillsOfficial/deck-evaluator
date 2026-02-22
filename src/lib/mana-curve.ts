import type { DeckData, EnrichedCard } from "@/lib/types";

export type CardType =
  | "Creature"
  | "Instant"
  | "Sorcery"
  | "Artifact"
  | "Enchantment"
  | "Planeswalker"
  | "Battle";

export const CARD_TYPES: CardType[] = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
];

export interface ManaCurveBucket {
  cmc: string; // "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7+"
  permanents: number;
  nonPermanents: number;
}

const BUCKET_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7+"] as const;

/**
 * Extracts the primary card type from a type line.
 * Uses the front face only (before "//") for DFCs.
 * Returns null for Lands and unrecognized types.
 */
export function extractCardType(typeLine: string): CardType | null {
  const frontFace = typeLine.split("//")[0];
  if (frontFace.includes("Land")) return null;
  // Creature takes priority over Artifact/Enchantment for multi-type cards
  if (frontFace.includes("Creature")) return "Creature";
  if (frontFace.includes("Instant")) return "Instant";
  if (frontFace.includes("Sorcery")) return "Sorcery";
  if (frontFace.includes("Artifact")) return "Artifact";
  if (frontFace.includes("Enchantment")) return "Enchantment";
  if (frontFace.includes("Planeswalker")) return "Planeswalker";
  if (frontFace.includes("Battle")) return "Battle";
  return null;
}

function isNonPermanent(typeLine: string): boolean {
  const frontFace = typeLine.split("//")[0];
  return frontFace.includes("Instant") || frontFace.includes("Sorcery");
}

export function computeManaCurve(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  enabledTypes?: Set<CardType>
): ManaCurveBucket[] {
  const permanents = new Map<string, number>(
    BUCKET_LABELS.map((label) => [label, 0])
  );
  const nonPermanents = new Map<string, number>(
    BUCKET_LABELS.map((label) => [label, 0])
  );

  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    const cardType = extractCardType(enriched.typeLine);
    if (cardType === null) continue; // Land or unknown

    if (enabledTypes && !enabledTypes.has(cardType)) continue;

    const bucket = enriched.cmc >= 7 ? "7+" : String(Math.floor(enriched.cmc));
    if (isNonPermanent(enriched.typeLine)) {
      nonPermanents.set(bucket, (nonPermanents.get(bucket) ?? 0) + card.quantity);
    } else {
      permanents.set(bucket, (permanents.get(bucket) ?? 0) + card.quantity);
    }
  }

  return BUCKET_LABELS.map((label) => ({
    cmc: label,
    permanents: permanents.get(label) ?? 0,
    nonPermanents: nonPermanents.get(label) ?? 0,
  }));
}
