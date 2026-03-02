import { test, expect } from "@playwright/test";
import {
  normalizeToEnrichedCard,
  type ScryfallCard,
} from "../../src/lib/scryfall";

// ---------------------------------------------------------------------------
// Helpers — minimal ScryfallCard fixtures modeled after real Scryfall responses
// ---------------------------------------------------------------------------

function baseScryfallCard(
  overrides: Partial<ScryfallCard> = {}
): ScryfallCard {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Test Card",
    cmc: 0,
    type_line: "Creature",
    colors: [],
    color_identity: [],
    keywords: [],
    rarity: "common",
    set: "tst",
    collector_number: "1",
    ...overrides,
  };
}

const IMG_FRONT = {
  small: "https://cards.scryfall.io/small/front.jpg",
  normal: "https://cards.scryfall.io/normal/front.jpg",
  large: "https://cards.scryfall.io/large/front.jpg",
};

const IMG_BACK = {
  small: "https://cards.scryfall.io/small/back.jpg",
  normal: "https://cards.scryfall.io/normal/back.jpg",
  large: "https://cards.scryfall.io/large/back.jpg",
};

// ---------------------------------------------------------------------------
// Normal layout — single-face card
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — normal layout", () => {
  test("produces layout 'normal' and single-entry cardFaces", () => {
    const card = baseScryfallCard({
      name: "Lightning Bolt",
      layout: "normal",
      mana_cost: "{R}",
      cmc: 1,
      type_line: "Instant",
      oracle_text: "Lightning Bolt deals 3 damage to any target.",
      colors: ["R"],
      color_identity: ["R"],
      image_uris: IMG_FRONT,
    });

    const result = normalizeToEnrichedCard(card);

    expect(result.layout).toBe("normal");
    expect(result.cardFaces).toHaveLength(1);
    expect(result.cardFaces[0].name).toBe("Lightning Bolt");
    expect(result.cardFaces[0].manaCost).toBe("{R}");
    expect(result.cardFaces[0].typeLine).toBe("Instant");
    expect(result.cardFaces[0].oracleText).toBe(
      "Lightning Bolt deals 3 damage to any target."
    );
    expect(result.cardFaces[0].imageUris).toEqual(IMG_FRONT);
  });

  test("top-level oracleText matches the single face", () => {
    const card = baseScryfallCard({
      oracle_text: "Draw a card.",
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.oracleText).toBe("Draw a card.");
  });

  test("defaults layout to 'normal' when Scryfall omits layout", () => {
    const card = baseScryfallCard(); // no layout field

    const result = normalizeToEnrichedCard(card);
    expect(result.layout).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// Transform DFC — e.g., Delver of Secrets // Insectile Aberration
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — transform DFC", () => {
  const delver = baseScryfallCard({
    name: "Delver of Secrets // Insectile Aberration",
    layout: "transform",
    cmc: 1,
    type_line: "Creature — Human Wizard // Creature — Human Insect",
    colors: ["U"],
    color_identity: ["U"],
    keywords: ["Transform"],
    // Transform DFCs have no top-level mana_cost, oracle_text, or image_uris
    card_faces: [
      {
        name: "Delver of Secrets",
        mana_cost: "{U}",
        type_line: "Creature — Human Wizard",
        oracle_text:
          "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.",
        power: "1",
        toughness: "1",
        image_uris: IMG_FRONT,
      },
      {
        name: "Insectile Aberration",
        mana_cost: "",
        type_line: "Creature — Human Insect",
        oracle_text: "Flying",
        power: "3",
        toughness: "2",
        image_uris: IMG_BACK,
      },
    ],
  });

  test("produces two cardFaces with correct names", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.layout).toBe("transform");
    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[0].name).toBe("Delver of Secrets");
    expect(result.cardFaces[1].name).toBe("Insectile Aberration");
  });

  test("back face has no mana cost", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.cardFaces[0].manaCost).toBe("{U}");
    expect(result.cardFaces[1].manaCost).toBe("");
  });

  test("each face has its own image URIs", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.cardFaces[0].imageUris).toEqual(IMG_FRONT);
    expect(result.cardFaces[1].imageUris).toEqual(IMG_BACK);
  });

  test("each face has its own type line", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.cardFaces[0].typeLine).toBe("Creature — Human Wizard");
    expect(result.cardFaces[1].typeLine).toBe("Creature — Human Insect");
  });

  test("each face has its own P/T", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.cardFaces[0].power).toBe("1");
    expect(result.cardFaces[0].toughness).toBe("1");
    expect(result.cardFaces[1].power).toBe("3");
    expect(result.cardFaces[1].toughness).toBe("2");
  });

  test("top-level oracleText combines both faces", () => {
    const result = normalizeToEnrichedCard(delver);

    expect(result.oracleText).toContain("transform Delver of Secrets");
    expect(result.oracleText).toContain("Flying");
    // Separated by double newline
    expect(result.oracleText).toBe(
      "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.\n\nFlying"
    );
  });

  test("top-level manaCost uses front face", () => {
    const result = normalizeToEnrichedCard(delver);
    expect(result.manaCost).toBe("{U}");
  });

  test("top-level imageUris falls back to front face", () => {
    const result = normalizeToEnrichedCard(delver);
    expect(result.imageUris).toEqual(IMG_FRONT);
  });

  test("top-level power/toughness uses front face", () => {
    const result = normalizeToEnrichedCard(delver);
    expect(result.power).toBe("1");
    expect(result.toughness).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Modal DFC — e.g., Esika, God of the Tree // The Prismatic Bridge
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — modal DFC", () => {
  const esika = baseScryfallCard({
    name: "Esika, God of the Tree // The Prismatic Bridge",
    layout: "modal_dfc",
    cmc: 3,
    type_line:
      "Legendary Creature — God // Legendary Enchantment",
    colors: ["G"],
    color_identity: ["W", "U", "B", "R", "G"],
    keywords: ["Vigilance"],
    card_faces: [
      {
        name: "Esika, God of the Tree",
        mana_cost: "{1}{G}{G}",
        type_line: "Legendary Creature — God",
        oracle_text:
          "Vigilance\nOther legendary creatures you control have vigilance and \"{T}: Add one mana of any color.\"",
        power: "1",
        toughness: "4",
        image_uris: IMG_FRONT,
      },
      {
        name: "The Prismatic Bridge",
        mana_cost: "{W}{U}{B}{R}{G}",
        type_line: "Legendary Enchantment",
        oracle_text:
          "At the beginning of your upkeep, reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.",
        image_uris: IMG_BACK,
      },
    ],
  });

  test("produces two cardFaces with layout modal_dfc", () => {
    const result = normalizeToEnrichedCard(esika);

    expect(result.layout).toBe("modal_dfc");
    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[0].name).toBe("Esika, God of the Tree");
    expect(result.cardFaces[1].name).toBe("The Prismatic Bridge");
  });

  test("both faces have their own mana costs", () => {
    const result = normalizeToEnrichedCard(esika);

    expect(result.cardFaces[0].manaCost).toBe("{1}{G}{G}");
    expect(result.cardFaces[1].manaCost).toBe("{W}{U}{B}{R}{G}");
  });

  test("back face has no P/T (it is an enchantment)", () => {
    const result = normalizeToEnrichedCard(esika);

    expect(result.cardFaces[1].power).toBeNull();
    expect(result.cardFaces[1].toughness).toBeNull();
  });

  test("top-level oracleText combines both faces", () => {
    const result = normalizeToEnrichedCard(esika);

    expect(result.oracleText).toContain("Add one mana of any color");
    expect(result.oracleText).toContain("reveal cards from the top");
  });

  test("top-level manaCost uses front face", () => {
    const result = normalizeToEnrichedCard(esika);
    expect(result.manaCost).toBe("{1}{G}{G}");
  });
});

