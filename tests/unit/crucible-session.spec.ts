import { test, expect } from "@playwright/test";
import {
  createCrucibleSession,
  flattenPileParse,
  addCardToPool,
  setCardStatus,
  setKeptQuantity,
  keptQuantityOf,
  keptCards,
  cutCards,
  undecidedCards,
  keptCount,
  buildFinalDeck,
  parseCruciblePayload,
  type CruciblePayload,
} from "../../src/lib/crucible-session";
import { makeDeck } from "../helpers";
import type { DeckCard } from "../../src/lib/types";

const POOL: DeckCard[] = [
  { name: "Sol Ring", quantity: 1 },
  { name: "Cultivate", quantity: 1 },
  { name: "Plains", quantity: 12 },
  { name: "Adeline, Resplendent Cathar", quantity: 1 },
];

function session(overrides: Partial<CruciblePayload> = {}): CruciblePayload {
  return { ...createCrucibleSession(POOL, []), ...overrides };
}

test.describe("createCrucibleSession", () => {
  test("defaults every card to undecided and generates an id", () => {
    const payload = createCrucibleSession(POOL, ["warn one"]);
    expect(payload.crucibleId).toBeTruthy();
    expect(payload.parseWarnings).toEqual(["warn one"]);
    expect(payload.commanders).toEqual([]);
    expect(payload.pool).toEqual(POOL);
    for (const card of POOL) {
      expect(payload.statuses[card.name]).toBe("undecided");
    }
  });

  test("two sessions get distinct ids", () => {
    const a = createCrucibleSession(POOL, []);
    const b = createCrucibleSession(POOL, []);
    expect(a.crucibleId).not.toBe(b.crucibleId);
  });
});

test.describe("flattenPileParse", () => {
  test("folds parser-inferred commanders back into the pool", () => {
    const parsed = {
      deck: makeDeck({
        commanders: [{ name: "Adeline, Resplendent Cathar", quantity: 1 }],
        mainboard: [{ name: "Sol Ring", quantity: 1 }],
        sideboard: [{ name: "Swords to Plowshares", quantity: 1 }],
      }),
      warnings: ["a warning"],
    };
    const { pool, warnings } = flattenPileParse(parsed);
    expect(warnings).toEqual(["a warning"]);
    expect(pool).toContainEqual({ name: "Adeline, Resplendent Cathar", quantity: 1 });
    expect(pool).toContainEqual({ name: "Sol Ring", quantity: 1 });
    expect(pool).toContainEqual({ name: "Swords to Plowshares", quantity: 1 });
  });

  test("merges duplicate names across zones, summing quantities", () => {
    const parsed = {
      deck: makeDeck({
        mainboard: [{ name: "Plains", quantity: 5 }],
        sideboard: [{ name: "Plains", quantity: 3 }],
      }),
      warnings: [],
    };
    const { pool } = flattenPileParse(parsed);
    expect(pool).toEqual([{ name: "Plains", quantity: 8 }]);
  });
});

test.describe("addCardToPool", () => {
  test("appends a new card as quantity 1 with undecided status (immutable)", () => {
    const before = session();
    const after = addCardToPool(before, "Birds of Paradise");
    expect(after).not.toBe(before);
    expect(after.pool).toContainEqual({ name: "Birds of Paradise", quantity: 1 });
    expect(after.statuses["Birds of Paradise"]).toBe("undecided");
    expect(before.pool.find((c) => c.name === "Birds of Paradise")).toBeUndefined();
  });

  test("bumps quantity for a name already in the pool, preserving its status", () => {
    let payload = session();
    payload = setCardStatus(payload, "Sol Ring", "keep");
    const after = addCardToPool(payload, "Sol Ring");
    expect(after.pool.find((c) => c.name === "Sol Ring")?.quantity).toBe(2);
    expect(after.statuses["Sol Ring"]).toBe("keep");
  });

  test("preserves a partial keep count when bumping a stacked card", () => {
    let payload = session();
    payload = setKeptQuantity(payload, "Plains", 5);
    const after = addCardToPool(payload, "Plains");
    expect(after.pool.find((c) => c.name === "Plains")?.quantity).toBe(13);
    expect(keptQuantityOf(after, { name: "Plains", quantity: 13 })).toBe(5);
  });
});

test.describe("setCardStatus", () => {
  test("returns a new payload with the status flipped (immutable)", () => {
    const before = session();
    const after = setCardStatus(before, "Sol Ring", "keep");
    expect(after).not.toBe(before);
    expect(after.statuses["Sol Ring"]).toBe("keep");
    expect(before.statuses["Sol Ring"]).toBe("undecided");
  });

  test("ignores names not in the pool", () => {
    const before = session();
    const after = setCardStatus(before, "Black Lotus", "keep");
    expect(after.statuses["Black Lotus"]).toBeUndefined();
  });
});

