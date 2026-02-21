import { test, expect } from "@playwright/test";
import { generateTags } from "../src/lib/card-tags";
import type { EnrichedCard } from "../src/lib/types";

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
    ...overrides,
  };
}

test.describe("generateTags — Ramp", () => {
  test("Sol Ring (tap to add mana) → Ramp", () => {
    const card = makeCard({
      name: "Sol Ring",
      oracleText: "{T}: Add {C}{C}.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toEqual(["Ramp"]);
  });

  test("Cultivate (search for basic lands) → Ramp, NOT Tutor", () => {
    const card = makeCard({
      name: "Cultivate",
      oracleText:
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      typeLine: "Sorcery",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Ramp");
    expect(tags).not.toContain("Tutor");
  });

  test("Llanowar Elves (tap to add mana on creature) → Ramp", () => {
    const card = makeCard({
      name: "Llanowar Elves",
      oracleText: "{T}: Add {G}.",
      typeLine: "Creature — Elf Druid",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("vanilla creature with no mana ability → no Ramp", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      oracleText: "",
      typeLine: "Creature — Bear",
    });
    expect(generateTags(card)).not.toContain("Ramp");
  });

  test("basic land is not tagged as Ramp", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
    });
    expect(generateTags(card)).not.toContain("Ramp");
  });
});

test.describe("generateTags — Card Draw", () => {
  test("'Draw three cards.' → Card Draw", () => {
    const card = makeCard({ oracleText: "Draw three cards." });
    expect(generateTags(card)).toContain("Card Draw");
  });

  test("'Whenever a creature enters, draw a card.' → Card Draw", () => {
    const card = makeCard({
      oracleText: "Whenever a creature enters, draw a card.",
    });
    expect(generateTags(card)).toContain("Card Draw");
  });

  test("'withdraw' does not trigger false positive", () => {
    const card = makeCard({
      oracleText: "Withdraw target creature to its owner's hand.",
    });
    expect(generateTags(card)).not.toContain("Card Draw");
  });
});

test.describe("generateTags — Removal", () => {
  test("'Destroy target creature.' → Removal", () => {
    const card = makeCard({ oracleText: "Destroy target creature." });
    expect(generateTags(card)).toContain("Removal");
  });

  test("'Exile target nonland permanent.' → Removal", () => {
    const card = makeCard({ oracleText: "Exile target nonland permanent." });
    expect(generateTags(card)).toContain("Removal");
  });

  test("'Return target creature to its owner's hand.' → Removal", () => {
    const card = makeCard({
      oracleText: "Return target creature to its owner's hand.",
    });
    expect(generateTags(card)).toContain("Removal");
  });
});

test.describe("generateTags — Board Wipe", () => {
  test("'Destroy all creatures.' → Board Wipe + Removal", () => {
    const card = makeCard({ oracleText: "Destroy all creatures." });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Removal");
  });

  test("'Exile all nonland permanents.' → Board Wipe + Removal", () => {
    const card = makeCard({ oracleText: "Exile all nonland permanents." });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Removal");
  });

  test("single-target removal → no Board Wipe", () => {
    const card = makeCard({ oracleText: "Destroy target creature." });
    expect(generateTags(card)).not.toContain("Board Wipe");
  });
});

test.describe("generateTags — Counterspell", () => {
  test("'Counter target spell.' → Counterspell", () => {
    const card = makeCard({ oracleText: "Counter target spell." });
    expect(generateTags(card)).toContain("Counterspell");
  });
});

test.describe("generateTags — Tutor", () => {
  test("generic search → Tutor", () => {
    const card = makeCard({
      oracleText:
        "Search your library for a card, put it into your hand, then shuffle.",
    });
    expect(generateTags(card)).toContain("Tutor");
  });

  test("Cultivate (land search) → NOT Tutor", () => {
    const card = makeCard({
      oracleText:
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    });
    expect(generateTags(card)).not.toContain("Tutor");
  });
});

test.describe("generateTags — Protection", () => {
  test("Hexproof keyword → Protection", () => {
    const card = makeCard({ keywords: ["Hexproof"] });
    expect(generateTags(card)).toContain("Protection");
  });

  test("'gains indestructible' in oracle text → Protection", () => {
    const card = makeCard({
      oracleText: "Target creature gains indestructible until end of turn.",
    });
    expect(generateTags(card)).toContain("Protection");
  });
});

test.describe("generateTags — Recursion", () => {
  test("'Return target creature card from your graveyard to the battlefield.' → Recursion", () => {
    const card = makeCard({
      oracleText:
        "Return target creature card from your graveyard to the battlefield.",
    });
    expect(generateTags(card)).toContain("Recursion");
  });

  test("'Return target creature card from your graveyard to your hand.' → Recursion", () => {
    const card = makeCard({
      oracleText:
        "Return target creature card from your graveyard to your hand.",
    });
    expect(generateTags(card)).toContain("Recursion");
  });
});

test.describe("generateTags — Multi-tag & Edge Cases", () => {
  test("Sol Ring → only Ramp (no type tags)", () => {
    const card = makeCard({
      name: "Sol Ring",
      oracleText: "{T}: Add {C}{C}.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toEqual(["Ramp"]);
  });

  test("board wipe sorcery → Board Wipe + Removal", () => {
    const card = makeCard({
      oracleText: "Destroy all creatures.",
      typeLine: "Sorcery",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Removal");
    expect(tags).toHaveLength(2);
  });

  test("empty oracle text and no keywords → empty tags", () => {
    const card = makeCard({ oracleText: "", keywords: [] });
    expect(generateTags(card)).toEqual([]);
  });

  test("basic land → no tags", () => {
    const card = makeCard({
      name: "Plains",
      oracleText: "({T}: Add {W}.)",
      typeLine: "Basic Land — Plains",
    });
    expect(generateTags(card)).toEqual([]);
  });
});
