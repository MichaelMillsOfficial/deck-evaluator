import { test, expect } from "@playwright/test";
import {
  serializePayload,
  deserializePayload,
  buildCompactPayload,
  serializeCompactPayload,
} from "../../src/lib/deck-codec";
import { reconstructDecklist } from "../../src/lib/decklist-parser";
import { parseDecklist } from "../../src/lib/decklist-parser";
import { makeDeck, makeCard } from "../helpers";
import type { EnrichedCard } from "../../src/lib/types";

test.describe("serializePayload", () => {
  test("produces JSON with { t, c? }", () => {
    const json = serializePayload("1 Sol Ring", ["Atraxa, Praetors' Voice"]);
    const parsed = JSON.parse(json);
    expect(parsed.t).toBe("1 Sol Ring");
    expect(parsed.c).toEqual(["Atraxa, Praetors' Voice"]);
  });

  test("omits c when no commanders", () => {
    const json = serializePayload("1 Sol Ring");
    const parsed = JSON.parse(json);
    expect(parsed.t).toBe("1 Sol Ring");
    expect(parsed.c).toBeUndefined();
  });
});

test.describe("deserializePayload", () => {
  test("parses valid JSON and returns { text, commanders }", () => {
    const input = JSON.stringify({ t: "1 Sol Ring", c: ["Atraxa, Praetors' Voice"] });
    const result = deserializePayload(input);
    expect(result.text).toBe("1 Sol Ring");
    expect(result.commanders).toEqual(["Atraxa, Praetors' Voice"]);
  });

  test("returns undefined commanders when c is missing", () => {
    const input = JSON.stringify({ t: "1 Sol Ring" });
    const result = deserializePayload(input);
    expect(result.text).toBe("1 Sol Ring");
    expect(result.commanders).toBeUndefined();
  });

  test("rejects invalid/missing fields", () => {
    expect(() => deserializePayload("{}")).toThrow();
    expect(() => deserializePayload('{"t": 123}')).toThrow();
    expect(() => deserializePayload("not json")).toThrow();
  });

  test("is tolerant of extra fields", () => {
    const input = JSON.stringify({ t: "1 Sol Ring", extra: true, foo: "bar" });
    const result = deserializePayload(input);
    expect(result.text).toBe("1 Sol Ring");
  });
});

test.describe("reconstructDecklist", () => {
  test("roundtrips: parseDecklist(reconstructDecklist(deck)) produces equivalent DeckData", () => {
    const deck = makeDeck({
      name: "Test Deck",
      commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Command Tower", quantity: 1 },
      ],
      sideboard: [{ name: "Rest in Peace", quantity: 1 }],
    });

    const text = reconstructDecklist(deck);
    const { deck: parsed } = parseDecklist(text);

    expect(parsed.commanders.map((c) => c.name)).toEqual(
      deck.commanders.map((c) => c.name)
    );
    expect(parsed.mainboard.map((c) => c.name).sort()).toEqual(
      deck.mainboard.map((c) => c.name).sort()
    );
    expect(parsed.sideboard.map((c) => c.name).sort()).toEqual(
      deck.sideboard.map((c) => c.name).sort()
    );
  });

  test("includes COMMANDER: section when commanders present", () => {
    const deck = makeDeck({
      commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });

    const text = reconstructDecklist(deck);
    expect(text).toContain("COMMANDER:");
    expect(text).toContain("1 Atraxa, Praetors' Voice");
  });

  test("handles special characters in card names", () => {
    const deck = makeDeck({
      mainboard: [
        { name: "Grafdigger's Cage", quantity: 1 },
        { name: "Jötun Grunt", quantity: 1 },
      ],
    });

    const text = reconstructDecklist(deck);
    expect(text).toContain("1 Grafdigger's Cage");
    expect(text).toContain("1 Jötun Grunt");
  });

  test("omits COMMANDER section when no commanders", () => {
    const deck = makeDeck({
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });

    const text = reconstructDecklist(deck);
    expect(text).not.toContain("COMMANDER:");
  });
});