// ---------------------------------------------------------------------------
// Adventure — e.g., Bonecrusher Giant // Stomp
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — adventure", () => {
  const bonecrusher = baseScryfallCard({
    name: "Bonecrusher Giant // Stomp",
    layout: "adventure",
    mana_cost: "{2}{R} // {1}{R}",
    cmc: 3,
    type_line: "Creature — Giant // Instant — Adventure",
    oracle_text:
      "Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell's controller.",
    colors: ["R"],
    color_identity: ["R"],
    keywords: [],
    image_uris: IMG_FRONT,
    card_faces: [
      {
        name: "Bonecrusher Giant",
        mana_cost: "{2}{R}",
        type_line: "Creature — Giant",
        oracle_text:
          "Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell's controller.",
        power: "4",
        toughness: "3",
      },
      {
        name: "Stomp",
        mana_cost: "{1}{R}",
        type_line: "Instant — Adventure",
        oracle_text:
          "Damage can't be prevented this turn. Stomp deals 2 damage to any target.",
      },
    ],
  });

  test("produces two cardFaces with layout adventure", () => {
    const result = normalizeToEnrichedCard(bonecrusher);

    expect(result.layout).toBe("adventure");
    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[0].name).toBe("Bonecrusher Giant");
    expect(result.cardFaces[1].name).toBe("Stomp");
  });

  test("adventure face has its own mana cost and type line", () => {
    const result = normalizeToEnrichedCard(bonecrusher);

    expect(result.cardFaces[1].manaCost).toBe("{1}{R}");
    expect(result.cardFaces[1].typeLine).toBe("Instant — Adventure");
  });

  test("shared image — both faces have null imageUris (adventure faces inherit card image)", () => {
    const result = normalizeToEnrichedCard(bonecrusher);

    // Adventure cards: top-level image_uris exists, per-face image_uris may not
    // Front face should have null since face didn't provide image_uris
    expect(result.cardFaces[0].imageUris).toBeNull();
    expect(result.cardFaces[1].imageUris).toBeNull();
    // Top-level imageUris is the shared card image
    expect(result.imageUris).toEqual(IMG_FRONT);
  });

  test("top-level oracleText combines creature and adventure text", () => {
    const result = normalizeToEnrichedCard(bonecrusher);

    expect(result.oracleText).toContain("2 damage to that spell's controller");
    expect(result.oracleText).toContain(
      "Damage can't be prevented this turn"
    );
  });

  test("top-level manaCost uses Scryfall combined cost", () => {
    const result = normalizeToEnrichedCard(bonecrusher);
    // Scryfall provides combined cost at top level for adventure
    expect(result.manaCost).toBe("{2}{R} // {1}{R}");
  });
});

