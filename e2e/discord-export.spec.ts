import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Discord Export Modal", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
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
  });

  test('clicking "Export to Discord..." opens modal', async ({ deckPage }) => {
    // Open share menu
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    await expect(
      deckPage.page.getByTestId("discord-export-modal")
    ).toBeVisible();
  });

  test("modal shows checkbox list with section labels", async ({
    deckPage,
  }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const modal = deckPage.page.getByTestId("discord-export-modal");
    // Use label locators in the sections list (not the preview)
    const sectionsList = modal.locator("label");
    await expect(sectionsList.filter({ hasText: "Header" })).toBeVisible();
    await expect(sectionsList.filter({ hasText: "Mana Curve" })).toBeVisible();
    await expect(sectionsList.filter({ hasText: "Land Efficiency" })).toBeVisible();
  });

  test("Header checkbox is checked and disabled", async ({ deckPage }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const modal = deckPage.page.getByTestId("discord-export-modal");
    const headerCheckbox = modal
      .locator("label")
      .filter({ hasText: "Header" })
      .locator('input[type="checkbox"]');
    await expect(headerCheckbox).toBeChecked();
    await expect(headerCheckbox).toBeDisabled();
  });

  test("live preview pane shows content", async ({ deckPage }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const preview = deckPage.page.getByTestId("discord-preview");
    await expect(preview).toContainText("Imported Decklist");
  });

  test("character counter is visible", async ({ deckPage }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal.getByText(/\/2000/)).toBeVisible();
  });

  test("Escape closes modal", async ({ deckPage }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal).toBeVisible();

    await deckPage.page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("modal has aria-label", async ({ deckPage }) => {
    await deckPage.shareButton.click();
    await deckPage.page.getByText("Export to Discord...").click();

    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal).toHaveAttribute("aria-label", "Export to Discord");
  });
});
