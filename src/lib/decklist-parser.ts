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

export function parseDecklist(text: string): DeckData {
  const lines = text.split(/\r?\n/);
  let currentZone: Zone = "mainboard";
  let hadExplicitCommander = false;

  const zones: Record<Zone, DeckCard[]> = {
    mainboard: [],
    sideboard: [],
    commanders: [],
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const zoneMatch = line.match(ZONE_LINE);
    if (zoneMatch) {
      const mapped = ZONE_HEADERS[zoneMatch[1].toLowerCase()];
      if (mapped) {
        currentZone = mapped;
        if (mapped === "commanders") hadExplicitCommander = true;
      }
      continue;
    }

    const cardMatch = line.match(CARD_LINE);
    if (cardMatch) {
      zones[currentZone].push({
        quantity: parseInt(cardMatch[1], 10),
        name: cardMatch[2].trim(),
      });
    }
  }

  // Heuristic: if no explicit COMMANDER: header, check if the last
  // blank-line-separated group (1-2 cards) is likely the commander(s).
  // This handles common export formats (MTGA, Moxfield) where the
  // commander appears at the end separated by a blank line.
  if (!hadExplicitCommander) {
    inferCommanders(lines, zones);
  }

  return {
    name: "Imported Decklist",
    source: "text",
    url: "",
    commanders: zones.commanders,
    mainboard: zones.mainboard,
    sideboard: zones.sideboard,
  };
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
