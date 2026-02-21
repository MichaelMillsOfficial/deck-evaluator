import { test, expect } from "@playwright/test";
import { parseManaPips, parseTypeLine } from "../src/lib/mana";

test.describe("parseManaPips", () => {
  test("parses single colored pip", () => {
    expect(parseManaPips("{W}")).toEqual({ W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 });
    expect(parseManaPips("{U}")).toEqual({ W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 });
    expect(parseManaPips("{B}")).toEqual({ W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 });
    expect(parseManaPips("{R}")).toEqual({ W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 });
    expect(parseManaPips("{G}")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 });
    expect(parseManaPips("{C}")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 });
  });

  test("parses multiple colored pips", () => {
    expect(parseManaPips("{2}{B}{B}")).toEqual({ W: 0, U: 0, B: 2, R: 0, G: 0, C: 0 });
  });

  test("parses mixed colors with generic mana", () => {
    expect(parseManaPips("{X}{R}{G}")).toEqual({ W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 });
  });

  test("parses zero generic mana", () => {
    expect(parseManaPips("{0}")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  test("parses hybrid mana — counts toward both colors", () => {
    expect(parseManaPips("{W/U}")).toEqual({ W: 1, U: 1, B: 0, R: 0, G: 0, C: 0 });
  });

  test("parses Phyrexian mana", () => {
    expect(parseManaPips("{B/P}")).toEqual({ W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 });
  });

  test("handles empty string gracefully", () => {
    expect(parseManaPips("")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  test("parses complex mana cost like Atraxa", () => {
    expect(parseManaPips("{G}{W}{U}{B}")).toEqual({ W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 });
  });

  test("parses Sol Ring mana cost", () => {
    expect(parseManaPips("{1}")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });
});

test.describe("parseTypeLine", () => {
  test("parses legendary creature with subtypes", () => {
    const result = parseTypeLine("Legendary Creature — Human Wizard");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardType).toBe("Creature");
    expect(result.subtypes).toEqual(["Human", "Wizard"]);
  });

  test("parses simple artifact with no subtypes", () => {
    const result = parseTypeLine("Artifact");
    expect(result.supertypes).toEqual([]);
    expect(result.cardType).toBe("Artifact");
    expect(result.subtypes).toEqual([]);
  });

  test("parses enchantment with subtype", () => {
    const result = parseTypeLine("Enchantment — Aura");
    expect(result.supertypes).toEqual([]);
    expect(result.cardType).toBe("Enchantment");
    expect(result.subtypes).toEqual(["Aura"]);
  });

  test("parses basic land with subtype", () => {
    const result = parseTypeLine("Basic Land — Island");
    expect(result.supertypes).toEqual(["Basic"]);
    expect(result.cardType).toBe("Land");
    expect(result.subtypes).toEqual(["Island"]);
  });

  test("parses legendary planeswalker", () => {
    const result = parseTypeLine("Legendary Planeswalker — Jace");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardType).toBe("Planeswalker");
    expect(result.subtypes).toEqual(["Jace"]);
  });

  test("parses legendary artifact creature", () => {
    const result = parseTypeLine("Legendary Artifact Creature — Phyrexian Angel Horror");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardType).toBe("Artifact Creature");
    expect(result.subtypes).toEqual(["Phyrexian", "Angel", "Horror"]);
  });

  test("parses snow land", () => {
    const result = parseTypeLine("Snow Land — Island");
    expect(result.supertypes).toEqual(["Snow"]);
    expect(result.cardType).toBe("Land");
    expect(result.subtypes).toEqual(["Island"]);
  });

  test("parses instant with no subtypes", () => {
    const result = parseTypeLine("Instant");
    expect(result.supertypes).toEqual([]);
    expect(result.cardType).toBe("Instant");
    expect(result.subtypes).toEqual([]);
  });

  test("parses kindred type", () => {
    const result = parseTypeLine("Kindred Instant — Elf");
    expect(result.supertypes).toEqual([]);
    expect(result.cardType).toBe("Kindred Instant");
    expect(result.subtypes).toEqual(["Elf"]);
  });

  test("handles DFC type line — only parses front face", () => {
    const result = parseTypeLine("Creature — Human Cleric // Land");
    expect(result.supertypes).toEqual([]);
    expect(result.cardType).toBe("Creature");
    expect(result.subtypes).toEqual(["Human", "Cleric"]);
  });
});
