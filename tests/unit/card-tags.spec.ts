import { test, expect } from "@playwright/test";
import { generateTags } from "../../src/lib/card-tags";
import type { EnrichedCard } from "../../src/lib/types";

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

// ---------------------------------------------------------------------------
// Land Tags
// ---------------------------------------------------------------------------

test.describe("generateTags — Fetch Land", () => {
  test("Polluted Delta → Fetch Land + Ramp", () => {
    const card = makeCard({
      name: "Polluted Delta",
      oracleText:
        "{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.",
      typeLine: "Land",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Fetch Land");
    expect(tags).toContain("Ramp");
  });

  test("Evolving Wilds → Fetch Land + Ramp", () => {
    const card = makeCard({
      name: "Evolving Wilds",
      oracleText:
        "{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      typeLine: "Land",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Fetch Land");
    expect(tags).toContain("Ramp");
  });

  test("Cultivate (non-land with land search) → NOT Fetch Land", () => {
    const card = makeCard({
      name: "Cultivate",
      oracleText:
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).not.toContain("Fetch Land");
  });

  test("basic Forest → NOT Fetch Land", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
    });
    expect(generateTags(card)).not.toContain("Fetch Land");
  });
});

test.describe("generateTags — ETB Tapped", () => {
  test("Temple of Malice → ETB Tapped", () => {
    const card = makeCard({
      name: "Temple of Malice",
      oracleText:
        "Temple of Malice enters the battlefield tapped. When Temple of Malice enters the battlefield, scry 1. {T}: Add {B} or {R}.",
      typeLine: "Land",
      producedMana: ["B", "R"],
    });
    expect(generateTags(card)).toContain("ETB Tapped");
  });

  test("Boros Guildgate → ETB Tapped", () => {
    const card = makeCard({
      name: "Boros Guildgate",
      oracleText:
        "Boros Guildgate enters the battlefield tapped. {T}: Add {R} or {W}.",
      typeLine: "Land — Gate",
      producedMana: ["R", "W"],
    });
    expect(generateTags(card)).toContain("ETB Tapped");
  });

  test("Breeding Pool (conditional) → NOT ETB Tapped", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    expect(generateTags(card)).not.toContain("ETB Tapped");
  });

  test("Command Tower (no tapped text) → NOT ETB Tapped", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("ETB Tapped");
  });
});

test.describe("generateTags — Conditional ETB", () => {
  test("Breeding Pool (shock land) → Conditional ETB", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    expect(generateTags(card)).toContain("Conditional ETB");
  });

  test("Glacial Fortress (check land) → Conditional ETB", () => {
    const card = makeCard({
      name: "Glacial Fortress",
      oracleText:
        "Glacial Fortress enters the battlefield tapped unless you control a Plains or an Island. {T}: Add {W} or {U}.",
      typeLine: "Land",
      producedMana: ["W", "U"],
    });
    expect(generateTags(card)).toContain("Conditional ETB");
  });

  test("Blackcleave Cliffs (fast land) → Conditional ETB", () => {
    const card = makeCard({
      name: "Blackcleave Cliffs",
      oracleText:
        "Blackcleave Cliffs enters the battlefield tapped unless you control two or fewer other lands. {T}: Add {B} or {R}.",
      typeLine: "Land",
      producedMana: ["B", "R"],
    });
    expect(generateTags(card)).toContain("Conditional ETB");
  });

  test("Temple of Malice (unconditional tapped) → NOT Conditional ETB", () => {
    const card = makeCard({
      name: "Temple of Malice",
      oracleText:
        "Temple of Malice enters the battlefield tapped. When Temple of Malice enters the battlefield, scry 1. {T}: Add {B} or {R}.",
      typeLine: "Land",
      producedMana: ["B", "R"],
    });
    expect(generateTags(card)).not.toContain("Conditional ETB");
  });

  test("Command Tower (no tapped text) → NOT Conditional ETB", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("Conditional ETB");
  });
});

