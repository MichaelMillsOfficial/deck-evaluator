import type { DeckData, EnrichedCard } from "./types";
import { getTagsCached } from "./card-tags";
import { classifyLandEntry } from "./land-base-efficiency";
import { buildPool, buildCommandZone, canCastWithLands } from "./opening-hand";

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
  commandZone: GoldfishCard[];
  manaPool: ManaPool;
  landsPlayedThisTurn: number;
  commanderTaxPaid: number;
  turn: number;
  treasureCount: number;
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

export interface GoldfishTurnLog {
  turn: number;
  landPlayed: string | null;
  spellsCast: string[];
  manaAvailable: number;
  manaUsed: number;
  handSize: number;
  permanentCount: number;
  commanderCast: boolean;
}

export interface GoldfishGameLog {
  turnLogs: GoldfishTurnLog[];
  commanderFirstCastTurn: number | null;
}

export interface GoldfishResult {
  games: GoldfishGameLog[];
  stats: GoldfishAggregateStats;
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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  commandZone: GoldfishCard[]
): GoldfishGameState {
  const library = shuffleArray(pool);
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
    commandZone: [...commandZone],
    manaPool: emptyManaPool(),
    landsPlayedThisTurn: 0,
    commanderTaxPaid: 0,
    turn: 0,
    treasureCount: 0,
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

    if (isLand(card)) {
      // Lands always tap for mana (not summoning-sick, already untapped at start of turn)
      const colors =
        card.producedMana.length > 0 ? card.producedMana : ["C"];
      // Pick the "best" color to add (we'll add one mana per land)
      // For simplicity, add all produced mana colors contribute 1 mana total
      // We add one mana of the first available color
      if (colors.length > 0) {
        const color = colors[0];
        if (color === "W") pool.W++;
        else if (color === "U") pool.U++;
        else if (color === "B") pool.B++;
        else if (color === "R") pool.R++;
        else if (color === "G") pool.G++;
        else pool.C++;
      }
    } else if (isManaProducer(card)) {
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
    if (isLand(card)) {
      const colors =
        card.producedMana.length > 0 ? card.producedMana : ["C"];
      sources.push(colors);
    } else if (isManaProducer(card)) {
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
 */
function castSpell(
  state: GoldfishGameState,
  card: GoldfishCard,
  isCommander: boolean
): void {
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
    } else {
      // Non-permanent (Instant/Sorcery) goes to graveyard
      state.graveyard.push(card);
    }
  }
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

  // Draw (skip first draw on the play)
  if (!(state.turn === 1 && config.onThePlay)) {
    drawCard(state);
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

  // Recompute mana after possibly playing a land (lands contribute mana now)
  const manaPoolAfterLand = computeAvailableMana(state);
  let remainingMana = sumManaPool(manaPoolAfterLand);

  // We try to cast multiple spells per turn
  let maxAttempts = 30; // safety valve
  while (maxAttempts-- > 0) {
    const choice = chooseSpellToCast(state);
    if (!choice) break;

    const cmc = effectiveCmc(choice.card, state, choice.isCommander);
    if (cmc > remainingMana) break;

    castSpell(state, choice.card, choice.isCommander);
    spellsCast.push(choice.card.name);
    remainingMana -= cmc;
    manaUsed += cmc;

    if (choice.isCommander) {
      commanderCast = true;
    }
  }

  return {
    turn: state.turn,
    landPlayed,
    spellsCast,
    manaAvailable,
    manaUsed,
    handSize: state.hand.length,
    permanentCount: state.battlefield.length,
    commanderCast,
  };
}

// ---------------------------------------------------------------------------
// Single game runner
// ---------------------------------------------------------------------------

/**
 * Run a single goldfish game for N turns, returning the game log.
 */
export function runGoldfishGame(
  pool: GoldfishCard[],
  commandZone: GoldfishCard[],
  config: GoldfishConfig
): GoldfishGameLog {
  const state = initializeGame(pool, commandZone);
  const turnLogs: GoldfishTurnLog[] = [];
  let commanderFirstCastTurn: number | null = null;

  for (let t = 0; t < config.turns; t++) {
    const log = executeTurn(state, config);
    turnLogs.push(log);

    if (log.commanderCast && commanderFirstCastTurn === null) {
      commanderFirstCastTurn = log.turn;
    }
  }

  return { turnLogs, commanderFirstCastTurn };
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
    };
  }

  const n = games.length;

  // Per-turn averages
  const avgManaByTurn: number[] = [];
  const avgManaUsedByTurn: number[] = [];
  const avgSpellsByTurn: number[] = [];
  const avgHandSizeByTurn: number[] = [];
  const medianManaByTurn: number[] = [];

  for (let t = 0; t < turns; t++) {
    const manaValues: number[] = [];
    let totalManaUsed = 0;
    let totalSpells = 0;
    let totalHandSize = 0;

    for (const game of games) {
      const log = game.turnLogs[t];
      if (!log) continue;
      manaValues.push(log.manaAvailable);
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

  // Ramp acceleration: avg mana at turn 4 minus expected baseline (turn number)
  const t4Index = 3; // 0-based index for turn 4
  const avgManaT4 = avgManaByTurn[t4Index] ?? 0;
  const baselineT4 = 4; // without ramp, you'd expect ~4 mana on T4
  const rampAcceleration = Math.max(0, avgManaT4 - baselineT4);

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
  };
}

// ---------------------------------------------------------------------------
// Monte Carlo runner
// ---------------------------------------------------------------------------

/**
 * Run the full goldfish simulation: builds pool, runs N games, aggregates stats.
 */
export function runGoldfishSimulation(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  config: GoldfishConfig = DEFAULT_GOLDFISH_CONFIG
): GoldfishResult {
  const pool = buildGoldfishPoolFromDeck(deck, cardMap);
  const commandZone = buildGoldfishCommandZoneFromDeck(deck, cardMap);

  const games: GoldfishGameLog[] = [];
  for (let i = 0; i < config.iterations; i++) {
    games.push(runGoldfishGame(pool, commandZone, config));
  }

  const stats = computeAggregateStats(games, config.turns);

  return { games, stats };
}
