import { test, expect } from "@playwright/test";
import { parseDecklist, reconstructDecklist } from "../../src/lib/decklist-parser";

test.describe("parseDecklist", () => {
  test("parses simple card lines with quantities", () => {
    const { deck } = parseDecklist("1 Sol Ring\n4 Lightning Bolt");
    expect(deck.mainboard).toEqual([
      { quantity: 1, name: "Sol Ring" },
      { quantity: 4, name: "Lightning Bolt" },
    ]);
  });

  test("parses card lines with 'x' separator", () => {
    const { deck } = parseDecklist("1x Sol Ring\n4x Lightning Bolt");
    expect(deck.mainboard).toEqual([
      { quantity: 1, name: "Sol Ring" },
      { quantity: 4, name: "Lightning Bolt" },
    ]);
  });

  test("detects zone headers (COMMANDER:, MAINBOARD:, SIDEBOARD:)", () => {
    const text = [
      "COMMANDER:",
      "1 Atraxa, Praetors' Voice",
      "MAINBOARD:",
      "1 Sol Ring",
      "SIDEBOARD:",
      "1 Lightning Bolt",
    ].join("\n");
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Atraxa, Praetors' Voice");
    expect(deck.mainboard).toHaveLength(1);
    expect(deck.sideboard).toHaveLength(1);
  });

  test("handles case-insensitive zone headers", () => {
    const text = "commander:\n1 Korvold, Fae-Cursed King\nmainboard:\n1 Sol Ring";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.mainboard).toHaveLength(1);
  });

  test("maps COMPANION: to sideboard zone", () => {
    const text = "COMPANION:\n1 Lurrus of the Dream-Den";
    const { deck } = parseDecklist(text);
    expect(deck.sideboard).toHaveLength(1);
    expect(deck.sideboard[0].name).toBe("Lurrus of the Dream-Den");
  });

  test("returns warnings for unparseable lines", () => {
    const { deck, warnings } = parseDecklist("1 Sol Ring\ngarbage line\n2 Island");
    expect(deck.mainboard).toHaveLength(2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("garbage line");
  });

  test("returns empty deck for empty input", () => {
    const { deck, warnings } = parseDecklist("");
    expect(deck.mainboard).toHaveLength(0);
    expect(deck.commanders).toHaveLength(0);
    expect(deck.sideboard).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test("blank lines between cards — trailing group triggers commander inference", () => {
    // The parser uses a blank-line heuristic: 1-2 cards after a blank line
    // are inferred as commanders. Use qty>2 to avoid inference.
    const text = "1 Sol Ring\n\n\n4 Island";
    const { deck } = parseDecklist(text);
    // 4 Islands won't trigger inference (totalQty > 2), stays in mainboard
    expect(deck.mainboard).toHaveLength(2);
  });

  test("handles Windows line endings (\\r\\n)", () => {
    const text = "COMMANDER:\r\n1 Kenrith, the Returned King\r\nMAINBOARD:\r\n1 Sol Ring\r\n";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.mainboard).toHaveLength(1);
  });

  test("trims whitespace from card names", () => {
    const { deck } = parseDecklist("1   Sol Ring  ");
    expect(deck.mainboard[0].name).toBe("Sol Ring");
  });

  test("handles card names with special characters", () => {
    const text = "1 Uro, Titan of Nature's Wrath\n1 Fire // Ice";
    const { deck } = parseDecklist(text);
    expect(deck.mainboard).toHaveLength(2);
    expect(deck.mainboard[0].name).toBe("Uro, Titan of Nature's Wrath");
    expect(deck.mainboard[1].name).toBe("Fire // Ice");
  });

  test("sets default deck metadata", () => {
    const { deck } = parseDecklist("1 Sol Ring");
    expect(deck.name).toBe("Imported Decklist");
    expect(deck.source).toBe("text");
    expect(deck.url).toBe("");
  });
});

test.describe("parseDecklist — commander inference", () => {
  test("infers 1 commander from last blank-line-separated group", () => {
    const text = "1 Sol Ring\n1 Island\n\n1 Kenrith, the Returned King";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Kenrith, the Returned King");
  });

  test("infers 2 commanders (partner) from last blank-line-separated group", () => {
    const text = "1 Sol Ring\n\n1 Thrasios, Triton Hero\n1 Tymna the Weaver";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(2);
  });

  test("does not infer commanders if no blank line separates them", () => {
    const text = "1 Sol Ring\n1 Kenrith, the Returned King";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(0);
    expect(deck.mainboard).toHaveLength(2);
  });

  test("does not infer commanders if trailing group has 3+ total quantity", () => {
    const text = "1 Sol Ring\n\n1 Card A\n1 Card B\n1 Card C";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(0);
  });

  test("skips inference when explicit COMMANDER: header exists", () => {
    const text = "COMMANDER:\n1 Korvold, Fae-Cursed King\nMAINBOARD:\n1 Sol Ring\n\n1 Lightning Bolt";
    const { deck } = parseDecklist(text);
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Korvold, Fae-Cursed King");
    // Lightning Bolt should NOT be inferred as commander
  });
});

test.describe("parseDecklist — commander override", () => {
  test("moves named card from mainboard to commanders", () => {
    const text = "1 Sol Ring\n1 Kenrith, the Returned King";
    const { deck } = parseDecklist(text, {
      commanders: ["Kenrith, the Returned King"],
    });
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Kenrith, the Returned King");
    expect(deck.mainboard).toHaveLength(1);
    expect(deck.mainboard[0].name).toBe("Sol Ring");
  });

  test("adds missing commander with quantity 1 if not in decklist", () => {
    const text = "1 Sol Ring";
    const { deck } = parseDecklist(text, {
      commanders: ["Kenrith, the Returned King"],
    });
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0]).toEqual({
      name: "Kenrith, the Returned King",
      quantity: 1,
    });
  });

  test("override treats COMMANDER: header cards as mainboard", () => {
    const text = "COMMANDER:\n1 Korvold, Fae-Cursed King\n1 Sol Ring";
    const { deck } = parseDecklist(text, {
      commanders: ["Sol Ring"],
    });
    expect(deck.commanders).toHaveLength(1);
    expect(deck.commanders[0].name).toBe("Sol Ring");
    // Korvold should be in mainboard since override overrides the header
    expect(deck.mainboard.some((c) => c.name === "Korvold, Fae-Cursed King")).toBe(true);
  });
});

