import { test, expect } from "@playwright/test";
import {
  computeCompositionScorecard,
  TEMPLATE_8X8,
  TEMPLATE_COMMAND_ZONE,
  AVAILABLE_TEMPLATES,
} from "../../src/lib/deck-composition";
import type { DeckData, EnrichedCard } from "../../src/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeck(overrides: Partial<DeckData> = {}): DeckData {
  return {
    name: "Test Deck",
    source: "text",
    url: "",
    commanders: [],
    mainboard: [],
    sideboard: [],
    ...overrides,
  };
}

function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card",
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Creature",
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
    ...overrides,
  };
}

// A vanilla creature — no tags, not a land
const VANILLA_BEAR = makeCard({
  name: "Grizzly Bears",
  typeLine: "Creature — Bear",
  oracleText: "",
  keywords: [],
});

// Ramp card
const SOL_RING = makeCard({
  name: "Sol Ring",
  typeLine: "Artifact",
  oracleText: "{T}: Add {C}{C}.",
});

// Card Draw
const RHYSTIC_STUDY = makeCard({
  name: "Rhystic Study",
  typeLine: "Enchantment",
  oracleText:
    "Whenever an opponent casts a spell, you may pay {1}. If you don't, draw a card.",
});

// Card Advantage (look/reveal into hand — not draw)
const SENSEI_DIVINING = makeCard({
  name: "Sensei's Divining Top",
  typeLine: "Artifact",
  oracleText:
    "Look at the top three cards of your library, then put them back in any order.",
});

// Card Advantage that merges into Card Draw bucket
const SCROLL_RACK = makeCard({
  name: "Scroll Rack",
  typeLine: "Artifact",
  oracleText:
    "Reveal any number of cards from your hand. For each card revealed this way, look at the top card of your library; you may put that card into your hand and put the revealed card on top of your library.",
});

// Removal (single target)
const SWORDS_TO_PLOWSHARES = makeCard({
  name: "Swords to Plowshares",
  typeLine: "Instant",
  oracleText: "Exile target creature.",
});

// Board Wipe (also counts as Removal)
const WRATH_OF_GOD = makeCard({
  name: "Wrath of God",
  typeLine: "Sorcery",
  oracleText: "Destroy all creatures.",
});

// Counterspell
const COUNTERSPELL = makeCard({
  name: "Counterspell",
  typeLine: "Instant",
  oracleText: "Counter target spell.",
});

// Tutor
const DEMONIC_TUTOR = makeCard({
  name: "Demonic Tutor",
  typeLine: "Sorcery",
  oracleText:
    "Search your library for a card, put it into your hand, then shuffle.",
});

// Protection (indestructible grant)
const HEROIC_INTERVENTION = makeCard({
  name: "Heroic Intervention",
  typeLine: "Instant",
  oracleText:
    "Until end of turn, permanents you control gain hexproof and indestructible.",
});

// Recursion
const REGROWTH = makeCard({
  name: "Regrowth",
  typeLine: "Sorcery",
  oracleText: "Return target card from your graveyard to your hand.",
});

// Basic land
const FOREST = makeCard({
  name: "Forest",
  typeLine: "Basic Land — Forest",
  oracleText: "({T}: Add {G}.)",
  supertypes: ["Basic"],
});

// Non-basic land
const COMMAND_TOWER = makeCard({
  name: "Command Tower",
  typeLine: "Land",
  oracleText: "{T}: Add one mana of any color in your commander's color identity.",
});

// ---------------------------------------------------------------------------
// Template constants
// ---------------------------------------------------------------------------

