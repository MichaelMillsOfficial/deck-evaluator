import { test, expect } from "@playwright/test";
import { parseOracleText } from "../src/lib/oracle";

test.describe("parseOracleText", () => {
  test("plain text with no symbols", () => {
    expect(parseOracleText("Counter target spell.")).toEqual([
      { type: "text", value: "Counter target spell." },
    ]);
  });

  test("symbol at start", () => {
    expect(parseOracleText("{T}: Add {C}{C}.")).toEqual([
      { type: "symbol", value: "T" },
      { type: "text", value: ": Add " },
      { type: "symbol", value: "C" },
      { type: "symbol", value: "C" },
      { type: "text", value: "." },
    ]);
  });

  test("symbol at end", () => {
    expect(parseOracleText("Add {G}")).toEqual([
      { type: "text", value: "Add " },
      { type: "symbol", value: "G" },
    ]);
  });

  test("symbol in middle", () => {
    expect(parseOracleText("Pay {2} life")).toEqual([
      { type: "text", value: "Pay " },
      { type: "symbol", value: "2" },
      { type: "text", value: " life" },
    ]);
  });

  test("hybrid mana", () => {
    expect(parseOracleText("{W/U}")).toEqual([
      { type: "symbol", value: "W/U" },
    ]);
  });

  test("empty string", () => {
    expect(parseOracleText("")).toEqual([]);
  });

  test("symbol-only input", () => {
    expect(parseOracleText("{E}")).toEqual([
      { type: "symbol", value: "E" },
    ]);
  });

  test("multiple symbols with no text between them", () => {
    expect(parseOracleText("{W}{U}{B}")).toEqual([
      { type: "symbol", value: "W" },
      { type: "symbol", value: "U" },
      { type: "symbol", value: "B" },
    ]);
  });

  test("Phyrexian mana", () => {
    expect(parseOracleText("{B/P}")).toEqual([
      { type: "symbol", value: "B/P" },
    ]);
  });
});
