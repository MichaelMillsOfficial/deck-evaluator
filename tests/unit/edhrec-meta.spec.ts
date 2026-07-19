import { test, expect } from "@playwright/test";
import {
  bandFor,
  normalizeCardName,
  computeDeckMeta,
  metaHeadline,
  stockSpicyLabel,
  parseEdhrecPayload,
  COVERAGE_TOP_N,
  THIN_SAMPLE_THRESHOLD,
  type DeckMetaResult,
} from "../../src/lib/edhrec-meta";
import { makeDeck } from "../helpers";
import type { DeckCard } from "../../src/lib/types";

/** Build a normalized inclusion map (name → 0..1) from plain pairs. */
function incl(pairs: Array<[string, number]>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [name, v] of pairs) map[normalizeCardName(name)] = v;
  return map;
}

function cards(...names: string[]): DeckCard[] {
  return names.map((name) => ({ name, quantity: 1 }));
}

test.describe("bandFor", () => {
  test("assigns bands at the documented boundaries", () => {
    expect(bandFor(0.9)).toBe("staple");
    expect(bandFor(0.899)).toBe("standard");
    expect(bandFor(0.5)).toBe("standard");
    expect(bandFor(0.1)).toBe("niche");
    expect(bandFor(0.099)).toBe("spice");
    expect(bandFor(0)).toBe("spice");
  });
});

test.describe("normalizeCardName", () => {
  test("lowercases, trims, and takes the DFC front face", () => {
    expect(normalizeCardName("Sol Ring")).toBe("sol ring");
    expect(normalizeCardName("  Toxic Deluge  ")).toBe("toxic deluge");
    expect(normalizeCardName("Fire // Ice")).toBe("fire");
  });
});

test.describe("computeDeckMeta", () => {
  const inclusionMap = incl([
    ["Sol Ring", 0.96],
    ["Command Tower", 0.91],
    ["Arcane Signet", 0.88],
    ["Doubling Season", 0.71],
    ["Evolution Sage", 0.38],
    ["Contentious Plan", 0.06],
  ]);

  test("excludes basic lands and commanders from the scored set", () => {
    const deck = makeDeck({
      commanders: cards("Atraxa, Praetors' Voice"),
      mainboard: cards(
        "Atraxa, Praetors' Voice", // commander duplicated in mainboard — excluded
        "Sol Ring",
        "Doubling Season",
        "Forest", // basic land — excluded
        "Island" // basic land — excluded
      ),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.cards.map((c) => c.name).sort()).toEqual(["Doubling Season", "Sol Ring"]);
  });

  test("counts a card EDHREC has never seen as 0% spice", () => {
    const deck = makeDeck({
      mainboard: cards("Sol Ring", "My Pet Brew Card"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    const pet = r.cards.find((c) => c.name === "My Pet Brew Card");
    expect(pet).toBeTruthy();
    expect(pet!.inclusion).toBe(0);
    expect(pet!.band).toBe("spice");
    expect(r.spiceCount).toBe(1);
  });

  test("coverage measures how many of the top-N staples the deck runs", () => {
    // Top-N by inclusion from the 6-card map (N caps at map size here).
    const deck = makeDeck({
      mainboard: cards("Sol Ring", "Command Tower", "Doubling Season"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.coverage.of).toBe(Math.min(COVERAGE_TOP_N, 6));
    // Sol Ring, Command Tower, Doubling Season are all in the top 6.
    expect(r.coverage.have).toBe(3);
    expect(r.coverage.pct).toBeCloseTo(3 / 6, 5);
  });

  test("meanInclusion averages the scored set", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring", "Evolution Sage") });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.meanInclusion).toBeCloseTo((0.96 + 0.38) / 2, 5);
  });

  test("bandCounts tally the scored cards", () => {
    const deck = makeDeck({
      mainboard: cards("Sol Ring", "Doubling Season", "Evolution Sage", "Contentious Plan"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.bandCounts).toEqual({ staple: 1, standard: 1, niche: 1, spice: 1 });
  });

  test("empty inclusion map yields no-data", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring") });
    const r = computeDeckMeta(deck, {}, 12000, "primary");
    expect(r.status).toBe("no-data");
  });

  test("thin sample flags low confidence", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring") });
    expect(computeDeckMeta(deck, inclusionMap, THIN_SAMPLE_THRESHOLD - 1, "primary").status).toBe("thin");
    expect(computeDeckMeta(deck, inclusionMap, THIN_SAMPLE_THRESHOLD, "primary").status).toBe("ok");
  });

  test("carries source and commander sample size through", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring") });
    const r = computeDeckMeta(deck, inclusionMap, 4200, "combined");
    expect(r.source).toBe("combined");
    expect(r.potentialDecks).toBe(4200);
  });
});

test.describe("metaHeadline", () => {
  const base: DeckMetaResult = {
    status: "ok",
    source: "primary",
    commanderLabel: "Atraxa, Praetors' Voice",
    potentialDecks: 12000,
    cards: [],
    coverage: { pct: 0.71, have: 22, of: 31 },
    spiceCount: 3,
    meanInclusion: 0.45,
    fieldPercentile: 63,
    bandCounts: { staple: 0, standard: 0, niche: 0, spice: 0 },
  };

  test("phrases each lens correctly", () => {
    expect(metaHeadline(base, "coverage")).toBe("71% coverage · 3 spice");
    expect(metaHeadline(base, "percentile")).toBe("More stock than 63%");
    expect(metaHeadline(base, "mean")).toBe("45% mean inclusion");
  });
});

test.describe("stockSpicyLabel", () => {
  test("never grades — uses neutral stock/spicy language", () => {
    expect(stockSpicyLabel(0.9)).toMatch(/stock/i);
    expect(stockSpicyLabel(0.05)).toMatch(/spic/i);
  });
});

test.describe("parseEdhrecPayload", () => {
  const payload = {
    container: {
      json_dict: {
        cardlists: [
          {
            header: "High Synergy Cards",
            cardviews: [
              { name: "Doubling Season", num_decks: 8874, potential_decks: 12480 },
              { name: "Evolution Sage", num_decks: 4742, potential_decks: 12480 },
            ],
          },
          {
            header: "Top Cards",
            cardviews: [
              // Falls back to `inclusion` (0-100) when num_decks is absent.
              { name: "Sol Ring", inclusion: 96, potential_decks: 12480 },
            ],
          },
        ],
      },
    },
  };

  test("builds a normalized inclusion map and reads the sample size", () => {
    const { inclusionMap, potentialDecks } = parseEdhrecPayload(payload);
    expect(potentialDecks).toBe(12480);
    expect(inclusionMap[normalizeCardName("Doubling Season")]).toBeCloseTo(8874 / 12480, 5);
    expect(inclusionMap[normalizeCardName("Sol Ring")]).toBeCloseTo(0.96, 5);
  });

  test("returns an empty map for a missing/blank payload (no-data path)", () => {
    expect(parseEdhrecPayload(null).inclusionMap).toEqual({});
    expect(parseEdhrecPayload({}).potentialDecks).toBe(0);
  });
});
