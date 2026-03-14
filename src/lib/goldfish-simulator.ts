import type { DeckData, EnrichedCard } from "./types";
import { getTagsCached, RAMP_LAND_SEARCH_RE, RITUAL_MANA_ADD_RE } from "./card-tags";
import { classifyLandEntry } from "./land-base-efficiency";
import {
  buildPool,
  buildCommandZone,
  canCastWithLands,
  evaluateHandQuality,
} from "./opening-hand";
import type { HandCard, Verdict } from "./opening-hand";
import { createPRNG, randomSeed } from "./prng";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export interface GoldfishCard {
  name: string;
  enriched: EnrichedCard;
  tags: string[];
}

export interface GoldfishPermanent {
  card: GoldfishCard;
  tapped: boolean;
  summoningSick: boolean;
  producedMana: string[];
  enteredTurn: number;
}

export interface GoldfishGameState {
  hand: GoldfishCard[];
  battlefield: GoldfishPermanent[];
  library: GoldfishCard[];
  graveyard: GoldfishCard[];
  exile: GoldfishCard[];
  commandZone: GoldfishCard[];
  manaPool: ManaPool;
  landsPlayedThisTurn: number;
  commanderTaxPaid: number;
  turn: number;
  treasureCount: number;
  rampLandsSearched: number; // lands fetched by ramp spells (not natural land drops)
  random: () => number; // PRNG function — seeded for deterministic replay
}

export interface GoldfishConfig {
  turns: number; // default 10
  iterations: number; // default 1000
  onThePlay: boolean; // true = on the play (no extra draw T1)
}

export const DEFAULT_GOLDFISH_CONFIG: GoldfishConfig = {
  turns: 10,
  iterations: 1000,
  onThePlay: true,
};

export type RampEffectType = "land-search" | "ritual";

export interface CastResult {
  bonusMana: number; // net ritual mana produced (0 for non-rituals)
}

export interface CardDraw {
  name: string;
  imageUri: string | null;
  source: "draw-step" | "card-draw-spell" | "scry-kept" | "brainstorm" | "ponder";
}

export type LibraryActionType =
  | "kept-on-top"
  | "bottomed"
  | "graveyard"
  | "put-back-from-hand"
  | "shuffled";

export interface LibraryAction {
  cardName: string;
  action: LibraryActionType;
  source: string;
}

export type PermanentCategory = "land" | "creature" | "artifact" | "enchantment" | "planeswalker" | "token";

export interface PermanentSnapshot {
  name: string;
  category: PermanentCategory;
  tapped: boolean;
  enteredTurn: number;
}

export interface GoldfishTurnLog {
  turn: number;
  cardsDrawn: CardDraw[];
  landPlayed: string | null;
  spellsCast: string[];
  manaAvailable: number;
  manaFromLandsOnly: number;
  manaUsed: number;
  handSize: number;
  hand: string[]; // card names in hand at end of turn
  permanentCount: number;
  permanents: PermanentSnapshot[]; // full battlefield snapshot
  commanderCast: boolean;
  libraryActions: LibraryAction[];
  graveyard: string[]; // card names in graveyard at end of turn
  exile: string[]; // card names in exile at end of turn
}

export interface GoldfishOpeningHand {
  cards: {
    name: string;
    imageUri: string | null;
    typeLine: string;
    manaCost: string;
  }[];
  score: number;
  verdict: Verdict;
  reasoning: string[];
}

export interface GoldfishGameLog {
  turnLogs: GoldfishTurnLog[];
  commanderFirstCastTurn: number | null;
  openingHand: GoldfishOpeningHand;
}

export interface GoldfishGameSummary {
  seed: number;
  totalSpells: number;
  handVerdict: Verdict;
  handScore: number;
  commanderCastTurn: number | null;
  manaAtT4: number;
  finalPermanentCount: number;
}

export interface NotableGame {
  label: string;
  description: string;
  summaryIndex: number;
}

export interface GoldfishResult {
  games: GoldfishGameLog[];
  stats: GoldfishAggregateStats;
  gameSummaries: GoldfishGameSummary[];
  notableGames: NotableGame[];
  pool: GoldfishCard[];
  commandZone: GoldfishCard[];
}

export type RampSourceType = "rock" | "dork" | "land-search" | "ritual";

export interface RampSource {
  name: string;
  type: RampSourceType;
  cmc: number;
  avgCastTurn: number | null; // average turn this card was cast (null if never cast)
  castRate: number; // % of games where this card was cast
}

