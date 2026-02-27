import type { DeckData, EnrichedCard } from "./types";

/**
 * Static snapshot of the top cEDH staples at >= 20% inclusion rate.
 * Source: https://raw.githubusercontent.com/KonradHoeffner/cedh/gh-pages/data/cards.json
 *
 * This set is used as a fallback when the live data cannot be fetched.
 * It excludes basic lands even if they appear in the source data.
 */
export const STATIC_CEDH_STAPLES: Set<string> = new Set([
  "Ad Nauseam",
  "An Offer You Can't Refuse",
  "Ancient Tomb",
  "Arcane Signet",
  "Arid Mesa",
  "Badlands",
  "Bayou",
  "Beseech the Mirror",
  "Birds of Paradise",
  "Bloodstained Mire",
  "Borne Upon a Wind",
  "Boseiju, Who Endures",
  "Brain Freeze",
  "Cabal Ritual",
  "Carpet of Flowers",
  "Cavern of Souls",
  "Chain of Vapor",
  "Chrome Mox",
  "City of Brass",
  "City of Traitors",
  "Command Tower",
  "Crop Rotation",
  "Culling the Weak",
  "Cyclonic Rift",
  "Dark Ritual",
  "Deadly Rollick",
  "Deathrite Shaman",
  "Deflecting Swat",
  "Delighted Halfling",
  "Demonic Consultation",
  "Demonic Tutor",
  "Diabolic Intent",
  "Dispel",
  "Drannith Magistrate",
  "Eldritch Evolution",
  "Elvish Spirit Guide",
  "Emergence Zone",
  "Enlightened Tutor",
  "Entomb",
  "Esper Sentinel",
  "Exotic Orchard",
  "Faerie Mastermind",
  "Fellwar Stone",
  "Fierce Guardianship",
  "Final Fortune",
  "Finale of Devastation",
  "Flooded Strand",
  "Flusterstorm",
  "Force of Negation",
  "Force of Will",
  "Gaea's Cradle",
  "Gamble",
  "Gemstone Caverns",
  "Gitaxian Probe",
  "Grand Abolisher",
  "Grim Monolith",
  "Imperial Seal",
  "Into the Flood Maw",
  "Intuition",
  "Jeska's Will",
  "Lion's Eye Diamond",
  "Lotho, Corrupt Shirriff",
  "Lotus Petal",
  "Mana Confluence",
  "Mana Vault",
  "Marsh Flats",
  "Mental Misstep",
  "Minamo, School at Water's Edge",
  "Mindbreak Trap",
  "Misty Rainforest",
  "Mockingbird",
  "Mox Amber",
  "Mox Diamond",
  "Mox Opal",
  "Mystic Remora",
  "Mystical Tutor",
  "Nature's Rhythm",
  "Necropotence",
  "Opposition Agent",
  "Orcish Bowmasters",
  "Otawara, Soaring City",
  "Pact of Negation",
  "Phyrexian Metamorph",
  "Plateau",
  "Polluted Delta",
  "Praetor's Grasp",
  "Pyroblast",
  "Ragavan, Nimble Pilferer",
  "Ranger-Captain of Eos",
  "Reanimate",
  "Red Elemental Blast",
  "Rhystic Study",
  "Rite of Flame",
  "Savannah",
  "Scalding Tarn",
  "Scrubland",
  "Sevinne's Reclamation",
  "Silence",
  "Simian Spirit Guide",
  "Smothering Tithe",
  "Sol Ring",
  "Starting Town",
  "Swan Song",
  "Swords to Plowshares",
  "Tainted Pact",
  "Talisman of Dominance",
  "Talon Gates of Madara",
  "Thassa's Oracle",
  "The One Ring",
  "Tropical Island",
  "Tundra",
  "Underground Sea",
  "Underworld Breach",
  "Urza's Saga",
  "Valley Floodcaller",
  "Vampiric Tutor",
  "Veil of Summer",
  "Verdant Catacombs",
  "Voice of Victory",
  "Volcanic Island",
  "Watery Grave",
  "Wheel of Fortune",
  "Windswept Heath",
  "Wishclaw Talisman",
  "Wooded Foothills",
  "Worldly Tutor",
]);

/** Shape of each entry in the remote cEDH cards JSON. */
interface CedhCardEntry {
  name: string;
  percent: number;
}

/**
 * Pure function: build a staple set from the raw JSON data.
 * Filters to cards with percent >= 20 and returns their names as a Set.
 */
export function buildStapleSet(
  cardsJson: Record<string, CedhCardEntry>
): Set<string> {
  const names = new Set<string>();
  for (const entry of Object.values(cardsJson)) {
    if (entry.percent >= 20) {
      names.add(entry.name);
    }
  }
  return names;
}

const CEDH_DATA_URL =
  "https://raw.githubusercontent.com/KonradHoeffner/cedh/gh-pages/data/cards.json";

/**
 * Fetch staple data from GitHub, build a Set, and fall back to the
 * static snapshot on any error.
 */
export async function fetchCedhStaples(): Promise<Set<string>> {
  try {
    const res = await fetch(CEDH_DATA_URL);
    if (!res.ok) {
      return STATIC_CEDH_STAPLES;
    }
    const data: Record<string, CedhCardEntry> = await res.json();
    return buildStapleSet(data);
  } catch {
    return STATIC_CEDH_STAPLES;
  }
}

/** Module-level cache for fetched staple data. */
let cachedStaples: { staples: Set<string>; fetchedAt: number } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cached getter. Returns the cached staple set if it was fetched within
 * the last 24 hours; otherwise fetches fresh data and caches it.
 */
export async function getCedhStaples(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedStaples && now - cachedStaples.fetchedAt < CACHE_TTL) {
    return cachedStaples.staples;
  }
  const staples = await fetchCedhStaples();
  cachedStaples = { staples, fetchedAt: now };
  return staples;
}

const LAND_TYPE_RE = /\bLand\b/;

/**
 * Compute what percentage of a deck's non-land cards are cEDH staples.
 *
 * - Collects all cards from commanders, mainboard, and sideboard.
 * - Excludes lands (determined via cardMap typeLine) from both the
 *   numerator and denominator.
 * - Cards missing from cardMap are treated as non-land, non-staple cards.
 * - Returns a number 0-100. Returns 0 for empty decks.
 */
export function computeStapleOverlap(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  staples: Set<string>
): number {
  const allCards = [
    ...deck.commanders,
    ...deck.mainboard,
    ...deck.sideboard,
  ];

  let nonLandTotal = 0;
  let stapleCount = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    const isLand = enriched && LAND_TYPE_RE.test(enriched.typeLine);

    if (isLand) {
      continue;
    }

    nonLandTotal += card.quantity;
    if (staples.has(card.name)) {
      stapleCount += card.quantity;
    }
  }

  if (nonLandTotal === 0) {
    return 0;
  }

  return (stapleCount / nonLandTotal) * 100;
}