test.describe("reconstructDecklist", () => {
  test("round-trips: parse → reconstruct → parse yields same DeckData", () => {
    const original = [
      "COMMANDER:",
      "1 Kenrith, the Returned King",
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "4 Island",
      "",
      "SIDEBOARD:",
      "1 Lightning Bolt",
    ].join("\n");

    const { deck: firstParse } = parseDecklist(original);
    const reconstructed = reconstructDecklist(firstParse);
    const { deck: secondParse } = parseDecklist(reconstructed);

    expect(secondParse.commanders).toEqual(firstParse.commanders);
    expect(secondParse.mainboard).toEqual(firstParse.mainboard);
    expect(secondParse.sideboard).toEqual(firstParse.sideboard);
  });

  test("omits empty sections", () => {
    const { deck } = parseDecklist("1 Sol Ring\n2 Island");
    const text = reconstructDecklist(deck);
    expect(text).not.toContain("COMMANDER:");
    expect(text).not.toContain("SIDEBOARD:");
  });

  test("includes COMMANDER: and MAINBOARD: headers when commanders present", () => {
    const text = reconstructDecklist({
      name: "Test",
      source: "text",
      url: "",
      commanders: [{ name: "Kenrith, the Returned King", quantity: 1 }],
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
      sideboard: [],
    });
    expect(text).toContain("COMMANDER:");
    expect(text).toContain("MAINBOARD:");
  });
});
