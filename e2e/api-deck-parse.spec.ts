import { test, expect } from "@playwright/test";

const API_URL = "/api/deck-parse";

test.describe("POST /api/deck-parse", () => {
  test("parses a valid decklist and returns DeckData", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        text: "COMMANDER:\n1 Atraxa, Praetors' Voice\n\nMAINBOARD:\n1 Sol Ring\n1 Command Tower",
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("Imported Decklist");
    expect(body.source).toBe("text");
    expect(body.commanders).toHaveLength(1);
    expect(body.commanders[0].name).toBe("Atraxa, Praetors' Voice");
    expect(body.mainboard).toHaveLength(2);
    expect(body.mainboard.map((c: { name: string }) => c.name)).toContain(
      "Sol Ring"
    );
  });

  test("parses quantity with x suffix (2x Card Name)", async ({
    request,
  }) => {
    const response = await request.post(API_URL, {
      data: { text: "2x Lightning Bolt\n4x Counterspell" },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.mainboard).toHaveLength(2);

    const bolt = body.mainboard.find(
      (c: { name: string }) => c.name === "Lightning Bolt"
    );
    expect(bolt.quantity).toBe(2);

    const counter = body.mainboard.find(
      (c: { name: string }) => c.name === "Counterspell"
    );
    expect(counter.quantity).toBe(4);
  });

  test("parses sideboard section correctly", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        text: "1 Sol Ring\n\nSIDEBOARD:\n2 Rest in Peace\n1 Grafdigger's Cage",
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.mainboard).toHaveLength(1);
    expect(body.sideboard).toHaveLength(2);
    expect(body.sideboard[0].name).toBe("Rest in Peace");
  });

  test("returns 400 for missing text field", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing required field");
  });

  test("returns 400 for empty text field", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { text: "   " },
    });

    expect(response.status()).toBe(400);
  });

  test("returns 400 for invalid JSON body", async ({ request, baseURL }) => {
    // Use native fetch to send a raw malformed JSON body, since
    // Playwright's request.post auto-serializes objects.
    const response = await fetch(`${baseURL}${API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid JSON");
  });

  test("returns 422 when no cards can be parsed", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: { text: "this is not a decklist at all" },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toContain("No cards found");
  });

  test("handles companion zone as sideboard", async ({ request }) => {
    const response = await request.post(API_URL, {
      data: {
        text: "1 Sol Ring\n\nCOMPANION:\n1 Lurrus of the Dream-Den",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.sideboard).toHaveLength(1);
    expect(body.sideboard[0].name).toBe("Lurrus of the Dream-Den");
  });
});
