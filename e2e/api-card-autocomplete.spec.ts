import { test, expect } from "@playwright/test";

/**
 * Probe Scryfall reachability so we can skip network-dependent tests
 * when the API is unreachable (sandboxed CI, offline dev).
 */
let scryfallReachable = true;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get("/api/card-autocomplete?q=Sol+Ring");
    if (!res.ok()) {
      scryfallReachable = false;
    }
  } catch {
    scryfallReachable = false;
  }
});

test.describe("GET /api/card-autocomplete", { tag: "@external" }, () => {
  test("returns suggestions for a valid query", async ({ request }) => {
    test.skip(!scryfallReachable, "Scryfall API is unreachable");
    const res = await request.get("/api/card-autocomplete?q=Atraxa");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("suggestions");
    expect(Array.isArray(json.suggestions)).toBe(true);
    expect(json.suggestions.length).toBeGreaterThan(0);
    // At least one suggestion should contain "Atraxa"
    expect(
      json.suggestions.some((s: string) => s.includes("Atraxa"))
    ).toBe(true);
  });

  test("returns 400 for empty query", async ({ request }) => {
    const res = await request.get("/api/card-autocomplete?q=");
    expect(res.status()).toBe(400);

    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("returns 400 for single-character query", async ({ request }) => {
    const res = await request.get("/api/card-autocomplete?q=x");
    expect(res.status()).toBe(400);

    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("returns 400 when q param is missing", async ({ request }) => {
    const res = await request.get("/api/card-autocomplete");
    expect(res.status()).toBe(400);
  });
});
