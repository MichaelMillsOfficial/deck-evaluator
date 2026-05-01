import { test, expect } from "@playwright/test";
import {
  buildModifiedDeck,
  confirmedAdds,
  confirmedCutNames,
  unpairedAddNames,
  serializePendingChanges,
  deserializePendingChanges,
  type PendingAdd,
} from "../../src/lib/pending-changes";
import { makeCard, makeDeck } from "../helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePairedAdd(name: string, cutName: string): PendingAdd {
  return { name, pairedCutName: cutName, enrichedCard: makeCard({ name }) };
}

function makeUnpairedAdd(name: string): PendingAdd {
  return { name };
}

// ---------------------------------------------------------------------------
// buildModifiedDeck
// ---------------------------------------------------------------------------

test.describe("buildModifiedDeck", () => {
  test("empty adds returns deck unchanged", () => {
    const deck = makeDeck({
      commanders: [{ name: "Commander", quantity: 1 }],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Forest", quantity: 1 },
      ],
    });

    const result = buildModifiedDeck(deck, []);

    expect(result.mainboard).toHaveLength(2);
    expect(result.mainboard.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Sol Ring", "Forest"])
    );
    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].name).toBe("Commander");
  });

  test("one paired add removes the cut and adds the new card", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Forest", quantity: 1 },
        { name: "Mind Stone", quantity: 1 },
      ],
    });

    const adds: PendingAdd[] = [makePairedAdd("Lightning Bolt", "Mind Stone")];
    const result = buildModifiedDeck(deck, adds);

    const names = result.mainboard.map((c) => c.name);
    expect(names).toContain("Sol Ring");
    expect(names).toContain("Forest");
    expect(names).toContain("Lightning Bolt");
    expect(names).not.toContain("Mind Stone");
  });

  test("one unpaired add is a no-op", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Forest", quantity: 1 },
      ],
    });

    const adds: PendingAdd[] = [makeUnpairedAdd("Lightning Bolt")];
    const result = buildModifiedDeck(deck, adds);

    const names = result.mainboard.map((c) => c.name);
    expect(names).toContain("Sol Ring");
    expect(names).toContain("Forest");
    expect(names).not.toContain("Lightning Bolt");
    expect(result.mainboard).toHaveLength(2);
  });

  test("mixed paired+unpaired only applies paired", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Mind Stone", quantity: 1 },
        { name: "Forest", quantity: 1 },
      ],
    });

    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makeUnpairedAdd("Counterspell"),
    ];
    const result = buildModifiedDeck(deck, adds);

    const names = result.mainboard.map((c) => c.name);
    expect(names).toContain("Sol Ring");
    expect(names).toContain("Forest");
    expect(names).toContain("Lightning Bolt");
    expect(names).not.toContain("Mind Stone");
    expect(names).not.toContain("Counterspell");
  });

  test("preserves total mainboard card count (invariant) for each paired swap", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Mind Stone", quantity: 1 },
        { name: "Forest", quantity: 3 },
        { name: "Island", quantity: 2 },
        { name: "Brainstorm", quantity: 1 },
      ],
    });

    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makePairedAdd("Counterspell", "Brainstorm"),
    ];
    const result = buildModifiedDeck(deck, adds);

    // Original total: 1+1+3+2+1 = 8
    const originalCount = deck.mainboard.reduce(
      (s, c) => s + c.quantity,
      0
    );
    const modifiedCount = result.mainboard.reduce(
      (s, c) => s + c.quantity,
      0
    );
    expect(modifiedCount).toBe(originalCount);
  });

  test("preserves commanders untouched", () => {
    const deck = makeDeck({
      commanders: [
        { name: "Atraxa, Praetors' Voice", quantity: 1 },
      ],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Mind Stone", quantity: 1 },
      ],
    });

    const adds: PendingAdd[] = [makePairedAdd("Lightning Bolt", "Mind Stone")];
    const result = buildModifiedDeck(deck, adds);

    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].name).toBe("Atraxa, Praetors' Voice");
  });

  test("preserves sideboard untouched", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Mind Stone", quantity: 1 },
      ],
      sideboard: [{ name: "Rest in Peace", quantity: 1 }],
    });

    const adds: PendingAdd[] = [makePairedAdd("Lightning Bolt", "Mind Stone")];
    const result = buildModifiedDeck(deck, adds);

    expect(result.sideboard).toHaveLength(1);
    expect(result.sideboard[0].name).toBe("Rest in Peace");
  });
});

// ---------------------------------------------------------------------------
// confirmedAdds
// ---------------------------------------------------------------------------

