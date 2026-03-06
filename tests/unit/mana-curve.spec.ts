import { test, expect } from "@playwright/test";
import { computeManaCurve, countMdfcLands, extractCardType } from "../../src/lib/mana-curve";
import type { EnrichedCard } from "../../src/lib/types";
import { makeCard, makeDeck } from "../helpers";

const EXPECTED_BUCKETS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

test.describe("computeManaCurve", () => {
  test("returns 8 buckets in order, all zero when cardMap is empty", () => {
    const result = computeManaCurve(makeDeck(), {});
    expect(result).toHaveLength(8);
    expect(result.map((b) => b.cmc)).toEqual(EXPECTED_BUCKETS);
    expect(result.every((b) => b.permanents === 0 && b.nonPermanents === 0)).toBe(true);
  });

  test("groups cards into correct CMC bucket", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "One Drop", quantity: 1 },
        { name: "Three Drop", quantity: 1 },
        { name: "Five Drop", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "One Drop": makeCard({ name: "One Drop", cmc: 1 }),
      "Three Drop": makeCard({ name: "Three Drop", cmc: 3 }),
      "Five Drop": makeCard({ name: "Five Drop", cmc: 5 }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "1")!.permanents).toBe(1);
    expect(result.find((b) => b.cmc === "3")!.permanents).toBe(1);
    expect(result.find((b) => b.cmc === "5")!.permanents).toBe(1);
    expect(result.find((b) => b.cmc === "0")!.permanents).toBe(0);
  });

  test("groups CMC >= 7 into the '7+' bucket", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Seven", quantity: 1 },
        { name: "Ten", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Seven: makeCard({ name: "Seven", cmc: 7 }),
      Ten: makeCard({ name: "Ten", cmc: 10 }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "7+")!.permanents).toBe(2);
  });

  test("multiplies DeckCard.quantity into count", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Bolt", quantity: 4 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Bolt: makeCard({ name: "Bolt", cmc: 1, typeLine: "Instant" }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "1")!.nonPermanents).toBe(4);
  });

  test("excludes lands (Basic Land, Snow Land, Artifact Land)", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Forest", quantity: 1 },
        { name: "Snow Forest", quantity: 1 },
        { name: "Seat of the Synod", quantity: 1 },
        { name: "Sol Ring", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Forest: makeCard({ name: "Forest", cmc: 0, typeLine: "Basic Land — Forest" }),
      "Snow Forest": makeCard({ name: "Snow Forest", cmc: 0, typeLine: "Snow Land — Forest" }),
      "Seat of the Synod": makeCard({ name: "Seat of the Synod", cmc: 0, typeLine: "Artifact Land" }),
      "Sol Ring": makeCard({ name: "Sol Ring", cmc: 1, typeLine: "Artifact" }),
    };

    const result = computeManaCurve(deck, cardMap);
    const totalCount = result.reduce((sum, b) => sum + b.permanents + b.nonPermanents, 0);
    expect(totalCount).toBe(1);
    expect(result.find((b) => b.cmc === "1")!.permanents).toBe(1);
  });

  test("includes commanders and sideboard cards", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [{ name: "Main Card", quantity: 1 }],
      sideboard: [{ name: "Side Card", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Commander: makeCard({ name: "Commander", cmc: 4, typeLine: "Legendary Creature" }),
      "Main Card": makeCard({ name: "Main Card", cmc: 2 }),
      "Side Card": makeCard({ name: "Side Card", cmc: 3 }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "4")!.permanents).toBe(1);
    expect(result.find((b) => b.cmc === "2")!.permanents).toBe(1);
    expect(result.find((b) => b.cmc === "3")!.permanents).toBe(1);
  });

  test("skips cards not found in cardMap (no crash)", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Known Card", quantity: 1 },
        { name: "Unknown Card", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Known Card": makeCard({ name: "Known Card", cmc: 2 }),
    };

    const result = computeManaCurve(deck, cardMap);
    const totalCount = result.reduce((sum, b) => sum + b.permanents + b.nonPermanents, 0);
    expect(totalCount).toBe(1);
  });

  test("CMC 0 non-land cards (e.g. Mox) appear in bucket 0", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Mox Diamond", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Mox Diamond": makeCard({ name: "Mox Diamond", cmc: 0, typeLine: "Artifact" }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "0")!.permanents).toBe(1);
  });

  test("classifies Creatures, Artifacts, Enchantments, Planeswalkers, Battles as permanents", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Bear", quantity: 1 },
        { name: "Ring", quantity: 1 },
        { name: "Aura", quantity: 1 },
        { name: "Walker", quantity: 1 },
        { name: "Siege", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Bear: makeCard({ name: "Bear", cmc: 2, typeLine: "Creature — Bear" }),
      Ring: makeCard({ name: "Ring", cmc: 2, typeLine: "Artifact" }),
      Aura: makeCard({ name: "Aura", cmc: 2, typeLine: "Enchantment — Aura" }),
      Walker: makeCard({ name: "Walker", cmc: 2, typeLine: "Legendary Planeswalker — Jace" }),
      Siege: makeCard({ name: "Siege", cmc: 2, typeLine: "Battle — Siege" }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "2")!.permanents).toBe(5);
    expect(result.find((b) => b.cmc === "2")!.nonPermanents).toBe(0);
  });

  test("classifies Instants and Sorceries as nonPermanents", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Bolt", quantity: 2 },
        { name: "Wrath", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Bolt: makeCard({ name: "Bolt", cmc: 1, typeLine: "Instant" }),
      Wrath: makeCard({ name: "Wrath", cmc: 4, typeLine: "Sorcery" }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "1")!.nonPermanents).toBe(2);
    expect(result.find((b) => b.cmc === "1")!.permanents).toBe(0);
    expect(result.find((b) => b.cmc === "4")!.nonPermanents).toBe(1);
    expect(result.find((b) => b.cmc === "4")!.permanents).toBe(0);
  });

  test("mixed bucket: same CMC with both permanents and nonPermanents", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Bear", quantity: 3 },
        { name: "Counterspell", quantity: 2 },
        { name: "Signet", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      Bear: makeCard({ name: "Bear", cmc: 2, typeLine: "Creature — Bear" }),
      Counterspell: makeCard({ name: "Counterspell", cmc: 2, typeLine: "Instant" }),
      Signet: makeCard({ name: "Signet", cmc: 2, typeLine: "Artifact" }),
    };

    const result = computeManaCurve(deck, cardMap);
    const bucket = result.find((b) => b.cmc === "2")!;
    expect(bucket.permanents).toBe(4); // 3 Bears + 1 Signet
    expect(bucket.nonPermanents).toBe(2); // 2 Counterspells
  });

  test("DFC cards classify based on front face type", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "DFC Card", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "DFC Card": makeCard({
        name: "DFC Card",
        cmc: 3,
        typeLine: "Instant // Sorcery",
      }),
    };

    const result = computeManaCurve(deck, cardMap);
    expect(result.find((b) => b.cmc === "3")!.nonPermanents).toBe(1);
    expect(result.find((b) => b.cmc === "3")!.permanents).toBe(0);
  });
});