test.describe("generateTags — Mana Fixing", () => {
  test("Command Tower (any color) → Mana Fixing", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).toContain("Mana Fixing");
  });

  test("City of Brass (any color) → Mana Fixing", () => {
    const card = makeCard({
      name: "City of Brass",
      oracleText:
        "Whenever City of Brass becomes tapped, it deals 1 damage to you. {T}: Add one mana of any color.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).toContain("Mana Fixing");
  });

  test("Breeding Pool (2 colors) → Mana Fixing", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    expect(generateTags(card)).toContain("Mana Fixing");
  });

  test("basic Forest (1 color) → NOT Mana Fixing", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
      producedMana: ["G"],
    });
    expect(generateTags(card)).not.toContain("Mana Fixing");
  });

  test("Ancient Tomb (colorless only) → NOT Mana Fixing", () => {
    const card = makeCard({
      name: "Ancient Tomb",
      oracleText: "{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.",
      typeLine: "Land",
      producedMana: ["C"],
    });
    expect(generateTags(card)).not.toContain("Mana Fixing");
  });
});

test.describe("generateTags — Utility Land", () => {
  test("Reliquary Tower (static ability) → Utility Land", () => {
    const card = makeCard({
      name: "Reliquary Tower",
      oracleText: "You have no maximum hand size. {T}: Add {C}.",
      typeLine: "Land",
      producedMana: ["C"],
    });
    expect(generateTags(card)).toContain("Utility Land");
  });

  test("Bojuka Bog (ETB trigger) → Utility Land", () => {
    const card = makeCard({
      name: "Bojuka Bog",
      oracleText:
        "Bojuka Bog enters the battlefield tapped. When Bojuka Bog enters the battlefield, exile all cards from target player's graveyard. {T}: Add {B}.",
      typeLine: "Land",
      producedMana: ["B"],
    });
    expect(generateTags(card)).toContain("Utility Land");
  });

  test("Maze of Ith (activated non-mana ability) → Utility Land", () => {
    const card = makeCard({
      name: "Maze of Ith",
      oracleText:
        "{T}: Untap target attacking creature. Prevent all combat damage that would be dealt to and dealt by that creature this turn.",
      typeLine: "Land",
    });
    expect(generateTags(card)).toContain("Utility Land");
  });

  test("basic Forest → NOT Utility Land", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
    });
    expect(generateTags(card)).not.toContain("Utility Land");
  });

  test("Command Tower (only mana production) → NOT Utility Land", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("Utility Land");
  });

  test("Breeding Pool (only mana + ETB condition) → NOT Utility Land", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    expect(generateTags(card)).not.toContain("Utility Land");
  });
});

test.describe("generateTags — Basic Types", () => {
  test("Breeding Pool (Forest Island) → Basic Types", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    expect(generateTags(card)).toContain("Basic Types");
  });

  test("Blood Crypt (Swamp Mountain) → Basic Types", () => {
    const card = makeCard({
      name: "Blood Crypt",
      oracleText:
        "({T}: Add {B} or {R}.) As Blood Crypt enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Swamp Mountain",
      supertypes: [],
      subtypes: ["Swamp", "Mountain"],
      producedMana: ["B", "R"],
    });
    expect(generateTags(card)).toContain("Basic Types");
  });

  test("basic Forest → NOT Basic Types (is a basic land)", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
      producedMana: ["G"],
    });
    expect(generateTags(card)).not.toContain("Basic Types");
  });

  test("Command Tower (no subtypes) → NOT Basic Types", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("Basic Types");
  });
});

