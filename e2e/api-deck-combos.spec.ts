import { test, expect } from "@playwright/test";

const API_URL = "/api/deck-combos";

/**
 * Check whether the Commander Spellbook API is reachable before running
 * integration tests. If the network is unavailable, we skip those tests
 * rather than reporting false failures.
 */
let spellbookReachable = true;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.post(`${API_URL}`, {
      data: {
        cardNames: ["Sol Ring", "Arcane Signet"],
        commanders: [],
      },
      timeout: 20_000,
    });
    if (!res.ok()) {
      const body = await res.json();
      // If the route returned an error field, spellbook might be unreachable
      if (body.error) {
        spellbookReachable = false;
      }
    }
  } catch {
    spellbookReachable = false;
  }
});

test.describe("POST /api/deck-combos", () => {
  test("returns 200 with exactCombos and nearCombos arrays for valid request", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: {
        cardNames: ["Sol Ring", "Arcane Signet", "Command Tower"],
        commanders: [],
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.exactCombos)).toBe(true);
    expect(Array.isArray(body.nearCombos)).toBe(true);
  });

  test("returns 400 for missing cardNames", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { commanders: [] },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error).toContain("cardNames");
  });

  test("returns 400 for empty cardNames", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: [], commanders: [] },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 for non-array cardNames", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: "Sol Ring", commanders: [] },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 for invalid JSON body", async ({ request, baseURL }) => {
    const response = await fetch(`${baseURL}${API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid JSON");
  });

  test("returns 400 when too many unique card names (>250)", async ({
    request,
  }) => {
    const names = Array.from({ length: 251 }, (_, i) => `Card Name ${i}`);

    const response = await request.post(API_URL, {
      data: { cardNames: names },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("250");
  });

  test("exact combo response shape has expected fields", async ({
    request,
  }) => {
    test.skip(!spellbookReachable, "Commander Spellbook API is unreachable");

    // Use cards that are part of a well-known combo
    const response = await request.post(API_URL, {
      data: {
        cardNames: [
          "Thassa's Oracle",
          "Demonic Consultation",
          "Sol Ring",
          "Command Tower",
          "Island",
          "Swamp",
        ],
        commanders: [],
      },
      timeout: 20_000,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // If we got exact combos, validate their shape
    if (body.exactCombos.length > 0) {
      const combo = body.exactCombos[0];
      expect(Array.isArray(combo.cards)).toBe(true);
      expect(typeof combo.description).toBe("string");
      expect(Array.isArray(combo.produces)).toBe(true);
      expect(typeof combo.id).toBe("string");
      expect(combo.type).toBe("exact");
      expect(Array.isArray(combo.missingCards)).toBe(true);
      expect(combo.missingCards).toHaveLength(0);
    }
  });

  test("combo-known cards return at least 1 exact combo", async ({
    request,
  }) => {
    test.skip(!spellbookReachable, "Commander Spellbook API is unreachable");

    const response = await request.post(API_URL, {
      data: {
        cardNames: [
          "Thassa's Oracle",
          "Demonic Consultation",
          "Sol Ring",
          "Command Tower",
          "Island",
          "Swamp",
          "Mana Crypt",
          "Dark Ritual",
        ],
        commanders: [],
      },
      timeout: 20_000,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.exactCombos.length).toBeGreaterThanOrEqual(1);
  });

  test("accepts optional commanders array", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        cardNames: ["Sol Ring", "Command Tower"],
        commanders: ["Kenrith, the Returned King"],
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.exactCombos)).toBe(true);
    expect(Array.isArray(body.nearCombos)).toBe(true);
  });

  test("works without commanders field (defaults to empty)", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: {
        cardNames: ["Sol Ring", "Command Tower"],
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.exactCombos)).toBe(true);
    expect(Array.isArray(body.nearCombos)).toBe(true);
  });
});
