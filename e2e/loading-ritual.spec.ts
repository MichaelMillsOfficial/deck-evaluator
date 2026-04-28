import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

const MOCK_ENRICH_RESPONSE = {
  cards: {},
  notFound: [],
};

const MOCK_COMBOS_RESPONSE = {
  exactCombos: [],
  nearCombos: [],
};

test.describe("/ritual loading flow", () => {
  test("import passes through /ritual before landing on /reading", async ({
    deckPage,
  }) => {
    const visitedRitual = { value: false };
    deckPage.page.on("framenavigated", (frame) => {
      if (frame === deckPage.page.mainFrame() && /\/ritual/.test(frame.url())) {
        visitedRitual.value = true;
      }
    });

    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );
    await deckPage.page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMBOS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
    await deckPage.waitForDeckDisplay();

    expect(visitedRitual.value).toBe(true);
  });

  test("ritual respects 2 second minimum floor", async ({ deckPage }) => {
    // Undo the fixture's floor-skip flag so this test sees the real ritual.
    await deckPage.page.addInitScript(() => {
      delete (window as Window).__SKIP_RITUAL_FLOOR__;
    });

    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );
    await deckPage.page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMBOS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);

    const startedAt = Date.now();
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
    const elapsed = Date.now() - startedAt;

    // Floor is 2000ms; allow 100ms slack for navigation overhead but never below the floor.
    expect(elapsed).toBeGreaterThanOrEqual(1900);
  });

  test("loader UI is visible on /ritual", async ({ deckPage }) => {
    // Hold enrichment so we can observe the loader.
    let release: (() => void) | null = null;
    await deckPage.page.route("**/api/deck-enrich", async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
        setTimeout(resolve, 5_000);
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    });
    await deckPage.page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMBOS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    await deckPage.page.waitForURL(/\/ritual/, { timeout: 5_000 });
    await expect(
      deckPage.page.getByTestId("cosmic-loader")
    ).toBeVisible({ timeout: 5_000 });

    release?.();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
  });

  test("ritual still routes forward when enrichment errors", async ({
    deckPage,
  }) => {
    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scryfall unavailable" }),
      })
    );
    await deckPage.page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMBOS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
  });

  test("visiting /ritual without a session redirects to /", async ({
    deckPage,
  }) => {
    await deckPage.page.goto("/");
    await deckPage.page.evaluate(() => sessionStorage.clear());

    await deckPage.page.goto("/ritual");
    await deckPage.page.waitForURL(/\/$|\/\?/);
    await expect(deckPage.decklistTextarea).toBeVisible();
  });
});
