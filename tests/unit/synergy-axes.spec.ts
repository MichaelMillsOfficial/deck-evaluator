import { test, expect } from "@playwright/test";
import { SYNERGY_AXES, getAxisById, extractReferencedKeywords } from "../../src/lib/synergy-axes";
import { makeCard as mockCard } from "../helpers";

test.describe("Synergy Axes", () => {
  test("exports a non-empty array of axes", () => {
    expect(SYNERGY_AXES.length).toBeGreaterThanOrEqual(13);
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

  test("Najeela (type-specific trigger: Whenever a Warrior attacks) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Najeela, the Blade-Blossom",
      oracleText:
        "Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking.",
      subtypes: ["Human", "Warrior"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Goblin Chieftain (type-specific lord + haste) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Goblin Chieftain",
      oracleText: "Haste\nOther Goblin creatures you control get +1/+1 and have haste.",
      subtypes: ["Goblin"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Kindred Dominance (type-specific board wipe) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Kindred Dominance",
      typeLine: "Kindred Sorcery",
      oracleText:
        "Choose a creature type. Destroy all creatures that aren't of the chosen type.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Mirror Entity (Changeling keyword) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Mirror Entity",
      keywords: ["Changeling"],
      typeLine: "Creature — Shapeshifter",
      subtypes: ["Shapeshifter"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Herald's Horn (chosen type cost reduction + card advantage) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Herald's Horn",
      typeLine: "Artifact",
      oracleText:
        "As Herald's Horn enters the battlefield, choose a creature type.\nCreature spells of the chosen type cost {1} less to cast.\nAt the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Vanquisher's Banner (chosen type lord + draw) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Vanquisher's Banner",
      typeLine: "Artifact",
      oracleText:
        "As Vanquisher's Banner enters the battlefield, choose a creature type.\nCreatures you control of the chosen type get +1/+1.\nWhenever you cast a creature spell of the chosen type, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Coat of Arms (creatures that share type get +1/+1) → detected", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Coat of Arms",
      typeLine: "Artifact",
      oracleText:
        "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it.",
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

  test("Glorious Anthem (generic anthem, no type reference) → 0", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Glorious Anthem",
      typeLine: "Enchantment",
      oracleText: "Creatures you control get +1/+1.",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Maskwood Nexus ('every creature type') scores > 0", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Maskwood Nexus",
      typeLine: "Artifact",
      oracleText:
        "Creatures you control are every creature type. The same is true for creature spells you control and creature cards you own that aren't on the battlefield.\n{4}, {T}: Create a 2/2 colorless Shapeshifter creature token with changeling.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Elesh Norn (generic 'other creatures' buff, no type name) → 0", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Elesh Norn, Grand Cenobite",
      typeLine: "Legendary Creature — Phyrexian Praetor",
      oracleText:
        "Vigilance\nOther creatures you control get +2/+2. Creatures your opponents control get -2/-2.",
      keywords: ["Vigilance"],
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

  test("detects artifact type line", () => {
    const axis = getAxisById("artifacts")!;
    const card = mockCard({
      typeLine: "Artifact",
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects non-artifact protection text", () => {
    const axis = getAxisById("artifacts")!;
    const card = mockCard({
      oracleText: "Destroy all non-artifact creatures.",
    });
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

// ---------------------------------------------------------------------------
// Issue #48 — Lifegain axis: drop "pay life" false positives
// ---------------------------------------------------------------------------

test.describe("Lifegain axis — pay-life exclusions (Issue #48)", () => {
  test("Arid Mesa (fetch land, 'Pay 1 life') → lifegain score = 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Arid Mesa",
      oracleText:
        "{T}, Pay 1 life, Sacrifice Arid Mesa: Search your library for a Mountain or Plains card, put it onto the battlefield, then shuffle.",
      typeLine: "Land",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Breeding Pool (shock land, 'pay 2 life') → lifegain score = 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Breeding Pool",
      oracleText:
        "({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      typeLine: "Land — Forest Island",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Bolas's Citadel ('paying life rather than mana') → lifegain score = 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Bolas's Citadel",
      oracleText:
        "You may look at the top card of your library any time.\nYou may play lands and cast spells from the top of your library by paying life equal to their mana costs rather than paying their mana costs.\n{T}, Sacrifice ten nonland permanents: Each opponent loses 10 life.",
      typeLine: "Legendary Artifact",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Necropotence ('Pay 1 life:') → lifegain score = 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Necropotence",
      oracleText:
        "Skip your draw step.\nWhenever you discard a card, exile that card from your graveyard.\nPay 1 life: Exile the top card of your library face down. Put that card into your hand at the beginning of your next end step.",
      typeLine: "Enchantment",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Ajani's Pridemate ('Whenever you gain life') → lifegain score > 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Ajani's Pridemate",
      oracleText:
        "Whenever you gain life, put a +1/+1 counter on Ajani's Pridemate.",
      typeLine: "Creature — Cat Soldier",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Soul Warden ('you gain 1 life') → lifegain score > 0", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Soul Warden",
      oracleText:
        "Whenever another creature enters the battlefield, you gain 1 life.",
      typeLine: "Creature — Human Cleric",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Lifelink keyword → still lifegain > 0 (no regression)", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({ keywords: ["Lifelink"] });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Issue #48 — Tribal axis: verify Tribal Unity detection
// ---------------------------------------------------------------------------

test.describe("Tribal axis — Tribal Unity verification (Issue #48)", () => {
  test("Tribal Unity ('Choose a creature type. Creatures of the chosen type get +X/+X') → tribal score > 0", () => {
    const axis = getAxisById("tribal")!;
    const card = mockCard({
      name: "Tribal Unity",
      oracleText:
        "Choose a creature type. Creatures of the chosen type get +X/+X until end of turn, where X is the amount of mana spent to cast this spell.",
      typeLine: "Instant",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });
});


test.describe("Keyword Matters axis", () => {
  test("detects keyword lord effect: 'Creatures with flying get +1/+1'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Kangee, Aerie Keeper",
      oracleText:
        "Flying\nCreatures with flying get +1/+1 for each feather counter on Kangee, Aerie Keeper.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects keyword trigger: 'Whenever a creature with haste attacks'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Ognis, the Dragon's Lash",
      oracleText:
        "Haste\nWhenever a creature with haste attacks, create a tapped Treasure token.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects keyword trigger: 'creature you control with deathtouch deals combat damage'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Fynn, the Fangbearer",
      oracleText:
        "Deathtouch\nWhenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects mass keyword granting: 'Creatures you control have flying'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      oracleText: "Creatures you control have flying.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects conditional keyword check: 'if it has flying'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Akroma, Vision of Ixidor",
      oracleText:
        "Flying, first strike, vigilance, trample\nAt the beginning of each combat, until end of turn, each other creature you control gets +1/+1 if it has flying, +1/+1 if it has first strike, and so on for double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects keyword check: 'you control a creature with first strike'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Odric, Lunarch Marshal",
      oracleText:
        "At the beginning of each combat, creatures you control gain first strike until end of turn if you control a creature with first strike. The same is true for flying, deathtouch, double strike, haste, hexproof, indestructible, lifelink, menace, reach, skulk, trample, and vigilance.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects 'Creatures you control with first strike have double strike'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Kwende, Pride of Femeref",
      oracleText:
        "Double strike\nCreatures you control with first strike have double strike.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("detects defender-matters: 'creature with defender enters the battlefield'", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Arcades, the Strategist",
      oracleText:
        "Flying, vigilance\nWhenever a creature with defender enters the battlefield under your control, draw a card.\nEach creature you control with defender assigns combat damage equal to its toughness rather than its power and can attack as though it didn't have defender.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("returns 0 for creature that just HAS flying (no keyword-matters text)", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Serra Angel",
      keywords: ["Flying", "Vigilance"],
      oracleText: "Flying, vigilance",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("returns 0 for generic creature with no keyword references", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Grizzly Bears",
      oracleText: "",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("returns 0 for Thalia (mentions noncreature spells, not keyword-matters)", () => {
    const axis = getAxisById("keywordMatters")!;
    const card = mockCard({
      name: "Thalia, Guardian of Thraben",
      keywords: ["First Strike"],
      oracleText: "First strike\nNoncreature spells cost {1} more to cast.",
    });
    expect(axis.detect(card)).toBe(0);
  });
});

test.describe("extractReferencedKeywords", () => {
  test("extracts 'flying' from Kangee", () => {
    const card = mockCard({
      oracleText:
        "Flying\nCreatures with flying get +1/+1 for each feather counter on Kangee, Aerie Keeper.",
    });
    const keywords = extractReferencedKeywords(card);
    expect(keywords).toContain("flying");
  });

  test("extracts 'haste' from Ognis", () => {
    const card = mockCard({
      oracleText:
        "Haste\nWhenever a creature with haste attacks, create a tapped Treasure token.",
    });
    const keywords = extractReferencedKeywords(card);
    expect(keywords).toContain("haste");
  });

  test("extracts 'deathtouch' from Fynn", () => {
    const card = mockCard({
      oracleText:
        "Deathtouch\nWhenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters.",
    });
    const keywords = extractReferencedKeywords(card);
    expect(keywords).toContain("deathtouch");
  });

  test("extracts multiple keywords from Akroma", () => {
    const card = mockCard({
      oracleText:
        "Flying, first strike, vigilance, trample\nAt the beginning of each combat, until end of turn, each other creature you control gets +1/+1 if it has flying, +1/+1 if it has first strike, and so on for double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance.",
    });
    const keywords = extractReferencedKeywords(card);
    expect(keywords).toContain("flying");
    expect(keywords).toContain("first strike");
    expect(keywords).toContain("haste");
    expect(keywords).toContain("deathtouch");
    expect(keywords).toContain("vigilance");
    expect(keywords).toContain("trample");
  });

  test("extracts 'defender' from Arcades", () => {
    const card = mockCard({
      oracleText:
        "Flying, vigilance\nWhenever a creature with defender enters the battlefield under your control, draw a card.\nEach creature you control with defender assigns combat damage equal to its toughness rather than its power and can attack as though it didn't have defender.",
    });
    const keywords = extractReferencedKeywords(card);
    expect(keywords).toContain("defender");
  });

  test("returns empty array for card with no keyword references", () => {
    const card = mockCard({
      keywords: ["Flying"],
      oracleText: "Flying",
    });
    expect(extractReferencedKeywords(card)).toHaveLength(0);
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

test.describe("Supertype Matters axis", () => {
  test("Jodah, the Unifier (cast legendary + static buff) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Jodah, the Unifier",
      typeLine: "Legendary Creature — Human",
      supertypes: ["Legendary"],
      oracleText:
        "Legendary creatures you control get +1/+1.\nWhenever you cast a legendary nontoken spell, exile cards from the top of your library until you exile a legendary nontoken card. You may cast the exiled cards without paying their mana costs.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Jhoira, Weatherlight Captain (historic cast trigger) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Jhoira, Weatherlight Captain",
      typeLine: "Legendary Creature — Human Artificer",
      supertypes: ["Legendary"],
      oracleText: "Whenever you cast a historic spell, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Ratadrabik of Urborg (legendary death trigger) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Ratadrabik of Urborg",
      typeLine: "Legendary Creature — Zombie Wizard",
      supertypes: ["Legendary"],
      oracleText:
        "Vigilance, ward {2}\nOther legendary creatures you control have vigilance.\nWhenever another legendary creature you control dies, create a token that's a copy of that creature, except it's not legendary and it's a 2/2 black Zombie in addition to its other colors and types.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Kethis, the Hidden Hand (cost reduction + graveyard) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Kethis, the Hidden Hand",
      typeLine: "Legendary Creature — Elf Advisor",
      supertypes: ["Legendary"],
      oracleText:
        "Legendary spells you cast cost {1} less to cast.\nExile two legendary cards from your graveyard: Until end of turn, each legendary card in your graveyard gains \"You may play this card from your graveyard.\"",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Shanid, Sleepers' Scourge (play a legendary + other legendary lord) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Shanid, Sleepers' Scourge",
      typeLine: "Legendary Creature — Human Knight",
      supertypes: ["Legendary"],
      oracleText:
        "Menace\nOther legendary creatures you control have menace.\nWhenever you play a legendary land or cast a legendary spell, you draw a card and you lose 1 life.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Mirror Box (legend rule manipulation) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Mirror Box",
      typeLine: "Artifact",
      oracleText:
        "The \"legend rule\" doesn't apply to permanents you control.\nEach legendary creature you control gets +1/+1.\nEach nontoken creature you control with the same name as another creature you control gets +1/+1.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Narfi, Betrayer King (other snow lord + {S} ability) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Narfi, Betrayer King",
      typeLine: "Legendary Snow Creature — Zombie Wizard",
      supertypes: ["Legendary", "Snow"],
      oracleText:
        "Other snow and Zombie creatures you control get +1/+1.\n{S}{S}{S}: Return Narfi, Betrayer King from your graveyard to the battlefield tapped.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Marit Lage's Slumber (snow permanent enters trigger) scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Marit Lage's Slumber",
      typeLine: "Legendary Snow Enchantment",
      supertypes: ["Legendary", "Snow"],
      oracleText:
        "Whenever a snow permanent enters the battlefield under your control, scry 1.\nAt the beginning of your upkeep, if you control ten or more snow permanents, sacrifice Marit Lage's Slumber and create Marit Lage, a legendary 20/20 black Avatar creature token with flying and indestructible.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("card with {S} only in manaCost scores > 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Icehide Golem",
      typeLine: "Snow Artifact Creature — Golem",
      supertypes: ["Snow"],
      manaCost: "{S}",
      oracleText: "",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("generic creature with no supertype references → 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      oracleText: "",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Legendary creature with no payoff text (Thalia) → 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Thalia, Guardian of Thraben",
      typeLine: "Legendary Creature — Human Soldier",
      supertypes: ["Legendary"],
      oracleText: "First strike\nNoncreature spells cost {1} more to cast.",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Hylda of the Icy Crown (ice-themed, NOT snow-matters) → 0", () => {
    const axis = getAxisById("supertypeMatter")!;
    const card = mockCard({
      name: "Hylda of the Icy Crown",
      typeLine: "Legendary Creature — Human Warlock",
      supertypes: ["Legendary"],
      oracleText:
        "Whenever you tap an untapped creature an opponent controls, choose one —\n• Create a 4/4 white and blue Elemental creature token.\n• Put two +1/+1 counters on target creature you control.\n• Scry 2, then draw a card.",
    });
    expect(axis.detect(card)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-face card synergy detection (combined oracle text)
// ---------------------------------------------------------------------------

test.describe("Multi-face card synergy detection", () => {
  test("transform DFC with graveyard text on back face scores on graveyard axis", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({
      name: "Henrika Domnathi // Henrika, Infernal Seer",
      typeLine: "Legendary Creature — Vampire // Legendary Creature — Vampire",
      // Combined oracle text from both faces
      oracleText:
        "At the beginning of combat on your turn, choose one that hasn't been chosen —\n• Each player sacrifices a creature.\n• You draw a card and you lose 1 life.\n• Transform Henrika Domnathi.\n\n" +
        "Flying, deathtouch, lifelink\nWhenever Henrika, Infernal Seer attacks, return target creature card from your graveyard to the battlefield tapped and attacking.",
      layout: "transform",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("modal DFC with spellslinger text on back face scores on spellslinger axis", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({
      name: "Fblthp, Lost on the Range // Fblthp, Found on the Range",
      typeLine: "Legendary Creature — Homunculus // Legendary Creature — Homunculus",
      // Front face is vanilla-ish; back face has "whenever you cast an instant or sorcery"
      oracleText:
        "When Fblthp enters the battlefield, draw a card.\n\n" +
        "Whenever you cast an instant or sorcery spell, copy it. You may choose new targets for the copy.",
      layout: "modal_dfc",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("adventure card with sacrifice text on adventure half scores on sacrifice axis", () => {
    const axis = getAxisById("sacrifice")!;
    const card = mockCard({
      name: "Flamekin Herald // Stoke Genius",
      typeLine: "Creature — Elemental // Sorcery — Adventure",
      oracleText:
        "Sacrifice a creature: Add {R}{R}.\n\n" +
        "Draw two cards, then discard a card.",
      layout: "adventure",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("normal card still works as graveyard baseline", () => {
    const axis = getAxisById("graveyard")!;
    const card = mockCard({
      name: "Reanimate",
      typeLine: "Sorcery",
      oracleText:
        "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.",
      layout: "normal",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });
});

test.describe("Discard axis", () => {
  test("Waste Not (discard payoff) scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Waste Not",
      oracleText:
        "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.\nWhenever an opponent discards a land card, add {B}{B}.\nWhenever an opponent discards a noncreature, nonland card, draw a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Liliana of the Veil (mass discard) scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Liliana of the Veil",
      oracleText:
        "+1: Each player discards a card.\n−2: Target player sacrifices a creature.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Syphon Mind (each other player discards) scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Syphon Mind",
      oracleText:
        "Each other player discards a card. You draw a card for each card discarded this way.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Tomb Robber (discard cost) scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Tomb Robber",
      oracleText: "Menace\n{1}, {T}, Discard a card: This creature explores.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Wheel of Fortune (each player discards their hand) scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Wheel of Fortune",
      oracleText: "Each player discards their hand, then draws seven cards.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("card with Cycling keyword scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Archfiend of Ifnir",
      keywords: ["Cycling"],
      oracleText:
        "Flying\nWhenever you cycle or discard another card, put a -1/-1 counter on each creature your opponents control.\nCycling {2}",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("card with Madness keyword scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Basking Rootwalla",
      keywords: ["Madness"],
      oracleText:
        "{1}{G}: Basking Rootwalla gets +2/+2 until end of turn. Activate only once each turn.\nMadness {0}",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("card with Connive keyword scores > 0", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Raffine, Scheming Seer",
      keywords: ["Connive"],
      oracleText:
        "Flying, ward {1}\nWhenever you attack, target attacking creature connives X, where X is the number of attacking creatures.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Lightning Bolt scores 0 on discard axis", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Lightning Bolt",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
    });
    expect(axis.detect(card)).toBe(0);
  });

  test("Painful Quandary (unless...discards) scores > 0 on discard axis", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Painful Quandary",
      oracleText:
        "Whenever an opponent casts a spell, that player loses 5 life unless that player discards a card.",
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });
});

test.describe("Secrets of Strixhaven axis updates", () => {
  test("Opus ability word boosts Spellslinger axis", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({
      name: "Expressive Firedancer",
      oracleText:
        "Opus — Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn.",
      keywords: ["Opus"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0.4);
  });

  test("Repartee ability word boosts Spellslinger axis", () => {
    const axis = getAxisById("spellslinger")!;
    const card = mockCard({
      name: "Silverquill Duelist",
      oracleText:
        "Repartee — Whenever you cast an instant or sorcery spell that targets a creature, put a +1/+1 counter on this creature.",
      keywords: ["Repartee"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0.4);
  });

  test("Infusion ability word boosts Lifegain axis", () => {
    const axis = getAxisById("lifegain")!;
    const card = mockCard({
      name: "Old-Growth Educator",
      oracleText:
        "Infusion — When this creature enters, put two +1/+1 counters on it if you gained life this turn.",
      keywords: ["Infusion"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0.4);
  });

  test("Increment keyword boosts Counters axis", () => {
    const axis = getAxisById("counters")!;
    const card = mockCard({
      name: "Ambitious Augmenter",
      oracleText:
        "Increment (Whenever you cast a spell, if the amount of mana you spent is greater than this creature's power or toughness, put a +1/+1 counter on this creature.)",
      keywords: ["Increment"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0.4);
  });

  test("Connive 3 yields a higher Discard score than Connive 1", () => {
    const axis = getAxisById("discard")!;
    const conniveOne = mockCard({
      name: "Cheap Conniver",
      oracleText: "When this creature enters, connive 1.",
      keywords: ["Connive"],
    });
    const conniveThree = mockCard({
      name: "Mighty Conniver",
      oracleText: "When this creature enters, connive 3.",
      keywords: ["Connive"],
    });
    expect(axis.detect(conniveThree)).toBeGreaterThan(axis.detect(conniveOne));
  });

  test("Connive without numeric parameter still scores baseline", () => {
    const axis = getAxisById("discard")!;
    const card = mockCard({
      name: "Vintage Conniver",
      oracleText: "Connive.",
      keywords: ["Connive"],
    });
    expect(axis.detect(card)).toBeGreaterThan(0);
  });

  test("Vanilla creature still scores 0 on Spellslinger / Lifegain / Counters", () => {
    const vanilla = mockCard({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      oracleText: "",
    });
    expect(getAxisById("spellslinger")!.detect(vanilla)).toBe(0);
    expect(getAxisById("lifegain")!.detect(vanilla)).toBe(0);
    expect(getAxisById("counters")!.detect(vanilla)).toBe(0);
  });
});
