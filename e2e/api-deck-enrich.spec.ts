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

  test("resolves DFC cards by front face name", async ({ request }) => {
    // "Esika, God of the Tree" is the front face of "Esika, God of the Tree // The Prismatic Bridge"
    const response = await request.post(API_URL, {
      data: { cardNames: ["Esika, God of the Tree"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should be keyed by the requested front-face name
    const esika = body.cards["Esika, God of the Tree"];
    expect(esika).toBeDefined();
    expect(esika.name).toBe("Esika, God of the Tree // The Prismatic Bridge");
    expect(esika.typeLine).toContain("Legendary");

    // Should NOT appear in notFound
    expect(body.notFound).not.toContain("Esika, God of the Tree");
  });

  test("resolves Universes Beyond flavor names via fallback lookup", async ({
    request,
  }) => {
    // "Air Shoes" is the flavor name for "Swiftfoot Boots" (Universes Beyond / Sonic crossover)
    const response = await request.post(API_URL, {
      data: { cardNames: ["Air Shoes", "Sol Ring"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Air Shoes should be keyed by its requested name
    const airShoes = body.cards["Air Shoes"];
    expect(airShoes).toBeDefined();
    expect(airShoes.name).toBe("Swiftfoot Boots");
    expect(airShoes.flavorName).toBe("Air Shoes");
    expect(airShoes.typeLine).toContain("Artifact");

    // Air Shoes should NOT appear in notFound
    expect(body.notFound).not.toContain("Air Shoes");

    // Sol Ring should also be found normally
    expect(body.cards["Sol Ring"]).toBeDefined();
  });

  test("populates flavorName field for flavor name lookups", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { cardNames: ["Sol Ring"] },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Regular cards should have flavorName as null
    expect(body.cards["Sol Ring"].flavorName).toBeNull();
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