export interface GoldfishAggregateStats {
  avgManaByTurn: number[]; // index = turn number (0-based, so index 0 = turn 1)
  avgManaUsedByTurn: number[];
  avgSpellsByTurn: number[];
  avgHandSizeByTurn: number[];
  medianManaByTurn: number[];
  commanderCastRate: number; // % of games where commander was cast
  avgCommanderTurn: number | null; // avg turn of first commander cast
  rampAcceleration: number; // avg extra mana from ramp vs baseline
  avgTotalSpellsCast: number;
  rampSources: RampSource[]; // ramp cards in the deck with cast statistics
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categorizePermanent(permanent: GoldfishPermanent): PermanentCategory {
  const typeLine = permanent.card.enriched.typeLine;
  // Token permanents have a type line starting with "Token"
  if (typeLine.startsWith("Token")) return "token";
  if (typeLine.includes("Land")) return "land";
  if (typeLine.includes("Creature")) return "creature";
  if (typeLine.includes("Artifact")) return "artifact";
  if (typeLine.includes("Enchantment")) return "enchantment";
  if (typeLine.includes("Planeswalker")) return "planeswalker";
  return "artifact"; // fallback for unknown permanent types
}

function snapshotBattlefield(state: GoldfishGameState): PermanentSnapshot[] {
  const snapshots: PermanentSnapshot[] = [];

  for (const perm of state.battlefield) {
    snapshots.push({
      name: perm.card.name,
      category: categorizePermanent(perm),
      tapped: perm.tapped,
      enteredTurn: perm.enteredTurn,
    });
  }

  // Include treasure tokens as virtual permanents
  for (let i = 0; i < state.treasureCount; i++) {
    snapshots.push({
      name: "Treasure Token",
      category: "token",
      tapped: false,
      enteredTurn: state.turn,
    });
  }

  return snapshots;
}

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function sumManaPool(pool: ManaPool): number {
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
}


function isLand(card: EnrichedCard): boolean {
  return card.typeLine.includes("Land");
}

function isManaProducer(card: EnrichedCard): boolean {
  // Lands handled separately; non-land mana producers (dorks, rocks) with producedMana
  return !isLand(card) && card.producedMana.length > 0;
}

function hasHaste(card: EnrichedCard): boolean {
  return card.keywords.map((k) => k.toLowerCase()).includes("haste");
}

function shuffleArray<T>(arr: T[], random: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Ramp effect classification & simulation
// ---------------------------------------------------------------------------

function isInstantOrSorcery(card: EnrichedCard): boolean {
  return (
    card.typeLine.includes("Instant") || card.typeLine.includes("Sorcery")
  );
}

/**
 * Classify what kind of ramp effect an instant/sorcery produces.
 * Returns null for non-ramp cards or permanents (which are handled by
 * the existing battlefield placement logic).
 */
export function classifyRampEffect(card: GoldfishCard): RampEffectType | null {
  if (!isInstantOrSorcery(card.enriched)) return null;

  // Land search takes priority (Cultivate, Rampant Growth, etc.)
  if (RAMP_LAND_SEARCH_RE.test(card.enriched.oracleText)) {
    return "land-search";
  }

  // Ritual: produces mana without {T} (Dark Ritual, Pyretic Ritual, etc.)
  // Exclude cards with producedMana (would be permanent mana sources)
  if (
    card.enriched.producedMana.length === 0 &&
    RITUAL_MANA_ADD_RE.test(card.enriched.oracleText)
  ) {
    return "ritual";
  }

  return null;
}

/**
 * Estimate the net mana a ritual produces beyond its casting cost.
 * Counts mana symbols after "Add" in oracle text, subtracts CMC.
 * Returns 0 for non-rituals, capped at 5.
 */
export function estimateRitualNetMana(card: GoldfishCard): number {
  const text = card.enriched.oracleText;
  const addIndex = text.search(/[Aa]dd\s/);
  if (addIndex === -1) return 0;

  // Count mana symbols after the first "Add"
  const afterAdd = text.slice(addIndex);
  const symbols = Array.from(afterAdd.matchAll(/\{[WUBRGC]\}/g));
  const produced = symbols.length;
  const net = produced - card.enriched.cmc;
  return Math.max(0, Math.min(net, 5));
}

/**
 * Create a synthetic basic land card for land-search ramp simulation.
 */
function makeSyntheticLand(producedMana: string[]): GoldfishCard {
  const enriched: EnrichedCard = {
    name: "Basic Land",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Basic Land",
    supertypes: ["Basic"],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana,
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "",
    collectorNumber: "",
    layout: "normal",
    cardFaces: [
      {
        name: "Basic Land",
        manaCost: "",
        typeLine: "Basic Land",
        oracleText: "",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
    ],
  };
  return { name: "Basic Land", enriched, tags: [] };
}

/**
 * Simulate the effect of a ramp instant/sorcery after it resolves.
 * - Land search: adds a tapped basic land to the battlefield
 * - Ritual: returns the net bonus mana for the current turn
 * Returns the amount of bonus mana available this turn (0 for land-search).
 */
export function simulateRampEffect(
  state: GoldfishGameState,
  card: GoldfishCard
): number {
  const effectType = classifyRampEffect(card);
  if (!effectType) return 0;

  if (effectType === "land-search") {
    // Determine color from the spell's color identity, fallback to "C"
    const color =
      card.enriched.colorIdentity.length > 0
        ? card.enriched.colorIdentity[0]
        : "C";
    const syntheticLand = makeSyntheticLand([color]);
    state.battlefield.push({
      card: syntheticLand,
      tapped: true, // most search effects put land onto battlefield tapped
      summoningSick: false,
      producedMana: syntheticLand.enriched.producedMana,
      enteredTurn: state.turn,
    });
    state.rampLandsSearched++;
    // Shuffle library after searching
    state.library = shuffleArray(state.library, state.random);
    return 0; // tapped land produces no mana this turn
  }

  // Ritual: return net mana
  return estimateRitualNetMana(card);
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

const QUANTITY_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const TOKEN_RE =
  /create\s+(a|an|\d+|two|three|four|five|six|seven|eight|nine|ten|[Xx]|that many)\s+(.+?)\s+tokens?\b/gi;

interface TokenSpec {
  quantity: number;
  name: string;
  isCreature: boolean;
  isArtifact: boolean;
}

/**
 * Parse token creation from oracle text.
 * Returns specs for each "create N description token(s)" found.
 */
export function parseTokenCreation(oracleText: string): TokenSpec[] {
  const specs: TokenSpec[] = [];
  TOKEN_RE.lastIndex = 0;
  let match;

  while ((match = TOKEN_RE.exec(oracleText)) !== null) {
    const qtyStr = match[1].toLowerCase();
    const description = match[2].toLowerCase();

    // Skip copy effects
    if (/copy of/i.test(description)) continue;

    // Parse quantity
    let quantity = QUANTITY_WORDS[qtyStr] ?? parseInt(qtyStr, 10);
    if (isNaN(quantity) || qtyStr === "x" || qtyStr === "that many") {
      quantity = 1; // conservative fallback for X / "that many"
    }

    // Classify type
    const isCreature = description.includes("creature") ||
      // Most tokens without an explicit type are creatures (e.g. "1/1 white Soldier")
      /\d+\/\d+/.test(description);
    const isArtifact = description.includes("artifact") ||
      /treasure|food|clue|blood|map|gold|powerstone/i.test(description);

    // Build a readable name from the description
    // e.g. "3/3 green Elephant creature" → "Elephant Token"
    //       "Treasure artifact" → "Treasure Token"
    // Strategy: find the last capitalized-looking word that isn't a color,
    // type keyword, or p/t stats.
    const SKIP_WORDS = new Set([
      "white", "blue", "black", "red", "green", "colorless",
      "creature", "artifact", "enchantment", "token", "tokens",
      "legendary", "and", "with",
    ]);
    let name: string | null = null;
    const words = description.split(/\s+/);
    for (let wi = words.length - 1; wi >= 0; wi--) {
      const w = words[wi].replace(/[^a-z]/gi, "");
      if (!w || SKIP_WORDS.has(w) || /^\d+\/\d+$/.test(words[wi])) continue;
      name = w.charAt(0).toUpperCase() + w.slice(1) + " Token";
      break;
    }
    if (!name) {
      const ptMatch = description.match(/(\d+)\/(\d+)/);
      name = ptMatch ? `${ptMatch[1]}/${ptMatch[2]} Token` : "Token";
    }

    specs.push({ quantity, name, isCreature, isArtifact });
  }

  return specs;
}

/**
 * Create synthetic GoldfishCard for a token permanent.
 */
function makeTokenCard(spec: TokenSpec): GoldfishCard {
  const typeParts: string[] = [];
  if (spec.isArtifact) typeParts.push("Artifact");
  if (spec.isCreature) typeParts.push("Creature");
  if (typeParts.length === 0) typeParts.push("Creature"); // default
  const typeLine = `Token ${typeParts.join(" ")}`;

  const enriched: EnrichedCard = {
    name: spec.name,
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine,
    supertypes: [],
    subtypes: [],
    oracleText: "",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "",
    collectorNumber: "",
    layout: "normal",
    cardFaces: [
      {
        name: spec.name,
        manaCost: "",
        typeLine,
        oracleText: "",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
    ],
  };
  return { name: spec.name, enriched, tags: [] };
}

/**
 * Simulate token creation from a spell's oracle text.
 * Creates token permanents on the battlefield.
 */
function simulateTokenCreation(
  state: GoldfishGameState,
  card: GoldfishCard
): void {
  const specs = parseTokenCreation(card.enriched.oracleText);
  for (const spec of specs) {
    for (let i = 0; i < spec.quantity; i++) {
      const tokenCard = makeTokenCard(spec);
      state.battlefield.push({
        card: tokenCard,
        tapped: false,
        summoningSick: spec.isCreature,
        producedMana: [],
        enteredTurn: state.turn,
      });
    }
  }
}

const RECURRING_TOKEN_RE =
  /\bat the beginning of (?:your |each )?(?:upkeep|end step|combat)\b/i;

/**
 * Check battlefield permanents for recurring token triggers
 * (e.g. "At the beginning of your upkeep, create a 1/1 token").
 * Only fires for permanents that were on the battlefield before this turn.
 */
function simulateRecurringTokens(state: GoldfishGameState): void {
  for (const permanent of state.battlefield) {
    // Skip permanents that just entered (they won't trigger until next turn)
    if (permanent.enteredTurn >= state.turn) continue;
    // Skip tokens — they don't have oracle text triggers
    if (permanent.card.enriched.typeLine.startsWith("Token")) continue;

    const oracle = permanent.card.enriched.oracleText;
    if (RECURRING_TOKEN_RE.test(oracle)) {
      simulateTokenCreation(state, permanent.card);
    }
  }
}

/**
 * Compute remaining mana after spending some amount this turn.
 */
function computeRemainingMana(
  state: GoldfishGameState,
  manaUsed: number
): number {
  return sumManaPool(computeAvailableMana(state)) - manaUsed;
}

// ---------------------------------------------------------------------------
// Game initialization
// ---------------------------------------------------------------------------

/**
 * Build a flat GoldfishCard pool from HandCard pool (already built by buildPool).
 * This re-uses buildPool from opening-hand.ts which excludes commanders.
 */
export function buildGoldfishPoolFromDeck(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): GoldfishCard[] {
  const handPool = buildPool(deck, cardMap);
  return handPool.map((hc) => ({
    name: hc.name,
    enriched: hc.enriched,
    tags: getTagsCached(hc.enriched),
  }));
}

export function buildGoldfishCommandZoneFromDeck(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): GoldfishCard[] {
  const cmdPool = buildCommandZone(deck, cardMap);
  return cmdPool.map((hc) => ({
    name: hc.name,
    enriched: hc.enriched,
    tags: getTagsCached(hc.enriched),
  }));
}

/**
 * Initialize a new game state: shuffle library, draw 7 cards.
 * Draw behavior on T1 (play vs draw) is handled in executeTurn.
 */
export function initializeGame(
  pool: GoldfishCard[],
  commandZone: GoldfishCard[],
  random: () => number = Math.random
): GoldfishGameState {
  const library = shuffleArray(pool, random);
  const hand: GoldfishCard[] = [];

  // Draw opening hand of 7
  const openingHandSize = 7;
  for (let i = 0; i < openingHandSize && library.length > 0; i++) {
    hand.push(library.shift()!);
  }

  return {
    hand,
    battlefield: [],
    library,
    graveyard: [],
    exile: [],
    commandZone: [...commandZone],
    manaPool: emptyManaPool(),
    landsPlayedThisTurn: 0,
    commanderTaxPaid: 0,
    turn: 0,
    treasureCount: 0,
    rampLandsSearched: 0,
    random,
  };
}

// ---------------------------------------------------------------------------
// Mana computation
// ---------------------------------------------------------------------------

/**
 * Compute total available mana for the turn.
 * Untaps all lands and non-sick mana producers, sums their produced mana.
 */
export function computeAvailableMana(state: GoldfishGameState): ManaPool {
  const pool = emptyManaPool();

  for (const permanent of state.battlefield) {
    const card = permanent.card.enriched;

    if (isLand(card) && !permanent.tapped) {
      // Untapped lands tap for mana
      const colors =
        card.producedMana.length > 0 ? card.producedMana : ["C"];
      const color = colors[0];
      if (color === "W") pool.W++;
      else if (color === "U") pool.U++;
      else if (color === "B") pool.B++;
      else if (color === "R") pool.R++;
      else if (color === "G") pool.G++;
      else pool.C++;
    } else if (isManaProducer(card) && !permanent.tapped) {
      // Non-land mana producers: respect summoning sickness unless haste
      const canAct = !permanent.summoningSick || hasHaste(card);
      if (canAct) {
        const colors =
          card.producedMana.length > 0 ? card.producedMana : ["C"];
        const color = colors[0];
        if (color === "W") pool.W++;
        else if (color === "U") pool.U++;
        else if (color === "B") pool.B++;
        else if (color === "R") pool.R++;
        else if (color === "G") pool.G++;
        else pool.C++;
      }
    }
  }

  // Add treasures
  pool.C += state.treasureCount;

  return pool;
}

/**
 * Compute the natural-land-drop mana baseline: untapped lands minus any
 * lands that were fetched by ramp spells (which would not exist without ramp).
 * This gives the mana the player would have from just playing one land per turn.
 */
function computeNaturalLandMana(state: GoldfishGameState): number {
  let untappedLands = 0;
  for (const permanent of state.battlefield) {
    if (isLand(permanent.card.enriched) && !permanent.tapped) {
      untappedLands++;
    }
  }
  // Subtract ramp-searched lands (they might be tapped or untapped, but
  // we conservatively subtract from the untapped total since the baseline
  // should reflect only natural land drops)
  return Math.max(0, untappedLands - state.rampLandsSearched);
}

// ---------------------------------------------------------------------------
// Land selection
// ---------------------------------------------------------------------------

/**
 * Choose the best land to play from hand.
 * Priority: untapped > conditional > tapped.
 * Tiebreak: prefer lands that produce colors we're missing.
 */
export function chooseLandToPlay(
  state: GoldfishGameState
): GoldfishCard | null {
  const landsInHand = state.hand.filter((c) => isLand(c.enriched));
  if (landsInHand.length === 0) return null;

  // Score each land: untapped=2, conditional=1, tapped=0
  const scored = landsInHand.map((c) => {
    const classification = classifyLandEntry(c.enriched);
    const score =
      classification === "untapped"
        ? 2
        : classification === "conditional"
          ? 1
          : 0;
    return { card: c, score };
  });

  // Sort by score descending, then prefer lands with more color production
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.card.enriched.producedMana.length - a.card.enriched.producedMana.length;
  });

  return scored[0]?.card ?? null;
}

// ---------------------------------------------------------------------------
// Spell selection
// ---------------------------------------------------------------------------

/**
 * Get land sources from battlefield for canCastWithLands().
 */
function getLandSources(state: GoldfishGameState): string[][] {
  // Each land on the battlefield can produce mana
  // We only count untapped lands (all untap at start of turn)
  const sources: string[][] = [];

  for (const permanent of state.battlefield) {
    const card = permanent.card.enriched;
    if (isLand(card) && !permanent.tapped) {
      const colors =
        card.producedMana.length > 0 ? card.producedMana : ["C"];
      sources.push(colors);
    } else if (isManaProducer(card) && !permanent.tapped) {
      const canAct =
        !permanent.summoningSick || hasHaste(card);
      if (canAct) {
        const colors =
          card.producedMana.length > 0 ? card.producedMana : ["C"];
        sources.push(colors);
      }
    }
  }

  // Add treasures as colorless sources
  for (let i = 0; i < state.treasureCount; i++) {
    sources.push(["C"]);
  }

  return sources;
}

/**
 * Determine the effective CMC of a spell, considering commander tax.
 */
function effectiveCmc(
  card: GoldfishCard,
  state: GoldfishGameState,
  isCommander: boolean
): number {
  const base = card.enriched.cmc;
  if (isCommander) {
    return base + state.commanderTaxPaid * 2;
  }
  return base;
}

/**
 * Choose the best spell to cast from hand + command zone.
 * Priority:
 *   1. Ramp spells with CMC <= 3 (accelerate development)
 *   2. Commander (from command zone)
 *   3. Highest CMC castable spell
 *   4. Tiebreak: Card Draw > Removal > other
 */
export function chooseSpellToCast(
  state: GoldfishGameState
): { card: GoldfishCard; isCommander: boolean } | null {
  const availableMana = sumManaPool(computeAvailableMana(state));
  const landSources = getLandSources(state);

  // Build list of all castable spells (hand + command zone)
  interface CastOption {
    card: GoldfishCard;
    isCommander: boolean;
    cmc: number;
    castable: boolean;
  }

  const options: CastOption[] = [];

  // Hand spells
  for (const card of state.hand) {
    if (isLand(card.enriched)) continue;
    const cmc = effectiveCmc(card, state, false);
    if (cmc > availableMana) continue;
    const castable = canCastWithLands(card.enriched, landSources);
    if (castable) {
      options.push({ card, isCommander: false, cmc, castable: true });
    }
  }

  // Commander from command zone
  for (const commander of state.commandZone) {
    const cmc = effectiveCmc(commander, state, true);
    if (cmc > availableMana) continue;
    const castable = canCastWithLands(commander.enriched, landSources);
    if (castable) {
      options.push({ card: commander, isCommander: true, cmc, castable: true });
    }
  }

  if (options.length === 0) return null;

  // Priority 1: Ramp spells CMC <= 3
  const rampOptions = options.filter(
    (o) => !o.isCommander && o.cmc <= 3 && o.card.tags.includes("Ramp")
  );
  if (rampOptions.length > 0) {
    // Pick lowest CMC ramp (get online fastest)
    rampOptions.sort((a, b) => a.cmc - b.cmc);
    return { card: rampOptions[0].card, isCommander: false };
  }

  // Priority 2: Commander
  const commanderOptions = options.filter((o) => o.isCommander);
  if (commanderOptions.length > 0) {
    return { card: commanderOptions[0].card, isCommander: true };
  }

  // Priority 3 + 4: Highest CMC castable, tiebreak by tag quality
  const nonRampOptions = options.filter((o) => !o.isCommander);
  if (nonRampOptions.length === 0) return null;

  nonRampOptions.sort((a, b) => {
    if (b.cmc !== a.cmc) return b.cmc - a.cmc;
    // Tiebreak: Card Draw > Removal > other
    const tagPriority = (o: CastOption) => {
      if (o.card.tags.includes("Card Draw")) return 2;
      if (o.card.tags.includes("Removal")) return 1;
      return 0;
    };
    return tagPriority(b) - tagPriority(a);
  });

  return { card: nonRampOptions[0].card, isCommander: false };
}

// ---------------------------------------------------------------------------
// Turn execution
// ---------------------------------------------------------------------------

/**
 * Untap all permanents at the beginning of the turn.
 */
function untapAll(state: GoldfishGameState): void {
  for (const permanent of state.battlefield) {
    permanent.tapped = false;
    // Clear summoning sickness for permanents that entered previous turns
    if (permanent.enteredTurn < state.turn) {
      permanent.summoningSick = false;
    }
  }
}

/**
 * Draw one card from the library.
 */
function drawCard(state: GoldfishGameState): void {
  if (state.library.length > 0) {
    state.hand.push(state.library.shift()!);
  }
}

/**
 * Draw one card and return its info for tracking.
 */
function drawCardTracked(
  state: GoldfishGameState
): { name: string; imageUri: string | null } | null {
  if (state.library.length === 0) return null;
  const card = state.library.shift()!;
  state.hand.push(card);
  return {
    name: card.name,
    imageUri: card.enriched.imageUris?.normal ?? null,
  };
}

/**
 * Estimate how many cards a "Card Draw" spell draws from its oracle text.
 * Returns 1-3 for most draw spells, capped at 3 for simulation simplicity.
 */
function estimateCardDrawCount(oracleText: string): number {
  // "draw three cards" / "draw 3 cards"
  const numMatch = oracleText.match(
    /draw\s+(\w+)\s+cards?/i
  );
  if (numMatch) {
    const wordToNum: Record<string, number> = {
      a: 1, one: 1, two: 2, three: 3, four: 3, five: 3,
      "1": 1, "2": 2, "3": 3,
    };
    const n = wordToNum[numMatch[1].toLowerCase()];
    if (n) return Math.min(n, 3);
  }
  // "draw a card" → 1
  if (/draw a card/i.test(oracleText)) return 1;
  return 1; // default
}

export function computeCardDesirability(card: GoldfishCard, state: GoldfishGameState): number {
  const enriched = card.enriched;

  if (isLand(enriched)) {
    const battlefieldLands = state.battlefield.filter(p => isLand(p.card.enriched)).length;
    const handLands = state.hand.filter(c => isLand(c.enriched)).length;

    if (battlefieldLands >= 6) return 0.1;
    if (battlefieldLands >= 4) {
      if (handLands === 0) return 0.6;
      if (handLands >= 2) return 0.15;
      return 0.5;
    }
    // battlefieldLands < 4
    if (handLands === 0) return 0.9;
    return 0.5;
  }

  // Non-land
  const availableMana = sumManaPool(computeAvailableMana(state));
  const cmc = enriched.cmc;

  // Ramp + early turn + cheap
  if (card.tags.includes("Ramp") && state.turn <= 4 && cmc <= 3) return 0.95;
  // Card draw + castable next turn
  if (card.tags.includes("Card Draw") && cmc <= availableMana + 1) return 0.85;
  // Castable next turn
  if (cmc <= availableMana + 1) return 0.7;
  // Castable in 2-3 turns
  if (cmc <= availableMana + 3) return 0.4;
  // Too expensive
  return 0.15;
}

export function estimateScryCount(oracleText: string): number {
  const match = oracleText.match(/scry\s+(\w+)/i);
  if (!match) return 0;
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  };
  return wordToNum[match[1].toLowerCase()] ?? 0;
}

export function estimateSurveilCount(oracleText: string): number {
  const match = oracleText.match(/surveil\s+(\w+)/i);
  if (!match) return 0;
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  };
  return wordToNum[match[1].toLowerCase()] ?? 0;
}

export function isBrainstormEffect(oracleText: string): boolean {
  return /draw three cards.*put two cards from your hand on top/i.test(oracleText);
}

export function isPonderEffect(oracleText: string): boolean {
  return (
    /look at the top three cards of your library/i.test(oracleText) &&
    /you may shuffle/i.test(oracleText) &&
    /draw a card/i.test(oracleText)
  );
}

export function isTopReorderEffect(oracleText: string): boolean {
  return /look at the top \w+ cards? of your library.*put them back in any order/i.test(oracleText) &&
    !isPonderEffect(oracleText);
}

export function estimateTopReorderCount(oracleText: string): number {
  const match = oracleText.match(/look at the top (\w+) cards? of your library/i);
  if (!match) return 0;
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  };
  return wordToNum[match[1].toLowerCase()] ?? 0;
}

