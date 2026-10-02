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
  MIN_RATED_CARDS,
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
  test("assigns bands at the real-inclusion boundaries", () => {
    expect(bandFor(0.9)).toBe("staple");
    expect(bandFor(0.6)).toBe("staple");
    expect(bandFor(0.599)).toBe("standard");
    expect(bandFor(0.3)).toBe("standard");
    expect(bandFor(0.299)).toBe("niche");
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
  // 12 rated cards spanning the bands, so a deck running them clears MIN_RATED.
  const inclusionMap = incl([
    ["Sol Ring", 0.85],
    ["Command Tower", 0.92],
    ["Arcane Signet", 0.78],
    ["Swords to Plowshares", 0.62],
    ["Doubling Season", 0.55],
    ["Deepglow Skate", 0.44],
    ["Evolution Sage", 0.38],
    ["Toxic Deluge", 0.33],
    ["Inexorable Tide", 0.22],
    ["Flux Channeler", 0.18],
    ["Contentious Plan", 0.06],
    ["Ichormoon Gauntlet", 0.03],
  ]);
  const ratedNames = [
    "Sol Ring", "Command Tower", "Arcane Signet", "Swords to Plowshares",
    "Doubling Season", "Deepglow Skate", "Evolution Sage", "Toxic Deluge",
    "Inexorable Tide", "Flux Channeler", "Contentious Plan", "Ichormoon Gauntlet",
  ];

  test("excludes basic lands and commanders from the scored set", () => {
    const deck = makeDeck({
      commanders: cards("Atraxa, Praetors' Voice"),
      mainboard: cards(
        "Atraxa, Praetors' Voice", // commander duplicated in mainboard — excluded
        ...ratedNames,
        "Forest", // basic land — excluded
        "Island" // basic land — excluded
      ),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.cards.map((c) => c.name).sort()).toEqual([...ratedNames].sort());
  });

  test("excludes a card EDHREC has no data for as unrated, not spice", () => {
    const deck = makeDeck({
      mainboard: cards(...ratedNames, "My Pet Brew Card"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.cards.find((c) => c.name === "My Pet Brew Card")).toBeUndefined();
    expect(r.ratedCount).toBe(ratedNames.length);
    expect(r.unratedCount).toBe(1);
    // Only the two genuinely-low rated cards count as spice — not the unrated one.
    expect(r.spiceCount).toBe(2);
  });

  test("coverage measures how many of the top-N staples the deck runs", () => {
    const deck = makeDeck({
      mainboard: cards("Sol Ring", "Command Tower", "Doubling Season"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.coverage.of).toBe(Math.min(COVERAGE_TOP_N, 12));
    expect(r.coverage.have).toBe(3);
    expect(r.coverage.pct).toBeCloseTo(3 / 12, 5);
  });

  test("meanInclusion averages the rated set only", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring", "Evolution Sage", "Unrated Card") });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.meanInclusion).toBeCloseTo((0.85 + 0.38) / 2, 5);
  });

  test("bandCounts tally the rated cards under the tuned thresholds", () => {
    const deck = makeDeck({ mainboard: cards(...ratedNames) });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    // staple ≥.6: Sol Ring .85, Command Tower .92, Arcane Signet .78, Swords .62 → 4
    // standard .3–.6: Doubling .55, Deepglow .44, Evolution .38, Toxic .33 → 4
    // niche .1–.3: Inexorable .22, Flux .18 → 2
    // spice <.1: Contentious .06, Ichormoon .03 → 2
    expect(r.bandCounts).toEqual({ staple: 4, standard: 4, niche: 2, spice: 2 });
  });

  test("empty inclusion map yields no-data", () => {
    const deck = makeDeck({ mainboard: cards("Sol Ring") });
    const r = computeDeckMeta(deck, {}, 12000, "primary");
    expect(r.status).toBe("no-data");
  });

  test("too few rated cards yields insufficient", () => {
    const deck = makeDeck({
      mainboard: cards("Sol Ring", "Command Tower", "Unrated A", "Unrated B", "Unrated C"),
    });
    const r = computeDeckMeta(deck, inclusionMap, 12000, "primary");
    expect(r.ratedCount).toBe(2);
    expect(r.ratedCount).toBeLessThan(MIN_RATED_CARDS);
    expect(r.status).toBe("insufficient");
  });

  test("thin sample flags low confidence when there is enough rated data", () => {
    const deck = makeDeck({ mainboard: cards(...ratedNames) });
    expect(computeDeckMeta(deck, inclusionMap, THIN_SAMPLE_THRESHOLD - 1, "primary").status).toBe("thin");
    expect(computeDeckMeta(deck, inclusionMap, THIN_SAMPLE_THRESHOLD, "primary").status).toBe("ok");
  });

  test("carries source and commander sample size through", () => {
    const deck = makeDeck({ mainboard: cards(...ratedNames) });
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
    ratedCount: 45,
    unratedCount: 40,
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
