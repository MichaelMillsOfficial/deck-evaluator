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
      currentZone = ZONE_HEADERS[zoneMatch[1].toLowerCase()];
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

  return {
    name: "Imported Decklist",
    source: "text",
    url: "",
    commanders: zones.commanders,
    mainboard: zones.mainboard,
    sideboard: zones.sideboard,
  };
}
