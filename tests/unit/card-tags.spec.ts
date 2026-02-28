import { test, expect } from "@playwright/test";
import { generateTags } from "../../src/lib/card-tags";
import { makeCard } from "../helpers";

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

// ---------------------------------------------------------------------------
// Bracket-related Tags: Game Changer, Extra Turn, Mass Land Denial
// ---------------------------------------------------------------------------

test.describe("generateTags — Game Changer", () => {
  test("card with isGameChanger: true → Game Changer tag", () => {
    const card = makeCard({ isGameChanger: true });
    expect(generateTags(card)).toContain("Game Changer");
  });

  test("card with isGameChanger: false → no Game Changer tag", () => {
    const card = makeCard({ isGameChanger: false });
    expect(generateTags(card)).not.toContain("Game Changer");
  });

  test("Cyclonic Rift (Game Changer + Board Wipe) → both tags", () => {
    const card = makeCard({
      name: "Cyclonic Rift",
      oracleText:
        'Return target nonland permanent you don\'t control to its owner\'s hand.\nOverload {6}{U} (You may cast this spell for its overload cost. If you do, change "target" in its text to "each.")',
      typeLine: "Instant",
      keywords: ["Overload"],
      isGameChanger: true,
    });
    const tags = generateTags(card);
    expect(tags).toContain("Game Changer");
    expect(tags).toContain("Removal");
  });

  test("Rhystic Study (Game Changer + Card Draw) → both tags", () => {
    const card = makeCard({
      name: "Rhystic Study",
      oracleText:
        "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
      typeLine: "Enchantment",
      isGameChanger: true,
    });
    const tags = generateTags(card);
    expect(tags).toContain("Game Changer");
    expect(tags).toContain("Card Draw");
  });
});

test.describe("generateTags — Extra Turn", () => {
  test("Time Warp → Extra Turn", () => {
    const card = makeCard({
      name: "Time Warp",
      oracleText: "Target player takes an extra turn after this one.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Extra Turn");
  });

  test("Expropriate → Extra Turn", () => {
    const card = makeCard({
      name: "Expropriate",
      oracleText:
        "Council's dilemma — Starting with you, each player votes for time or money. For each time vote, take an extra turn after this one. For each money vote, choose a permanent owned by the voter and gain control of it. Exile Expropriate.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Extra Turn");
  });

  test("Temporal Manipulation → Extra Turn", () => {
    const card = makeCard({
      name: "Temporal Manipulation",
      oracleText: "Take an extra turn after this one.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Extra Turn");
  });

  test("Lightning Bolt → no Extra Turn", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      typeLine: "Instant",
    });
    expect(generateTags(card)).not.toContain("Extra Turn");
  });

  test("card mentioning turn without 'extra turn' → no Extra Turn", () => {
    const card = makeCard({
      oracleText: "At the beginning of your next turn, draw a card.",
    });
    expect(generateTags(card)).not.toContain("Extra Turn");
  });
});

