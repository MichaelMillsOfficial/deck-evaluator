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
    producedMana: [],
    flavorName: null,
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

  test("Halimar Depths (non-basic land with tap for mana) → NOT Ramp", () => {
    const card = makeCard({
      name: "Halimar Depths",
      oracleText:
        "This land enters tapped.\nWhen this land enters, look at the top three cards of your library, then put them back in any order.\n{T}: Add {U}.",
      typeLine: "Land",
    });
    expect(generateTags(card)).not.toContain("Ramp");
  });

  test("Nesting Grounds (non-basic land with tap for colorless) → NOT Ramp", () => {
    const card = makeCard({
      name: "Nesting Grounds",
      oracleText:
        "{T}: Add {C}.\n{1}, {T}: Move a counter from target permanent you control onto a second target permanent. Activate only as a sorcery.",
      typeLine: "Land",
    });
    expect(generateTags(card)).not.toContain("Ramp");
  });

  test("Arcane Signet (add one mana of any color) → Ramp", () => {
    const card = makeCard({
      name: "Arcane Signet",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Cradle Clearcutter (add an amount of mana) → Ramp", () => {
    const card = makeCard({
      name: "Cradle Clearcutter",
      oracleText:
        "Prototype {2}{G} — 1/3 (You may cast this spell with different mana cost, color, and size. It keeps its abilities and types.)\n{T}: Add an amount of {G} equal to this creature's power.",
      typeLine: "Artifact Creature — Golem",
      keywords: ["Prototype"],
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Fertilid (search their library for land via counter removal) → Ramp", () => {
    const card = makeCard({
      name: "Fertilid",
      oracleText:
        "This creature enters with two +1/+1 counters on it.\n{1}{G}, Remove a +1/+1 counter from this creature: Target player searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
      typeLine: "Creature — Elemental",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Commander's Sphere (add one mana of any color) → Ramp", () => {
    const card = makeCard({
      name: "Commander's Sphere",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.\nSacrifice this artifact: Draw a card.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Krosan Verge (land that searches for Forest/Plains) → Ramp", () => {
    const card = makeCard({
      name: "Krosan Verge",
      oracleText:
        "This land enters tapped.\n{T}: Add {C}.\n{2}, {T}, Sacrifice this land: Search your library for a Forest card and a Plains card, put them onto the battlefield tapped, then shuffle.",
      typeLine: "Land",
    });
    expect(generateTags(card)).toContain("Ramp");
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

  test("Brainstorm (draw three) → Card Draw, NOT Card Advantage", () => {
    const card = makeCard({
      name: "Brainstorm",
      oracleText:
        "Draw three cards, then put two cards from your hand on top of your library.",
      typeLine: "Instant",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Card Draw");
    expect(tags).not.toContain("Card Advantage");
  });
});

test.describe("generateTags — Card Advantage", () => {
  test("Adaptive Omnitool (look at top, put in hand) → Card Advantage", () => {
    const card = makeCard({
      name: "Adaptive Omnitool",
      oracleText:
        "Equipped creature gets +1/+1 for each artifact you control.\nWhenever equipped creature attacks, look at the top six cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\nEquip {3}",
      typeLine: "Artifact — Equipment",
      keywords: ["Equip"],
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Ancient Stirrings (look at top, put in hand) → Card Advantage", () => {
    const card = makeCard({
      name: "Ancient Stirrings",
      oracleText:
        "Look at the top five cards of your library. You may reveal a colorless card from among them and put it into your hand. Then put the rest on the bottom of your library in any order.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Impulse (look at top 4, put one in hand) → Card Advantage", () => {
    const card = makeCard({
      name: "Impulse",
      oracleText:
        "Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.",
      typeLine: "Instant",
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Commander's Sphere (literal draw) → Card Draw, NOT Card Advantage", () => {
    const card = makeCard({
      name: "Commander's Sphere",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.\nSacrifice this artifact: Draw a card.",
      typeLine: "Artifact",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Card Draw");
    expect(tags).not.toContain("Card Advantage");
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

  test("Evacuation (return all creatures to hands) → Board Wipe", () => {
    const card = makeCard({
      name: "Evacuation",
      oracleText: "Return all creatures to their owners' hands.",
      typeLine: "Instant",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Removal");
  });
});

test.describe("generateTags — Cost Reduction", () => {
  test("Etherium Sculptor (artifact spells cost less) → Cost Reduction", () => {
    const card = makeCard({
      name: "Etherium Sculptor",
      oracleText: "Artifact spells you cast cost {1} less to cast.",
      typeLine: "Artifact Creature — Vedalken Artificer",
    });
    expect(generateTags(card)).toContain("Cost Reduction");
  });

  test("Helm of Awakening (spells cost less) → Cost Reduction", () => {
    const card = makeCard({
      name: "Helm of Awakening",
      oracleText: "Spells cost {1} less to cast.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Cost Reduction");
  });

  test("vanilla artifact → no Cost Reduction", () => {
    const card = makeCard({
      oracleText: "{T}: Add {C}{C}.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).not.toContain("Cost Reduction");
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