test.describe("AVAILABLE_TEMPLATES", () => {
  test("contains both templates", () => {
    expect(AVAILABLE_TEMPLATES).toHaveLength(2);
    const ids = AVAILABLE_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("command-zone");
    expect(ids).toContain("8x8");
  });

  test("Command Zone is first (default)", () => {
    expect(AVAILABLE_TEMPLATES[0].id).toBe("command-zone");
  });

  test("each template has required fields", () => {
    for (const t of AVAILABLE_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.categories.length).toBeGreaterThan(0);
      for (const cat of t.categories) {
        expect(cat.tag).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(cat.min).toBeGreaterThanOrEqual(0);
        expect(cat.max).toBeGreaterThanOrEqual(cat.min);
        expect(cat.description).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 2.2 — Empty deck
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — empty deck", () => {
  test("returns all counts at 0 for empty cardMap", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    // Empty cardMap — card not found
    const result = computeCompositionScorecard(deck, {}, TEMPLATE_COMMAND_ZONE);

    for (const cat of result.categories) {
      expect(cat.count).toBe(0);
    }
  });

  test("large-min categories are critical when no cards enriched", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const result = computeCompositionScorecard(deck, {}, TEMPLATE_COMMAND_ZONE);
    // Categories with min > 2 are critical at count=0 (count < min - 2)
    const largeMins = result.categories.filter((c) => c.min > 2);
    for (const cat of largeMins) {
      expect(cat.status).toBe("critical");
    }
    // Categories with min <= 2 at count=0: count >= min - 2 (e.g. 0 >= 0) → "low"
    const smallMins = result.categories.filter((c) => c.min <= 2);
    for (const cat of smallMins) {
      expect(["critical", "low"]).toContain(cat.status);
    }
  });

  test("overall health is major-gaps when all categories critical", () => {
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    expect(result.overallHealth).toBe("major-gaps");
  });

  test("healthSummary is non-empty string", () => {
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    expect(typeof result.healthSummary).toBe("string");
    expect(result.healthSummary.length).toBeGreaterThan(0);
  });

  test("result has templateId and templateName matching input", () => {
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_8X8);
    expect(result.templateId).toBe("8x8");
    expect(result.templateName).toBe(TEMPLATE_8X8.name);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.3 — Land counting
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — land counting", () => {
  test("basic land counted in Lands category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Forest", quantity: 1 }] });
    const cardMap = { Forest: FOREST };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.count).toBe(1);
  });

  test("non-basic land counted in Lands category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Command Tower", quantity: 1 }] });
    const cardMap = { "Command Tower": COMMAND_TOWER };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.count).toBe(1);
  });

  test("multiple lands counted correctly", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 1 },
        { name: "Command Tower", quantity: 1 },
      ],
    });
    const cardMap = { Forest: FOREST, "Command Tower": COMMAND_TOWER };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.count).toBe(2);
  });

  test("non-land cards not counted in Lands category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 1 }] });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.4 — Tag-based counting
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — tag-based counting", () => {
  test("Ramp card counted in Ramp category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 1 }] });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const ramp = result.categories.find((c) => c.tag === "Ramp")!;
    expect(ramp.count).toBe(1);
  });

  test("Card Draw card counted in Card Draw category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Rhystic Study", quantity: 1 }] });
    const cardMap = { "Rhystic Study": RHYSTIC_STUDY };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const draw = result.categories.find((c) => c.tag === "Card Draw")!;
    expect(draw.count).toBe(1);
  });

  test("Removal card counted in Removal category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Swords to Plowshares", quantity: 1 }] });
    const cardMap = { "Swords to Plowshares": SWORDS_TO_PLOWSHARES };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const removal = result.categories.find((c) => c.tag === "Removal")!;
    expect(removal.count).toBe(1);
  });

  test("Board Wipe counted in both Board Wipe and Removal", () => {
    const deck = makeDeck({ mainboard: [{ name: "Wrath of God", quantity: 1 }] });
    const cardMap = { "Wrath of God": WRATH_OF_GOD };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const boardWipe = result.categories.find((c) => c.tag === "Board Wipe")!;
    const removal = result.categories.find((c) => c.tag === "Removal")!;
    expect(boardWipe.count).toBe(1);
    expect(removal.count).toBe(1);
  });

  test("Counterspell card counted in Counterspell category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Counterspell", quantity: 1 }] });
    const cardMap = { "Counterspell": COUNTERSPELL };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const counter = result.categories.find((c) => c.tag === "Counterspell")!;
    expect(counter.count).toBe(1);
  });

  test("Tutor card counted in Tutor category (8x8 template)", () => {
    const deck = makeDeck({ mainboard: [{ name: "Demonic Tutor", quantity: 1 }] });
    const cardMap = { "Demonic Tutor": DEMONIC_TUTOR };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_8X8);
    const tutor = result.categories.find((c) => c.tag === "Tutor")!;
    expect(tutor).toBeDefined();
    expect(tutor.count).toBe(1);
  });

  test("Protection card counted in Protection category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Heroic Intervention", quantity: 1 }] });
    const cardMap = { "Heroic Intervention": HEROIC_INTERVENTION };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const protection = result.categories.find((c) => c.tag === "Protection")!;
    expect(protection.count).toBe(1);
  });

  test("Recursion card counted in Recursion category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Regrowth", quantity: 1 }] });
    const cardMap = { "Regrowth": REGROWTH };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const recursion = result.categories.find((c) => c.tag === "Recursion")!;
    expect(recursion.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.5 — Status thresholds
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — status thresholds", () => {
  // Command Zone Ramp: min=10, max=12
  // We test all threshold variants using Ramp

  function rampResult(count: number) {
    const cards = Array.from({ length: count }, (_, i) => ({
      name: `Ramp Card ${i + 1}`,
      quantity: 1,
    }));
    const cardMap: Record<string, EnrichedCard> = {};
    for (const c of cards) {
      cardMap[c.name] = makeCard({
        name: c.name,
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
      });
    }
    const deck = makeDeck({ mainboard: cards });
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    return result.categories.find((c) => c.tag === "Ramp")!;
  }

  test("count at min → good", () => {
    // min = 10
    expect(rampResult(10).status).toBe("good");
  });

  test("count at max → good", () => {
    // max = 12
    expect(rampResult(12).status).toBe("good");
  });

  test("count between min and max → good", () => {
    expect(rampResult(11).status).toBe("good");
  });

  test("count 1 below min → low", () => {
    // 9 = 10 - 1 (within 2 below min)
    expect(rampResult(9).status).toBe("low");
  });

  test("count 2 below min → low", () => {
    // 8 = 10 - 2 (exactly at boundary, should be low)
    expect(rampResult(8).status).toBe("low");
  });

  test("count 3 below min → critical", () => {
    // 7 = 10 - 3 (exceeds threshold of min - 2)
    expect(rampResult(7).status).toBe("critical");
  });

  test("count 0 → critical (far below min)", () => {
    expect(rampResult(0).status).toBe("critical");
  });

  test("count above max → high", () => {
    expect(rampResult(15).status).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Phase 2.6 — Status message strings
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — statusMessage strings", () => {
  // Use Ramp (min=10, max=12) from Command Zone template

  function rampCategory(count: number) {
    const cards = Array.from({ length: count }, (_, i) => ({
      name: `R${i}`,
      quantity: 1,
    }));
    const cardMap: Record<string, EnrichedCard> = {};
    for (const c of cards) {
      cardMap[c.name] = makeCard({
        name: c.name,
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
      });
    }
    const deck = makeDeck({ mainboard: cards });
    return computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE).categories.find(
      (c) => c.tag === "Ramp"
    )!;
  }

  test("On target message when count in [min, max]", () => {
    expect(rampCategory(10).statusMessage).toBe("On target");
    expect(rampCategory(11).statusMessage).toBe("On target");
    expect(rampCategory(12).statusMessage).toBe("On target");
  });

  test("'Need N+ more' when low (1-2 below min)", () => {
    const cat9 = rampCategory(9);
    expect(cat9.status).toBe("low");
    expect(cat9.statusMessage).toMatch(/Need \d+\+ more/);
  });

  test("'Critically low' message when count < min - 2", () => {
    const cat5 = rampCategory(5);
    expect(cat5.status).toBe("critical");
    expect(cat5.statusMessage).toMatch(/Critically low/i);
  });

  test("'Over by N' message when count > max", () => {
    const cat15 = rampCategory(15);
    expect(cat15.status).toBe("high");
    expect(cat15.statusMessage).toMatch(/Over by \d+/);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.7 — Overall health
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — overall health", () => {
  test("healthy when all non-critical categories (deck with 36+ lands and enough cards)", () => {
    // Build a deck with all categories satisfied for Command Zone template
    // Lands: min 36 - add 36 forests
    // Ramp: min 10 - add 10 Sol Ring variants
    // Card Draw: min 10 - add 10 Rhystic Study variants
    // Removal: min 5 - add 5 Swords variants
    // Board Wipe: min 3 - add 3 Wrath variants
    // Counterspell: min 2 - add 2 Counterspell variants
    // Protection: min 3 - add 3 Heroic Intervention variants
    // Recursion: min 2 - add 2 Regrowth variants

    const mainboard: { name: string; quantity: number }[] = [];
    const cardMap: Record<string, EnrichedCard> = {};

    // 36 lands
    for (let i = 0; i < 36; i++) {
      const name = `Land ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Basic Land — Forest", supertypes: ["Basic"], oracleText: "({T}: Add {G}.)" });
    }

    // 10 ramp
    for (let i = 0; i < 10; i++) {
      const name = `Ramp ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Artifact", oracleText: "{T}: Add {C}{C}." });
    }

    // 10 draw
    for (let i = 0; i < 10; i++) {
      const name = `Draw ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Enchantment", oracleText: "Whenever an opponent casts a spell, draw a card." });
    }

    // 5 removal
    for (let i = 0; i < 5; i++) {
      const name = `Removal ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Exile target creature." });
    }

    // 3 board wipes
    for (let i = 0; i < 3; i++) {
      const name = `Wipe ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Sorcery", oracleText: "Destroy all creatures." });
    }

    // 2 counters
    for (let i = 0; i < 2; i++) {
      const name = `Counter ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Counter target spell." });
    }

    // 3 protection
    for (let i = 0; i < 3; i++) {
      const name = `Protection ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Target permanent gains hexproof until end of turn." });
    }

    // 2 recursion
    for (let i = 0; i < 2; i++) {
      const name = `Recursion ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Sorcery", oracleText: "Return target card from your graveyard to your hand." });
    }

    const deck = makeDeck({ mainboard });
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    expect(result.overallHealth).toBe("healthy");
  });

  test("needs-attention when some low but no critical", () => {
    // Ramp at 9 (low for Command Zone: min 10) and rest 0 (would be critical)
    // We need all to be low or good - only test that at least one low + no critical = needs-attention
    // Easier: test a small deck where only one category is low and the rest are good
    const mainboard: { name: string; quantity: number }[] = [];
    const cardMap: Record<string, EnrichedCard> = {};

    // 36 lands
    for (let i = 0; i < 36; i++) {
      const name = `Land ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Basic Land — Forest", supertypes: ["Basic"] });
    }
    // 9 ramp (1 below min of 10 for Command Zone → low)
    for (let i = 0; i < 9; i++) {
      const name = `Ramp ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Artifact", oracleText: "{T}: Add {C}{C}." });
    }
    // 10 draw (at min → good)
    for (let i = 0; i < 10; i++) {
      const name = `Draw ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Enchantment", oracleText: "Whenever an opponent casts a spell, draw a card." });
    }
    // 5 removal
    for (let i = 0; i < 5; i++) {
      const name = `Removal ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Exile target creature." });
    }
    // 3 board wipes
    for (let i = 0; i < 3; i++) {
      const name = `Wipe ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Sorcery", oracleText: "Destroy all creatures." });
    }
    // 2 counters
    for (let i = 0; i < 2; i++) {
      const name = `Counter ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Counter target spell." });
    }
    // 3 protection
    for (let i = 0; i < 3; i++) {
      const name = `Protection ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Instant", oracleText: "Target permanent gains hexproof until end of turn." });
    }
    // 2 recursion
    for (let i = 0; i < 2; i++) {
      const name = `Recursion ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Sorcery", oracleText: "Return target card from your graveyard to your hand." });
    }

    const deck = makeDeck({ mainboard });
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    expect(result.overallHealth).toBe("needs-attention");
  });

  test("major-gaps when any category is critical", () => {
    // Empty deck → all categories critical → major-gaps
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    expect(result.overallHealth).toBe("major-gaps");
  });
});

// ---------------------------------------------------------------------------
// Phase 2.8 — Untagged cards
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — untagged cards", () => {
  test("vanilla creature with no tags counted as untagged non-land", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Grizzly Bears", quantity: 1 }],
    });
    const cardMap = { "Grizzly Bears": VANILLA_BEAR };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    expect(result.untaggedCount).toBe(1);
    expect(result.untaggedCards).toHaveLength(1);
    expect(result.untaggedCards[0].name).toBe("Grizzly Bears");
  });

  test("land cards not counted as untagged", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Forest", quantity: 1 }],
    });
    const cardMap = { Forest: FOREST };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    expect(result.untaggedCount).toBe(0);
    expect(result.untaggedCards).toHaveLength(0);
  });

  test("tagged cards not counted as untagged", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    expect(result.untaggedCount).toBe(0);
  });

  test("mix of tagged, untagged, and lands", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Grizzly Bears", quantity: 2 },
        { name: "Sol Ring", quantity: 1 },
        { name: "Forest", quantity: 1 },
      ],
    });
    const cardMap = {
      "Grizzly Bears": VANILLA_BEAR,
      "Sol Ring": SOL_RING,
      "Forest": FOREST,
    };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    // 2x Grizzly Bears untagged (quantity 2)
    expect(result.untaggedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.9 — Quantity multiplication
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — quantity multiplication", () => {
  test("quantity 4 counts as 4 in the category", () => {
    const deck = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 4 }] });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const ramp = result.categories.find((c) => c.tag === "Ramp")!;
    expect(ramp.count).toBe(4);
  });

  test("land quantity multiplied into land count", () => {
    const deck = makeDeck({ mainboard: [{ name: "Forest", quantity: 5 }] });
    const cardMap = { Forest: FOREST };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.10 — Cards not in cardMap
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — missing cards", () => {
  test("cards not in cardMap are silently skipped (no crash)", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Known Card", quantity: 1 },
        { name: "Unknown Card", quantity: 1 },
      ],
    });
    const cardMap = { "Known Card": SOL_RING };
    expect(() =>
      computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE)
    ).not.toThrow();
  });

  test("only known cards contribute to counts", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Missing Card", quantity: 10 },
      ],
    });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const ramp = result.categories.find((c) => c.tag === "Ramp")!;
    expect(ramp.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.11 — Template switching
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — template switching", () => {
  test("same deck, different templates, possibly different statuses for Ramp", () => {
    // 9 ramp cards
    // Command Zone: min=10 → low (9 is within 2 of 10)
    // 8x8: min=7 → good (9 >= 7)
    const mainboard: { name: string; quantity: number }[] = [];
    const cardMap: Record<string, EnrichedCard> = {};
    for (let i = 0; i < 9; i++) {
      const name = `Ramp ${i}`;
      mainboard.push({ name, quantity: 1 });
      cardMap[name] = makeCard({ name, typeLine: "Artifact", oracleText: "{T}: Add {C}{C}." });
    }
    const deck = makeDeck({ mainboard });

    const czResult = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const czRamp = czResult.categories.find((c) => c.tag === "Ramp")!;
    expect(czRamp.status).toBe("low"); // 9 < 10, within 2 → low

    const eightxResult = computeCompositionScorecard(deck, cardMap, TEMPLATE_8X8);
    const eightxRamp = eightxResult.categories.find((c) => c.tag === "Ramp")!;
    expect(eightxRamp.status).toBe("good"); // 9 >= 7 → good
  });

  test("templateId matches selected template", () => {
    const czResult = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    const eightxResult = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_8X8);
    expect(czResult.templateId).toBe("command-zone");
    expect(eightxResult.templateId).toBe("8x8");
  });
});