test.describe("generateTags — Mass Land Denial", () => {
  test("Armageddon ('Destroy all lands.') → Mass Land Denial", () => {
    const card = makeCard({
      name: "Armageddon",
      oracleText: "Destroy all lands.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Jokulhaups ('Destroy all artifacts, creatures, and lands.') → Mass Land Denial", () => {
    const card = makeCard({
      name: "Jokulhaups",
      oracleText: "Destroy all artifacts, creatures, and lands. They can't be regenerated.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Obliterate ('Destroy all artifacts, creatures, planeswalkers, and lands.') → Mass Land Denial", () => {
    const card = makeCard({
      name: "Obliterate",
      oracleText:
        "This spell can't be countered. Destroy all artifacts, creatures, planeswalkers, and lands. They can't be regenerated.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Ruination ('Destroy all nonbasic lands.') → Mass Land Denial", () => {
    const card = makeCard({
      name: "Ruination",
      oracleText: "Destroy all nonbasic lands.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Cataclysm (sacrifice-based MLD) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Cataclysm",
      oracleText:
        "Each player chooses from among the permanents they control an artifact, a creature, an enchantment, and a land, then sacrifices the rest.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Blood Moon (resource denial by name) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Blood Moon",
      oracleText: "Nonbasic lands are Mountains.",
      typeLine: "Enchantment",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Winter Orb (stax by name) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Winter Orb",
      oracleText: "As long as Winter Orb is untapped, players can't untap more than one land during their untap steps.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Back to Basics (resource denial by name) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Back to Basics",
      oracleText: "Nonbasic lands don't untap during their controllers' untap steps.",
      typeLine: "Enchantment",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Stasis (stax by name) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Stasis",
      oracleText:
        "Players skip their untap steps. At the beginning of your upkeep, sacrifice Stasis unless you pay {U}.",
      typeLine: "Enchantment",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Static Orb (stax by name) → Mass Land Denial", () => {
    const card = makeCard({
      name: "Static Orb",
      oracleText:
        "As long as Static Orb is untapped, players can't untap more than two permanents during their untap steps.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Mass Land Denial");
  });

  test("Wrath of God ('Destroy all creatures.') → NOT Mass Land Denial", () => {
    const card = makeCard({
      name: "Wrath of God",
      oracleText: "Destroy all creatures. They can't be regenerated.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).not.toContain("Mass Land Denial");
  });

  test("Farewell ('destroy all nonland permanents' variant) → NOT Mass Land Denial", () => {
    const card = makeCard({
      name: "Farewell",
      oracleText:
        "Choose one or more — Exile all artifacts. Exile all creatures. Exile all enchantments. Exile all graveyards.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).not.toContain("Mass Land Denial");
  });

  test("Lightning Bolt → no Mass Land Denial", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      typeLine: "Instant",
    });
    expect(generateTags(card)).not.toContain("Mass Land Denial");
  });
});

test.describe("generateTags — Lord", () => {
  test("Elvish Archdruid (type-specific lord) → Lord", () => {
    const card = makeCard({
      name: "Elvish Archdruid",
      oracleText:
        "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.",
      typeLine: "Creature — Elf Druid",
      subtypes: ["Elf", "Druid"],
    });
    expect(generateTags(card)).toContain("Lord");
  });

  test("Goblin Chieftain (type-specific lord + haste) → Lord", () => {
    const card = makeCard({
      name: "Goblin Chieftain",
      oracleText: "Haste\nOther Goblin creatures you control get +1/+1 and have haste.",
      typeLine: "Creature — Goblin",
      subtypes: ["Goblin"],
    });
    expect(generateTags(card)).toContain("Lord");
  });

  test("Coat of Arms (generic buff, no type-specific lord) → no Lord", () => {
    const card = makeCard({
      name: "Coat of Arms",
      oracleText:
        "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).not.toContain("Lord");
  });

  test("Glorious Anthem (generic anthem, no creature type) → no Lord", () => {
    const card = makeCard({
      name: "Glorious Anthem",
      oracleText: "Creatures you control get +1/+1.",
      typeLine: "Enchantment",
    });
    expect(generateTags(card)).not.toContain("Lord");
  });

  test("Elesh Norn (generic 'other creatures' buff, no type) → no Lord", () => {
    const card = makeCard({
      name: "Elesh Norn, Grand Cenobite",
      oracleText:
        "Vigilance\nOther creatures you control get +2/+2. Creatures your opponents control get -2/-2.",
      typeLine: "Legendary Creature — Phyrexian Praetor",
      keywords: ["Vigilance"],
    });
    expect(generateTags(card)).not.toContain("Lord");
  });

  test("Adaptive Automaton (chosen type lord) → Lord", () => {
    const card = makeCard({
      name: "Adaptive Automaton",
      oracleText:
        "As Adaptive Automaton enters the battlefield, choose a creature type. Adaptive Automaton is the chosen type in addition to its other types. Other creatures you control of the chosen type get +1/+1.",
      typeLine: "Artifact Creature — Construct",
      subtypes: ["Construct"],
    });
    expect(generateTags(card)).toContain("Lord");
  });
});

test.describe("generateTags — Tribal Payoff", () => {
  test("Herald's Horn (chosen type cost reduction) → Tribal Payoff", () => {
    const card = makeCard({
      name: "Herald's Horn",
      typeLine: "Artifact",
      oracleText:
        "As Herald's Horn enters the battlefield, choose a creature type.\nCreature spells of the chosen type cost {1} less to cast.\nAt the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand.",
    });
    expect(generateTags(card)).toContain("Tribal Payoff");
  });

  test("Kindred Dominance (Kindred type line) → Tribal Payoff", () => {
    const card = makeCard({
      name: "Kindred Dominance",
      typeLine: "Kindred Sorcery",
      oracleText:
        "Choose a creature type. Destroy all creatures that aren't of the chosen type.",
    });
    expect(generateTags(card)).toContain("Tribal Payoff");
  });

  test("Coat of Arms (shares creature type) → Tribal Payoff", () => {
    const card = makeCard({
      name: "Coat of Arms",
      oracleText:
        "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Tribal Payoff");
  });

  test("Vanquisher's Banner (chosen type lord + draw) → Tribal Payoff", () => {
    const card = makeCard({
      name: "Vanquisher's Banner",
      typeLine: "Artifact",
      oracleText:
        "As Vanquisher's Banner enters the battlefield, choose a creature type.\nCreatures you control of the chosen type get +1/+1.\nWhenever you cast a creature spell of the chosen type, draw a card.",
    });
    expect(generateTags(card)).toContain("Tribal Payoff");
  });

  test("Grizzly Bears (generic creature) → no Tribal Payoff", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      oracleText: "",
      subtypes: ["Bear"],
    });
    expect(generateTags(card)).not.toContain("Tribal Payoff");
  });

  test("Maskwood Nexus ('every creature type') → Tribal Payoff", () => {
    const card = makeCard({
      name: "Maskwood Nexus",
      typeLine: "Artifact",
      oracleText:
        "Creatures you control are every creature type. The same is true for creature spells you control and creature cards you own that aren't on the battlefield.\n{4}, {T}: Create a 2/2 colorless Shapeshifter creature token with changeling.",
    });
    expect(generateTags(card)).toContain("Tribal Payoff");
  });
});

test.describe("generateTags — Legendary Payoff", () => {
  test("Jodah (cast legendary + legendary buff) → Legendary Payoff", () => {
    const card = makeCard({
      name: "Jodah, the Unifier",
      oracleText:
        "Whenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken spell that costs less. You may cast that spell without paying its mana cost. Legendary creatures you control get +1/+1.",
      typeLine: "Legendary Creature — Human Wizard",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).toContain("Legendary Payoff");
  });

  test("Kethis (legendary cost reduction + graveyard) → Legendary Payoff", () => {
    const card = makeCard({
      name: "Kethis, the Hidden Hand",
      oracleText:
        "Legendary spells you cast cost {1} less to cast.\nExile two legendary cards from your graveyard: Until end of turn, each legendary card in your graveyard gains \"You may play this card from your graveyard.\"",
      typeLine: "Legendary Creature — Elf Advisor",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).toContain("Legendary Payoff");
  });

  test("Jhoira (historic cast trigger) → Legendary Payoff", () => {
    const card = makeCard({
      name: "Jhoira, Weatherlight Captain",
      oracleText: "Whenever you cast a historic spell, draw a card.",
      typeLine: "Legendary Creature — Human Artificer",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).toContain("Legendary Payoff");
  });

  test("Shanid (play a legendary) → Legendary Payoff", () => {
    const card = makeCard({
      name: "Shanid, Sleepers' Scourge",
      oracleText:
        "Menace\nOther legendary creatures you control have menace.\nWhenever you play a legendary land or cast a legendary spell, you draw a card and you lose 1 life.",
      typeLine: "Legendary Creature — Human Knight",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).toContain("Legendary Payoff");
  });

  test("Mirror Box (legend rule) → Legendary Payoff", () => {
    const card = makeCard({
      name: "Mirror Box",
      oracleText:
        "The \"legend rule\" doesn't apply to permanents you control.\nEach legendary creature you control gets +1/+1.\nEach nontoken creature you control gets +1/+1 for each other creature you control with the same name.",
      typeLine: "Artifact",
      supertypes: [],
    });
    expect(generateTags(card)).toContain("Legendary Payoff");
  });

  test("Thalia (Legendary, no payoff text) → no Legendary Payoff", () => {
    const card = makeCard({
      name: "Thalia, Guardian of Thraben",
      oracleText:
        "First strike\nNoncreature spells cost {1} more to cast.",
      typeLine: "Legendary Creature — Human Soldier",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).not.toContain("Legendary Payoff");
  });

  test("Grizzly Bears → no Legendary Payoff", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      oracleText: "",
      typeLine: "Creature — Bear",
    });
    expect(generateTags(card)).not.toContain("Legendary Payoff");
  });
});

test.describe("generateTags — Snow Payoff", () => {
  test("Narfi (other snow lord + {S} in oracle) → Snow Payoff", () => {
    const card = makeCard({
      name: "Narfi, Betrayer King",
      oracleText:
        "Other snow and Zombie creatures you control get +1/+1.\n{S}{S}{S}: Return Narfi, Betrayer King from your graveyard to the battlefield tapped.",
      typeLine: "Legendary Snow Creature — Zombie Wizard",
      supertypes: ["Legendary", "Snow"],
      manaCost: "{3}{U}{B}",
    });
    expect(generateTags(card)).toContain("Snow Payoff");
  });

  test("Marit Lage's Slumber (snow permanent enters) → Snow Payoff", () => {
    const card = makeCard({
      name: "Marit Lage's Slumber",
      oracleText:
        "Whenever a snow permanent enters the battlefield under your control, scry 1.\nAt the beginning of your upkeep, if you control ten or more snow permanents, sacrifice Marit Lage's Slumber. If you do, create Marit Lage, a legendary 20/20 black Avatar creature token with flying and indestructible.",
      typeLine: "Legendary Snow Enchantment",
      supertypes: ["Legendary", "Snow"],
    });
    expect(generateTags(card)).toContain("Snow Payoff");
  });

  test("Card with {S} in manaCost only → Snow Payoff", () => {
    const card = makeCard({
      name: "Icehide Golem",
      oracleText: "",
      typeLine: "Snow Artifact Creature — Golem",
      supertypes: ["Snow"],
      manaCost: "{S}",
    });
    expect(generateTags(card)).toContain("Snow Payoff");
  });

  test("Hylda (ice-themed, NOT snow) → no Snow Payoff", () => {
    const card = makeCard({
      name: "Hylda of the Icy Crown",
      oracleText:
        "Whenever you tap an untapped creature an opponent controls, you may pay {1}. When you do, choose one — Create a 4/4 white and blue Elemental creature token. Put two +1/+1 counters on target creature you control. Scry 2, then draw a card.",
      typeLine: "Legendary Creature — Human Warlock",
      supertypes: ["Legendary"],
    });
    expect(generateTags(card)).not.toContain("Snow Payoff");
  });

  test("Grizzly Bears → no Snow Payoff", () => {
    const card = makeCard({
      name: "Grizzly Bears",
      oracleText: "",
      typeLine: "Creature — Bear",
    });
    expect(generateTags(card)).not.toContain("Snow Payoff");
  });
});
