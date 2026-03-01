import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Export Toolbar", () => {
  test("share dropdown appears in header after enrichment", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await deckPage.page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        const analysisTab = Array.from(tabs).find(
          (t) => t.textContent === "Analysis"
        );
        return analysisTab && !(analysisTab as HTMLButtonElement).disabled;
      },
      { timeout: 20_000 }
    );

    await deckPage.shareButton.click();
    const menu = deckPage.page.getByTestId("share-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Copy as Markdown")).toBeVisible();
    await expect(menu.getByText("Copy as JSON")).toBeVisible();
    await expect(menu.getByText("Export to Discord...")).toBeVisible();
    await expect(menu.getByText("Copy Share Link")).toBeVisible();
  });

  test("share dropdown has accessible aria-label", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await deckPage.page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        const analysisTab = Array.from(tabs).find(
          (t) => t.textContent === "Analysis"
        );
        return analysisTab && !(analysisTab as HTMLButtonElement).disabled;
      },
      { timeout: 20_000 }
    );

    await deckPage.shareButton.click();
    const menu = deckPage.page.getByTestId("share-menu");
    await expect(menu).toHaveAttribute("aria-label", "Share options");
  });

  test("all share options disabled during enrichment loading", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Block enrichment
    await deckPage.page.route("**/api/deck-enrich", () => {
      // Don't respond
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Share button should be disabled during enrichment
    await expect(deckPage.shareButton).toBeDisabled();
  });
});