test.describe("extractCardType", () => {
  test("returns Creature for creature type lines", () => {
    expect(extractCardType("Creature — Bear")).toBe("Creature");
    expect(extractCardType("Legendary Creature — Human Wizard")).toBe("Creature");
  });

  test("returns Instant for instants", () => {
    expect(extractCardType("Instant")).toBe("Instant");
  });

  test("returns Sorcery for sorceries", () => {
    expect(extractCardType("Sorcery")).toBe("Sorcery");
  });

  test("returns Artifact for artifacts", () => {
    expect(extractCardType("Artifact")).toBe("Artifact");
    expect(extractCardType("Artifact — Equipment")).toBe("Artifact");
  });

  test("returns Enchantment for enchantments", () => {
    expect(extractCardType("Enchantment — Aura")).toBe("Enchantment");
  });

  test("returns Planeswalker for planeswalkers", () => {
    expect(extractCardType("Legendary Planeswalker — Jace")).toBe("Planeswalker");
  });

  test("returns Battle for battles", () => {
    expect(extractCardType("Battle — Siege")).toBe("Battle");
  });

  test("returns null for lands", () => {
    expect(extractCardType("Basic Land — Forest")).toBeNull();
    expect(extractCardType("Artifact Land")).toBeNull();
  });

  test("uses front face only for DFCs", () => {
    expect(extractCardType("Instant // Creature")).toBe("Instant");
    expect(extractCardType("Creature — Werewolf // Creature — Werewolf")).toBe("Creature");
  });

  test("returns Creature for artifact creatures (Creature takes priority)", () => {
    expect(extractCardType("Artifact Creature — Golem")).toBe("Creature");
  });

  test("returns Creature for enchantment creatures", () => {
    expect(extractCardType("Enchantment Creature — God")).toBe("Creature");
  });
});

