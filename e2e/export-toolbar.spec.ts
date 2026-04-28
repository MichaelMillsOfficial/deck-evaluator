import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

/**
 * Probe Scryfall reachability so we can skip enrichment-dependent tests
 * when the API is unreachable (sandboxed CI, offline dev).
 */
let scryfallReachable = true;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.post("/api/deck-enrich", {
      data: { cardNames: ["Sol Ring"] },
      timeout: 15_000,
    });
    if (res.status() === 502) {
      scryfallReachable = false;
    } else if (res.ok()) {
      const body = await res.json();
      if (!body.cards?.["Sol Ring"]) {
        scryfallReachable = false;
      }
    }
  } catch {
    scryfallReachable = false;
  }
});

test.describe("Export Toolbar", () => {
  test("share dropdown appears in header after enrichment", async ({
    deckPage,
  }) => {
    test.skip(!scryfallReachable, "Scryfall API is unreachable");
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
    test.skip(!scryfallReachable, "Scryfall API is unreachable");
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

  // Removed: "all share options disabled during enrichment loading"
  // Phase 2: /reading is not reached mid-enrichment.
});