export function scryAppearsBeforeDraw(oracleText: string): boolean {
  const scryIndex = oracleText.search(/scry/i);
  const drawIndex = oracleText.search(/draw/i);
  if (scryIndex === -1 || drawIndex === -1) return false;
  return scryIndex < drawIndex;
}

export function simulateScry(
  state: GoldfishGameState,
  n: number,
  sourceName: string
): LibraryAction[] {
  const actions: LibraryAction[] = [];
  const cards = state.library.splice(0, Math.min(n, state.library.length));

  const kept: { card: GoldfishCard; score: number }[] = [];
  const bottomed: GoldfishCard[] = [];

  for (const card of cards) {
    const score = computeCardDesirability(card, state);
    if (score >= 0.5) {
      kept.push({ card, score });
    } else {
      bottomed.push(card);
      actions.push({ cardName: card.name, action: "bottomed", source: sourceName });
    }
  }

  // Sort kept by score descending (best on very top)
  kept.sort((a, b) => b.score - a.score);
  for (const { card } of kept) {
    actions.push({ cardName: card.name, action: "kept-on-top", source: sourceName });
  }

  // Prepend kept to top of library (in order, best first)
  state.library.unshift(...kept.map(k => k.card));
  // Append bottomed to end
  state.library.push(...bottomed);

  return actions;
}

