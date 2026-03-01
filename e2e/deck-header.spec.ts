import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Deck Header", () => {
  test("header is visible after deck import", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(deckPage.page.getByTestId("deck-header")).toBeVisible();
  });

  test("header shows deck name, source badge, and card count", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const header = deckPage.page.getByTestId("deck-header");
    await expect(header.getByText("Imported Decklist")).toBeVisible();
    await expect(header.getByText("text")).toBeVisible();
    await expect(header.getByText("6 cards")).toBeVisible();
  });

  test("header tab bar has 4 tabs", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const header = deckPage.page.getByTestId("deck-header");
    const tabs = header.getByRole("tab");
    await expect(tabs).toHaveCount(4);

    await expect(header.getByRole("tab", { name: "Deck List" })).toBeVisible();
    await expect(header.getByRole("tab", { name: "Analysis" })).toBeVisible();
    await expect(header.getByRole("tab", { name: "Synergy" })).toBeVisible();
    await expect(header.getByRole("tab", { name: "Hands" })).toBeVisible();
  });

  test("clicking tabs switches panel content", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Default: Deck List tab active
    await expect(
      deckPage.page.locator("#tabpanel-deck-list")
    ).not.toHaveAttribute("hidden");

    // Wait for enrichment to complete before switching to Analysis
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

    // Switch to Analysis tab
    await deckPage.page
      .getByTestId("deck-header")
      .getByRole("tab", { name: "Analysis" })
      .click();

    await expect(
      deckPage.page.locator("#tabpanel-deck-analysis")
    ).not.toHaveAttribute("hidden");
  });

  test("Analysis/Synergy/Hands tabs disabled during enrichment", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Intercept enrichment to keep it loading — use fulfill to avoid hanging
    await deckPage.page.route("**/api/deck-enrich", (route) => {
      // Simply don't respond — Playwright will abort when the page navigates or test ends
      // The route stays pending, keeping enrichLoading=true
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const header = deckPage.page.getByTestId("deck-header");
    await expect(
      header.getByRole("tab", { name: "Analysis" })
    ).toBeDisabled();
    await expect(
      header.getByRole("tab", { name: "Synergy" })
    ).toBeDisabled();
    await expect(header.getByRole("tab", { name: "Hands" })).toBeDisabled();
    await expect(
      header.getByRole("tab", { name: "Deck List" })
    ).toBeEnabled();
  });

  test("header is sticky when scrolling", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const header = deckPage.page.getByTestId("deck-header");
    const position = await header.evaluate(
      (el) => getComputedStyle(el).position
    );
    expect(position).toBe("sticky");
  });

  test("bracket/power badge appears after enrichment completes", async ({
    deckPage,
  }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete (tabs become enabled)
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

    const header = deckPage.page.getByTestId("deck-header");
    await expect(header.getByTestId("bracket-power-badge")).toBeVisible();
  });

  test("share button exists, disabled during enrichment", async ({
    deckPage,
  }) => {
    await deckPage.goto();

    // Intercept enrichment — don't respond to keep loading state
    await deckPage.page.route("**/api/deck-enrich", (route) => {
      // Don't respond — keeps enrichment pending
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const header = deckPage.page.getByTestId("deck-header");
    const shareBtn = header.getByTestId("share-button");
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toBeDisabled();
  });
});
