import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("/reading routing", () => {
  test("import navigates from / to /reading", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);
    await deckPage.waitForDeckDisplay();
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
    await deckPage.waitForDeckDisplay();

    await deckPage.page.reload();
    await deckPage.waitForDeckDisplay();
    await expect(
      deckPage.deckDisplay.getByText("Atraxa, Praetors' Voice")
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

  test("clearing the session via 'new reading' returns to /", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/);
    await deckPage.waitForDeckDisplay();

    await deckPage.page
      .getByRole("button", { name: /new reading/i })
      .first()
      .click();
    await deckPage.page.waitForURL(/\/$|\/\?/);
    await expect(deckPage.decklistTextarea).toBeVisible();
  });
});