export function simulateSurveil(
  state: GoldfishGameState,
  n: number,
  sourceName: string
): LibraryAction[] {
  const actions: LibraryAction[] = [];
  const cards = state.library.splice(0, Math.min(n, state.library.length));

  const kept: { card: GoldfishCard; score: number }[] = [];

  for (const card of cards) {
    const score = computeCardDesirability(card, state);
    if (score >= 0.5) {
      kept.push({ card, score });
    } else {
      state.graveyard.push(card);
      actions.push({ cardName: card.name, action: "graveyard", source: sourceName });
    }
  }

  kept.sort((a, b) => b.score - a.score);
  for (const { card } of kept) {
    actions.push({ cardName: card.name, action: "kept-on-top", source: sourceName });
  }

  state.library.unshift(...kept.map(k => k.card));

  return actions;
}

export function simulateBrainstorm(
  state: GoldfishGameState,
  sourceName: string
): { drawn: CardDraw[]; actions: LibraryAction[] } {
  const drawn: CardDraw[] = [];
  const actions: LibraryAction[] = [];

  // Draw 3 cards
  for (let i = 0; i < 3; i++) {
    const card = drawCardTracked(state);
    if (card) {
      drawn.push({ ...card, source: "brainstorm" });
    }
  }

  // Score all cards in hand
  const scored = state.hand.map(card => ({
    card,
    score: computeCardDesirability(card, state),
  }));

  // Find the 2 lowest-scoring cards
  scored.sort((a, b) => a.score - b.score);
  const putBack = scored.slice(0, 2);

  for (const { card } of putBack) {
    state.hand = state.hand.filter(c => c !== card);
    actions.push({ cardName: card.name, action: "put-back-from-hand", source: sourceName });
  }

  // Prepend to library (put back on top)
  state.library.unshift(...putBack.map(p => p.card));

  return { drawn, actions };
}

