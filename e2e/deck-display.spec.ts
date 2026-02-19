import {
  test,
  expect,
  SAMPLE_DECKLIST,
  SAMPLE_DECKLIST_WITH_SIDEBOARD,
} from "./fixtures";

test.describe("Deck Display", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("renders commander section when commander cards exist", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    await expect(
      deck.getByRole("heading", { name: /Commander/i })
    ).toBeVisible();
    await expect(
      deck.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();
  });

  test("renders mainboard section with all cards", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    await expect(
      deck.getByRole("heading", { name: /Mainboard/i })
    ).toBeVisible();

    const expectedCards = [
      "Sol Ring",
      "Command Tower",
      "Arcane Signet",
      "Swords to Plowshares",
      "Counterspell",
    ];
    for (const card of expectedCards) {
      await expect(deck.getByText(card)).toBeVisible();
    }
  });

  test("renders sideboard section when sideboard cards exist", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST_WITH_SIDEBOARD);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    await expect(
      deck.getByRole("heading", { name: /Sideboard/i })
    ).toBeVisible();
    await expect(deck.getByText("Rest in Peace")).toBeVisible();
    await expect(deck.getByText("Grafdigger's Cage")).toBeVisible();
  });

  test("displays correct total card count across all sections", async ({
    deckPage,
  }) => {
    // 1 commander + 2 mainboard + 2 sideboard = 5
    await deckPage.fillDecklist(SAMPLE_DECKLIST_WITH_SIDEBOARD);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(deckPage.deckDisplay.getByText("5 cards")).toBeVisible();
  });

  test("shows source as text for manually imported decks", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // The source link should say "text"
    await expect(
      deckPage.deckDisplay.getByRole("link", { name: "text" })
    ).toBeVisible();
  });

  test("does not render sideboard section when no sideboard cards", async ({
    deckPage,
  }) => {
    // SAMPLE_DECKLIST has no sideboard
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Sideboard heading should not appear in the deck display
    await expect(
      deckPage.deckDisplay.getByRole("heading", { name: /Sideboard/i })
    ).toHaveCount(0);
  });
});
