import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("/reading overview (verdict landing)", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
  });

  test("shows the deck name as a serif hero title", async ({ deckPage }) => {
    const hero = deckPage.page.getByTestId("reading-hero");
    await expect(hero).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: "Imported Decklist" })
    ).toBeVisible();
  });

  test("shows the READING eyebrow", async ({ deckPage }) => {
    const hero = deckPage.page.getByTestId("reading-hero");
    await expect(hero.getByText("READING", { exact: false })).toBeVisible();
  });

  test("shows a non-empty italic tagline", async ({ deckPage }) => {
    const tagline = deckPage.page.getByTestId("reading-tagline");
    await expect(tagline).toBeVisible();
    const text = (await tagline.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.trim()).toMatch(/[.!?]$/);
  });

  test("renders stat tiles for bracket, power level, and total cost", async ({
    deckPage,
  }) => {
    const stats = deckPage.page.getByTestId("reading-stats");
    await expect(stats).toBeVisible();
    await expect(stats.getByText(/bracket/i)).toBeVisible();
    await expect(stats.getByText(/power level/i)).toBeVisible();
  });

  test("renders a section grid linking into the reading", async ({
    deckPage,
  }) => {
    const grid = deckPage.page.getByTestId("reading-section-grid");
    await expect(grid).toBeVisible();
    // At minimum, the Cards section is reachable in Phase 3.
    await expect(grid.getByRole("link", { name: /cards/i }).first()).toBeVisible();
  });

  test("clicking the Cards section navigates to /reading/cards", async ({
    deckPage,
  }) => {
    const grid = deckPage.page.getByTestId("reading-section-grid");
    await grid.getByRole("link", { name: /cards/i }).first().click();
    await deckPage.page.waitForURL(/\/reading\/cards/, { timeout: 5_000 });
    await deckPage.waitForDeckDisplay();
  });
});