export function simulatePonder(
  state: GoldfishGameState,
  sourceName: string
): { drawn: CardDraw[]; actions: LibraryAction[] } {
  const drawn: CardDraw[] = [];
  const actions: LibraryAction[] = [];

  const topCount = Math.min(3, state.library.length);
  const topCards = state.library.slice(0, topCount);

  // Score each
  const scored = topCards.map(card => ({
    card,
    score: computeCardDesirability(card, state),
  }));

  const allBad = scored.every(s => s.score < 0.4);

  if (allBad) {
    // Shuffle the library
    state.library = shuffleArray(state.library, state.random);
    actions.push({ cardName: "", action: "shuffled", source: sourceName });
  } else {
    // Remove top cards, reorder by score desc, put back
    state.library.splice(0, topCount);
    scored.sort((a, b) => b.score - a.score);
    state.library.unshift(...scored.map(s => s.card));
    for (const { card } of scored) {
      actions.push({ cardName: card.name, action: "kept-on-top", source: sourceName });
    }
  }

  // Draw 1
  const card = drawCardTracked(state);
  if (card) {
    drawn.push({ ...card, source: "ponder" });
  }

  return { drawn, actions };
}

export function simulateTopReorder(
  state: GoldfishGameState,
  n: number,
  sourceName: string
): LibraryAction[] {
  const actions: LibraryAction[] = [];
  const topCount = Math.min(n, state.library.length);
  const topCards = state.library.splice(0, topCount);

  const scored = topCards.map(card => ({
    card,
    score: computeCardDesirability(card, state),
  }));

  scored.sort((a, b) => b.score - a.score);
  state.library.unshift(...scored.map(s => s.card));

  for (const { card } of scored) {
    actions.push({ cardName: card.name, action: "kept-on-top", source: sourceName });
  }

  return actions;
}

/**
 * Play a land from hand onto the battlefield.
 */
function playLand(state: GoldfishGameState, land: GoldfishCard): void {
  state.hand = state.hand.filter((c) => c !== land);
  const classification = classifyLandEntry(land.enriched);
  const entersTapped = classification === "tapped";

  state.battlefield.push({
    card: land,
    tapped: entersTapped,
    summoningSick: false, // lands don't have summoning sickness
    producedMana: land.enriched.producedMana,
    enteredTurn: state.turn,
  });
  state.landsPlayedThisTurn++;
}

/**
 * Cast a spell from hand (or command zone), placing creature/artifact/enchantment on battlefield.
 * Returns a CastResult with bonus mana from ritual effects.
 */
function castSpell(
  state: GoldfishGameState,
  card: GoldfishCard,
  isCommander: boolean
): CastResult {
  const cmc = effectiveCmc(card, state, isCommander);
  // Deduct from mana pool (simplified: we track total mana used)
  state.manaPool.C = Math.max(0, state.manaPool.C - cmc); // rough deduction

  const isPermanentType =
    card.enriched.typeLine.includes("Creature") ||
    card.enriched.typeLine.includes("Artifact") ||
    card.enriched.typeLine.includes("Enchantment") ||
    card.enriched.typeLine.includes("Planeswalker") ||
    card.enriched.typeLine.includes("Land");

  if (isCommander) {
    // Remove from command zone
    state.commandZone = state.commandZone.filter((c) => c !== card);
    state.commanderTaxPaid++;
    // Commander goes onto battlefield
    state.battlefield.push({
      card,
      tapped: false,
      summoningSick: !hasHaste(card.enriched),
      producedMana: card.enriched.producedMana,
      enteredTurn: state.turn,
    });
    // ETB token creation (e.g. commander with "when ~ enters, create tokens")
    simulateTokenCreation(state, card);
    return { bonusMana: 0 };
  } else {
    // Remove from hand
    state.hand = state.hand.filter((c) => c !== card);
    if (isPermanentType) {
      state.battlefield.push({
        card,
        tapped: false,
        summoningSick:
          card.enriched.typeLine.includes("Creature") &&
          !hasHaste(card.enriched),
        producedMana: card.enriched.producedMana,
        enteredTurn: state.turn,
      });
      // ETB token creation (e.g. "when ~ enters, create tokens")
      simulateTokenCreation(state, card);
      return { bonusMana: 0 };
    } else {
      // Non-permanent (Instant/Sorcery) goes to graveyard
      state.graveyard.push(card);
      // Simulate ramp effects (land search, rituals)
      const bonusMana = simulateRampEffect(state, card);
      // Token creation from spells (e.g. "Create three 1/1 tokens")
      simulateTokenCreation(state, card);
      return { bonusMana };
    }
  }
}