test.describe("confirmedAdds", () => {
  test("returns only adds with pairedCutName defined", () => {
    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makeUnpairedAdd("Counterspell"),
      makePairedAdd("Sol Ring", "Forest"),
    ];
    const result = confirmedAdds(adds);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(
      expect.arrayContaining(["Lightning Bolt", "Sol Ring"])
    );
  });

  test("empty adds returns empty array", () => {
    expect(confirmedAdds([])).toHaveLength(0);
  });

  test("all unpaired returns empty array", () => {
    const adds: PendingAdd[] = [makeUnpairedAdd("A"), makeUnpairedAdd("B")];
    expect(confirmedAdds(adds)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// confirmedCutNames
// ---------------------------------------------------------------------------

test.describe("confirmedCutNames", () => {
  test("returns Set of paired cut names only", () => {
    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makeUnpairedAdd("Counterspell"),
      makePairedAdd("Sol Ring", "Forest"),
    ];
    const cuts = confirmedCutNames(adds);
    expect(cuts).toBeInstanceOf(Set);
    expect(cuts.has("Mind Stone")).toBe(true);
    expect(cuts.has("Forest")).toBe(true);
    expect(cuts.size).toBe(2);
  });

  test("empty adds returns empty Set", () => {
    expect(confirmedCutNames([])).toEqual(new Set());
  });

  test("unpaired adds do not contribute to the set", () => {
    const adds: PendingAdd[] = [makeUnpairedAdd("Counterspell")];
    expect(confirmedCutNames(adds).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// unpairedAddNames
// ---------------------------------------------------------------------------

test.describe("unpairedAddNames", () => {
  test("returns Set of names where pairedCutName === undefined", () => {
    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makeUnpairedAdd("Counterspell"),
      makeUnpairedAdd("Brainstorm"),
    ];
    const unpaired = unpairedAddNames(adds);
    expect(unpaired).toBeInstanceOf(Set);
    expect(unpaired.has("Counterspell")).toBe(true);
    expect(unpaired.has("Brainstorm")).toBe(true);
    expect(unpaired.has("Lightning Bolt")).toBe(false);
    expect(unpaired.size).toBe(2);
  });

  test("empty adds returns empty Set", () => {
    expect(unpairedAddNames([])).toEqual(new Set());
  });

  test("all paired returns empty Set", () => {
    const adds: PendingAdd[] = [makePairedAdd("A", "B")];
    expect(unpairedAddNames(adds).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Codec: serializePendingChanges / deserializePendingChanges
// ---------------------------------------------------------------------------

test.describe("serializePendingChanges", () => {
  test("roundtrip preserves name and pairedCutName, drops enrichedCard and analysis", () => {
    const adds: PendingAdd[] = [
      {
        name: "Sol Ring",
        pairedCutName: "Mind Stone",
        enrichedCard: makeCard({ name: "Sol Ring" }),
        analysis: undefined,
      },
      {
        name: "Counterspell",
        enrichedCard: makeCard({ name: "Counterspell" }),
      },
    ];

    const serialized = serializePendingChanges("deck-abc", adds);

    expect(serialized.version).toBe(1);
    expect(serialized.deckId).toBe("deck-abc");
    expect(serialized.adds).toHaveLength(2);

    const solRingEntry = serialized.adds.find((a) => a.name === "Sol Ring");
    expect(solRingEntry).toBeDefined();
    expect(solRingEntry?.pairedCutName).toBe("Mind Stone");
    // enrichedCard should not be present
    expect((solRingEntry as unknown as Record<string, unknown>)?.enrichedCard).toBeUndefined();

    const counterspellEntry = serialized.adds.find((a) => a.name === "Counterspell");
    expect(counterspellEntry).toBeDefined();
    expect(counterspellEntry?.pairedCutName).toBeUndefined();
  });
});

test.describe("deserializePendingChanges", () => {
  test("roundtrip returns correct adds", () => {
    const adds: PendingAdd[] = [
      makePairedAdd("Lightning Bolt", "Mind Stone"),
      makeUnpairedAdd("Counterspell"),
    ];

    const serialized = serializePendingChanges("deck-123", adds);
    const result = deserializePendingChanges(serialized, "deck-123");

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    const bolt = result?.find((a) => a.name === "Lightning Bolt");
    expect(bolt?.pairedCutName).toBe("Mind Stone");
    const counter = result?.find((a) => a.name === "Counterspell");
    expect(counter?.pairedCutName).toBeUndefined();
  });

  test("rejects payload with mismatched deckId", () => {
    const adds: PendingAdd[] = [makePairedAdd("Sol Ring", "Mind Stone")];
    const serialized = serializePendingChanges("deck-abc", adds);
    const result = deserializePendingChanges(serialized, "deck-xyz");
    expect(result).toBeNull();
  });

  test("returns null for null input", () => {
    expect(deserializePendingChanges(null, "deck-123")).toBeNull();
  });

  test("returns null for malformed payload (missing version)", () => {
    expect(
      deserializePendingChanges({ deckId: "deck-123", adds: [] }, "deck-123")
    ).toBeNull();
  });

  test("returns null for malformed payload (missing adds array)", () => {
    expect(
      deserializePendingChanges({ version: 1, deckId: "deck-123" }, "deck-123")
    ).toBeNull();
  });

  test("returns null for non-object input", () => {
    expect(deserializePendingChanges("not an object", "deck-123")).toBeNull();
    expect(deserializePendingChanges(42, "deck-123")).toBeNull();
    expect(deserializePendingChanges(undefined, "deck-123")).toBeNull();
  });
});
