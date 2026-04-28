import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";

const SESSION_KEY = "astral.deck-session.v1";

/**
 * Snapshot of an in-progress deck reading. Persisted to sessionStorage so the
 * /reading routes can hydrate after navigation or refresh without re-importing.
 *
 * Lifecycle:
 *   - `/` import success     → save({ deck, parseWarnings, status: "ready" })
 *   - `/reading` mount       → load(); if cardMap missing, fetch enrichment + combos
 *   - enrichment completes   → save with cardMap + spellbookCombos populated
 *   - "new reading" pressed  → clear()
 */
export interface DeckSessionPayload {
  /** Stable id for this reading. Generated at import time. */
  deckId: string;
  /** Parsed deck. */
  deck: DeckData;
  /** Non-fatal parse warnings shown as a banner on /reading. */
  parseWarnings: string[];
  /** Scryfall-enriched cards keyed by name. Null until enrichment completes. */
  cardMap: Record<string, EnrichedCard> | null;
  /** Number of cards Scryfall could not resolve. 0 until enrichment completes. */
  notFoundCount: number;
  /** Commander Spellbook combos. Null until /api/deck-combos resolves. */
  spellbookCombos: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
  /** Wall-clock timestamp at import. Used for the "READING · 04.27.26" eyebrow. */
  createdAt: number;
}

const isBrowser = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export function loadDeckSession(): DeckSessionPayload | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeckSessionPayload;
    if (!parsed?.deck || !parsed?.deckId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDeckSession(payload: DeckSessionPayload): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage can throw on quota exceeded or in private modes that
    // restrict writes — fail silently; the in-memory context is still valid.
  }
}

export function clearDeckSession(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}

export function generateDeckId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `deck-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
