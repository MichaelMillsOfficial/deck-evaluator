import { test, expect } from "@playwright/test";
import { extractKeywordParameter } from "../../src/lib/keyword-parameters";

test.describe("extractKeywordParameter", () => {
  test("returns N for bare integer argument (Ward 2)", () => {
    expect(extractKeywordParameter("Flying, ward 2", "ward")).toBe(2);
  });

  test("returns N for mana-brace argument (Ward {3})", () => {
    expect(
      extractKeywordParameter("Flying, ward {3} (...)", "ward"),
    ).toBe(3);
  });

  test("matches case-insensitively", () => {
    expect(extractKeywordParameter("WARD 4", "ward")).toBe(4);
    expect(extractKeywordParameter("ward 4", "WARD")).toBe(4);
  });

  test("works for Connive N", () => {
    expect(
      extractKeywordParameter(
        "When this creature enters, connive 2.",
        "connive",
      ),
    ).toBe(2);
  });

  test("works for Casualty N", () => {
    expect(
      extractKeywordParameter("Casualty 3 (...)", "casualty"),
    ).toBe(3);
  });

  test("returns null when keyword is absent", () => {
    expect(extractKeywordParameter("Flying, trample", "ward")).toBeNull();
  });

  test("returns null for non-numeric arguments (Ward {X})", () => {
    expect(extractKeywordParameter("Ward {X}", "ward")).toBeNull();
  });

  test("returns null for life-payment ward (Ward — Pay 2 life)", () => {
    // Ward followed by an em-dash (sentence form) — no integer to extract.
    expect(
      extractKeywordParameter("Ward — Pay 2 life.", "ward"),
    ).toBeNull();
  });

  test("returns the max when keyword appears multiple times", () => {
    // Hypothetical card with two ward instances (modal/face).
    expect(
      extractKeywordParameter("Ward 1. // Ward 3.", "ward"),
    ).toBe(3);
  });

  test("returns null for empty inputs", () => {
    expect(extractKeywordParameter("", "ward")).toBeNull();
    expect(extractKeywordParameter("Ward 2", "")).toBeNull();
  });

  test("does not match keyword as substring of another word", () => {
    // "rewardful" should not match "reward".
    expect(
      extractKeywordParameter("Rewardful enchantment 2", "reward"),
    ).toBeNull();
  });
});