/**
 * Choose which card to discard when over the hand limit.
 * Prefers highest-CMC non-utility cards (not Ramp, not Card Draw, not lands).
 */
export function chooseDiscard(state: GoldfishGameState): GoldfishCard | null {
  if (state.hand.length === 0) return null;

  const scored = state.hand.map((card) => {
    let priority = card.enriched.cmc; // higher CMC = more likely to discard
    // Prefer keeping ramp, card draw, and lands
    if (card.tags.includes("Ramp")) priority -= 100;
    if (card.tags.includes("Card Draw")) priority -= 50;
    if (isLand(card.enriched)) priority -= 80;
    return { card, priority };
  });

  // Sort by priority descending — highest priority = discard first
  scored.sort((a, b) => b.priority - a.priority);
  return scored[0].card;
}

/**
 * Execute a full turn: untap, draw, play land, cast spells.
 * Returns the turn log.
 */
export function executeTurn(state: GoldfishGameState, config: GoldfishConfig): GoldfishTurnLog {
  state.turn++;
  state.landsPlayedThisTurn = 0;

  // Untap
  untapAll(state);

  // Upkeep: process recurring token triggers from permanents on battlefield
  // (e.g. Bitterblossom "At the beginning of your upkeep, create a token")
  simulateRecurringTokens(state);

  // Track cards drawn this turn
  const cardsDrawn: CardDraw[] = [];
  const libraryActions: LibraryAction[] = [];

  // Draw (skip first draw on the play)
  if (!(state.turn === 1 && config.onThePlay)) {
    const drawn = drawCardTracked(state);
    if (drawn) {
      cardsDrawn.push({ ...drawn, source: "draw-step" });
    }
  }

  // Compute mana available for this turn
  const manaPool = computeAvailableMana(state);
  const manaAvailable = sumManaPool(manaPool);

  // Play land (one per turn)
  let landPlayed: string | null = null;
  const landToPlay = chooseLandToPlay(state);
  if (landToPlay) {
    playLand(state, landToPlay);
    landPlayed = landToPlay.name;
  }

  // Cast spells until no more castable spells
  const spellsCast: string[] = [];
  let commanderCast = false;
  let manaUsed = 0;
  let ritualBonusMana = 0;

  // Recompute mana after possibly playing a land (lands contribute mana now)
  let remainingMana = computeRemainingMana(state, manaUsed);

  // We try to cast multiple spells per turn
  let maxAttempts = 30; // safety valve
  while (maxAttempts-- > 0) {
    const choice = chooseSpellToCast(state);
    if (!choice) break;

    const cmc = effectiveCmc(choice.card, state, choice.isCommander);
    if (cmc > remainingMana + ritualBonusMana) break;

    const castCard = choice.card;
    const result = castSpell(state, castCard, choice.isCommander);
    spellsCast.push(castCard.name);
    manaUsed += cmc;
    ritualBonusMana += result.bonusMana;

    // --- Library manipulation & card draw effect resolution ---
    let handledSpecialDraw = false;
    const oracle = castCard.enriched.oracleText;

    // 1. Brainstorm/Ponder special cases (handle their own draws)
    if (isBrainstormEffect(oracle)) {
      const r = simulateBrainstorm(state, castCard.name);
      cardsDrawn.push(...r.drawn);
      libraryActions.push(...r.actions);
      handledSpecialDraw = true;
    } else if (isPonderEffect(oracle)) {
      const r = simulatePonder(state, castCard.name);
      cardsDrawn.push(...r.drawn);
      libraryActions.push(...r.actions);
      handledSpecialDraw = true;
    }

    // 2. Scry-before-draw (e.g., Opt "Scry 1, then draw a card")
    const scryN = estimateScryCount(oracle);
    const scryBeforeDraw = scryN > 0 && scryAppearsBeforeDraw(oracle);
    if (scryBeforeDraw) {
      libraryActions.push(...simulateScry(state, scryN, castCard.name));
    }

    // 3. Generic card draw (skipped if brainstorm/ponder handled it)
    if (!handledSpecialDraw && castCard.tags.includes("Card Draw")) {
      const drawCount = estimateCardDrawCount(oracle);
      for (let d = 0; d < drawCount; d++) {
        const drawn = drawCardTracked(state);
        if (drawn) {
          cardsDrawn.push({ ...drawn, source: "card-draw-spell" });
        }
      }
    }

    // 4. Draw-before-scry or standalone scry/surveil
    if (scryN > 0 && !scryBeforeDraw) {
      libraryActions.push(...simulateScry(state, scryN, castCard.name));
    }
    const surveilN = estimateSurveilCount(oracle);
    if (surveilN > 0) {
      libraryActions.push(...simulateSurveil(state, surveilN, castCard.name));
    }

    // 5. Top-reorder effects (Sensei's Divining Top)
    if (isTopReorderEffect(oracle)) {
      const n = estimateTopReorderCount(oracle);
      if (n > 0) {
        libraryActions.push(...simulateTopReorder(state, n, castCard.name));
      }
    }

    // 6. Shuffle after Tutor
    if (castCard.tags.includes("Tutor")) {
      state.library = shuffleArray(state.library, state.random);
      libraryActions.push({ cardName: "", action: "shuffled", source: castCard.name });
    }

    // Always recompute remaining mana after every cast — handles mid-turn
    // mana rocks (untapped artifacts), summoning-sick dorks, and tapped lands
    remainingMana = computeRemainingMana(state, manaUsed);

    if (choice.isCommander) {
      commanderCast = true;
    }
  }

  // End-of-turn: discard to 7
  const MAX_HAND_SIZE = 7;
  while (state.hand.length > MAX_HAND_SIZE) {
    const toDiscard = chooseDiscard(state);
    if (!toDiscard) break;
    state.hand = state.hand.filter((c) => c !== toDiscard);
    state.graveyard.push(toDiscard);
  }

  // End-of-turn mana reflects ramp benefit (rocks, searched lands untap next turn)
  const manaAvailableEndOfTurn = sumManaPool(computeAvailableMana(state));
  const landOnlyMana = computeNaturalLandMana(state);

  return {
    turn: state.turn,
    cardsDrawn,
    landPlayed,
    spellsCast,
    manaAvailable: manaAvailableEndOfTurn,
    manaFromLandsOnly: landOnlyMana,
    manaUsed,
    handSize: state.hand.length,
    hand: state.hand.map((c) => c.name),
    permanentCount: state.battlefield.length,
    permanents: snapshotBattlefield(state),
    commanderCast,
    libraryActions,
    graveyard: state.graveyard.map((c) => c.name),
    exile: state.exile.map((c) => c.name),
  };
}