test.describe("buildCompactPayload", () => {
  test("produces v2 payload with [set, num, qty] tuples", () => {
    const deck = makeDeck({
      name: "Test Deck",
      commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Command Tower", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Atraxa, Praetors' Voice": makeCard({
        name: "Atraxa, Praetors' Voice",
        setCode: "cmm",
        collectorNumber: "456",
      }),
      "Sol Ring": makeCard({
        name: "Sol Ring",
        setCode: "cmm",
        collectorNumber: "123",
      }),
      "Command Tower": makeCard({
        name: "Command Tower",
        setCode: "cmm",
        collectorNumber: "789",
      }),
    };

    const payload = buildCompactPayload(deck, cardMap);
    expect(payload.v).toBe(2);
    expect(payload.n).toBe("Test Deck");
    expect(payload.c).toEqual([["cmm", "456", 1]]);
    expect(payload.m).toEqual([
      ["cmm", "123", 1],
      ["cmm", "789", 1],
    ]);
  });

  test("omits s key when sideboard is empty", () => {
    const deck = makeDeck({
      name: "No Sideboard",
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
    };

    const payload = buildCompactPayload(deck, cardMap);
    expect(payload.s).toBeUndefined();
  });

  test("includes s key when sideboard has cards", () => {
    const deck = makeDeck({
      name: "With Sideboard",
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
      sideboard: [{ name: "Rest in Peace", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
      "Rest in Peace": makeCard({ name: "Rest in Peace", setCode: "akh", collectorNumber: "26" }),
    };

    const payload = buildCompactPayload(deck, cardMap);
    expect(payload.s).toEqual([["akh", "26", 1]]);
  });

  test("uses fallback ['_', cardName, qty] when card missing from cardMap", () => {
    const deck = makeDeck({
      name: "Missing Card",
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Unknown Card", quantity: 2 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
    };

    const payload = buildCompactPayload(deck, cardMap);
    expect(payload.m).toEqual([
      ["cmm", "123", 1],
      ["_", "Unknown Card", 2],
    ]);
  });
});

test.describe("serializeCompactPayload", () => {
  test("produces valid JSON string", () => {
    const deck = makeDeck({
      name: "Test Deck",
      commanders: [{ name: "Sol Ring", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
      "Command Tower": makeCard({ name: "Command Tower", setCode: "cmm", collectorNumber: "789" }),
    };

    const payload = buildCompactPayload(deck, cardMap);
    const json = serializeCompactPayload(payload);
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(2);
    expect(parsed.n).toBe("Test Deck");
  });
});

test.describe("deserializePayload v1/v2 detection", () => {
  test("v1 payload still returns version 1 shape", () => {
    const input = JSON.stringify({ t: "1 Sol Ring", c: ["Atraxa"] });
    const result = deserializePayload(input);
    expect(result.version).toBe(1);
    if (result.version === 1) {
      expect(result.text).toBe("1 Sol Ring");
      expect(result.commanders).toEqual(["Atraxa"]);
    }
  });

  test("v2 payload returns version 2 shape", () => {
    const input = JSON.stringify({
      v: 2,
      n: "Test Deck",
      c: [["cmm", "456", 1]],
      m: [["cmm", "123", 1]],
    });
    const result = deserializePayload(input);
    expect(result.version).toBe(2);
    if (result.version === 2) {
      expect(result.name).toBe("Test Deck");
      expect(result.commanders).toEqual([["cmm", "456", 1]]);
      expect(result.mainboard).toEqual([["cmm", "123", 1]]);
      expect(result.sideboard).toEqual([]);
    }
  });

  test("v2 payload with sideboard", () => {
    const input = JSON.stringify({
      v: 2,
      n: "Test Deck",
      c: [],
      m: [["cmm", "123", 1]],
      s: [["akh", "26", 1]],
    });
    const result = deserializePayload(input);
    expect(result.version).toBe(2);
    if (result.version === 2) {
      expect(result.sideboard).toEqual([["akh", "26", 1]]);
    }
  });

  test("compact JSON payload is smaller than text-based for same deck", () => {
    const deck = makeDeck({
      name: "Size Test",
      commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
      mainboard: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Command Tower", quantity: 1 },
        { name: "Swords to Plowshares", quantity: 1 },
        { name: "Counterspell", quantity: 1 },
        { name: "Arcane Signet", quantity: 1 },
      ],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Atraxa, Praetors' Voice": makeCard({ setCode: "cmm", collectorNumber: "456" }),
      "Sol Ring": makeCard({ setCode: "cmm", collectorNumber: "123" }),
      "Command Tower": makeCard({ setCode: "cmm", collectorNumber: "789" }),
      "Swords to Plowshares": makeCard({ setCode: "cmm", collectorNumber: "55" }),
      "Counterspell": makeCard({ setCode: "cmm", collectorNumber: "42" }),
      "Arcane Signet": makeCard({ setCode: "cmm", collectorNumber: "10" }),
    };

    const compactJson = serializeCompactPayload(buildCompactPayload(deck, cardMap));
    const textPayload = serializePayload(
      reconstructDecklist(deck),
      deck.commanders.map((c) => c.name)
    );

    expect(compactJson.length).toBeLessThan(textPayload.length);
  });
});
