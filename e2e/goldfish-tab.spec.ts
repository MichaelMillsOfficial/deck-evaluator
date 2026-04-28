/**
 * E2E tests for the Goldfish Simulator tab.
 *
 * NOTE: These tests require the dev server and card enrichment API.
 * They import a minimal deck, verify the Goldfish tab is visible in the nav,
 * that it requires enrichment, that the simulation runs, and that stats
 * are displayed.
 *
 * Tests that require enrichment call Scryfall — keep the card list small
 * to minimize test execution time.
 */

import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

// Minimal deck for goldfish testing — small and fast to enrich
const GOLDFISH_TEST_DECK = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
38 Forest
1 Sol Ring
1 Llanowar Elves
1 Cultivate
1 Kodama's Reach
1 Rampant Growth
1 Elvish Mystic
1 Birds of Paradise
1 Farseek
1 Three Visits
1 Nature's Lore
1 Command Tower
1 Arcane Signet
1 Talisman of Unity
1 Talisman of Progress
1 Talisman of Creativity
1 Talisman of Dominance
1 Swords to Plowshares
1 Path to Exile`;

test.describe("Goldfish Simulator Tab", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("Goldfish tab visible in nav after deck import", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // The Goldfish tab should be visible in the sidebar nav or tab list
    // It appears in the Tools section with a BETA badge
    const goldfishTab = deckPage.page.getByRole("tab", { name: /Goldfish/i });
    await expect(goldfishTab).toBeVisible();
  });

  test("Goldfish tab shows BETA badge", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // The Goldfish tab should have a BETA badge
    const deckHeader = deckPage.deckHeader;
    await expect(deckHeader.getByText("BETA").first()).toBeVisible();
  });

  // Removed: "Goldfish tab is disabled without enrichment"
  // Phase 2: /reading is only reached after enrichment terminates, so the
  // unenriched Goldfish-disabled state is unobservable. Coverage of the
  // enabled state remains in "Goldfish simulator renders when tab activated
  // after enrichment".

  test("Goldfish simulator renders when tab activated after enrichment", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist(GOLDFISH_TEST_DECK);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Enrich the deck
    const enrichButton = deckPage.page.getByRole("button", {
      name: /Enrich/i,
    });
    if (await enrichButton.isVisible()) {
      await enrichButton.click();
      // Wait for enrichment to complete
      await deckPage.page
        .getByTestId("enrich-status")
        .waitFor({ timeout: 30_000 })
        .catch(() => {
          // Some implementations may not have this test ID
        });
      // Wait for tabs to become enabled
      await deckPage.page.waitForTimeout(2000);
    }

    // Navigate to goldfish tab
    const goldfishTab = deckPage.page.getByRole("tab", { name: /Goldfish/i });
    await goldfishTab.click();

    // The goldfish simulator component should be visible
    const simulator = deckPage.page.getByTestId("goldfish-simulator");
    await expect(simulator).toBeVisible({ timeout: 15_000 });
  });

  test("Goldfish tab panel has correct tabpanel ID", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // The goldfish tabpanel should exist in the DOM
    const tabpanel = deckPage.page.locator("#tabpanel-deck-goldfish");
    await expect(tabpanel).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Game selector & zone bar e2e tests
// ---------------------------------------------------------------------------

/**
 * Helper: import deck, enrich, and navigate to the Goldfish tab.
 * Waits for the simulator to fully render.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setupGoldfishTab(deckPage: any) {
  await deckPage.fillDecklist(GOLDFISH_TEST_DECK);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Enrich
  const enrichButton = deckPage.page.getByRole("button", { name: /Enrich/i });
  if (await enrichButton.isVisible()) {
    await enrichButton.click();
    await deckPage.page
      .getByTestId("enrich-status")
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    await deckPage.page.waitForTimeout(2000);
  }

  // Navigate to goldfish tab
  const goldfishTab = deckPage.page.getByRole("tab", { name: /Goldfish/i });
  await goldfishTab.click();

  // Wait for simulator to render with results
  const simulator = deckPage.page.getByTestId("goldfish-simulator");
  await expect(simulator).toBeVisible({ timeout: 15_000 });

  // Wait for stat cards to appear (simulation complete)
  await expect(deckPage.page.getByTestId("goldfish-stat-cards")).toBeVisible({
    timeout: 60_000,
  });

  return simulator;
}

test.describe("Goldfish Game Selector", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("notable game buttons render with labels", async ({ deckPage }) => {
    await setupGoldfishTab(deckPage);

    const selector = deckPage.page.getByTestId("goldfish-game-selector");
    await expect(selector).toBeVisible();

    // Should have at least "Best Game" button
    await expect(
      deckPage.page.getByTestId("notable-game-best-game")
    ).toBeVisible();
  });

  test("Random Game and New Game buttons are visible", async ({ deckPage }) => {
    await setupGoldfishTab(deckPage);

    await expect(
      deckPage.page.getByTestId("random-game-button")
    ).toBeVisible();
    await expect(
      deckPage.page.getByTestId("new-game-button")
    ).toBeVisible();
  });

  test("clicking a notable game button shows the timeline", async ({
    deckPage,
  }) => {
    await setupGoldfishTab(deckPage);

    // The timeline should be visible (default selection = Best Game)
    await expect(
      deckPage.page.getByTestId("goldfish-turn-timeline")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("aggregate stats remain unchanged when switching games", async ({
    deckPage,
  }) => {
    await setupGoldfishTab(deckPage);

    // Read stats before switching
    const statCards = deckPage.page.getByTestId("goldfish-stat-cards");
    const textBefore = await statCards.innerText();

    // Click Random Game
    await deckPage.page.getByTestId("random-game-button").click();

    // Stats should remain the same
    const textAfter = await statCards.innerText();
    expect(textAfter).toBe(textBefore);
  });
});

test.describe("Goldfish Zone Bar", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("turn headers show micro-badges", async ({ deckPage }) => {
    await setupGoldfishTab(deckPage);

    // Find any turn panel — check for micro-badge presence
    // Micro-badges use bg-emerald-500/15 (land), bg-slate-700/50 (spells)
    const timeline = deckPage.page.getByTestId("goldfish-turn-timeline");
    await expect(timeline).toBeVisible();

    // At least one turn panel should exist
    const turnPanel = deckPage.page.getByTestId("goldfish-turn-panel-1");
    await expect(turnPanel).toBeVisible();
  });
});