// ---------------------------------------------------------------------------
// Omen (adventure layout) — e.g., Stormshriek Feral // Flush Out
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — omen (adventure layout)", () => {
  const stormshriek = baseScryfallCard({
    name: "Stormshriek Feral // Flush Out",
    layout: "adventure",
    mana_cost: "{4}{R} // {1}{R}",
    cmc: 5,
    type_line: "Creature — Dragon // Sorcery — Omen",
    colors: ["R"],
    color_identity: ["R"],
    keywords: ["Flying", "Haste"],
    image_uris: IMG_FRONT,
    card_faces: [
      {
        name: "Stormshriek Feral",
        mana_cost: "{4}{R}",
        type_line: "Creature — Dragon",
        oracle_text:
          "Flying, haste\n{1}{R}: This creature gets +1/+0 until end of turn.",
        power: "3",
        toughness: "3",
      },
      {
        name: "Flush Out",
        mana_cost: "{1}{R}",
        type_line: "Sorcery — Omen",
        oracle_text:
          "Discard a card. If you do, draw two cards. (Then shuffle this card into its owner's library.)",
      },
    ],
  });

  test("omen uses adventure layout", () => {
    const result = normalizeToEnrichedCard(stormshriek);

    expect(result.layout).toBe("adventure");
    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[1].typeLine).toBe("Sorcery — Omen");
  });

  test("combined oracleText includes omen spell text", () => {
    const result = normalizeToEnrichedCard(stormshriek);

    expect(result.oracleText).toContain("Flying, haste");
    expect(result.oracleText).toContain("draw two cards");
  });
});

// ---------------------------------------------------------------------------
// Split — e.g., Fire // Ice
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — split card", () => {
  const fireIce = baseScryfallCard({
    name: "Fire // Ice",
    layout: "split",
    mana_cost: "{1}{R} // {1}{U}",
    cmc: 4,
    type_line: "Instant // Instant",
    colors: ["R", "U"],
    color_identity: ["R", "U"],
    keywords: [],
    image_uris: IMG_FRONT,
    card_faces: [
      {
        name: "Fire",
        mana_cost: "{1}{R}",
        type_line: "Instant",
        oracle_text: "Fire deals 2 damage divided as you choose among one or two targets.",
      },
      {
        name: "Ice",
        mana_cost: "{1}{U}",
        type_line: "Instant",
        oracle_text: "Tap target permanent.\nDraw a card.",
      },
    ],
  });

  test("produces two cardFaces with layout split", () => {
    const result = normalizeToEnrichedCard(fireIce);

    expect(result.layout).toBe("split");
    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[0].name).toBe("Fire");
    expect(result.cardFaces[1].name).toBe("Ice");
  });

  test("each half has its own mana cost", () => {
    const result = normalizeToEnrichedCard(fireIce);

    expect(result.cardFaces[0].manaCost).toBe("{1}{R}");
    expect(result.cardFaces[1].manaCost).toBe("{1}{U}");
  });

  test("uses Scryfall combined CMC", () => {
    const result = normalizeToEnrichedCard(fireIce);
    expect(result.cmc).toBe(4);
  });

  test("top-level oracleText combines both halves", () => {
    const result = normalizeToEnrichedCard(fireIce);

    expect(result.oracleText).toContain("Fire deals 2 damage");
    expect(result.oracleText).toContain("Tap target permanent");
  });

  test("shared image at top level", () => {
    const result = normalizeToEnrichedCard(fireIce);
    expect(result.imageUris).toEqual(IMG_FRONT);
  });
});

