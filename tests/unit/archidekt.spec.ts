import { test, expect } from "@playwright/test";
import {
  isArchidektUrl,
  extractArchidektDeckId,
  normalizeArchidektCards,
} from "../../src/lib/archidekt";
import type { ArchidektApiResponse } from "../../src/lib/types";

test.describe("isArchidektUrl", () => {
  test("returns true for valid https URL", () => {
    expect(isArchidektUrl("https://archidekt.com/decks/12345")).toBe(true);
  });

  test("returns true for valid http URL", () => {
    expect(isArchidektUrl("http://archidekt.com/decks/99")).toBe(true);
  });

  test("returns true for URL with www prefix", () => {
    expect(isArchidektUrl("https://www.archidekt.com/decks/12345")).toBe(true);
  });

  test("returns true for URL with trailing path segments", () => {
    expect(isArchidektUrl("https://archidekt.com/decks/12345/my-deck")).toBe(true);
  });

  test("returns false for non-Archidekt URL", () => {
    expect(isArchidektUrl("https://moxfield.com/decks/abc")).toBe(false);
  });

  test("returns false for Archidekt URL without deck ID", () => {
    expect(isArchidektUrl("https://archidekt.com/")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isArchidektUrl("")).toBe(false);
  });

  test("returns false for non-URL strings", () => {
    expect(isArchidektUrl("archidekt 12345")).toBe(false);
  });
});

test.describe("extractArchidektDeckId", () => {
  test("extracts numeric deck ID from valid URL", () => {
    expect(extractArchidektDeckId("https://archidekt.com/decks/12345")).toBe("12345");
  });

  test("extracts ID from URL with trailing path", () => {
    expect(extractArchidektDeckId("https://archidekt.com/decks/99/my-deck-name")).toBe("99");
  });

  test("returns null for non-matching URL", () => {
    expect(extractArchidektDeckId("https://moxfield.com/decks/abc")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(extractArchidektDeckId("")).toBeNull();
  });

  test("extracts ID from URL with query parameters", () => {
    expect(extractArchidektDeckId("https://archidekt.com/decks/12345?view=list")).toBe("12345");
  });
});

test.describe("normalizeArchidektCards", () => {
  function makeRawResponse(
    cards: Array<{
      name?: string;
      quantity?: number;
      categories?: string[];
    }>
  ): ArchidektApiResponse {
    return {
      name: "Test Deck",
      cards: cards.map((c) => ({
        quantity: c.quantity ?? 1,
        categories: c.categories ?? [],
        card: {
          oracleCard: c.name ? { name: c.name } : {},
        },
      })),
    } as unknown as ArchidektApiResponse;
  }

  test("categorizes commander cards correctly", () => {
    const raw = makeRawResponse([
      { name: "Korvold, Fae-Cursed King", categories: ["Commander"] },
      { name: "Sol Ring", categories: ["Nonland"] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].name).toBe("Korvold, Fae-Cursed King");
    expect(result.mainboard).toHaveLength(1);
  });

  test("categorizes Oathbreaker and Signature Spell as commanders", () => {
    const raw = makeRawResponse([
      { name: "Jace, Wielder of Mysteries", categories: ["Oathbreaker"] },
      { name: "Brainstorm", categories: ["Signature Spell"] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.commanders).toHaveLength(2);
  });

  test("categorizes sideboard and maybeboard cards", () => {
    const raw = makeRawResponse([
      { name: "Lightning Bolt", categories: ["Sideboard"] },
      { name: "Path to Exile", categories: ["Maybeboard"] },
      { name: "Swords to Plowshares", categories: ["Considering"] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.sideboard).toHaveLength(3);
  });

  test("skips cards without oracleCard.name", () => {
    const raw = makeRawResponse([
      { name: "Sol Ring", categories: [] },
      { categories: [] }, // missing name
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.mainboard).toHaveLength(1);
  });

  test("preserves card quantities", () => {
    const raw = makeRawResponse([
      { name: "Island", quantity: 10, categories: [] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.mainboard[0].quantity).toBe(10);
  });

  test("sorts cards by name within each zone", () => {
    const raw = makeRawResponse([
      { name: "Zealous Conscripts", categories: [] },
      { name: "Arcane Signet", categories: [] },
      { name: "Mountain", categories: [] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.mainboard.map((c) => c.name)).toEqual([
      "Arcane Signet",
      "Mountain",
      "Zealous Conscripts",
    ]);
  });

  test("returns empty arrays for empty deck", () => {
    const raw = makeRawResponse([]);
    const result = normalizeArchidektCards(raw);
    expect(result.commanders).toEqual([]);
    expect(result.mainboard).toEqual([]);
    expect(result.sideboard).toEqual([]);
  });

  test("commander category takes precedence over other categories", () => {
    const raw = makeRawResponse([
      { name: "Korvold, Fae-Cursed King", categories: ["Commander", "Nonland"] },
    ]);
    const result = normalizeArchidektCards(raw);
    expect(result.commanders).toHaveLength(1);
    expect(result.mainboard).toHaveLength(0);
  });
});
