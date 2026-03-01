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
    const result = parseDecklist(FLAT_DECKLIST, {
      commanders: ["Atraxa, Praetors' Voice"],
    });
    expect(result.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(result.mainboard.map((c) => c.name)).not.toContain(
      "Atraxa, Praetors' Voice"
    );
    expect(result.mainboard).toHaveLength(3);
  });

  test("override skips heuristic inference even when trailing group exists", () => {
    // This decklist has a trailing blank-line-separated card that would
    // normally be inferred as a commander by the heuristic
    const textWithTrailing = [
      "1 Sol Ring",
      "1 Command Tower",
      "",
      "1 Thrasios, Triton Hero",
    ].join("\n");

    const result = parseDecklist(textWithTrailing, {
      commanders: ["Sol Ring"],
    });
    // Sol Ring should be the commander (from override), not Thrasios
    expect(result.commanders).toEqual([{ name: "Sol Ring", quantity: 1 }]);
    // Thrasios should stay in mainboard (heuristic was skipped)
    expect(result.mainboard.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
  });

  test("override with card not in list adds it as a fresh commander", () => {
    const result = parseDecklist(FLAT_DECKLIST, {
      commanders: ["Nonexistent Card"],
    });
    // Card not found in any zone — added fresh with quantity 1
    expect(result.commanders).toEqual([
      { name: "Nonexistent Card", quantity: 1 },
    ]);
    // Original mainboard is untouched
    expect(result.mainboard).toHaveLength(4);
  });

  test("override adds commander not in decklist while mainboard stays intact", () => {
    const decklist = [
      "1 Sol Ring",
      "1 Command Tower",
      "1 Arcane Signet",
    ].join("\n");
    const result = parseDecklist(decklist, {
      commanders: ["Suki, Kyoshi Warrior"],
    });
    expect(result.commanders).toEqual([
      { name: "Suki, Kyoshi Warrior", quantity: 1 },
    ]);
    expect(result.mainboard).toHaveLength(3);
    expect(result.mainboard.map((c) => c.name)).toEqual([
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
    const result = parseDecklist(decklist, {
      commanders: ["Thrasios, Triton Hero", "Tymna the Weaver"],
    });
    expect(result.commanders).toHaveLength(2);
    expect(result.commanders.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
    expect(result.commanders.map((c) => c.name)).toContain(
      "Tymna the Weaver"
    );
    // Thrasios moved out, so only Sol Ring and Command Tower remain
    expect(result.mainboard).toHaveLength(2);
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

    const result = parseDecklist(textWithHeader);
    expect(result.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(result.mainboard).toHaveLength(2);
  });

  test("no override falls back to heuristic inference", () => {
    const textWithTrailing = [
      "1 Sol Ring",
      "1 Command Tower",
      "",
      "1 Atraxa, Praetors' Voice",
    ].join("\n");

    const result = parseDecklist(textWithTrailing);
    expect(result.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
    expect(result.mainboard).toHaveLength(2);
  });

  test("override ignores COMMANDER: header in text", () => {
    // Text has an explicit COMMANDER header for card A, but override says card B
    const textWithHeader = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "1 Command Tower",
      "1 Thrasios, Triton Hero",
    ].join("\n");

    const result = parseDecklist(textWithHeader, {
      commanders: ["Thrasios, Triton Hero"],
    });
    expect(result.commanders).toEqual([
      { name: "Thrasios, Triton Hero", quantity: 1 },
    ]);
    // Atraxa should be in mainboard since override takes precedence
    expect(result.mainboard.map((c) => c.name)).toContain(
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

    const result = parseDecklist(text, {
      commanders: ["Thrasios, Triton Hero", "Tymna the Weaver"],
    });
    expect(result.commanders).toHaveLength(2);
    expect(result.commanders.map((c) => c.name)).toContain(
      "Thrasios, Triton Hero"
    );
    expect(result.commanders.map((c) => c.name)).toContain(
      "Tymna the Weaver"
    );
    expect(result.mainboard).toHaveLength(2);
  });

  test("empty override array falls back to normal parsing", () => {
    const textWithHeader = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
    ].join("\n");

    const result = parseDecklist(textWithHeader, { commanders: [] });
    expect(result.commanders).toEqual([
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
    ]);
  });
});
