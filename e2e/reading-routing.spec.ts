import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("/reading routing", () => {
  test("import navigates from / to /reading", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);
    // After Phase 3, /reading is the verdict overview; deck-display lives at
    // /reading/cards. Confirm the overview hero is visible instead.
    await expect(deckPage.page.getByTestId("reading-hero")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the / page no longer renders a deck after import", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);

    await deckPage.page.goto("/");
    // Import form is visible on /
    await expect(deckPage.decklistTextarea).toBeVisible();
    // Deck display is NOT visible on /
    await expect(deckPage.deckDisplay).toBeHidden();
  });

  test("refreshing /reading rehydrates from sessionStorage", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);
    await expect(deckPage.page.getByTestId("reading-hero")).toBeVisible({
      timeout: 15_000,
    });

    await deckPage.page.reload();
    await expect(deckPage.page.getByTestId("reading-hero")).toBeVisible({
      timeout: 15_000,
    });
    // Hero should show the deck name as its serif title.
    await expect(
      deckPage.page
        .getByTestId("reading-hero")
        .getByRole("heading", { name: "Imported Decklist" })
    ).toBeVisible();
  });

  test("refreshing /reading/cards rehydrates from sessionStorage", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);

    await deckPage.page.goto("/reading/cards");
    await deckPage.waitForDeckDisplay();
    await expect(
      deckPage.deckDisplay.getByRole("button", { name: "Atraxa, Praetors' Voice" })
    ).toBeVisible();
  });

  test("visiting /reading without a session redirects to /", async ({
    deckPage,
  }) => {
    // Ensure session is empty
    await deckPage.page.goto("/");
    await deckPage.page.evaluate(() => sessionStorage.clear());

    await deckPage.page.goto("/reading");
    await deckPage.page.waitForURL(/\/$|\/\?/);
    await expect(deckPage.decklistTextarea).toBeVisible();
  });

  test("'new reading' from /reading overview returns to /", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);
    await expect(deckPage.page.getByTestId("reading-hero")).toBeVisible({
      timeout: 15_000,
    });

    await deckPage.page
      .getByRole("button", { name: /new reading/i })
      .first()
      .click();
    await deckPage.page.waitForURL(/\/$|\/\?/);
    await expect(deckPage.decklistTextarea).toBeVisible();
  });
});