// ---------------------------------------------------------------------------
// Single game runner
// ---------------------------------------------------------------------------

/**
 * Run a single goldfish game for N turns, returning the game log.
 * When a seed is provided, the game is fully deterministic (same seed = same game).
 */
export function runGoldfishGame(
  pool: GoldfishCard[],
  commandZone: GoldfishCard[],
  config: GoldfishConfig,
  seed?: number
): GoldfishGameLog {
  const random = seed !== undefined ? createPRNG(seed) : Math.random;
  const state = initializeGame(pool, commandZone, random);

  // Capture opening hand before any turns execute
  const openingHandCards = state.hand.map((c) => ({
    name: c.name,
    imageUri: c.enriched.imageUris?.normal ?? null,
    typeLine: c.enriched.typeLine,
    manaCost: c.enriched.manaCost,
  }));

  // Evaluate keepability
  const handCards: HandCard[] = state.hand.map((c) => ({
    name: c.name,
    quantity: 1,
    enriched: c.enriched,
  }));
  const cmdCards: HandCard[] = state.commandZone.map((c) => ({
    name: c.name,
    quantity: 1,
    enriched: c.enriched,
  }));
  const identity = new Set(
    state.commandZone.flatMap((c) => c.enriched.colorIdentity)
  );
  const quality = evaluateHandQuality(handCards, 0, identity, cmdCards);

  const openingHand: GoldfishOpeningHand = {
    cards: openingHandCards,
    score: quality.score,
    verdict: quality.verdict,
    reasoning: quality.reasoning,
  };

  const turnLogs: GoldfishTurnLog[] = [];
  let commanderFirstCastTurn: number | null = null;

  for (let t = 0; t < config.turns; t++) {
    const log = executeTurn(state, config);
    turnLogs.push(log);

    if (log.commanderCast && commanderFirstCastTurn === null) {
      commanderFirstCastTurn = log.turn;
    }
  }

  return { turnLogs, commanderFirstCastTurn, openingHand };
}

// ---------------------------------------------------------------------------
// Aggregate statistics
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeAggregateStats(
  games: GoldfishGameLog[],
  turns: number
): GoldfishAggregateStats {
  if (games.length === 0) {
    return {
      avgManaByTurn: Array(turns).fill(0),
      avgManaUsedByTurn: Array(turns).fill(0),
      avgSpellsByTurn: Array(turns).fill(0),
      avgHandSizeByTurn: Array(turns).fill(0),
      medianManaByTurn: Array(turns).fill(0),
      commanderCastRate: 0,
      avgCommanderTurn: null,
      rampAcceleration: 0,
      avgTotalSpellsCast: 0,
      rampSources: [],
    };
  }

  const n = games.length;

  // Per-turn averages
  const avgManaByTurn: number[] = [];
  const avgManaUsedByTurn: number[] = [];
  const avgSpellsByTurn: number[] = [];
  const avgHandSizeByTurn: number[] = [];
  const medianManaByTurn: number[] = [];

  const avgLandOnlyManaByTurn: number[] = [];

  for (let t = 0; t < turns; t++) {
    const manaValues: number[] = [];
    const landOnlyValues: number[] = [];
    let totalManaUsed = 0;
    let totalSpells = 0;
    let totalHandSize = 0;

    for (const game of games) {
      const log = game.turnLogs[t];
      if (!log) continue;
      manaValues.push(log.manaAvailable);
      landOnlyValues.push(log.manaFromLandsOnly);
      totalManaUsed += log.manaUsed;
      totalSpells += log.spellsCast.length;
      totalHandSize += log.handSize;
    }

    const validGames = games.filter((g) => g.turnLogs[t]).length;
    avgManaByTurn.push(
      validGames > 0
        ? Math.round((manaValues.reduce((a, b) => a + b, 0) / validGames) * 100) / 100
        : 0
    );
    avgLandOnlyManaByTurn.push(
      validGames > 0
        ? Math.round((landOnlyValues.reduce((a, b) => a + b, 0) / validGames) * 100) / 100
        : 0
    );
    avgManaUsedByTurn.push(
      validGames > 0 ? Math.round((totalManaUsed / validGames) * 100) / 100 : 0
    );
    avgSpellsByTurn.push(
      validGames > 0 ? Math.round((totalSpells / validGames) * 100) / 100 : 0
    );
    avgHandSizeByTurn.push(
      validGames > 0 ? Math.round((totalHandSize / validGames) * 100) / 100 : 0
    );
    medianManaByTurn.push(median(manaValues));
  }

  // Commander stats
  const gamesWithCommander = games.filter(
    (g) => g.commanderFirstCastTurn !== null
  );
  const commanderCastRate = gamesWithCommander.length / n;
  const avgCommanderTurn =
    gamesWithCommander.length > 0
      ? gamesWithCommander.reduce(
          (sum, g) => sum + (g.commanderFirstCastTurn ?? 0),
          0
        ) / gamesWithCommander.length
      : null;

  // Ramp acceleration: avg total mana at T4 minus avg land-only mana at T4.
  // Both values come from the same simulation so variance cancels out.
  const t4Index = 3; // 0-based index for turn 4
  const avgManaT4 = avgManaByTurn[t4Index] ?? 0;
  const avgLandOnlyT4 = avgLandOnlyManaByTurn[t4Index] ?? 0;
  const rampAcceleration =
    Math.round(Math.max(0, avgManaT4 - avgLandOnlyT4) * 100) / 100;

  // Avg total spells cast per game
  const avgTotalSpellsCast =
    games.reduce(
      (sum, g) =>
        sum + g.turnLogs.reduce((s, l) => s + l.spellsCast.length, 0),
      0
    ) / n;

  return {
    avgManaByTurn,
    avgManaUsedByTurn,
    avgSpellsByTurn,
    avgHandSizeByTurn,
    medianManaByTurn,
    commanderCastRate,
    avgCommanderTurn,
    rampAcceleration,
    avgTotalSpellsCast: Math.round(avgTotalSpellsCast * 100) / 100,
    rampSources: [], // populated by runGoldfishSimulation after aggregation
  };
}

// ---------------------------------------------------------------------------
// Ramp source analysis
// ---------------------------------------------------------------------------

/**
 * Classify what kind of ramp source a card is.
 */
function classifyRampSourceType(card: GoldfishCard): RampSourceType | null {
  if (!card.tags.includes("Ramp")) return null;

  const e = card.enriched;

  // Instant/Sorcery ramp effects
  if (isInstantOrSorcery(e)) {
    const effect = classifyRampEffect(card);
    if (effect === "land-search") return "land-search";
    if (effect === "ritual") return "ritual";
    return "land-search"; // default for ramp-tagged instants/sorceries
  }

  // Creature with producedMana → dork
  if (e.typeLine.includes("Creature") && e.producedMana.length > 0) {
    return "dork";
  }

  // Non-creature permanent with producedMana or tap-for-mana → rock
  if (e.producedMana.length > 0 || /\{T\}.*?[Aa]dd\s/.test(e.oracleText)) {
    return "rock";
  }

  // Ramp-tagged but doesn't fit above (e.g., land search on a creature like Solemn Simulacrum)
  if (RAMP_LAND_SEARCH_RE.test(e.oracleText)) return "land-search";

  return "rock"; // fallback for ramp-tagged cards
}

