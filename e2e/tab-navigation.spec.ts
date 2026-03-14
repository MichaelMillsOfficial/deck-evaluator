import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Tab Navigation", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("defaults to Manual Import tab", async ({ deckPage }) => {
    // Load Example button is only on the Manual tab
    await expect(deckPage.loadExampleButton).toBeVisible();
  });

  test("switches to Moxfield tab", async ({ deckPage }) => {
    await deckPage.selectTab("Moxfield");

    // Load Example should not be visible on Moxfield tab
    await expect(deckPage.loadExampleButton).toBeHidden();

    // Card lookup should not be visible on Moxfield tab
    await expect(deckPage.cardLookupInput).toBeHidden();

    // Textarea should still be present for pasting exported text
    await expect(deckPage.decklistTextarea).toBeVisible();

    // Export instructions should be visible
    const guide = deckPage.page.getByTestId("moxfield-export-guide");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("How to import from Moxfield");
    await expect(guide).toContainText("Copy for MTGO");
  });

  test("switches to Archidekt tab", async ({ deckPage }) => {
    await deckPage.selectTab("Archidekt");

    await expect(deckPage.loadExampleButton).toBeHidden();
    await expect(deckPage.decklistTextarea).toBeVisible();
  });

  test("switches back to Manual tab from another tab", async ({
    deckPage,
  }) => {
    await deckPage.selectTab("Moxfield");
    await expect(deckPage.loadExampleButton).toBeHidden();
    await expect(deckPage.cardLookupInput).toBeHidden();

    await deckPage.selectTab("Manual Import");
    await expect(deckPage.loadExampleButton).toBeVisible();
    await expect(deckPage.cardLookupInput).toBeVisible();

    // Moxfield export guide should not be visible on Manual tab
    await expect(
      deckPage.page.getByTestId("moxfield-export-guide")
    ).toBeHidden();
  });

  test("textarea content persists when switching tabs", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.selectTab("Moxfield");
    await deckPage.selectTab("Manual Import");

    await expect(deckPage.decklistTextarea).toHaveValue("1 Sol Ring");
  });

  test("Load Example populates textarea", async ({
    deckPage,
  }) => {
    await deckPage.loadExample();

    // Textarea should contain the example decklist
    await expect(deckPage.decklistTextarea).not.toBeEmpty();
    await expect(deckPage.decklistTextarea).toContainText(
      "Atraxa, Praetors' Voice"
    );
  });

  test("Load Example decklist can be imported successfully", async ({
    deckPage,
  }) => {
    await deckPage.loadExample();
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    await expect(
      deck.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();
    await expect(deck.getByText("Sol Ring")).toBeVisible();
  });
});
