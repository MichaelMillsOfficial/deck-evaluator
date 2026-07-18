import type { DeckCard, DeckData } from "@/lib/types";
import type { ParseResult } from "@/lib/decklist-parser";

const SESSION_KEY = "astral.crucible-session.v1";

export type CrucibleCardStatus = "keep" | "cut" | "undecided";

/**
 * Snapshot of an in-progress Crucible triage session. Persisted to
 * sessionStorage under its own key so it can coexist with the reading session.
 *
 * Lifecycle:
 *   - /crucible import success → createCrucibleSession + save
 *   - triage                    → setCardStatus / commanders updates + save
 *   - "Seal the Deck"           → buildFinalDeck → setPayload → /ritual
 */
export interface CruciblePayload {
  /** Stable id for this crucible session. Generated at import time. */
  crucibleId: string;
  /** Every imported card, quantity-aware. Never mutated by triage. */
  pool: DeckCard[];
  /** Triage status per card name. Every pool name has an entry. */
  statuses: Record<string, CrucibleCardStatus>;
  /** Partial keeps for stacked cards: kept copies per name. Only present for
   * kept cards keeping fewer than their full pool quantity. */
  keptQuantities: Record<string, number>;
  /** Chosen commander names (0-2). Must be names present in the pool. */
  commanders: string[];
  /** Non-fatal parse warnings from the pile import. */
  parseWarnings: string[];
  /** Wall-clock timestamp at import. */
  createdAt: number;
}

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export function generateCrucibleId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `crucible-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCrucibleSession(
  pool: DeckCard[],
  parseWarnings: string[]
): CruciblePayload {
  const statuses: Record<string, CrucibleCardStatus> = {};
  for (const card of pool) statuses[card.name] = "undecided";
  return {
    crucibleId: generateCrucibleId(),
    pool,
    statuses,
    keptQuantities: {},
    commanders: [],
    parseWarnings,
    createdAt: Date.now(),
  };
}

/**
 * Fold a parsed decklist back into a flat pile. The parser's commander
 * inference ("trailing 1-2 cards are the commander") misfires on plain piles,
 * so the Crucible flattens every zone into one pool and lets the user pick a
 * commander explicitly. Duplicate names across zones merge, summing quantity.
 */
export function flattenPileParse(parsed: ParseResult): {
  pool: DeckCard[];
  warnings: string[];
} {
  const merged = new Map<string, number>();
  const zones = [
    parsed.deck.commanders,
    parsed.deck.mainboard,
    parsed.deck.sideboard,
  ];
  for (const zone of zones) {
    for (const card of zone) {
      merged.set(card.name, (merged.get(card.name) ?? 0) + card.quantity);
    }
  }
  return {
    pool: Array.from(merged, ([name, quantity]) => ({ name, quantity })),
    warnings: parsed.warnings,
  };
}

export function setCardStatus(
  payload: CruciblePayload,
  name: string,
  status: CrucibleCardStatus
): CruciblePayload {
  if (!(name in payload.statuses)) return payload;
  const next: CruciblePayload = {
    ...payload,
    statuses: { ...payload.statuses, [name]: status },
  };
  if (payload.keptQuantities && name in payload.keptQuantities) {
    const keptQuantities = { ...payload.keptQuantities };
    delete keptQuantities[name];
    next.keptQuantities = keptQuantities;
  }
  return next;
}

/**
 * Keep a partial count of a stacked card (e.g. 30 of 59 Forest). Clamped to
 * [0, pool quantity]. Zero returns the card to undecided; the full quantity
 * is a plain keep with no partial entry.
 */
export function setKeptQuantity(
  payload: CruciblePayload,
  name: string,
  count: number
): CruciblePayload {
  const poolCard = payload.pool.find((card) => card.name === name);
  if (!poolCard) return payload;
  const clamped = Math.max(0, Math.min(Math.floor(count), poolCard.quantity));
  if (clamped === 0) return setCardStatus(payload, name, "undecided");
  const kept = setCardStatus(payload, name, "keep");
  if (clamped >= poolCard.quantity) return kept;
  return {
    ...kept,
    keptQuantities: { ...kept.keptQuantities, [name]: clamped },
  };
}

/** Kept copies of a pool card: full quantity for a plain keep, the partial
 * count when one is set, zero when the card is not kept. */
export function keptQuantityOf(payload: CruciblePayload, card: DeckCard): number {
  if ((payload.statuses[card.name] ?? "undecided") !== "keep") return 0;
  const partial = payload.keptQuantities?.[card.name];
  return partial === undefined ? card.quantity : Math.min(partial, card.quantity);
}

function withStatus(payload: CruciblePayload, status: CrucibleCardStatus): DeckCard[] {
  return payload.pool.filter((card) => (payload.statuses[card.name] ?? "undecided") === status);
}

export function keptCards(payload: CruciblePayload): DeckCard[] {
  return withStatus(payload, "keep").map((card) => ({
    ...card,
    quantity: keptQuantityOf(payload, card),
  }));
}

export function cutCards(payload: CruciblePayload): DeckCard[] {
  return withStatus(payload, "cut");
}

export function undecidedCards(payload: CruciblePayload): DeckCard[] {
  return withStatus(payload, "undecided");
}

/** Total kept quantity (not unique names). Commanders count via their keep status. */
export function keptCount(payload: CruciblePayload): number {
  return keptCards(payload).reduce((sum, c) => sum + c.quantity, 0);
}

/**
 * Build the final DeckData for handoff to the reading journey: commanders in
 * the command zone, kept cards as the mainboard (commanders excluded), and
 * everything else (cuts and remaining undecided) preserved as the sideboard.
 */
export function buildFinalDeck(payload: CruciblePayload, name: string): DeckData {
  const commanderSet = new Set(payload.commanders);
  const mainboard: DeckCard[] = [];
  const sideboard: DeckCard[] = [];
  for (const card of payload.pool) {
    if (commanderSet.has(card.name)) continue;
    const status = payload.statuses[card.name] ?? "undecided";
    if (status === "keep") {
      const kept = keptQuantityOf(payload, card);
      if (kept > 0) mainboard.push({ name: card.name, quantity: kept });
      const remainder = card.quantity - kept;
      if (remainder > 0) sideboard.push({ name: card.name, quantity: remainder });
    } else {
      sideboard.push(card);
    }
  }
  return {
    name,
    source: "text",
    url: "",
    commanders: payload.commanders.map((n) => ({ name: n, quantity: 1 })),
    mainboard,
    sideboard,
  };
}

/** Parse a serialized payload, returning null for corrupt or foreign JSON. */
export function parseCruciblePayload(raw: string | null): CruciblePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CruciblePayload;
    if (!parsed?.crucibleId || !Array.isArray(parsed.pool) || !parsed.statuses) {
      return null;
    }
    return { ...parsed, keptQuantities: parsed.keptQuantities ?? {} };
  } catch {
    return null;
  }
}

export function loadCrucibleSession(): CruciblePayload | null {
  if (!isBrowser()) return null;
  try {
    return parseCruciblePayload(window.sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveCrucibleSession(payload: CruciblePayload): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage can throw on quota exceeded or in restrictive private
    // modes — fail silently; the in-memory context is still valid.
  }
}

export function clearCrucibleSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}
