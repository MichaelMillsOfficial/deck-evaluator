import {
  test,
  expect,
  SAMPLE_DECKLIST,
  MINIMAL_DECKLIST,
} from "./fixtures";

test.describe("Deck Import — Manual Text Input", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("submits a decklist and displays parsed cards", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;

    // Commander section should include Atraxa
    await expect(
      deck.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();

    // Mainboard cards should be present
    await expect(deck.getByText("Sol Ring")).toBeVisible();
    await expect(deck.getByText("Command Tower")).toBeVisible();
    await expect(deck.getByText("Counterspell")).toBeVisible();
  });

  test("shows card counts after import", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Total card count should appear (1 commander + 5 mainboard = 6)
    await expect(deckPage.deckDisplay.getByText("6 cards")).toBeVisible();
  });

  test("handles a minimal single-card decklist", async ({ deckPage }) => {
    await deckPage.fillDecklist(MINIMAL_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(deckPage.deckDisplay.getByText("Sol Ring")).toBeVisible();
    await expect(deckPage.deckDisplay.getByText("1 cards")).toBeVisible();
  });

  test("import button is disabled when textarea is empty", async ({
    deckPage,
  }) => {
    await expect(deckPage.importButton).toBeDisabled();
  });

  test("import button enables after typing in textarea", async ({
    deckPage,
  }) => {
    await deckPage.fillDecklist("1 Sol Ring");
    await expect(deckPage.importButton).toBeEnabled();
  });

  test("shows loading state during submission", async ({
    deckPage,
    page,
  }) => {
    // Delay the API response so the loading state is reliably visible
    await page.route("**/api/deck-parse", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    // The button text changes to "Loading..." while the request is in-flight
    await expect(
      page.getByRole("button", { name: "Loading..." })
    ).toBeVisible();
  });
});
