import { test, expect } from "@playwright/test";
import {
  serializePayload,
  deserializePayload,
} from "../../src/lib/deck-codec";
import { reconstructDecklist } from "../../src/lib/decklist-parser";
import { parseDecklist } from "../../src/lib/decklist-parser";
import { makeDeck } from "../helpers";

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
    const parsed = parseDecklist(text);

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
