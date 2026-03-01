import type { DeckData, DeckCard } from "./types";

type Zone = "mainboard" | "sideboard" | "commanders";

const ZONE_HEADERS: Record<string, Zone> = {
  commander: "commanders",
  sideboard: "sideboard",
  mainboard: "mainboard",
  companion: "sideboard",
};

const CARD_LINE = /^(\d+)x?\s+(.+)$/;
const ZONE_LINE = /^(commander|sideboard|mainboard|companion):?\s*$/i;

export interface ParseDecklistOptions {
  /** When provided, these card names are used as commanders instead of
   *  header detection or heuristic inference. Cards matching these names
   *  are moved from their parsed zone into the commanders zone. */
  commanders?: string[];
}

export interface ParseResult {
  deck: DeckData;
  warnings: string[];
}

export function parseDecklist(
  text: string,
  options?: ParseDecklistOptions
): ParseResult {
  const lines = text.split(/\r?\n/);
  const hasOverride =
    options?.commanders != null && options.commanders.length > 0;

  let currentZone: Zone = "mainboard";
  let hadExplicitCommander = false;
  const warnings: string[] = [];

  const zones: Record<Zone, DeckCard[]> = {
    mainboard: [],
    sideboard: [],
    commanders: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const zoneMatch = line.match(ZONE_LINE);
    if (zoneMatch) {
      const mapped = ZONE_HEADERS[zoneMatch[1].toLowerCase()];
      if (mapped) {
        // When override is active, treat COMMANDER: header as mainboard
        // so the override is the sole source of truth for commanders.
        if (hasOverride && mapped === "commanders") {
          currentZone = "mainboard";
        } else {
          currentZone = mapped;
          if (mapped === "commanders") hadExplicitCommander = true;
        }
      }
      continue;
    }

    const cardMatch = line.match(CARD_LINE);
    if (cardMatch) {
      zones[currentZone].push({
        quantity: parseInt(cardMatch[1], 10),
        name: cardMatch[2].trim(),
      });
    } else {
      warnings.push(`Line ${i + 1}: "${line}"`);
    }
  }

  if (hasOverride) {
    // Move named cards from mainboard/sideboard into commanders
    applyCommanderOverride(options!.commanders!, zones);
  } else if (!hadExplicitCommander) {
    // Heuristic: if no explicit COMMANDER: header, check if the last
    // blank-line-separated group (1-2 cards) is likely the commander(s).
    // This handles common export formats (MTGA, Moxfield) where the
    // commander appears at the end separated by a blank line.
    inferCommanders(lines, zones);
  }

  return {
    deck: {
      name: "Imported Decklist",
      source: "text",
      url: "",
      commanders: zones.commanders,
      mainboard: zones.mainboard,
      sideboard: zones.sideboard,
    },
    warnings,
  };
}

/**
 * Moves cards with the given names from mainboard/sideboard into the
 * commanders zone. Used when the caller specifies commanders explicitly.
 */
function applyCommanderOverride(
  names: string[],
  zones: Record<Zone, DeckCard[]>
): void {
  for (const name of names) {
    let found = false;
    for (const zone of ["mainboard", "sideboard"] as Zone[]) {
      const idx = zones[zone].findIndex((c) => c.name === name);
      if (idx !== -1) {
        zones.commanders.push(zones[zone].splice(idx, 1)[0]);
        found = true;
        break;
      }
    }
    if (!found) {
      zones.commanders.push({ name, quantity: 1 });
    }
  }
}

/**
 * Converts DeckData back into standard decklist text format.
 */
export function reconstructDecklist(deck: DeckData): string {
  const lines: string[] = [];

  if (deck.commanders.length > 0) {
    lines.push("COMMANDER:");
    for (const card of deck.commanders) {
      lines.push(`${card.quantity} ${card.name}`);
    }
    lines.push("");
  }

  if (deck.mainboard.length > 0) {
    if (deck.commanders.length > 0) {
      lines.push("MAINBOARD:");
    }
    for (const card of deck.mainboard) {
      lines.push(`${card.quantity} ${card.name}`);
    }
  }

  if (deck.sideboard.length > 0) {
    lines.push("");
    lines.push("SIDEBOARD:");
    for (const card of deck.sideboard) {
      lines.push(`${card.quantity} ${card.name}`);
    }
  }

  return lines.join("\n");
}

/**
 * Scans backwards from the end of the decklist looking for a small group of
 * cards (1-2 total quantity) separated from the rest by a blank line. If found,
 * moves them from their parsed zone into the commanders zone.
 */
function inferCommanders(
  lines: string[],
  zones: Record<Zone, DeckCard[]>
): void {
  const trailingCards: string[] = [];
  let foundBlank = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) {
      if (trailingCards.length > 0) {
        foundBlank = true;
        break;
      }
      continue;
    }
    if (ZONE_LINE.test(line)) break;
    if (CARD_LINE.test(line)) {
      trailingCards.unshift(line);
    } else {
      break;
    }
  }

  if (!foundBlank || trailingCards.length === 0) return;

  const candidates: DeckCard[] = [];
  let totalQty = 0;
  for (const line of trailingCards) {
    const m = line.match(CARD_LINE);
    if (m) {
      const qty = parseInt(m[1], 10);
      totalQty += qty;
      candidates.push({ quantity: qty, name: m[2].trim() });
    }
  }

  if (totalQty < 1 || totalQty > 2) return;

  for (const cmd of candidates) {
    for (const zone of ["sideboard", "mainboard"] as Zone[]) {
      const idx = zones[zone].findIndex(
        (c) => c.name === cmd.name && c.quantity === cmd.quantity
      );
      if (idx !== -1) {
        zones[zone].splice(idx, 1);
        zones.commanders.push(cmd);
        break;
      }
    }
  }
}
