import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Enrichment Errors", () => {
  test("enrich API 502 shows error banner with Try Again button", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Intercept enrich API to return 502
    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({ status: 502, body: "{}" })
    );

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Error banner should appear with "Try Again" button
    const banner = deckPage.page.getByRole("alert").filter({
      hasText: "temporarily unavailable",
    });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(
      deckPage.page.getByTestId("enrich-retry-btn")
    ).toBeVisible();
  });

  test("clicking Try Again re-fires enrichment request", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    let enrichCallCount = 0;

    // First call returns 502, subsequent calls succeed
    await deckPage.page.route("**/api/deck-enrich", (route) => {
      enrichCallCount++;
      if (enrichCallCount === 1) {
        route.fulfill({ status: 502, body: "{}" });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ cards: {}, notFound: [] }),
        });
      }
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for initial error
    await expect(
      deckPage.page.getByTestId("enrich-retry-btn")
    ).toBeVisible({ timeout: 10_000 });

    // Click retry
    await deckPage.page.getByTestId("enrich-retry-btn").click();

    // Error banner should disappear after successful retry
    await expect(
      deckPage.page.getByRole("alert").filter({
        hasText: "temporarily unavailable",
      })
    ).toBeHidden({ timeout: 10_000 });

    // Should have made 2 enrich calls
    expect(enrichCallCount).toBe(2);
  });

  test("partial failure shows card-not-found warning", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Intercept enrich API to return some not-found cards
    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cards: {},
          notFound: ["Card A", "Card B"],
        }),
      })
    );

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Should show not-found warning
    const warning = deckPage.page.getByRole("alert").filter({
      hasText: "2 cards could not be found",
    });
    await expect(warning).toBeVisible({ timeout: 10_000 });
  });

  test("Try Again button is disabled during enrichment loading", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    let enrichCallCount = 0;

    await deckPage.page.route("**/api/deck-enrich", (route) => {
      enrichCallCount++;
      if (enrichCallCount === 1) {
        route.fulfill({ status: 502, body: "{}" });
      } else {
        // Second call: don't respond, keep loading
        // (route is left pending)
      }
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for error banner
    const retryBtn = deckPage.page.getByTestId("enrich-retry-btn");
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });

    // Click retry — second request hangs
    await retryBtn.click();

    // Banner should disappear (enrichLoading becomes true, hiding the error banner)
    await expect(
      deckPage.page.getByRole("alert").filter({
        hasText: "temporarily unavailable",
      })
    ).toBeHidden({ timeout: 5_000 });
  });

  test("partial failure warning is distinct from total failure banner", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Return success with some not-found cards (partial failure)
    await deckPage.page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cards: {},
          notFound: ["Card A"],
        }),
      })
    );

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Partial failure warning should appear
    const notFoundWarning = deckPage.page.getByRole("alert").filter({
      hasText: "1 card could not be found",
    });
    await expect(notFoundWarning).toBeVisible({ timeout: 10_000 });

    // Total failure banner should NOT appear
    await expect(
      deckPage.page.getByRole("alert").filter({
        hasText: "temporarily unavailable",
      })
    ).toBeHidden();

    // Retry button should NOT appear (no total failure)
    await expect(
      deckPage.page.getByTestId("enrich-retry-btn")
    ).toBeHidden();
  });
});
