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

test.describe("generateTags — Asymmetric Wipe", () => {
  test("Kindred Dominance (chosen-type exclusion) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Kindred Dominance",
      typeLine: "Kindred Sorcery",
      oracleText:
        "Choose a creature type. Destroy all creatures that aren't of the chosen type.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("In Garruk's Wake (you don't control) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "In Garruk's Wake",
      typeLine: "Sorcery",
      oracleText:
        "Destroy all creatures you don't control and all planeswalkers you don't control.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("Plague Wind (you don't control) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Plague Wind",
      typeLine: "Sorcery",
      oracleText: "Destroy all creatures you don't control. They can't be regenerated.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("non-creature-type wipe → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Hypothetical Elf Purge",
      typeLine: "Sorcery",
      oracleText: "Destroy all non-Elf creatures.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("Cyclonic Rift overload (opponents control) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Cyclonic Rift",
      typeLine: "Instant",
      oracleText:
        "Return target nonland permanent you don't control to its owner's hand.\nOverload {6}{U} (You may cast this spell for its overload cost. If you do, change its text by replacing all instances of \"target\" with \"each.\")\nReturn all nonland permanents your opponents control to their owners' hands.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("Wrath of God → Board Wipe but NOT Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Wrath of God",
      typeLine: "Sorcery",
      oracleText: "Destroy all creatures. They can't be regenerated.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("Damnation → Board Wipe but NOT Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Damnation",
      typeLine: "Sorcery",
      oracleText: "Destroy all creatures. They can't be regenerated.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("Organic Extinction (nonartifact creatures) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Organic Extinction",
      typeLine: "Sorcery",
      oracleText:
        "Improvise (Your artifacts can help cast this spell. Each artifact you tap after you're done activating mana abilities pays for {1}.)\nDestroy all nonartifact creatures.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("hypothetical nonlegendary wipe → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Hypothetical Legendary Purge",
      typeLine: "Sorcery",
      oracleText: "Destroy all nonlegendary creatures.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("Scourglass (except for artifacts and lands) → Board Wipe + Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Scourglass",
      typeLine: "Artifact",
      oracleText:
        "{T}, Sacrifice Scourglass: Destroy all permanents except for artifacts and lands. Activate only during your upkeep.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).toContain("Asymmetric Wipe");
  });

  test("Hour of Reckoning (nontoken) → Board Wipe but NOT Asymmetric Wipe", () => {
    // 'nontoken' sweeps *token* creatures — this wipe KILLS token strategies, not spares them.
    // Regression guard: must not be lumped into cardTypeRestricted exemption.
    const card = makeCard({
      name: "Hour of Reckoning",
      typeLine: "Sorcery",
      oracleText: "Convoke (Your creatures can help cast this spell.)\nDestroy all nontoken creatures.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("modal card with single-target 'you don't control' + symmetric wipe → not Asymmetric Wipe", () => {
    // False-positive regression: a card with "target creature you don't control" in a non-wipe
    // clause alongside a symmetric "destroy all creatures" must not be tagged asymmetric.
    const card = makeCard({
      name: "Hypothetical Modal Wipe",
      typeLine: "Sorcery",
      oracleText:
        "Choose one —\n• Destroy target creature you don't control.\n• Destroy all creatures.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("symmetric artifact destruction (Shatterstorm) → Board Wipe but NOT Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Shatterstorm",
      typeLine: "Sorcery",
      oracleText: "Destroy all artifacts. They can't be regenerated.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("symmetric -N/-N wipe (e.g. Black Sun's Zenith) → Board Wipe but NOT Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Black Sun's Zenith",
      typeLine: "Sorcery",
      oracleText: "All creatures get -3/-3 until end of turn.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Board Wipe");
    expect(tags).not.toContain("Asymmetric Wipe");
  });

  test("non-Board-Wipe reference to 'non-Elf' → no Asymmetric Wipe", () => {
    const card = makeCard({
      name: "Hypothetical Lord",
      typeLine: "Creature",
      oracleText: "Non-Elf creatures you control get +1/+0.",
    });
    const tags = generateTags(card);
    expect(tags).not.toContain("Asymmetric Wipe");
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

// ---------------------------------------------------------------------------
// Issue #48 — Recursion: play/cast from graveyard
// ---------------------------------------------------------------------------

test.describe("generateTags — Recursion (play/cast from graveyard)", () => {
  test("Crucible of Worlds ('play lands from your graveyard') → Recursion", () => {
    const card = makeCard({
      name: "Crucible of Worlds",
      oracleText: "You may play lands from your graveyard.",
      typeLine: "Artifact",
    });
    expect(generateTags(card)).toContain("Recursion");
  });

  test("Muldrotha ('cast permanent spells from your graveyard') → Recursion", () => {
    const card = makeCard({
      name: "Muldrotha, the Gravetide",
      oracleText:
        "During each of your turns, you may play a land and cast a spell from your graveyard.",
      typeLine: "Legendary Creature — Elemental Avatar",
    });
    expect(generateTags(card)).toContain("Recursion");
  });

  test("existing 'return from graveyard' pattern still works", () => {
    const card = makeCard({
      oracleText:
        "Return target creature card from your graveyard to the battlefield.",
    });
    expect(generateTags(card)).toContain("Recursion");
  });
});

// ---------------------------------------------------------------------------
// Issue #48 — Ramp: additional land plays
// ---------------------------------------------------------------------------

test.describe("generateTags — Ramp (additional land)", () => {
  test("Escape to the Wilds ('play an additional land this turn') → Ramp", () => {
    const card = makeCard({
      name: "Escape to the Wilds",
      oracleText:
        "Exile the top five cards of your library. You may play cards exiled this way until the end of your next turn. You may play an additional land this turn.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Exploration ('play an additional land on each of your turns') → Ramp", () => {
    const card = makeCard({
      name: "Exploration",
      oracleText:
        "You may play an additional land on each of your turns.",
      typeLine: "Enchantment",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Azusa, Lost but Seeking ('play two additional lands') → Ramp", () => {
    const card = makeCard({
      name: "Azusa, Lost but Seeking",
      oracleText:
        "You may play two additional lands on each of your turns.",
      typeLine: "Legendary Creature — Human Monk",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("Llanowar Elves (tap-for-mana, no additional land) → still Ramp", () => {
    const card = makeCard({
      name: "Llanowar Elves",
      oracleText: "{T}: Add {G}.",
      typeLine: "Creature — Elf Druid",
    });
    expect(generateTags(card)).toContain("Ramp");
  });

  test("basic land → still no Ramp", () => {
    const card = makeCard({
      name: "Forest",
      oracleText: "({T}: Add {G}.)",
      typeLine: "Basic Land — Forest",
    });
    expect(generateTags(card)).not.toContain("Ramp");
  });
});

// ---------------------------------------------------------------------------
// Issue #48 — Card Advantage: impulse draw + cascade
// ---------------------------------------------------------------------------

test.describe("generateTags — Card Advantage (impulse draw & cascade)", () => {
  test("Escape to the Wilds ('play cards exiled this way') → Card Advantage", () => {
    const card = makeCard({
      name: "Escape to the Wilds",
      oracleText:
        "Exile the top five cards of your library. You may play cards exiled this way until the end of your next turn. You may play an additional land this turn.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Light Up the Stage ('You may play them this turn') → Card Advantage", () => {
    const card = makeCard({
      name: "Light Up the Stage",
      oracleText:
        "Exile the top two cards of your library. Until the end of your next turn, you may play those cards.",
      typeLine: "Sorcery",
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Prosper, Tome-Bound ('you may play that card this turn') → Card Advantage", () => {
    const card = makeCard({
      name: "Prosper, Tome-Bound",
      oracleText:
        "At the beginning of your end step, exile the top card of your library. You may play that card until you exile another card with Prosper.",
      typeLine: "Legendary Creature — Tiefling Warlock",
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("The First Sliver (Cascade keyword) → Card Advantage", () => {
    const card = makeCard({
      name: "The First Sliver",
      oracleText:
        "Cascade\nSliver spells you cast have cascade.",
      typeLine: "Legendary Creature — Sliver",
      keywords: ["Cascade"],
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Bloodbraid Elf (Cascade keyword) → Card Advantage", () => {
    const card = makeCard({
      name: "Bloodbraid Elf",
      oracleText:
        "Cascade\nHaste",
      typeLine: "Creature — Elf Berserker",
      keywords: ["Cascade", "Haste"],
    });
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("Card Draw ('draw three cards') → Card Draw, NOT Card Advantage", () => {
    const card = makeCard({ oracleText: "Draw three cards." });
    const tags = generateTags(card);
    expect(tags).toContain("Card Draw");
    expect(tags).not.toContain("Card Advantage");
  });
});

// ---------------------------------------------------------------------------
// Issue #48 — Protection: has/have grants
// ---------------------------------------------------------------------------

test.describe("generateTags — Protection (has/have grants)", () => {
  test("Whispersilk Cloak ('has shroud') → Protection", () => {
    const card = makeCard({
      name: "Whispersilk Cloak",
      oracleText:
        "Equipped creature has shroud and can't be blocked. Equip {2}",
      typeLine: "Artifact — Equipment",
    });
    expect(generateTags(card)).toContain("Protection");
  });

  test("Ward Sliver ('have protection from the chosen color') → Protection", () => {
    const card = makeCard({
      name: "Ward Sliver",
      oracleText:
        "As Ward Sliver enters the battlefield, choose a color. All Slivers have protection from the chosen color.",
      typeLine: "Creature — Sliver",
    });
    expect(generateTags(card)).toContain("Protection");
  });

  test("Swiftfoot Boots ('has hexproof') → Protection", () => {
    const card = makeCard({
      name: "Swiftfoot Boots",
      oracleText:
        "Equipped creature has hexproof and haste. Equip {1}",
      typeLine: "Artifact — Equipment",
    });
    expect(generateTags(card)).toContain("Protection");
  });

  test("Hexproof keyword → still Protection (no regression)", () => {
    const card = makeCard({ keywords: ["Hexproof"] });
    expect(generateTags(card)).toContain("Protection");
  });

  test("'gains indestructible' oracle text → still Protection (no regression)", () => {
    const card = makeCard({
      oracleText: "Target creature gains indestructible until end of turn.",
    });
    expect(generateTags(card)).toContain("Protection");
  });
});

// ---------------------------------------------------------------------------
// Multi-face card tag detection (combined oracle text)
// ---------------------------------------------------------------------------

test.describe("generateTags — multi-face cards", () => {
  test("modal DFC with removal on back face gets Removal tag", () => {
    // Simulates a creature front / removal back (combined oracle text)
    const card = makeCard({
      name: "Valki, God of Lies // Tibalt, Cosmic Impostor",
      typeLine: "Legendary Creature — God // Legendary Planeswalker — Tibalt",
      oracleText:
        "When Valki enters the battlefield, each opponent reveals their hand.\n\n" +
        "Exile target artifact, creature, or enchantment. You may play cards exiled with Tibalt, Cosmic Impostor.",
      layout: "modal_dfc",
    });
    expect(generateTags(card)).toContain("Removal");
  });

  test("adventure card with card draw on adventure half gets Card Draw tag", () => {
    // Bonecrusher Giant front + adventure with draw effect
    const card = makeCard({
      name: "Fae of Wishes // Granted",
      typeLine: "Creature — Faerie Wizard // Sorcery — Adventure",
      oracleText:
        "Flying\n\n" +
        "You may reveal a noncreature card you own from outside the game and put it into your hand.",
      layout: "adventure",
    });
    // "put it into your hand" should trigger Card Advantage
    expect(generateTags(card)).toContain("Card Advantage");
  });

  test("adventure card with card draw on adventure half gets Card Draw", () => {
    const card = makeCard({
      name: "Edgewall Innkeeper // Innkeeper's Talent",
      typeLine: "Creature — Human Peasant",
      oracleText:
        "Whenever you cast a creature spell that has an Adventure, draw a card.\n\n" +
        "Some adventure text here.",
      layout: "adventure",
    });
    expect(generateTags(card)).toContain("Card Draw");
  });

  test("transform DFC with recursion on back face gets Recursion tag", () => {
    const card = makeCard({
      name: "Graveyard Trespasser // Graveyard Glutton",
      typeLine: "Creature — Human Werewolf // Creature — Werewolf",
      oracleText:
        "Ward—Discard a card.\nWhenever Graveyard Trespasser enters the battlefield or attacks, exile target card from a graveyard.\n\n" +
        "Ward—Discard a card.\nWhenever Graveyard Glutton enters the battlefield or attacks, return target card from a graveyard to your hand.",
      layout: "transform",
    });
    expect(generateTags(card)).toContain("Recursion");
  });

  test("DFC with non-land front face does not get land-specific tags from back face text", () => {
    // Modal DFC: creature front / enchantment back with ETB text
    const card = makeCard({
      name: "Esika, God of the Tree // The Prismatic Bridge",
      typeLine: "Legendary Creature — God // Legendary Enchantment",
      oracleText:
        'Vigilance\nOther legendary creatures you control have vigilance and "{T}: Add one mana of any color."\n\n' +
        "At the beginning of your upkeep, reveal cards from the top of your library until you reveal a creature or planeswalker card.",
      layout: "modal_dfc",
    });
    // Front face is Creature, not Land — no land-specific tags
    const tags = generateTags(card);
    expect(tags).not.toContain("ETB Tapped");
    expect(tags).not.toContain("Fetch Land");
    expect(tags).not.toContain("Utility Land");
  });

  test("MDFC land front face still gets land tags from combined text", () => {
    // Modal DFC: land front face
    const card = makeCard({
      name: "Emeria, Shattered Skyclave // Emeria's Call",
      typeLine: "Land // Sorcery",
      oracleText:
        "Emeria, Shattered Skyclave enters the battlefield tapped.\n{T}: Add {W}.\n\n" +
        "Create two 4/4 white Angel Warrior creature tokens with flying.",
      layout: "modal_dfc",
      producedMana: ["W"],
    });
    const tags = generateTags(card);
    expect(tags).toContain("ETB Tapped");
  });

  test("split card with counterspell on one half gets Counterspell tag", () => {
    const card = makeCard({
      name: "Counterflux // Suffocating Blast",
      typeLine: "Instant // Instant",
      oracleText:
        "Counter target spell. Overload {1}{U}{U}{R}\n\n" +
        "Counter target spell and deal 3 damage to target creature.",
      layout: "split",
    });
    expect(generateTags(card)).toContain("Counterspell");
  });

  test("normal layout card is unaffected by multi-face logic", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      layout: "normal",
    });
    expect(generateTags(card)).toContain("Removal");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Self-only cost reduction — should NOT get "Cost Reduction" tag
// ═══════════════════════════════════════════════════════════════════

test.describe("generateTags — Cost Reduction self-only exclusion", () => {
  test("Emry (self cost reduction) should NOT get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Emry, Lurker of the Loch",
      typeLine: "Legendary Creature — Merfolk Wizard",
      oracleText:
        "This spell costs {1} less to cast for each artifact you control.\nWhen Emry, Lurker of the Loch enters the battlefield, mill four cards.\n{T}: Choose target artifact card in your graveyard. You may cast that card this turn.",
      keywords: [],
      manaCost: "{2}{U}",
    });
    expect(generateTags(card)).not.toContain("Cost Reduction");
  });

  test("Blinkmoth Infusion (Affinity — self only) should NOT get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Blinkmoth Infusion",
      typeLine: "Instant",
      oracleText:
        "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nUntap all artifacts you control.",
      keywords: ["Affinity"],
      manaCost: "{12}{U}{U}",
    });
    expect(generateTags(card)).not.toContain("Cost Reduction");
  });

  test("Convoke creature (self only) should NOT get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Stoke the Flames",
      typeLine: "Instant",
      oracleText:
        "Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nStoke the Flames deals 4 damage to any target.",
      keywords: ["Convoke"],
      manaCost: "{2}{R}{R}",
    });
    expect(generateTags(card)).not.toContain("Cost Reduction");
  });

  test("Goblin Warchief (reduces other Goblin spells) SHOULD get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Goblin Warchief",
      typeLine: "Creature — Goblin Warrior",
      oracleText:
        "Goblin spells you cast cost {1} less to cast.\nGoblin creatures you control have haste.",
      manaCost: "{1}{R}{R}",
    });
    expect(generateTags(card)).toContain("Cost Reduction");
  });

  test("Helm of Awakening (reduces all spells) SHOULD get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Helm of Awakening",
      typeLine: "Artifact",
      oracleText: "Spells cost {1} less to cast.",
      manaCost: "{2}",
    });
    expect(generateTags(card)).toContain("Cost Reduction");
  });

  test("Urza's Incubator (reduces chosen type) SHOULD get Cost Reduction tag", () => {
    const card = makeCard({
      name: "Urza's Incubator",
      typeLine: "Artifact",
      oracleText:
        "As Urza's Incubator enters the battlefield, choose a creature type.\nCreature spells of the chosen type cost {2} less to cast.",
      manaCost: "{3}",
    });
    expect(generateTags(card)).toContain("Cost Reduction");
  });
});

// --- Discard tags ---

test.describe("generateTags — Targeted Discard", () => {
  test("Liliana Vess (+1 target player discards) → Targeted Discard", () => {
    const card = makeCard({
      name: "Liliana Vess",
      typeLine: "Legendary Planeswalker — Liliana",
      oracleText:
        "+1: Target player discards a card.\n−2: Search your library for a card, then shuffle and put that card on top.\n−8: Put all creature cards from all graveyards onto the battlefield under your control.",
    });
    expect(generateTags(card)).toContain("Targeted Discard");
    expect(generateTags(card)).not.toContain("Mass Discard");
  });

  test("Thoughtseize (target player reveals, you choose, they discard) → Targeted Discard", () => {
    const card = makeCard({
      name: "Thoughtseize",
      typeLine: "Sorcery",
      oracleText:
        "Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life.",
    });
    expect(generateTags(card)).toContain("Targeted Discard");
    expect(generateTags(card)).not.toContain("Mass Discard");
  });
});

test.describe("generateTags — Mass Discard", () => {
  test("Liliana of the Veil (each player discards) → Mass Discard, NOT Targeted", () => {
    const card = makeCard({
      name: "Liliana of the Veil",
      typeLine: "Legendary Planeswalker — Liliana",
      oracleText:
        "+1: Each player discards a card.\n−2: Target player sacrifices a creature.\n−6: Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Mass Discard");
    expect(tags).not.toContain("Targeted Discard");
  });

  test("Syphon Mind (each other player discards) → Mass Discard", () => {
    const card = makeCard({
      name: "Syphon Mind",
      typeLine: "Sorcery",
      oracleText:
        "Each other player discards a card. You draw a card for each card discarded this way.",
    });
    expect(generateTags(card)).toContain("Mass Discard");
  });

  test("Pox (each player discards) → Mass Discard", () => {
    const card = makeCard({
      name: "Pox",
      typeLine: "Sorcery",
      oracleText:
        "Each player loses a third of their life, then discards a third of the cards in their hand, then sacrifices a third of the creatures they control, then sacrifices a third of the lands they control. Round up each time.",
    });
    expect(generateTags(card)).toContain("Mass Discard");
  });

  test("Painful Quandary (unless that player discards) → Mass Discard", () => {
    const card = makeCard({
      name: "Painful Quandary",
      typeLine: "Enchantment",
      oracleText:
        "Whenever an opponent casts a spell, that player loses 5 life unless that player discards a card.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Mass Discard");
    expect(tags).not.toContain("Discard Payoff");
  });

  test("Wheel of Fortune (each player discards their hand) → Mass Discard", () => {
    const card = makeCard({
      name: "Wheel of Fortune",
      typeLine: "Sorcery",
      oracleText:
        "Each player discards their hand, then draws seven cards.",
    });
    expect(generateTags(card)).toContain("Mass Discard");
  });

  test("Professor Onyx (each opponent may discard) → Mass Discard, NOT Targeted", () => {
    const card = makeCard({
      name: "Professor Onyx",
      typeLine: "Legendary Planeswalker — Liliana",
      oracleText:
        "Magecraft — Whenever you cast or copy an instant or sorcery spell, each opponent loses 2 life and you gain 2 life.\n+1: You lose 1 life. Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.\n−3: Each opponent may discard a card. If they don't, they lose 3 life.\n−8: Each opponent may discard a card. If they don't, they lose 3 life. Repeat this process six more times.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Mass Discard");
    expect(tags).not.toContain("Targeted Discard");
  });

  test("Liliana, Heretical Healer back face (DFC each player discards) → Mass Discard", () => {
    const card = makeCard({
      name: "Liliana, Heretical Healer",
      typeLine: "Legendary Creature — Human Cleric",
      oracleText:
        "Lifelink\nWhenever another nontoken creature you control dies, exile Liliana, Heretical Healer, then return her to the battlefield transformed under her owner's control. If you do, create a 2/2 black Zombie creature token.\n+2: Each player discards a card.\n−X: Return target nonland creature card with mana value X or less from your graveyard to the battlefield.\n−8: You get an emblem with \"Whenever a creature dies, return it to the battlefield under your control at the beginning of the next end step.\"",
    });
    expect(generateTags(card)).toContain("Mass Discard");
  });
});

test.describe("generateTags — Self-Discard", () => {
  test("Tomb Robber (discard a card as activated cost) → Self-Discard", () => {
    const card = makeCard({
      name: "Tomb Robber",
      typeLine: "Creature — Human Pirate",
      oracleText:
        "Menace\n{1}, {T}, Discard a card: This creature explores.",
    });
    expect(generateTags(card)).toContain("Self-Discard");
  });

  test("Rotting Regisaur (upkeep discard trigger) → Self-Discard", () => {
    const card = makeCard({
      name: "Rotting Regisaur",
      typeLine: "Creature — Zombie Dinosaur",
      oracleText: "At the beginning of your upkeep, discard a card.",
    });
    expect(generateTags(card)).toContain("Self-Discard");
  });

  test("card with Cycling keyword → Self-Discard", () => {
    const card = makeCard({
      name: "Archfiend of Ifnir",
      typeLine: "Creature — Demon",
      keywords: ["Cycling"],
      oracleText:
        "Flying\nWhenever you cycle or discard another card, put a -1/-1 counter on each creature your opponents control.\nCycling {2}",
    });
    expect(generateTags(card)).toContain("Self-Discard");
  });

  test("card with Connive keyword → Self-Discard", () => {
    const card = makeCard({
      name: "Raffine, Scheming Seer",
      typeLine: "Legendary Creature — Sphinx Demon",
      keywords: ["Connive"],
      oracleText:
        "Flying, ward {1}\nWhenever you attack, target attacking creature connives X, where X is the number of attacking creatures.",
    });
    expect(generateTags(card)).toContain("Self-Discard");
  });

  test("Lightning Axe (as an additional cost, discard) → Self-Discard", () => {
    const card = makeCard({
      name: "Lightning Axe",
      typeLine: "Instant",
      oracleText:
        "As an additional cost to cast this spell, discard a card or pay {5}.\nLightning Axe deals 5 damage to target creature.",
    });
    expect(generateTags(card)).toContain("Self-Discard");
  });

  test("Faithless Looting (period-terminated effect) → NOT Self-Discard", () => {
    const card = makeCard({
      name: "Faithless Looting",
      typeLine: "Sorcery",
      oracleText:
        "Draw two cards, then discard two cards.\nFlashback {2}{R}",
    });
    expect(generateTags(card)).not.toContain("Self-Discard");
  });
});

test.describe("generateTags — Discard Payoff", () => {
  test("Waste Not (whenever an opponent discards) → Discard Payoff", () => {
    const card = makeCard({
      name: "Waste Not",
      typeLine: "Enchantment",
      oracleText:
        "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.\nWhenever an opponent discards a land card, add {B}{B}.\nWhenever an opponent discards a noncreature, nonland card, draw a card.",
    });
    expect(generateTags(card)).toContain("Discard Payoff");
  });

  test("Geth's Grimoire (whenever an opponent discards) → Discard Payoff", () => {
    const card = makeCard({
      name: "Geth's Grimoire",
      typeLine: "Artifact",
      oracleText:
        "Whenever an opponent discards a card, you may draw a card.",
    });
    expect(generateTags(card)).toContain("Discard Payoff");
  });

  test("Sangromancer (whenever an opponent discards) → Discard Payoff", () => {
    const card = makeCard({
      name: "Sangromancer",
      typeLine: "Creature — Vampire Shaman",
      oracleText:
        "Flying\nWhenever a creature an opponent controls dies, you may gain 3 life.\nWhenever an opponent discards a card, you may gain 3 life.",
    });
    expect(generateTags(card)).toContain("Discard Payoff");
  });

  test("Archfiend of Ifnir → both Self-Discard (Cycling) AND Discard Payoff (whenever discard trigger)", () => {
    const card = makeCard({
      name: "Archfiend of Ifnir",
      typeLine: "Creature — Demon",
      keywords: ["Cycling"],
      oracleText:
        "Flying\nWhenever you cycle or discard another card, put a -1/-1 counter on each creature your opponents control.\nCycling {2}",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Self-Discard");
    expect(tags).toContain("Discard Payoff");
  });

  test("The Raven Man → both Discard Payoff AND Mass Discard (dual-tag)", () => {
    const card = makeCard({
      name: "The Raven Man",
      typeLine: "Legendary Creature — Human Wizard",
      oracleText:
        "At the beginning of each end step, if a player discarded a card this turn, create a 1/1 black Bird creature token with flying and \"This creature can't block.\"\n{3}{B}, {T}: Each opponent discards a card. Activate only as a sorcery.",
    });
    const tags = generateTags(card);
    expect(tags).toContain("Discard Payoff");
    expect(tags).toContain("Mass Discard");
  });
});

test.describe("generateTags — Discard negative cases", () => {
  test("Liliana, Dreadhorde General (no discard text) → no discard tags", () => {
    const card = makeCard({
      name: "Liliana, Dreadhorde General",
      typeLine: "Legendary Planeswalker — Liliana",
      oracleText:
        "Whenever a creature you control dies, draw a card.\n+1: Create a 2/2 black Zombie creature token.\n−4: Each player sacrifices two creatures.\n−9: Each opponent chooses a permanent they control of each permanent type and sacrifices the rest.",
    });
    const tags = generateTags(card);
    expect(tags).not.toContain("Targeted Discard");
    expect(tags).not.toContain("Mass Discard");
    expect(tags).not.toContain("Self-Discard");
    expect(tags).not.toContain("Discard Payoff");
  });

  test("Lightning Bolt (no discard) → no discard tags", () => {
    const card = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
    });
    const tags = generateTags(card);
    expect(tags).not.toContain("Targeted Discard");
    expect(tags).not.toContain("Mass Discard");
    expect(tags).not.toContain("Self-Discard");
    expect(tags).not.toContain("Discard Payoff");
  });
});
