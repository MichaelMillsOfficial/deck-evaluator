import { test, expect } from "@playwright/test";
import { makeCard } from "../helpers";
import {
  COMMON_CREATURE_TYPES,
  isChangeling,
  getCreatureSubtypes,
  extractReferencedTypes,
  computeCreatureTypeBreakdown,
  identifyTribalAnchors,
} from "../../src/lib/creature-types";

test.describe("COMMON_CREATURE_TYPES", () => {
  test("contains common MTG creature types", () => {
    for (const type of ["Elf", "Goblin", "Zombie", "Warrior", "Wizard", "Dragon", "Merfolk", "Vampire", "Sliver"]) {
      expect(COMMON_CREATURE_TYPES.has(type)).toBe(true);
    }
  });

  test("does not contain land types", () => {
    for (const type of ["Plains", "Island", "Swamp", "Mountain", "Forest"]) {
      expect(COMMON_CREATURE_TYPES.has(type)).toBe(false);
    }
  });
});

test.describe("isChangeling", () => {
  test("Mirror Entity (Changeling keyword) → true", () => {
    const card = makeCard({
      name: "Mirror Entity",
      keywords: ["Changeling"],
      typeLine: "Creature — Shapeshifter",
      subtypes: ["Shapeshifter"],
    });
    expect(isChangeling(card)).toBe(true);
  });

  test("Elvish Archdruid (no Changeling keyword) → false", () => {
    const card = makeCard({
      name: "Elvish Archdruid",
      keywords: [],
      typeLine: "Creature — Elf Druid",
      subtypes: ["Elf", "Druid"],
    });
    expect(isChangeling(card)).toBe(false);
  });
});

test.describe("getCreatureSubtypes", () => {
  test("Elvish Archdruid (Creature — Elf Druid) → [Elf, Druid]", () => {
    const card = makeCard({
      typeLine: "Creature — Elf Druid",
      subtypes: ["Elf", "Druid"],
    });
    expect(getCreatureSubtypes(card)).toEqual(["Elf", "Druid"]);
  });

  test("Kindred Dominance (Kindred Sorcery) → []", () => {
    const card = makeCard({
      typeLine: "Kindred Sorcery",
      subtypes: [],
    });
    expect(getCreatureSubtypes(card)).toEqual([]);
  });

  test("Breeding Pool (Land — Forest Island) → [] (land subtypes excluded)", () => {
    const card = makeCard({
      typeLine: "Land — Forest Island",
      subtypes: ["Forest", "Island"],
    });
    expect(getCreatureSubtypes(card)).toEqual([]);
  });

  test("Dryad Arbor (Land Creature — Forest Dryad) → [Dryad]", () => {
    const card = makeCard({
      typeLine: "Land Creature — Forest Dryad",
      subtypes: ["Forest", "Dryad"],
    });
    expect(getCreatureSubtypes(card)).toEqual(["Dryad"]);
  });

  test("Sol Ring (Artifact, no subtypes) → []", () => {
    const card = makeCard({
      typeLine: "Artifact",
      subtypes: [],
    });
    expect(getCreatureSubtypes(card)).toEqual([]);
  });
});

test.describe("extractReferencedTypes", () => {
  test("Elvish Archdruid oracle text → [Elf]", () => {
    const types = extractReferencedTypes(
      "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control."
    );
    expect(types).toContain("Elf");
  });

  test("Najeela trigger → [Warrior]", () => {
    const types = extractReferencedTypes(
      "Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking."
    );
    expect(types).toContain("Warrior");
  });

  test("Kindred Dominance oracle text → creature types present", () => {
    // "Choose a creature type. Destroy all creatures that aren't of the chosen type."
    // This doesn't name a specific type — should return empty
    const types = extractReferencedTypes(
      "Choose a creature type. Destroy all creatures that aren't of the chosen type."
    );
    expect(types).toEqual([]);
  });

  test("generic oracle text (Lightning Bolt) → []", () => {
    const types = extractReferencedTypes("Lightning Bolt deals 3 damage to any target.");
    expect(types).toEqual([]);
  });

  test("Goblin Chieftain → [Goblin]", () => {
    const types = extractReferencedTypes(
      "Haste\nOther Goblin creatures you control get +1/+1 and have haste."
    );
    expect(types).toContain("Goblin");
  });

  test("deduplicates repeated references", () => {
    const types = extractReferencedTypes(
      "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control."
    );
    const elfCount = types.filter((t) => t === "Elf").length;
    expect(elfCount).toBe(1);
  });
});