// ---------------------------------------------------------------------------
// Battle — e.g., Invasion of Ikoria // Zilortha, Apex of Ikoria
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — battle", () => {
  const invasion = baseScryfallCard({
    name: "Invasion of Ikoria // Zilortha, Apex of Ikoria",
    layout: "transform",
    cmc: 4,
    type_line:
      "Battle — Siege // Legendary Creature — Dinosaur",
    colors: ["G"],
    color_identity: ["G"],
    keywords: ["Transform"],
    card_faces: [
      {
        name: "Invasion of Ikoria",
        mana_cost: "{X}{G}{G}",
        type_line: "Battle — Siege",
        oracle_text:
          "When Invasion of Ikoria enters the battlefield, you may search your library for a non-Human creature card with mana value X or less, reveal it, put it into your hand, then shuffle.",
        image_uris: IMG_FRONT,
      },
      {
        name: "Zilortha, Apex of Ikoria",
        mana_cost: "",
        type_line: "Legendary Creature — Dinosaur",
        oracle_text:
          "Reach, trample\nOther non-Human creatures you control have trample.",
        power: "8",
        toughness: "8",
        image_uris: IMG_BACK,
      },
    ],
  });

  test("battle/transform produces two faces with separate images", () => {
    const result = normalizeToEnrichedCard(invasion);

    expect(result.cardFaces).toHaveLength(2);
    expect(result.cardFaces[0].imageUris).toEqual(IMG_FRONT);
    expect(result.cardFaces[1].imageUris).toEqual(IMG_BACK);
  });

  test("back face is a creature with P/T", () => {
    const result = normalizeToEnrichedCard(invasion);

    expect(result.cardFaces[1].power).toBe("8");
    expect(result.cardFaces[1].toughness).toBe("8");
  });

  test("combined oracleText includes both faces", () => {
    const result = normalizeToEnrichedCard(invasion);

    expect(result.oracleText).toContain("search your library");
    expect(result.oracleText).toContain("Reach, trample");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test.describe("normalizeToEnrichedCard — edge cases", () => {
  test("card with empty card_faces array synthesizes single face from top-level", () => {
    const card = baseScryfallCard({
      name: "Weird Card",
      oracle_text: "Some text",
      card_faces: [],
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.cardFaces).toHaveLength(1);
    expect(result.cardFaces[0].name).toBe("Weird Card");
    expect(result.cardFaces[0].oracleText).toBe("Some text");
  });

  test("card without card_faces synthesizes single face from top-level", () => {
    const card = baseScryfallCard({
      name: "Simple Card",
      mana_cost: "{2}{B}",
      oracle_text: "Target creature gets -2/-2 until end of turn.",
      power: "2",
      toughness: "1",
      image_uris: IMG_FRONT,
    });

    const result = normalizeToEnrichedCard(card);
    expect(result.cardFaces).toHaveLength(1);
    expect(result.cardFaces[0].manaCost).toBe("{2}{B}");
    expect(result.cardFaces[0].power).toBe("2");
    expect(result.cardFaces[0].toughness).toBe("1");
    expect(result.cardFaces[0].imageUris).toEqual(IMG_FRONT);
  });

  test("face with missing oracle_text is excluded from combined text", () => {
    const card = baseScryfallCard({
      layout: "transform",
      card_faces: [
        {
          name: "Front",
          oracle_text: "Front text",
          image_uris: IMG_FRONT,
        },
        {
          name: "Back",
          // no oracle_text
          image_uris: IMG_BACK,
        },
      ],
    });

    const result = normalizeToEnrichedCard(card);
    // Only front text, no trailing separator
    expect(result.oracleText).toBe("Front text");
  });

  test("planeswalker face preserves loyalty", () => {
    const card = baseScryfallCard({
      name: "Arlinn Kord // Arlinn, Embraced by the Moon",
      layout: "transform",
      type_line: "Legendary Planeswalker — Arlinn // Legendary Planeswalker — Arlinn",
      card_faces: [
        {
          name: "Arlinn Kord",
          mana_cost: "{2}{R}{G}",
          type_line: "Legendary Planeswalker — Arlinn",
          oracle_text: "+1: Until end of turn, up to one target creature gets +2/+2 and gains vigilance and haste.",
          loyalty: "3",
          image_uris: IMG_FRONT,
        },
        {
          name: "Arlinn, Embraced by the Moon",
          mana_cost: "",
          type_line: "Legendary Planeswalker — Arlinn",
          oracle_text: "+1: Creatures you control get +1/+1 and gain trample until end of turn.",
          loyalty: undefined,
          image_uris: IMG_BACK,
        },
      ],
    });

    const result = normalizeToEnrichedCard(card);

    expect(result.cardFaces[0].loyalty).toBe("3");
    expect(result.cardFaces[1].loyalty).toBeNull();
    // Top-level loyalty falls back to front face
    expect(result.loyalty).toBe("3");
  });
});