test.describe("generateTags — Mana Accel Land", () => {
  test("Ancient Tomb ({C}{C}) → Mana Accel Land", () => {
    const card = makeCard({
      name: "Ancient Tomb",
      oracleText: "{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.",
      typeLine: "Land",
      producedMana: ["C"],
    });
    expect(generateTags(card)).toContain("Mana Accel Land");
  });

  test("Temple of the False God ({C}{C} conditional) → Mana Accel Land", () => {
    const card = makeCard({
      name: "Temple of the False God",
      oracleText:
        "{T}: Add {C}{C}. Activate only if you control five or more lands.",
      typeLine: "Land",
      producedMana: ["C"],
    });
    expect(generateTags(card)).toContain("Mana Accel Land");
  });

  test("Gaea's Cradle (add for each) → Mana Accel Land", () => {
    const card = makeCard({
      name: "Gaea's Cradle",
      oracleText: "{T}: Add {G} for each creature you control.",
      typeLine: "Legendary Land",
      producedMana: ["G"],
    });
    expect(generateTags(card)).toContain("Mana Accel Land");
  });

  test("Nykthos, Shrine to Nyx (add an amount) → Mana Accel Land", () => {
    const card = makeCard({
      name: "Nykthos, Shrine to Nyx",
      oracleText:
        "{T}: Add {C}. {2}, {T}: Choose a color. Add an amount of mana of that color equal to your devotion to that color.",
      typeLine: "Legendary Land",
      producedMana: ["C", "W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).toContain("Mana Accel Land");
  });

  test("Cabal Coffers (add for each Swamp) → Mana Accel Land", () => {
    const card = makeCard({
      name: "Cabal Coffers",
      oracleText: "{2}, {T}: Add {B} for each Swamp you control.",
      typeLine: "Land",
      producedMana: ["B"],
    });
    expect(generateTags(card)).toContain("Mana Accel Land");
  });

  test("Command Tower (only 1 mana) → NOT Mana Accel Land", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("Mana Accel Land");
  });

  test("Sol Ring (artifact, not land) → NOT Mana Accel Land", () => {
    const card = makeCard({
      name: "Sol Ring",
      oracleText: "{T}: Add {C}{C}.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).not.toContain("Mana Accel Land");
  });
});

test.describe("generateTags — Non-Land Types", () => {
  test("Dryad Arbor (Land Creature) → Non-Land Types", () => {
    const card = makeCard({
      name: "Dryad Arbor",
      oracleText: "(Dryad Arbor isn't a spell, it's affected by summoning sickness, and it has \"{T}: Add {G}.\")",
      typeLine: "Land Creature — Forest Dryad",
      supertypes: [],
      subtypes: ["Forest", "Dryad"],
      producedMana: ["G"],
    });
    expect(generateTags(card)).toContain("Non-Land Types");
  });

  test("Urza's Saga (Enchantment Land) → Non-Land Types", () => {
    const card = makeCard({
      name: "Urza's Saga",
      oracleText:
        "(As this Saga enters and after your draw step, add a lore counter.) I — {T}: Add {C}. II — {T}: Add {C}{C}. III — Search your library for an artifact card with mana cost {0} or {1}, put it onto the battlefield, then shuffle.",
      typeLine: "Enchantment Land — Urza's Saga",
      supertypes: [],
      subtypes: ["Urza's", "Saga"],
    });
    expect(generateTags(card)).toContain("Non-Land Types");
  });

  test("Darksteel Citadel (Artifact Land) → Non-Land Types", () => {
    const card = makeCard({
      name: "Darksteel Citadel",
      oracleText: "Indestructible. {T}: Add {C}.",
      typeLine: "Artifact Land",
      keywords: ["Indestructible"],
      producedMana: ["C"],
    });
    expect(generateTags(card)).toContain("Non-Land Types");
  });

  test("Command Tower (just Land) → NOT Non-Land Types", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
    });
    expect(generateTags(card)).not.toContain("Non-Land Types");
  });

  test("basic Forest → NOT Non-Land Types", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
    });
    expect(generateTags(card)).not.toContain("Non-Land Types");
  });
});

test.describe("generateTags — Cycling", () => {
  test("Irrigated Farmland (cycling keyword) → Cycling", () => {
    const card = makeCard({
      name: "Irrigated Farmland",
      oracleText:
        "Irrigated Farmland enters the battlefield tapped. {T}: Add {W} or {U}. Cycling {2}",
      typeLine: "Land — Plains Island",
      supertypes: [],
      subtypes: ["Plains", "Island"],
      keywords: ["Cycling"],
      producedMana: ["W", "U"],
    });
    expect(generateTags(card)).toContain("Cycling");
  });

  test("Fetid Pools (cycling keyword) → Cycling", () => {
    const card = makeCard({
      name: "Fetid Pools",
      oracleText:
        "Fetid Pools enters the battlefield tapped. {T}: Add {U} or {B}. Cycling {2}",
      typeLine: "Land — Island Swamp",
      supertypes: [],
      subtypes: ["Island", "Swamp"],
      keywords: ["Cycling"],
      producedMana: ["U", "B"],
    });
    expect(generateTags(card)).toContain("Cycling");
  });

  test("Ash Barrens (basic landcycling) → Cycling", () => {
    const card = makeCard({
      name: "Ash Barrens",
      oracleText: "{T}: Add {C}. Basic landcycling {1}",
      typeLine: "Land",
      keywords: ["Basic landcycling"],
      producedMana: ["C"],
    });
    expect(generateTags(card)).toContain("Cycling");
  });

  test("Scattered Groves (cycling keyword) → Cycling", () => {
    const card = makeCard({
      name: "Scattered Groves",
      oracleText:
        "Scattered Groves enters the battlefield tapped. {T}: Add {G} or {W}. Cycling {2}",
      typeLine: "Land — Forest Plains",
      supertypes: [],
      subtypes: ["Forest", "Plains"],
      keywords: ["Cycling"],
      producedMana: ["G", "W"],
    });
    expect(generateTags(card)).toContain("Cycling");
  });

  test("Command Tower (no cycling) → NOT Cycling", () => {
    const card = makeCard({
      name: "Command Tower",
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
      typeLine: "Land",
      producedMana: ["W", "U", "B", "R", "G"],
    });
    expect(generateTags(card)).not.toContain("Cycling");
  });

  test("basic Forest (no cycling) → NOT Cycling", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
    });
    expect(generateTags(card)).not.toContain("Cycling");
  });
});