test.describe("computeCreatureTypeBreakdown", () => {
  test("counts subtypes across cards", () => {
    const cardMap = {
      "Llanowar Elves": makeCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
      }),
      "Elvish Mystic": makeCard({
        name: "Elvish Mystic",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
      }),
      "Goblin Guide": makeCard({
        name: "Goblin Guide",
        typeLine: "Creature — Goblin Scout",
        subtypes: ["Goblin", "Scout"],
      }),
    };
    const result = computeCreatureTypeBreakdown(
      ["Llanowar Elves", "Elvish Mystic", "Goblin Guide"],
      cardMap
    );
    expect(result.get("Elf")).toBe(2);
    expect(result.get("Druid")).toBe(2);
    expect(result.get("Goblin")).toBe(1);
  });

  test("Changeling counts toward all types present in deck", () => {
    const cardMap = {
      "Mirror Entity": makeCard({
        name: "Mirror Entity",
        typeLine: "Creature — Shapeshifter",
        subtypes: ["Shapeshifter"],
        keywords: ["Changeling"],
      }),
      "Llanowar Elves": makeCard({
        name: "Llanowar Elves",
        typeLine: "Creature — Elf Druid",
        subtypes: ["Elf", "Druid"],
      }),
      "Goblin Guide": makeCard({
        name: "Goblin Guide",
        typeLine: "Creature — Goblin Scout",
        subtypes: ["Goblin", "Scout"],
      }),
    };
    const result = computeCreatureTypeBreakdown(
      ["Mirror Entity", "Llanowar Elves", "Goblin Guide"],
      cardMap
    );
    // Mirror Entity should count toward Elf, Druid, Goblin, Scout
    expect(result.get("Elf")).toBe(2); // Llanowar + Mirror Entity
    expect(result.get("Goblin")).toBe(2); // Guide + Mirror Entity
  });

  test("ignores non-creature cards", () => {
    const cardMap = {
      "Sol Ring": makeCard({
        name: "Sol Ring",
        typeLine: "Artifact",
        subtypes: [],
      }),
    };
    const result = computeCreatureTypeBreakdown(["Sol Ring"], cardMap);
    expect(result.size).toBe(0);
  });
});

test.describe("identifyTribalAnchors", () => {
  test("commander subtypes are anchors", () => {
    const commander = makeCard({
      name: "Najeela, the Blade-Blossom",
      typeLine: "Legendary Creature — Human Warrior",
      subtypes: ["Human", "Warrior"],
      oracleText: "Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking.",
    });
    const cardMap: Record<string, any> = {
      "Najeela, the Blade-Blossom": commander,
      "Warrior A": makeCard({ subtypes: ["Warrior"], typeLine: "Creature — Warrior" }),
      "Warrior B": makeCard({ subtypes: ["Warrior"], typeLine: "Creature — Warrior" }),
      "Warrior C": makeCard({ subtypes: ["Warrior"], typeLine: "Creature — Warrior" }),
    };
    const anchors = identifyTribalAnchors(
      [commander],
      Object.keys(cardMap),
      cardMap
    );
    expect(anchors).toContain("Warrior");
  });

  test("type referenced in payoff oracle text is an anchor", () => {
    const archdruid = makeCard({
      name: "Elvish Archdruid",
      typeLine: "Creature — Elf Druid",
      subtypes: ["Elf", "Druid"],
      oracleText: "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.",
    });
    const cardMap: Record<string, any> = {
      "Elvish Archdruid": archdruid,
      "Llanowar Elves": makeCard({ subtypes: ["Elf", "Druid"], typeLine: "Creature — Elf Druid" }),
      "Elvish Mystic": makeCard({ subtypes: ["Elf", "Druid"], typeLine: "Creature — Elf Druid" }),
      "Fyndhorn Elves": makeCard({ subtypes: ["Elf", "Druid"], typeLine: "Creature — Elf Druid" }),
      "Priest of Titania": makeCard({ subtypes: ["Elf", "Druid"], typeLine: "Creature — Elf Druid", oracleText: "{T}: Add {G} for each Elf on the battlefield." }),
    };
    const anchors = identifyTribalAnchors(
      [],
      Object.keys(cardMap),
      cardMap
    );
    expect(anchors).toContain("Elf");
  });

  test("returns empty for deck with no tribal focus", () => {
    const cardMap: Record<string, any> = {
      "Sol Ring": makeCard({ typeLine: "Artifact", subtypes: [] }),
      "Lightning Bolt": makeCard({ typeLine: "Instant", subtypes: [] }),
    };
    const anchors = identifyTribalAnchors(
      [],
      Object.keys(cardMap),
      cardMap
    );
    expect(anchors).toEqual([]);
  });
});
