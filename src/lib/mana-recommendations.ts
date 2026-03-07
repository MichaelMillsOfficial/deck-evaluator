import type { DeckData, EnrichedCard } from "./types";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  resolveCommanderIdentity,
  MTG_COLORS,
  type MtgColor,
} from "./color-distribution";
import { computeUntappedRatio, computeManaFixingQuality } from "./land-base-efficiency";
import { getTagsCached } from "./card-tags";
import { hypergeometricCdf, getDeckSize } from "./hypergeometric";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationSeverity = "critical" | "warning" | "suggestion";

export type RecommendationCategory =
  | "land-count"
  | "color-balance"
  | "etb-tempo"
  | "mana-fixing"
  | "basic-ratio"
  | "ramp-compat"
  | "opening-hand";

export interface ManaRecommendation {
  id: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  title: string;
  explanation: string;
}

export type OverallHealth = "healthy" | "needs-attention" | "critical-issues";

export interface ManaBaseRecommendationsResult {
  recommendations: ManaRecommendation[];
  overallHealth: OverallHealth;
  summaryText: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_NAMES: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
};

const BASIC_LAND_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest"] as const;

const LAND_TYPE_TO_COLOR: Record<string, string> = {
  Plains: "white",
  Island: "blue",
  Swamp: "black",
  Mountain: "red",
  Forest: "green",
};

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = {
  critical: 0,
  warning: 1,
  suggestion: 2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllCards(deck: DeckData) {
  return [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
}

function isLand(typeLine: string): boolean {
  return typeLine.includes("Land");
}

// ---------------------------------------------------------------------------
// Category 1: Land Count
// ---------------------------------------------------------------------------

interface LandTarget {
  low: number;
  high: number;
}

const LAND_TARGET_TABLE: { maxCmc: number; low: number; high: number }[] = [
  { maxCmc: 1.5, low: 28, high: 30 },
  { maxCmc: 2.0, low: 30, high: 32 },
  { maxCmc: 2.5, low: 33, high: 35 },
  { maxCmc: 3.0, low: 35, high: 37 },
  { maxCmc: 3.5, low: 36, high: 38 },
  { maxCmc: 4.0, low: 38, high: 39 },
  { maxCmc: Infinity, low: 39, high: 41 },
];

export function getLandCountTarget(avgCmc: number): LandTarget {
  for (const entry of LAND_TARGET_TABLE) {
    if (avgCmc <= entry.maxCmc) {
      return { low: entry.low, high: entry.high };
    }
  }
  // Fallback (should never reach)
  return { low: 39, high: 41 };
}

function countRampCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): number {
  const allCards = getAllCards(deck);
  let count = 0;
  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const tags = getTagsCached(enriched, tagCache);
    if (tags.includes("Ramp")) {
      count += card.quantity;
    }
  }
  return count;
}