test.describe("setKeptQuantity", () => {
  test("keeps a partial count of a stacked card", () => {
    const payload = setKeptQuantity(session(), "Plains", 5);
    expect(payload.statuses["Plains"]).toBe("keep");
    expect(payload.keptQuantities["Plains"]).toBe(5);
    expect(keptQuantityOf(payload, { name: "Plains", quantity: 12 })).toBe(5);
    expect(keptCount(payload)).toBe(5);
  });

  test("clamps to the pool quantity and drops the partial entry at full", () => {
    const payload = setKeptQuantity(session(), "Plains", 40);
    expect(payload.statuses["Plains"]).toBe("keep");
    expect(payload.keptQuantities["Plains"]).toBeUndefined();
    expect(keptCount(payload)).toBe(12);
  });

  test("zero returns the card to undecided", () => {
    let payload = setKeptQuantity(session(), "Plains", 5);
    payload = setKeptQuantity(payload, "Plains", 0);
    expect(payload.statuses["Plains"]).toBe("undecided");
    expect(payload.keptQuantities["Plains"]).toBeUndefined();
    expect(keptCount(payload)).toBe(0);
  });

  test("ignores names not in the pool", () => {
    const before = session();
    expect(setKeptQuantity(before, "Black Lotus", 3)).toBe(before);
  });

  test("the all-or-nothing shortcut clears a partial keep", () => {
    let payload = setKeptQuantity(session(), "Plains", 5);
    payload = setCardStatus(payload, "Plains", "keep");
    expect(payload.keptQuantities["Plains"]).toBeUndefined();
    expect(keptCount(payload)).toBe(12);
  });
});

test.describe("partitions", () => {
  test("kept / cut / undecided partition the pool, quantity-aware", () => {
    let payload = session();
    payload = setCardStatus(payload, "Sol Ring", "keep");
    payload = setCardStatus(payload, "Cultivate", "cut");

    expect(keptCards(payload)).toEqual([{ name: "Sol Ring", quantity: 1 }]);
    expect(cutCards(payload)).toEqual([{ name: "Cultivate", quantity: 1 }]);
    expect(undecidedCards(payload).map((c) => c.name).sort()).toEqual([
      "Adeline, Resplendent Cathar",
      "Plains",
    ]);
  });

  test("keptCount sums quantities, not unique names", () => {
    let payload = session();
    payload = setCardStatus(payload, "Plains", "keep");
    payload = setCardStatus(payload, "Sol Ring", "keep");
    expect(keptCount(payload)).toBe(13);
  });
});

test.describe("buildFinalDeck", () => {
  test("kept cards become the mainboard, cuts and undecided the sideboard, commanders excluded from mainboard", () => {
    let payload = session({ commanders: ["Adeline, Resplendent Cathar"] });
    payload = setCardStatus(payload, "Adeline, Resplendent Cathar", "keep");
    payload = setCardStatus(payload, "Sol Ring", "keep");
    payload = setCardStatus(payload, "Cultivate", "cut");
    // Plains left undecided.

    const deck = buildFinalDeck(payload, "Adeline's Hundred");
    expect(deck.name).toBe("Adeline's Hundred");
    expect(deck.source).toBe("text");
    expect(deck.commanders).toEqual([
      { name: "Adeline, Resplendent Cathar", quantity: 1 },
    ]);
    expect(deck.mainboard).toEqual([{ name: "Sol Ring", quantity: 1 }]);
    expect(deck.sideboard.map((c) => c.name).sort()).toEqual([
      "Cultivate",
      "Plains",
    ]);
  });

  test("a partial keep splits the stack: kept portion mainboard, remainder sideboard", () => {
    let payload = session();
    payload = setKeptQuantity(payload, "Plains", 5);

    const deck = buildFinalDeck(payload, "Split Stack");
    expect(deck.mainboard).toContainEqual({ name: "Plains", quantity: 5 });
    expect(deck.sideboard).toContainEqual({ name: "Plains", quantity: 7 });
  });
});

test.describe("parseCruciblePayload", () => {
  test("round-trips a serialized payload", () => {
    let payload = session({ commanders: ["Adeline, Resplendent Cathar"] });
    payload = setCardStatus(payload, "Sol Ring", "keep");
    const restored = parseCruciblePayload(JSON.stringify(payload));
    expect(restored).toEqual(payload);
  });

  test("returns null for corrupt or foreign JSON", () => {
    expect(parseCruciblePayload("not json {")).toBeNull();
    expect(parseCruciblePayload(JSON.stringify({ hello: "world" }))).toBeNull();
    expect(parseCruciblePayload(null)).toBeNull();
  });
});
