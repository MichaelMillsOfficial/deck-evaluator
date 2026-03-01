import { test, expect } from "@playwright/test";
import { parseDecklist } from "../../src/lib/decklist-parser";

test.describe("parseDecklist — commander override", () => {
  const FLAT_DECKLIST = [
    "1 Atraxa, Praetors' Voice",
    "1 Sol Ring",
    "1 Command Tower",
    "1 Arcane Signet",
  ].join("\n");

  test("override moves named card from mainboard to commanders", () => {
    const { deck } = parseDecklist(FLAT_DECKLIST, {
      commanders: ["Atraxa, Praetors' Voice"],
    });
    expect(deck.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(deck.mainboard.map((c) => c.name)).not.toContain(
      "Atraxa, Praetors' Voice"
    );
    expect(deck.mainboard).toHaveLength(3);
  });

  test("override skips heuristic inference even when trailing group exists", () => {
    const textWithTrailing = [
      "1 Sol Ring",
      "1 Command Tower",
      "",
      "1 Thrasios, Triton Hero",
    ].join("\n");

    const { deck } = parseDecklist(textWithTrailing, {
      commanders: ["Sol Ring"],
    });
    expect(deck.commanders).toEqual([{ name: "Sol Ring", quantity: 1 }]);
    expect(deck.mainboard.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
  });

  test("override with card not in list adds it as a fresh commander", () => {
    const { deck } = parseDecklist(FLAT_DECKLIST, {
      commanders: ["Nonexistent Card"],
    });
    expect(deck.commanders).toEqual([
      { name: "Nonexistent Card", quantity: 1 },
    ]);
    expect(deck.mainboard).toHaveLength(4);
  });

  test("override adds commander not in decklist while mainboard stays intact", () => {
    const decklist = [
      "1 Sol Ring",
      "1 Command Tower",
      "1 Arcane Signet",
    ].join("\n");
    const { deck } = parseDecklist(decklist, {
      commanders: ["Suki, Kyoshi Warrior"],
    });
    expect(deck.commanders).toEqual([
      { name: "Suki, Kyoshi Warrior", quantity: 1 },
    ]);
    expect(deck.mainboard).toHaveLength(3);
    expect(deck.mainboard.map((c) => c.name)).toEqual([
      "Sol Ring",
      "Command Tower",
      "Arcane Signet",
    ]);
  });

  test("partner pair: one in mainboard (moved) and one not (added fresh)", () => {
    const decklist = [
      "1 Thrasios, Triton Hero",
      "1 Sol Ring",
      "1 Command Tower",
    ].join("\n");
    const { deck } = parseDecklist(decklist, {
      commanders: ["Thrasios, Triton Hero", "Tymna the Weaver"],
    });
    expect(deck.commanders).toHaveLength(2);
    expect(deck.commanders.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
    expect(deck.commanders.map((c) => c.name)).toContain(
      "Tymna the Weaver"
    );
    expect(deck.mainboard).toHaveLength(2);
  });

  test("no override falls back to explicit COMMANDER: header", () => {
    const textWithHeader = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "1 Command Tower",
    ].join("\n");

    const { deck } = parseDecklist(textWithHeader);
    expect(deck.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(deck.mainboard).toHaveLength(2);
  });

  test("no override falls back to heuristic inference", () => {
    const textWithTrailing = [
      "1 Sol Ring",
      "1 Command Tower",
      "",
      "1 Atraxa, Praetors' Voice",
    ].join("\n");

    const { deck } = parseDecklist(textWithTrailing);
    expect(deck.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(deck.mainboard).toHaveLength(2);
  });

  test("override ignores COMMANDER: header in text", () => {
    const textWithHeader = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "1 Command Tower",
      "1 Thrasios, Triton Hero",
    ].join("\n");

    const { deck } = parseDecklist(textWithHeader, {
      commanders: ["Thrasios, Triton Hero"],
    });
    expect(deck.commanders).toEqual([
      { name: "Thrasios, Triton Hero", quantity: 1 },
    ]);
    expect(deck.mainboard.map((c) => c.name)).toContain(
      "Atraxa, Praetors' Voice"
    );
  });

  test("override supports partner pair (2 commanders)", () => {
    const text = [
      "1 Thrasios, Triton Hero",
      "1 Tymna the Weaver",
      "1 Sol Ring",
      "1 Command Tower",
    ].join("\n");

    const { deck } = parseDecklist(text, {
      commanders: ["Thrasios, Triton Hero", "Tymna the Weaver"],
    });
    expect(deck.commanders).toHaveLength(2);
    expect(deck.commanders.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
    expect(deck.commanders.map((c) => c.name)).toContain(
      "Tymna the Weaver"
    );
    expect(deck.mainboard).toHaveLength(2);
  });

  test("empty override array falls back to normal parsing", () => {
    const textWithHeader = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
    ].join("\n");

    const { deck } = parseDecklist(textWithHeader, { commanders: [] });
    expect(deck.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
  });
});

test.describe("parseDecklist — warnings for unparseable lines", () => {
  test("unparseable lines are returned in warnings with line numbers", () => {
    const text = [
      "COMMANDER:",
      "Suki, Kyoshi Warrior",    // line 2 — missing quantity prefix
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "1 Command Tower",
    ].join("\n");

    const { deck, warnings } = parseDecklist(text);
    // The unparseable line should appear in warnings
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Line 2");
    expect(warnings[0]).toContain("Suki, Kyoshi Warrior");
    // It should not appear in any zone
    expect(deck.commanders).toHaveLength(0);
    expect(deck.mainboard.map((c) => c.name)).not.toContain(
      "Suki, Kyoshi Warrior"
    );
  });

  test("valid decklist returns empty warnings array", () => {
    const text = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
    ].join("\n");

    const { warnings } = parseDecklist(text);
    expect(warnings).toEqual([]);
  });

  test("blank lines and zone headers are NOT reported as warnings", () => {
    const text = [
      "COMMANDER:",
      "",
      "MAINBOARD:",
      "",
      "SIDEBOARD:",
      "COMPANION:",
    ].join("\n");

    const { warnings } = parseDecklist(text);
    expect(warnings).toEqual([]);
  });

  test("multiple unparseable lines are all tracked", () => {
    const text = [
      "1 Sol Ring",
      "Bad Line One",              // line 2
      "1 Command Tower",
      "Another Bad Line",          // line 4
    ].join("\n");

    const { warnings } = parseDecklist(text);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Line 2");
    expect(warnings[0]).toContain("Bad Line One");
    expect(warnings[1]).toContain("Line 4");
    expect(warnings[1]).toContain("Another Bad Line");
  });

  test("warnings include line with only a card name (no quantity)", () => {
    const text = [
      "1 Sol Ring",
      "Command Tower",  // line 2 — missing quantity
    ].join("\n");

    const { deck, warnings } = parseDecklist(text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Line 2");
    expect(warnings[0]).toContain("Command Tower");
    expect(deck.mainboard).toHaveLength(1);
    expect(deck.mainboard[0].name).toBe("Sol Ring");
  });
});
