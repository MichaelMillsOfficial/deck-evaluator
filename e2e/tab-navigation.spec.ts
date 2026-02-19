import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Tab Navigation", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("defaults to Manual Import tab", async ({ deckPage }) => {
    // Format field is only visible on the Manual tab
    await expect(deckPage.formatInput).toBeVisible();
    // Load Example button is only on the Manual tab
    await expect(deckPage.loadExampleButton).toBeVisible();
  });

  test("switches to Moxfield tab", async ({ deckPage }) => {
    await deckPage.selectTab("Moxfield");

    // Format field and Load Example should not be visible on Moxfield tab
    await expect(deckPage.formatInput).toBeHidden();
    await expect(deckPage.loadExampleButton).toBeHidden();

    // Textarea should still be present with Moxfield placeholder
    await expect(deckPage.decklistTextarea).toBeVisible();
  });

  test("switches to Archidekt tab", async ({ deckPage }) => {
    await deckPage.selectTab("Archidekt");

    await expect(deckPage.formatInput).toBeHidden();
    await expect(deckPage.loadExampleButton).toBeHidden();
    await expect(deckPage.decklistTextarea).toBeVisible();
  });

  test("switches back to Manual tab from another tab", async ({
    deckPage,
  }) => {
    await deckPage.selectTab("Moxfield");
    await expect(deckPage.formatInput).toBeHidden();

    await deckPage.selectTab("Manual Import");
    await expect(deckPage.formatInput).toBeVisible();
    await expect(deckPage.loadExampleButton).toBeVisible();
  });

  test("textarea content persists when switching tabs", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.selectTab("Moxfield");
    await deckPage.selectTab("Manual Import");

    await expect(deckPage.decklistTextarea).toHaveValue("1 Sol Ring");
  });

  test("Load Example populates textarea and metadata fields", async ({
    deckPage,
  }) => {
    await deckPage.loadExample();

    // Textarea should contain the example decklist
    await expect(deckPage.decklistTextarea).not.toBeEmpty();
    await expect(deckPage.decklistTextarea).toContainText(
      "Atraxa, Praetors' Voice"
    );

    // Deck name should be filled
    await expect(deckPage.deckNameInput).toHaveValue("Atraxa Superfriends");

    // Format should be filled
    await expect(deckPage.formatInput).toHaveValue("Commander");
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