/**
 * Compute ramp source statistics from the pool and game logs.
 */
export function computeRampSources(
  pool: GoldfishCard[],
  commandZone: GoldfishCard[],
  games: GoldfishGameLog[]
): RampSource[] {
  // Find all unique ramp cards in the deck
  const allCards = [...pool, ...commandZone];
  const rampCards = new Map<string, { card: GoldfishCard; type: RampSourceType }>();

  for (const card of allCards) {
    if (rampCards.has(card.name)) continue;
    const sourceType = classifyRampSourceType(card);
    if (sourceType) {
      rampCards.set(card.name, { card, type: sourceType });
    }
  }

  if (rampCards.size === 0) return [];

  // Count cast occurrences and turns across all games
  const castData = new Map<string, { totalTurn: number; castCount: number }>();

  for (const game of games) {
    // Track which ramp cards were cast this game (first cast only for avg turn)
    const castThisGame = new Set<string>();

    for (const turnLog of game.turnLogs) {
      for (const spellName of turnLog.spellsCast) {
        if (!rampCards.has(spellName)) continue;

        let data = castData.get(spellName);
        if (!data) {
          data = { totalTurn: 0, castCount: 0 };
          castData.set(spellName, data);
        }

        if (!castThisGame.has(spellName)) {
          data.totalTurn += turnLog.turn;
          data.castCount++;
          castThisGame.add(spellName);
        }
      }
    }
  }

  const n = games.length;

  // Build RampSource entries
  const sources: RampSource[] = [];
  for (const [name, { card, type }] of rampCards) {
    const data = castData.get(name);
    sources.push({
      name,
      type,
      cmc: card.enriched.cmc,
      avgCastTurn: data && data.castCount > 0
        ? Math.round((data.totalTurn / data.castCount) * 10) / 10
        : null,
      castRate: data ? Math.round((data.castCount / n) * 1000) / 10 : 0,
    });
  }

  // Sort: highest cast rate first, then by CMC ascending
  sources.sort((a, b) => {
    if (b.castRate !== a.castRate) return b.castRate - a.castRate;
    return a.cmc - b.cmc;
  });

  return sources;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * Replay a goldfish game from its seed — deterministic, produces full detail.
 */
export function replayGoldfishGame(
  pool: GoldfishCard[],
  commandZone: GoldfishCard[],
  config: GoldfishConfig,
  seed: number
): GoldfishGameLog {
  return runGoldfishGame(pool, commandZone, config, seed);
}

// ---------------------------------------------------------------------------
// Notable games
// ---------------------------------------------------------------------------

/**
 * Scan game summaries and pick notable games (best, worst, fastest commander, most ramp).
 */
export function computeNotableGames(
  summaries: GoldfishGameSummary[]
): NotableGame[] {
  if (summaries.length === 0) return [];

  const notable: NotableGame[] = [];

  // Best game: highest totalSpells
  let bestIdx = 0;
  for (let i = 1; i < summaries.length; i++) {
    if (summaries[i].totalSpells > summaries[bestIdx].totalSpells) {
      bestIdx = i;
    }
  }
  notable.push({
    label: "Best Game",
    description: `${summaries[bestIdx].totalSpells} spells cast`,
    summaryIndex: bestIdx,
  });

  // Worst game: lowest totalSpells
  let worstIdx = 0;
  for (let i = 1; i < summaries.length; i++) {
    if (summaries[i].totalSpells < summaries[worstIdx].totalSpells) {
      worstIdx = i;
    }
  }
  if (worstIdx !== bestIdx) {
    notable.push({
      label: "Worst Game",
      description: `${summaries[worstIdx].totalSpells} spells cast`,
      summaryIndex: worstIdx,
    });
  }

  // Fastest commander: earliest commanderCastTurn
  let fastCmdIdx = -1;
  for (let i = 0; i < summaries.length; i++) {
    if (summaries[i].commanderCastTurn !== null) {
      if (
        fastCmdIdx === -1 ||
        summaries[i].commanderCastTurn! < summaries[fastCmdIdx].commanderCastTurn!
      ) {
        fastCmdIdx = i;
      }
    }
  }
  if (fastCmdIdx !== -1 && fastCmdIdx !== bestIdx && fastCmdIdx !== worstIdx) {
    notable.push({
      label: "Fastest Commander",
      description: `Cast on turn ${summaries[fastCmdIdx].commanderCastTurn}`,
      summaryIndex: fastCmdIdx,
    });
  }

  // Most ramp: highest manaAtT4
  let mostRampIdx = 0;
  for (let i = 1; i < summaries.length; i++) {
    if (summaries[i].manaAtT4 > summaries[mostRampIdx].manaAtT4) {
      mostRampIdx = i;
    }
  }
  const usedIndices = new Set(notable.map((n) => n.summaryIndex));
  if (!usedIndices.has(mostRampIdx)) {
    notable.push({
      label: "Most Ramp",
      description: `${summaries[mostRampIdx].manaAtT4} mana at T4`,
      summaryIndex: mostRampIdx,
    });
  }

  return notable;
}

// ---------------------------------------------------------------------------
// Game summary extraction
// ---------------------------------------------------------------------------

function extractGameSummary(
  game: GoldfishGameLog,
  seed: number
): GoldfishGameSummary {
  const totalSpells = game.turnLogs.reduce(
    (sum, l) => sum + l.spellsCast.length,
    0
  );
  const t4Log = game.turnLogs[3]; // 0-based index for turn 4
  return {
    seed,
    totalSpells,
    handVerdict: game.openingHand.verdict,
    handScore: game.openingHand.score,
    commanderCastTurn: game.commanderFirstCastTurn,
    manaAtT4: t4Log?.manaAvailable ?? 0,
    finalPermanentCount:
      game.turnLogs.length > 0
        ? game.turnLogs[game.turnLogs.length - 1].permanentCount
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Monte Carlo runner
// ---------------------------------------------------------------------------

/**
 * Run the full goldfish simulation: builds pool, runs N games, aggregates stats.
 * Each game gets a unique seed for deterministic replay.
 */
export function runGoldfishSimulation(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  config: GoldfishConfig = DEFAULT_GOLDFISH_CONFIG
): GoldfishResult {
  const pool = buildGoldfishPoolFromDeck(deck, cardMap);
  const commandZone = buildGoldfishCommandZoneFromDeck(deck, cardMap);

  const games: GoldfishGameLog[] = [];
  const gameSummaries: GoldfishGameSummary[] = [];

  for (let i = 0; i < config.iterations; i++) {
    const seed = randomSeed();
    const game = runGoldfishGame(pool, commandZone, config, seed);
    games.push(game);
    gameSummaries.push(extractGameSummary(game, seed));
  }

  const stats = computeAggregateStats(games, config.turns);
  stats.rampSources = computeRampSources(pool, commandZone, games);

  const notableGames = computeNotableGames(gameSummaries);

  return { games, stats, gameSummaries, notableGames, pool, commandZone };
}
