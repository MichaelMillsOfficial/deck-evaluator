import type { DeckData, EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingAdd {
  name: string;
  enrichedCard?: EnrichedCard;
  analysis?: CandidateAnalysis;
  error?: string;
  /** undefined = unpaired (ignored in modified deck) */
  pairedCutName?: string;
}

/**
 * Serialized form stored in sessionStorage. Strips runtime-only fields
 * (enrichedCard, analysis, error) to avoid bloating storage and stale data.
 */
export interface SerializedPendingAdd {
  name: string;
  pairedCutName?: string;
}

export interface PendingChangesPayload {
  version: 1;
  deckId: string;
  adds: SerializedPendingAdd[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns only adds that have a confirmed pairing (pairedCutName defined).
 */
export function confirmedAdds(adds: PendingAdd[]): PendingAdd[] {
  return adds.filter((a) => a.pairedCutName !== undefined);
}

/**
 * Returns a Set of all cut card names from confirmed (paired) adds.
 */
export function confirmedCutNames(adds: PendingAdd[]): Set<string> {
  const cuts = new Set<string>();
  for (const a of adds) {
    if (a.pairedCutName !== undefined) {
      cuts.add(a.pairedCutName);
    }
  }
  return cuts;
}

/**
 * Returns a Set of add names that have no pairing (pairedCutName === undefined).
 */
export function unpairedAddNames(adds: PendingAdd[]): Set<string> {
  const unpaired = new Set<string>();
  for (const a of adds) {
    if (a.pairedCutName === undefined) {
      unpaired.add(a.name);
    }
  }
  return unpaired;
}

/**
 * Builds the modified deck by applying all confirmed (paired) swaps.
 *
 * Invariant: |modifiedMainboard| === |originalMainboard| for each paired swap.
 * Unpaired adds are ignored — they do not affect the deck.
 * Commanders and sideboard are never touched.
 */
export function buildModifiedDeck(deck: DeckData, adds: PendingAdd[]): DeckData {
  const confirmedAddNames = adds
    .filter((a) => a.pairedCutName !== undefined)
    .map((a) => a.name);

  // Build a map of how many copies of each card to cut (strict 1:1 per pair).
  // Multiple pairs can target the same card name (e.g. cut 2 copies of a 4-of).
  const cutsRemaining = new Map<string, number>();
  for (const a of adds) {
    if (a.pairedCutName !== undefined) {
      cutsRemaining.set(
        a.pairedCutName,
        (cutsRemaining.get(a.pairedCutName) ?? 0) + 1
      );
    }
  }

  // Reduce quantity by 1 per paired cut; drop entries that reach 0.
  const filteredMainboard: import("@/lib/types").DeckCard[] = [];
  for (const card of deck.mainboard) {
    const remaining = cutsRemaining.get(card.name) ?? 0;
    if (remaining > 0) {
      const newQty = card.quantity - remaining;
      cutsRemaining.set(card.name, 0); // consumed all pending cuts for this entry
      if (newQty > 0) filteredMainboard.push({ ...card, quantity: newQty });
    } else {
      filteredMainboard.push(card);
    }
  }

  const additions = confirmedAddNames.map((name) => ({ name, quantity: 1 }));

  return {
    ...deck,
    mainboard: [...filteredMainboard, ...additions],
  };
}

// ---------------------------------------------------------------------------
// SessionStorage codec
// ---------------------------------------------------------------------------

const STORAGE_KEY = "dev:pending-changes:v1";

/**
 * Serializes the pending changes state for sessionStorage.
 * Strips enrichedCard, analysis, and error from each add.
 */
export function serializePendingChanges(
  deckId: string,
  adds: PendingAdd[]
): PendingChangesPayload {
  return {
    version: 1,
    deckId,
    adds: adds.map((a) => ({
      name: a.name,
      ...(a.pairedCutName !== undefined ? { pairedCutName: a.pairedCutName } : {}),
    })),
  };
}

/**
 * Deserializes pending changes from sessionStorage.
 * Returns null if the payload is malformed or the deckId does not match.
 */
export function deserializePendingChanges(
  raw: unknown,
  expectedDeckId: string
): SerializedPendingAdd[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const payload = raw as Record<string, unknown>;

  if (payload.version !== 1) return null;
  if (typeof payload.deckId !== "string") return null;
  if (!Array.isArray(payload.adds)) return null;
  if (payload.deckId !== expectedDeckId) return null;

  const adds: SerializedPendingAdd[] = [];
  for (const item of payload.adds) {
    if (!item || typeof item !== "object" || typeof (item as Record<string, unknown>).name !== "string") {
      return null;
    }
    const entry = item as Record<string, unknown>;
    adds.push({
      name: entry.name as string,
      ...(typeof entry.pairedCutName === "string"
        ? { pairedCutName: entry.pairedCutName }
        : {}),
    });
  }

  return adds;
}

// ---------------------------------------------------------------------------
// SessionStorage access helpers
// ---------------------------------------------------------------------------

const isBrowser = () =>
  typeof window !== "undefined" &&
  typeof window.sessionStorage !== "undefined";

export function loadPendingChanges(expectedDeckId: string): SerializedPendingAdd[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return deserializePendingChanges(parsed, expectedDeckId);
  } catch {
    return null;
  }
}

export function savePendingChanges(deckId: string, adds: PendingAdd[]): void {
  if (!isBrowser()) return;
  try {
    const payload = serializePendingChanges(deckId, adds);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage can throw on quota exceeded or restricted environments.
    // Fail silently — in-memory state is still valid.
  }
}

export function clearPendingChanges(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
