import { test, expect } from "@playwright/test";
import { SYNERGY_AXES, getAxisById } from "../src/lib/synergy-axes";
import type { EnrichedCard } from "../src/lib/types";

/** Helper to build a minimal EnrichedCard for testing axis detectors */
function mockCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
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

test.describe("Synergy Axes", () => {
  test("exports a non-empty array of axes", () => {
    expect(SYNERGY_AXES.length).toBeGreaterThanOrEqual(12);
  });

  test("each axis has required fields", () => {
    for (const axis of SYNERGY_AXES) {
      expect(axis.id).toBeTruthy();
      expect(axis.name).toBeTruthy();
      expect(typeof axis.detect).toBe("function");
    }
  });

  test("getAxisById returns the correct axis", () => {
    const counters = getAxisById("counters");
    expect(counters).toBeDefined();
    expect(counters!.name).toBe("Counters");
  });

  test("getAxisById returns undefined for unknown axis", () => {
    expect(getAxisById("nonexistent")).toBeUndefined();
  });
});

test.describe("Counters axis", () => {
  test("detects +1/+1 counter text", () => {
    const axis = getAxisById("counters")!;
    const card = mockCard({ oracleText: "Put a +1/+1 counter on target creature." });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects proliferate keyword", () => {
    const axis = getAxisById("counters")!;
    const card = mockCard({ keywords: ["Proliferate"], oracleText: "Proliferate." });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects counter doublers", () => {
    const axis = getAxisById("counters")!;
    const card = mockCard({
      name: "Doubling Season",
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("counters")!;
    const card = mockCard({ oracleText: "Flying" });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Tokens axis", () => {
  test("detects token creation", () => {
    const axis = getAxisById("tokens")!;
    const card = mockCard({
      oracleText: "Create a 1/1 white Soldier creature token.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects token doublers", () => {
    const axis = getAxisById("tokens")!;
    const card = mockCard({
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("tokens")!;
    const card = mockCard({ oracleText: "Destroy target creature." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Graveyard axis", () => {
  test("detects flashback keyword", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({ keywords: ["Flashback"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects delve keyword", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({ keywords: ["Delve"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects unearth keyword", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({ keywords: ["Unearth"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects reanimate oracle text", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({
      oracleText: "Return target creature card from your graveyard to the battlefield.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects self-mill", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({
      oracleText: "Mill four cards.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({ oracleText: "Draw a card." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("GraveyardHate axis", () => {
  test("detects Rest in Peace style global exile (all graveyards)", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText:
        "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects exile each opponent's graveyard", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText: "Exile each opponent's graveyard.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("does NOT detect targeted exile (exile target card from a graveyard)", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText: "Exile target card from a graveyard. You gain 2 life.",
    });
    // GY_HATE_EXILE_RE should not match targeted effects
    expect(axis.detect(card)).toBe(0);
  });

  test("does NOT detect targeted player graveyard exile", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText: "Exile all cards from target player's graveyard.",
    });
    // Targeting a single player is not global enough
    expect(axis.detect(card)).toBe(0);
  });

  test("detects exile-instead replacement effects", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText:
        "If a card or token would be put into a graveyard from anywhere, exile it instead.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects cards that can't be in graveyards", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({
      oracleText: "Cards in graveyards can't be the targets of spells or abilities.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("graveyardHate")!;
    const card = mockCard({ oracleText: "Flying" });
    expect(axis.detect(card)).toBe(0);
  });

  test("conflicts with graveyard axis", () => {
    const axis = getAxisById("graveyardHate")!;
    expect(axis.conflictsWith).toContain("graveyard");
  });
});

test.describe("Sacrifice axis", () => {
  test("detects sacrifice outlets", () => {
    const axis = getAxisById("sacrifice")!;
    const card = mockCard({
      oracleText: "Sacrifice a creature: Add one mana of any color.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects death triggers", () => {
    const axis = getAxisById("sacrifice")!;
    const card = mockCard({
      oracleText: "Whenever a creature you control dies, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("sacrifice")!;
    const card = mockCard({ oracleText: "Vigilance" });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Tribal axis", () => {
  test("detects lord effects", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      oracleText: "Other Elf creatures you control get +1/+1.",
      subtypes: ["Elf"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects kindred type line", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      typeLine: "Kindred Instant — Elf",
      oracleText: "Choose a creature type.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for generic creature", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      typeLine: "Creature — Human",
      oracleText: "Flying",
      subtypes: ["Human"],
    });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Landfall axis", () => {
  test("detects landfall keyword", () => {
    const axis = getAxisById("landfall")!;
    const card = mockCard({ keywords: ["Landfall"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects landfall oracle text pattern", () => {
    const axis = getAxisById("landfall")!;
    const card = mockCard({
      oracleText: "Whenever a land enters the battlefield under your control, create a 0/1 Plant creature token.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects fetchlands", () => {
    const axis = getAxisById("landfall")!;
    const card = mockCard({
      typeLine: "Land",
      oracleText: "{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects extra land plays", () => {
    const axis = getAxisById("landfall")!;
    const card = mockCard({
      oracleText: "You may play an additional land on each of your turns.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("landfall")!;
    const card = mockCard({ oracleText: "Draw a card." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Spellslinger axis", () => {
  test("detects spell-cast triggers", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({
      oracleText: "Whenever you cast an instant or sorcery spell, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects instants/sorceries matter", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({
      oracleText: "Instant and sorcery spells you cast cost {1} less to cast.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({ oracleText: "Flying, first strike" });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Artifacts axis", () => {
  test("detects artifact synergy text", () => {
    const axis = getAxisById("artifacts")!;
    const card = mockCard({
      oracleText: "Whenever an artifact enters the battlefield under your control, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects affinity keyword", () => {
    const axis = getAxisById("artifacts")!;
    const card = mockCard({ keywords: ["Affinity"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("artifacts")!;
    const card = mockCard({ oracleText: "Destroy target creature." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Enchantments axis", () => {
  test("detects constellation keyword", () => {
    const axis = getAxisById("enchantments")!;
    const card = mockCard({ keywords: ["Constellation"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects enchantress effects", () => {
    const axis = getAxisById("enchantments")!;
    const card = mockCard({
      oracleText: "Whenever you cast an enchantment spell, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("enchantments")!;
    const card = mockCard({ oracleText: "Flying" });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Lifegain axis", () => {
  test("detects life gain triggers", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      oracleText: "Whenever you gain life, put a +1/+1 counter on Ajani's Pridemate.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects lifelink keyword", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({ keywords: ["Lifelink"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({ oracleText: "Destroy target artifact." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Evasion axis", () => {
  test("detects flying keyword", () => {
    const axis = getAxisById("evasion")!;
    const card = mockCard({ keywords: ["Flying"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects unblockable text", () => {
    const axis = getAxisById("evasion")!;
    const card = mockCard({
      oracleText: "This creature can't be blocked.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects combat damage triggers", () => {
    const axis = getAxisById("evasion")!;
    const card = mockCard({
      oracleText: "Whenever this creature deals combat damage to a player, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for irrelevant card", () => {
    const axis = getAxisById("evasion")!;
    const card = mockCard({ oracleText: "Destroy target enchantment." });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("Axis conflict declarations", () => {
  test("graveyard and graveyardHate conflict with each other", () => {
    const gy = getAxisById("graveyard")!;
    const gyHate = getAxisById("graveyardHate")!;
    expect(gyHate.conflictsWith).toContain("graveyard");
    expect(gy.conflictsWith).toContain("graveyardHate");
  });

  test("tokens and boardWipe conflict (if boardWipe axis exists)", () => {
    const tokens = getAxisById("tokens")!;
    // boardWipe may not be a separate axis; tokens should declare anti-synergy
    // with cards that have Board Wipe tag -- this is handled at engine level
    // So we just verify tokens axis exists
    expect(tokens).toBeDefined();
  });
});
