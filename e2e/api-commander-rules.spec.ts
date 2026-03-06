import { test, expect } from "@playwright/test";

const API_URL = "/api/commander-rules";

test.describe("GET /api/commander-rules", () => {
  test("returns response with banned and gameChangers arrays", async ({ request }) => {
    const response = await request.get(API_URL);

    // May fail if Scryfall is unreachable in CI
    if (response.status() === 502) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("banned");
    expect(body).toHaveProperty("gameChangers");
    expect(Array.isArray(body.banned)).toBe(true);
    expect(Array.isArray(body.gameChangers)).toBe(true);
  });

  test("banned list contains known banned cards", async ({ request }) => {
    const response = await request.get(API_URL);

    if (response.status() === 502) {
      test.skip();
      return;
    }

    const body = await response.json();
    // These cards have been banned in Commander for years
    expect(body.banned).toContain("Balance");
    expect(body.banned).toContain("Channel");
  });

  test("gameChangers entries have name and oracleText fields", async ({ request }) => {
    const response = await request.get(API_URL);

    if (response.status() === 502) {
      test.skip();
      return;
    }

    const body = await response.json();
    if (body.gameChangers.length > 0) {
      const firstEntry = body.gameChangers[0];
      expect(firstEntry).toHaveProperty("name");
      expect(firstEntry).toHaveProperty("oracleText");
      expect(typeof firstEntry.name).toBe("string");
      expect(typeof firstEntry.oracleText).toBe("string");
    }
  });

  test("returns Cache-Control header", async ({ request }) => {
    const response = await request.get(API_URL);

    if (response.status() === 502) {
      test.skip();
      return;
    }

    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toContain("max-age=14400");
  });
});
