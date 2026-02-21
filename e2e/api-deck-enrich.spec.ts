import { test, expect } from "@playwright/test";

const API_URL = "/api/deck-enrich";

test.describe("POST /api/deck-enrich", () => {
  test("returns enriched card data for valid card names", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["Sol Ring", "Command Tower"] },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.cards).toBeDefined();
    expect(body.notFound).toBeDefined();

    // Sol Ring should be found
    const solRing = body.cards["Sol Ring"];
    expect(solRing).toBeDefined();
    expect(solRing.name).toBe("Sol Ring");
    expect(solRing.manaCost).toBe("{1}");
    expect(solRing.typeLine).toContain("Artifact");
    expect(solRing.oracleText).toBeTruthy();
    expect(solRing.rarity).toBeTruthy();
    expect(solRing.manaPips).toBeDefined();

    // Command Tower should be found
    const tower = body.cards["Command Tower"];
    expect(tower).toBeDefined();
    expect(tower.typeLine).toContain("Land");
  });

  test("returns notFound for unrecognized card names", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["Sol Ring", "ZZZZZ Not A Real Card Name ZZZZZ"] },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.cards["Sol Ring"]).toBeDefined();
    expect(body.notFound).toContain("ZZZZZ Not A Real Card Name ZZZZZ");
  });

  test("returns 400 for empty card names array", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: [] },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 when cardNames field is missing", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { someOtherField: "value" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("cardNames");
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

  test("trims and deduplicates card names", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["  Sol Ring  ", "Sol Ring", "sol ring"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Should have resolved to exactly one card
    expect(Object.keys(body.cards).length).toBe(1);
  });

  test("response cards are keyed by the requested name casing", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["sol ring", "command tower"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Keys should match the casing of the requested names
    expect(body.cards["sol ring"]).toBeDefined();
    expect(body.cards["sol ring"].name).toBe("Sol Ring");
    expect(body.cards["command tower"]).toBeDefined();
  });

  test("returns 400 for oversized card name (>200 chars)", async ({
    request,
  }) => {
    const longName = "A".repeat(201);
    const response = await request.post(API_URL, {
      data: { cardNames: [longName] },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("maximum length");
  });

  test("filters out empty and whitespace-only names", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["", "   ", "Sol Ring"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.cards["Sol Ring"]).toBeDefined();
  });

  test("returns 400 when all names are empty after filtering", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["", "   ", "  "] },
    });

    expect(response.status()).toBe(400);
  });
});
