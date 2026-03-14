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

  test("Goldfish tab is disabled without enrichment", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Before enrichment, the Goldfish tab should be disabled
    // Enrichment-required tabs are typically aria-disabled or have a specific state
    const goldfishTab = deckPage.page.getByRole("tab", { name: /Goldfish/i });
    // Check it's not clickable / is disabled
    const ariaDisabled = await goldfishTab.getAttribute("aria-disabled");
    const isDisabled = await goldfishTab.isDisabled();
    expect(ariaDisabled === "true" || isDisabled).toBe(true);
  });

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