test.describe("computeManaCurve with enabledTypes filter", () => {
  const mixedDeck = makeDeck({
    mainboard: [
      { name: "Bear", quantity: 2 },
      { name: "Bolt", quantity: 3 },
      { name: "Ring", quantity: 1 },
    ],
  });
  const mixedCardMap: Record<string, EnrichedCard> = {
    Bear: makeCard({ name: "Bear", cmc: 2, typeLine: "Creature — Bear" }),
    Bolt: makeCard({ name: "Bolt", cmc: 1, typeLine: "Instant" }),
    Ring: makeCard({ name: "Ring", cmc: 1, typeLine: "Artifact" }),
  };

  test("omitting enabledTypes includes all non-land cards (backward compat)", () => {
    const result = computeManaCurve(mixedDeck, mixedCardMap);
    const total = result.reduce((s, b) => s + b.permanents + b.nonPermanents, 0);
    expect(total).toBe(6); // 2 Bears + 3 Bolts + 1 Ring
  });

  test("filtering to only Creature excludes Instant and Artifact", () => {
    const result = computeManaCurve(mixedDeck, mixedCardMap, new Set(["Creature"]));
    const total = result.reduce((s, b) => s + b.permanents + b.nonPermanents, 0);
    expect(total).toBe(2); // only 2 Bears
    expect(result.find((b) => b.cmc === "2")!.permanents).toBe(2);
    expect(result.find((b) => b.cmc === "1")!.nonPermanents).toBe(0);
    expect(result.find((b) => b.cmc === "1")!.permanents).toBe(0);
  });

  test("filtering to only Instant excludes permanents", () => {
    const result = computeManaCurve(mixedDeck, mixedCardMap, new Set(["Instant"]));
    const total = result.reduce((s, b) => s + b.permanents + b.nonPermanents, 0);
    expect(total).toBe(3); // only 3 Bolts
    expect(result.find((b) => b.cmc === "1")!.nonPermanents).toBe(3);
  });

  test("filtering to multiple types includes both", () => {
    const result = computeManaCurve(mixedDeck, mixedCardMap, new Set(["Creature", "Artifact"]));
    const total = result.reduce((s, b) => s + b.permanents + b.nonPermanents, 0);
    expect(total).toBe(3); // 2 Bears + 1 Ring
  });

  test("empty enabledTypes set returns all-zero buckets", () => {
    const result = computeManaCurve(mixedDeck, mixedCardMap, new Set());
    const total = result.reduce((s, b) => s + b.permanents + b.nonPermanents, 0);
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countMdfcLands
// ---------------------------------------------------------------------------

test.describe("countMdfcLands", () => {
  test("counts modal DFC with land back face", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Emeria's Call", quantity: 1 },
        { name: "Shatterskull Smashing", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Emeria's Call": makeCard({
        name: "Emeria's Call",
        layout: "modal_dfc",
        typeLine: "Sorcery // Land",
        cmc: 7,
        cardFaces: [
          {
            name: "Emeria's Call",
            manaCost: "{4}{W}{W}{W}",
            typeLine: "Sorcery",
            oracleText: "Create two 4/4 white Angel Warrior creature tokens with flying.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
          {
            name: "Emeria, Shattered Skyclave",
            manaCost: "",
            typeLine: "Land",
            oracleText: "Emeria, Shattered Skyclave enters the battlefield tapped.\n{T}: Add {W}.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
        ],
      }),
      "Shatterskull Smashing": makeCard({
        name: "Shatterskull Smashing",
        layout: "modal_dfc",
        typeLine: "Sorcery // Land",
        cmc: 2,
        cardFaces: [
          {
            name: "Shatterskull Smashing",
            manaCost: "{X}{R}{R}",
            typeLine: "Sorcery",
            oracleText: "Shatterskull Smashing deals X damage divided as you choose among up to two target creatures and/or planeswalkers.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
          {
            name: "Shatterskull, the Hammer Pass",
            manaCost: "",
            typeLine: "Land",
            oracleText: "Shatterskull, the Hammer Pass enters the battlefield tapped.\n{T}: Add {R}.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
        ],
      }),
    };
    expect(countMdfcLands(deck, cardMap)).toBe(2);
  });

  test("does not count non-MDFC lands", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Command Tower": makeCard({
        name: "Command Tower",
        layout: "normal",
        typeLine: "Land",
      }),
    };
    expect(countMdfcLands(deck, cardMap)).toBe(0);
  });

  test("does not count transform DFCs with land back face", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Westvale Abbey", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Westvale Abbey": makeCard({
        name: "Westvale Abbey",
        layout: "transform",
        typeLine: "Land // Legendary Creature — Demon",
        cardFaces: [
          {
            name: "Westvale Abbey",
            manaCost: "",
            typeLine: "Land",
            oracleText: "{T}: Add {C}.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
          {
            name: "Ormendahl, Profane Prince",
            manaCost: "",
            typeLine: "Legendary Creature — Demon",
            oracleText: "Flying, lifelink, indestructible, haste",
            power: "9",
            toughness: "7",
            loyalty: null,
            imageUris: null,
          },
        ],
      }),
    };
    expect(countMdfcLands(deck, cardMap)).toBe(0);
  });

  test("MDFC with non-land back face is not counted", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Esika, God of the Tree", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Esika, God of the Tree": makeCard({
        name: "Esika, God of the Tree",
        layout: "modal_dfc",
        typeLine: "Legendary Creature — God // Legendary Enchantment",
        cardFaces: [
          {
            name: "Esika, God of the Tree",
            manaCost: "{1}{G}{G}",
            typeLine: "Legendary Creature — God",
            oracleText: "Vigilance",
            power: "1",
            toughness: "4",
            loyalty: null,
            imageUris: null,
          },
          {
            name: "The Prismatic Bridge",
            manaCost: "{W}{U}{B}{R}{G}",
            typeLine: "Legendary Enchantment",
            oracleText: "At the beginning of your upkeep, reveal cards...",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
        ],
      }),
    };
    expect(countMdfcLands(deck, cardMap)).toBe(0);
  });

  test("returns 0 for empty deck", () => {
    expect(countMdfcLands(makeDeck(), {})).toBe(0);
  });

  test("respects card quantity", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Emeria's Call", quantity: 3 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Emeria's Call": makeCard({
        name: "Emeria's Call",
        layout: "modal_dfc",
        typeLine: "Sorcery // Land",
        cardFaces: [
          {
            name: "Emeria's Call",
            manaCost: "{4}{W}{W}{W}",
            typeLine: "Sorcery",
            oracleText: "Create two 4/4 Angel tokens.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
          {
            name: "Emeria, Shattered Skyclave",
            manaCost: "",
            typeLine: "Land",
            oracleText: "{T}: Add {W}.",
            power: null,
            toughness: null,
            loyalty: null,
            imageUris: null,
          },
        ],
      }),
    };
    expect(countMdfcLands(deck, cardMap)).toBe(3);
  });
});