// ---------------------------------------------------------------------------
// Multi-tag coexistence & edge cases
// ---------------------------------------------------------------------------

test.describe("generateTags — Land Multi-tag Coexistence", () => {
  test("Breeding Pool → Conditional ETB + Mana Fixing + Basic Types", () => {
    const card = makeCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      producedMana: ["G", "U"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("Conditional ETB");
    expect(tags).toContain("Mana Fixing");
    expect(tags).toContain("Basic Types");
    expect(tags).not.toContain("ETB Tapped");
  });

  test("Polluted Delta → Fetch Land + Ramp", () => {
    const card = makeCard({
      name: "Polluted Delta",
      oracleText:
        "{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.",
      typeLine: "Land",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Fetch Land");
    expect(tags).toContain("Ramp");
  });

  test("Bojuka Bog → ETB Tapped + Utility Land", () => {
    const card = makeCard({
      name: "Bojuka Bog",
      oracleText:
        "Bojuka Bog enters the battlefield tapped. When Bojuka Bog enters the battlefield, exile all cards from target player's graveyard. {T}: Add {B}.",
      typeLine: "Land",
      producedMana: ["B"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("ETB Tapped");
    expect(tags).toContain("Utility Land");
    expect(tags).not.toContain("Conditional ETB");
  });

  test("Ancient Tomb → Mana Accel Land + Utility Land", () => {
    const card = makeCard({
      name: "Ancient Tomb",
      oracleText: "{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.",
      typeLine: "Land",
      producedMana: ["C"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("Mana Accel Land");
    expect(tags).toContain("Utility Land");
  });

  test("Dryad Arbor → Non-Land Types + Basic Types", () => {
    const card = makeCard({
      name: "Dryad Arbor",
      oracleText: "(Dryad Arbor isn't a spell, it's affected by summoning sickness, and it has \"{T}: Add {G}.\")",
      typeLine: "Land Creature — Forest Dryad",
      supertypes: [],
      subtypes: ["Forest", "Dryad"],
      producedMana: ["G"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("Non-Land Types");
    expect(tags).toContain("Basic Types");
  });

  test("Irrigated Farmland → ETB Tapped + Mana Fixing + Basic Types + Cycling", () => {
    const card = makeCard({
      name: "Irrigated Farmland",
      oracleText:
        "Irrigated Farmland enters the battlefield tapped. {T}: Add {W} or {U}. Cycling {2}",
      typeLine: "Land — Plains Island",
      supertypes: [],
      subtypes: ["Plains", "Island"],
      keywords: ["Cycling"],
      producedMana: ["W", "U"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("ETB Tapped");
    expect(tags).toContain("Mana Fixing");
    expect(tags).toContain("Basic Types");
    expect(tags).toContain("Cycling");
    expect(tags).not.toContain("Conditional ETB");
  });

  test("Darksteel Citadel → Non-Land Types only", () => {
    const card = makeCard({
      name: "Darksteel Citadel",
      oracleText: "Indestructible. {T}: Add {C}.",
      typeLine: "Artifact Land",
      keywords: ["Indestructible"],
      producedMana: ["C"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("Non-Land Types");
    expect(tags).toContain("Protection");
    expect(tags).not.toContain("ETB Tapped");
    expect(tags).not.toContain("Mana Fixing");
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