function checkLandCount(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): ManaRecommendation[] {
  const metrics = computeManaBaseMetrics(deck, cardMap);
  const rampCount = countRampCards(deck, cardMap, tagCache);
  const target = getLandCountTarget(metrics.averageCmc);
  const rampAdjustment = Math.min(Math.floor(rampCount / 4), 3);
  const adjustedLow = target.low - rampAdjustment;
  const adjustedHigh = target.high - rampAdjustment;
  const landCount = metrics.landCount;
  const recommendations: ManaRecommendation[] = [];

  if (landCount < adjustedLow - 2) {
    const deficit = adjustedLow - landCount;
    recommendations.push({
      id: "land-count-low-critical",
      severity: "critical",
      category: "land-count",
      title: "Land count is very low",
      explanation: `Running ${landCount} lands with avg CMC ${metrics.averageCmc.toFixed(1)}. Consider adding ${deficit}+ more lands for reliable land drops.`,
    });
  } else if (landCount < adjustedLow) {
    recommendations.push({
      id: "land-count-low-warning",
      severity: "warning",
      category: "land-count",
      title: "Land count is slightly low",
      explanation: `Land count is slightly below target for your mana curve (avg CMC ${metrics.averageCmc.toFixed(1)}). Consider adding a few more lands.`,
    });
  } else if (landCount > adjustedHigh + 2) {
    recommendations.push({
      id: "land-count-high",
      severity: "warning",
      category: "land-count",
      title: "Land count is high",
      explanation: `Running more lands than typical for your mana curve (avg CMC ${metrics.averageCmc.toFixed(1)}). Consider cutting a few lands for more spells.`,
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 2: Color Balance
// ---------------------------------------------------------------------------

function checkColorBalance(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaRecommendation[] {
  const metrics = computeManaBaseMetrics(deck, cardMap);
  const { pips, sources } = computeColorDistribution(deck, cardMap);
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  const recommendations: ManaRecommendation[] = [];

  // Mono-color decks can't be color-screwed — every source produces the right color
  const colorCount = Math.max(commanderIdentity.size, 1);
  if (colorCount <= 1) return [];

  for (const color of MTG_COLORS) {
    // Only evaluate colors in commander identity (if commanders present)
    if (commanderIdentity.size > 0 && !commanderIdentity.has(color)) continue;

    // Only evaluate colors with >= 5 pips demand
    if (pips[color] < 5) continue;

    const ratio = metrics.sourceToDemandRatio[color];
    const colorName = COLOR_NAMES[color];

    if (ratio < 0.5) {
      recommendations.push({
        id: `color-balance-${color}-critical`,
        severity: "critical",
        category: "color-balance",
        title: `Severely lacking ${colorName} sources`,
        explanation: `Severely lacking ${colorName} sources — you have ${sources[color]} sources for ${pips[color]} pips of demand. This will cause frequent color screw.`,
      });
    } else if (ratio < 0.7) {
      recommendations.push({
        id: `color-balance-${color}-warning`,
        severity: "warning",
        category: "color-balance",
        title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} sources below demand`,
        explanation: `Add additional lands that produce ${colorName} mana — you have ${sources[color]} sources for ${pips[color]} pips of demand.`,
      });
    } else if (ratio < 1.0) {
      recommendations.push({
        id: `color-balance-${color}-suggestion`,
        severity: "suggestion",
        category: "color-balance",
        title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} sources slightly low`,
        explanation: `Your ${colorName} sources are slightly below demand — consider adding a few more lands that produce ${colorName} mana.`,
      });
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 3: ETB Tempo
// ---------------------------------------------------------------------------

function checkEtbTempo(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaRecommendation[] {
  const untappedScore = computeUntappedRatio(deck, cardMap);
  const ratio = untappedScore / 100;
  const recommendations: ManaRecommendation[] = [];

  if (ratio < 0.45) {
    recommendations.push({
      id: "etb-tempo-critical",
      severity: "critical",
      category: "etb-tempo",
      title: "Too many tap lands",
      explanation:
        "Over half your lands enter tapped. This will put you behind on tempo nearly every game.",
    });
  } else if (ratio < 0.60) {
    recommendations.push({
      id: "etb-tempo-warning",
      severity: "warning",
      category: "etb-tempo",
      title: "Many lands enter tapped",
      explanation:
        "A significant portion of your lands enter tapped, which will consistently slow your early turns.",
    });
  } else if (ratio < 0.75) {
    recommendations.push({
      id: "etb-tempo-suggestion",
      severity: "suggestion",
      category: "etb-tempo",
      title: "Moderate number of tap lands",
      explanation:
        "A moderate number of your lands enter tapped. Look into trading out some tap lands for untapped alternatives.",
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 4: Mana Fixing Quality
// ---------------------------------------------------------------------------

interface FixingThresholds {
  noRecAbove: number;
  warnBelow: number;
  criticalBelow: number;
}

function getFixingThresholds(colorCount: number): FixingThresholds | null {
  switch (colorCount) {
    case 1:
      return null; // Never flag mono-color
    case 2:
      return { noRecAbove: 15, warnBelow: 10, criticalBelow: 5 };
    case 3:
      return { noRecAbove: 30, warnBelow: 20, criticalBelow: 10 };
    case 4:
      return { noRecAbove: 45, warnBelow: 30, criticalBelow: 15 };
    default:
      return { noRecAbove: 55, warnBelow: 40, criticalBelow: 20 };
  }
}

function checkManaFixing(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaRecommendation[] {
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  const colorCount = Math.max(commanderIdentity.size, 1);
  const thresholds = getFixingThresholds(colorCount);
  if (!thresholds) return [];

  const fixingScore = computeManaFixingQuality(deck, cardMap);
  const recommendations: ManaRecommendation[] = [];

  if (fixingScore < thresholds.criticalBelow) {
    recommendations.push({
      id: "mana-fixing-critical",
      severity: "critical",
      category: "mana-fixing",
      title: "Very few multi-color lands",
      explanation: `Your ${colorCount}-color deck has very few multi-color lands. Color screw will be a major issue.`,
    });
  } else if (fixingScore < thresholds.warnBelow) {
    recommendations.push({
      id: "mana-fixing-warning",
      severity: "warning",
      category: "mana-fixing",
      title: "Low mana fixing",
      explanation: `Your ${colorCount}-color deck has few multi-color lands. You will frequently struggle to cast spells on curve.`,
    });
  } else if (fixingScore < thresholds.noRecAbove) {
    recommendations.push({
      id: "mana-fixing-suggestion",
      severity: "suggestion",
      category: "mana-fixing",
      title: "Mana fixing could improve",
      explanation: `With ${colorCount} colors, consider replacing some basic lands with lands that produce multiple colors for more consistent color access.`,
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 5: Basic Land Ratio
// ---------------------------------------------------------------------------

function getIdealBasicRatio(colorCount: number): number {
  return colorCount === 1 ? 0.9 : Math.max(0.15, 0.7 - colorCount * 0.13);
}

function checkBasicLandRatio(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  basicOnlyFetcherCount: number
): ManaRecommendation[] {
  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  const colorCount = Math.max(commanderIdentity.size, 1);
  const allCards = getAllCards(deck);
  const recommendations: ManaRecommendation[] = [];

  let totalLands = 0;
  let basicLands = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;
    totalLands += card.quantity;
    if (enriched.supertypes.includes("Basic")) {
      basicLands += card.quantity;
    }
  }

  if (totalLands === 0) return [];

  const basicRatio = basicLands / totalLands;
  const idealRatio = getIdealBasicRatio(colorCount);

  // Too many basics (only for 2+ color decks)
  if (colorCount >= 2 && basicRatio >= idealRatio + 0.2) {
    recommendations.push({
      id: "basic-ratio-high",
      severity: "suggestion",
      category: "basic-ratio",
      title: "High basic land ratio",
      explanation:
        "Consider replacing some basic lands with lands that produce multiple colors to improve fixing.",
    });
  }

  // Too few basics
  if (basicRatio <= idealRatio - 0.2) {
    const severity: RecommendationSeverity =
      basicOnlyFetcherCount >= 3 ? "warning" : "suggestion";
    recommendations.push({
      id: "basic-ratio-low",
      severity,
      category: "basic-ratio",
      title: "Low basic land count",
      explanation:
        "Consider keeping enough basic lands to protect against nonbasic hate and support land-search effects.",
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 6: Ramp Compatibility
// ---------------------------------------------------------------------------

interface RampAnalysis {
  basicOnlyCount: number;
  typeFetchers: Map<string, number>; // land type → count of fetchers
  fetchLandCount: number;
}

const BASIC_LAND_TYPE_REGEX: Record<string, RegExp> = {
  Plains: /\bPlains\b/,
  Island: /\bIsland\b/,
  Swamp: /\bSwamp\b/,
  Mountain: /\bMountain\b/,
  Forest: /\bForest\b/,
};

function analyzeRampCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): RampAnalysis {
  const allCards = getAllCards(deck);
  let basicOnlyCount = 0;
  const typeFetchers = new Map<string, number>();
  let fetchLandCount = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    const tags = getTagsCached(enriched, tagCache);
    const text = enriched.oracleText.toLowerCase();

    // Count fetch lands (land cards tagged as Fetch Land)
    if (tags.includes("Fetch Land")) {
      fetchLandCount += card.quantity;
    }

    // Only analyze ramp cards that search
    if (!tags.includes("Ramp") || !text.includes("search")) continue;

    // Check for basic-only fetchers
    if (text.includes("basic land")) {
      basicOnlyCount += card.quantity;
      continue;
    }

    // Check for type fetchers (search for a specific land type without "basic land")
    for (const landType of BASIC_LAND_TYPES) {
      if (BASIC_LAND_TYPE_REGEX[landType].test(enriched.oracleText)) {
        typeFetchers.set(
          landType,
          (typeFetchers.get(landType) ?? 0) + card.quantity
        );
      }
    }
  }

  return { basicOnlyCount, typeFetchers, fetchLandCount };
}

function checkRampCompatibility(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): ManaRecommendation[] {
  const rampAnalysis = analyzeRampCards(deck, cardMap, tagCache);
  const allCards = getAllCards(deck);
  const recommendations: ManaRecommendation[] = [];

  // Count basic lands and lands by subtype
  let basicLandCount = 0;
  const typedLandCounts = new Map<string, number>();
  let nonBasicTypedLandCount = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;

    if (enriched.supertypes.includes("Basic")) {
      basicLandCount += card.quantity;
    }

    for (const subtype of enriched.subtypes) {
      if (BASIC_LAND_TYPES.includes(subtype as typeof BASIC_LAND_TYPES[number])) {
        typedLandCounts.set(
          subtype,
          (typedLandCounts.get(subtype) ?? 0) + card.quantity
        );
        if (!enriched.supertypes.includes("Basic")) {
          nonBasicTypedLandCount += card.quantity;
        }
      }
    }
  }

  // Rule 6a: Basic-only ramp vs basic count
  if (
    rampAnalysis.basicOnlyCount >= 3 &&
    basicLandCount < rampAnalysis.basicOnlyCount * 2 + 3
  ) {
    recommendations.push({
      id: "ramp-compat-basic-shortage",
      severity: "warning",
      category: "ramp-compat",
      title: "Ramp outpaces basic land supply",
      explanation: `Your ramp package includes ${rampAnalysis.basicOnlyCount} cards that only fetch basic lands, but you run ${basicLandCount} basics. You may run out of targets mid-game. Add more basics or look into ramp that can find any land type.`,
    });
  }

  // Rule 6b: Type fetchers with no/few typed targets
  for (const [landType, fetcherCount] of rampAnalysis.typeFetchers) {
    const targetCount = typedLandCounts.get(landType) ?? 0;
    if (targetCount === 0) {
      recommendations.push({
        id: `ramp-compat-no-${landType.toLowerCase()}`,
        severity: "warning",
        category: "ramp-compat",
        title: `No ${landType} targets for ramp`,
        explanation: `You have ramp that searches for ${landType} cards, but no lands with the ${landType} subtype in your deck.`,
      });
    } else if (targetCount <= 2) {
      recommendations.push({
        id: `ramp-compat-few-${landType.toLowerCase()}`,
        severity: "suggestion",
        category: "ramp-compat",
        title: `Few ${landType} targets for ramp`,
        explanation: `Your ramp searching for ${landType} cards has very few targets (${targetCount} lands).`,
      });
    }
  }

  // Rule 6c: Fetch lands with few typed non-basic targets
  if (rampAnalysis.fetchLandCount >= 3 && nonBasicTypedLandCount < 5) {
    recommendations.push({
      id: "ramp-compat-fetch-types",
      severity: "suggestion",
      category: "ramp-compat",
      title: "Few typed targets for fetch lands",
      explanation:
        "Your fetch lands search for basic land types, but few of your non-basic lands carry basic types. Consider lands that count as Plains, Islands, Swamps, Mountains, or Forests.",
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Category 7: Opening Hand Probability
// ---------------------------------------------------------------------------

function checkOpeningHand(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaRecommendation[] {
  const deckSize = getDeckSize(deck);
  if (deckSize === 0) return [];

  const allCards = getAllCards(deck);
  let landCount = 0;
  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched || !isLand(enriched.typeLine)) continue;
    landCount += card.quantity;
  }

  if (landCount === 0) return [];

  const prob = hypergeometricCdf(deckSize, landCount, 7, 3);
  const pct = Math.round(prob * 100);
  const recommendations: ManaRecommendation[] = [];

  // Thresholds calibrated to Commander reality:
  // 37 lands in 99 ≈ 52% for 3+ lands — that's standard and healthy.
  // Thresholds are set relative to that baseline.
  if (prob < 0.30) {
    recommendations.push({
      id: "opening-hand-critical",
      severity: "critical",
      category: "opening-hand",
      title: "Very low opening hand land probability",
      explanation: `With ${landCount} lands, you have only a ${pct}% chance of 3+ opening lands. You will mulligan very frequently.`,
    });
  } else if (prob < 0.40) {
    recommendations.push({
      id: "opening-hand-warning",
      severity: "warning",
      category: "opening-hand",
      title: "Low opening hand land probability",
      explanation: `With ${landCount} lands, you only have a ${pct}% chance of drawing 3+ lands in your opening hand — expect frequent mulligans.`,
    });
  } else if (prob < 0.45) {
    recommendations.push({
      id: "opening-hand-suggestion",
      severity: "suggestion",
      category: "opening-hand",
      title: "Opening hand consistency could improve",
      explanation: `With ${landCount} lands, you have a ${pct}% chance of 3+ lands in your opening hand. A few more lands would improve consistency.`,
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeManaBaseRecommendations(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): ManaBaseRecommendationsResult {
  const rampAnalysis = analyzeRampCards(deck, cardMap, tagCache);

  const allRecs: ManaRecommendation[] = [
    ...checkLandCount(deck, cardMap, tagCache),
    ...checkColorBalance(deck, cardMap),
    ...checkEtbTempo(deck, cardMap),
    ...checkManaFixing(deck, cardMap),
    ...checkBasicLandRatio(deck, cardMap, rampAnalysis.basicOnlyCount),
    ...checkRampCompatibility(deck, cardMap, tagCache),
    ...checkOpeningHand(deck, cardMap),
  ];

  // Sort by severity
  allRecs.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  // Determine overall health
  const hasCritical = allRecs.some((r) => r.severity === "critical");
  const hasWarning = allRecs.some((r) => r.severity === "warning");

  let overallHealth: OverallHealth;
  if (hasCritical) {
    overallHealth = "critical-issues";
  } else if (hasWarning) {
    overallHealth = "needs-attention";
  } else {
    overallHealth = "healthy";
  }

  // Summary text
  let summaryText: string;
  if (allRecs.length === 0) {
    summaryText = "No issues detected — your mana base looks solid.";
  } else {
    const critCount = allRecs.filter((r) => r.severity === "critical").length;
    const warnCount = allRecs.filter((r) => r.severity === "warning").length;
    const suggCount = allRecs.filter((r) => r.severity === "suggestion").length;
    const parts: string[] = [];
    if (critCount > 0) parts.push(`${critCount} critical`);
    if (warnCount > 0) parts.push(`${warnCount} warning`);
    if (suggCount > 0) parts.push(`${suggCount} suggestion`);
    summaryText = `${allRecs.length} issue${allRecs.length === 1 ? "" : "s"} found (${parts.join(", ")})`;
  }

  return { recommendations: allRecs, overallHealth, summaryText };
}