// ---------------------------------------------------------------------------
// Phase 2.12 — cards field per category
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — cards field", () => {
  test("Ramp category cards field contains contributing card name and quantity", () => {
    const deck = makeDeck({ mainboard: [{ name: "Sol Ring", quantity: 2 }] });
    const cardMap = { "Sol Ring": SOL_RING };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const ramp = result.categories.find((c) => c.tag === "Ramp")!;
    expect(ramp.cards).toHaveLength(1);
    expect(ramp.cards[0].name).toBe("Sol Ring");
    expect(ramp.cards[0].quantity).toBe(2);
  });

  test("Board Wipe cards appear in both Board Wipe and Removal cards list", () => {
    const deck = makeDeck({ mainboard: [{ name: "Wrath of God", quantity: 1 }] });
    const cardMap = { "Wrath of God": WRATH_OF_GOD };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const bw = result.categories.find((c) => c.tag === "Board Wipe")!;
    const rem = result.categories.find((c) => c.tag === "Removal")!;
    expect(bw.cards.some((c) => c.name === "Wrath of God")).toBe(true);
    expect(rem.cards.some((c) => c.name === "Wrath of God")).toBe(true);
  });

  test("Lands category cards contains land name and quantity", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap = { "Command Tower": COMMAND_TOWER };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const lands = result.categories.find((c) => c.tag === "Lands")!;
    expect(lands.cards).toHaveLength(1);
    expect(lands.cards[0].name).toBe("Command Tower");
    expect(lands.cards[0].quantity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.13 — Card Advantage merging into Card Draw
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — Card Advantage merges into Card Draw", () => {
  // Sensei's Divining Top has look-at ability but not draw - it gets Card Advantage tag
  // Card Advantage tagged cards should ALSO count toward Card Draw category
  test("card with Card Advantage tag contributes to Card Draw category", () => {
    // Make a card that triggers Card Advantage but NOT Card Draw
    // look at top X cards and put one into hand
    const cardAdvantageCard = makeCard({
      name: "Scroll Rack",
      typeLine: "Artifact",
      oracleText: "Look at the top three cards of your library, then put one into your hand and the rest on the bottom of your library in any order.",
    });
    const deck = makeDeck({ mainboard: [{ name: "Scroll Rack", quantity: 1 }] });
    const cardMap = { "Scroll Rack": cardAdvantageCard };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const draw = result.categories.find((c) => c.tag === "Card Draw")!;
    // Should count toward Card Draw even though the tag is "Card Advantage"
    expect(draw.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.X — Commanders included in tag counting
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — commanders included", () => {
  test("commander cards contribute to functional categories", () => {
    const commanderDraw = makeCard({
      name: "Rhystic Study Commander",
      typeLine: "Legendary Creature — Human Wizard",
      oracleText: "Whenever an opponent casts a spell, draw a card.",
    });
    const deck = makeDeck({
      commanders: [{ name: "Rhystic Study Commander", quantity: 1 }],
    });
    const cardMap = { "Rhystic Study Commander": commanderDraw };
    const result = computeCompositionScorecard(deck, cardMap, TEMPLATE_COMMAND_ZONE);
    const draw = result.categories.find((c) => c.tag === "Card Draw")!;
    expect(draw.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2.X — Count/min/max fields correct
// ---------------------------------------------------------------------------

test.describe("computeCompositionScorecard — category metadata", () => {
  test("category result contains correct min and max from template", () => {
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    const ramp = result.categories.find((c) => c.tag === "Ramp")!;
    const templateCat = TEMPLATE_COMMAND_ZONE.categories.find((c) => c.tag === "Ramp")!;
    expect(ramp.min).toBe(templateCat.min);
    expect(ramp.max).toBe(templateCat.max);
  });

  test("category result label matches template label", () => {
    const result = computeCompositionScorecard(makeDeck(), {}, TEMPLATE_COMMAND_ZONE);
    for (const cat of result.categories) {
      const templateCat = TEMPLATE_COMMAND_ZONE.categories.find((c) => c.tag === cat.tag)!;
      expect(cat.label).toBe(templateCat.label);
    }
  });
});
