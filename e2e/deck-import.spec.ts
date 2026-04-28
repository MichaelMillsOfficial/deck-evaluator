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

    // Commander section should include Atraxa.
    // Use the card-name button (rendered by EnrichedCardRow) to avoid
    // strict-mode collisions with auto-generated tag pills (e.g.
    // "Counterspell" appears both as a card name and a tag).
    await expect(
      deck.getByRole("button", { name: "Atraxa, Praetors' Voice" })
    ).toBeVisible();

    await expect(deck.getByRole("button", { name: "Sol Ring" })).toBeVisible();
    await expect(deck.getByRole("button", { name: "Command Tower" })).toBeVisible();
    await expect(deck.getByRole("button", { name: "Counterspell" })).toBeVisible();
  });

  test("shows card counts after import", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Total card count should appear in the header (1 commander + 5 mainboard = 6)
    await expect(deckPage.deckHeader.getByText("6 cards")).toBeVisible();
  });

  test("handles a minimal single-card decklist", async ({ deckPage }) => {
    await deckPage.fillDecklist(MINIMAL_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(deckPage.deckDisplay.getByText("Sol Ring")).toBeVisible();
    await expect(deckPage.deckHeader.getByText("1 cards")).toBeVisible();
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

  test("shows amber warning banner for unparseable lines", async ({
    deckPage,
  }) => {
    const decklistWithBadLine = [
      "COMMANDER:",
      "Suki, Kyoshi Warrior",  // missing quantity prefix
      "",
      "MAINBOARD:",
      "1 Sol Ring",
      "1 Command Tower",
    ].join("\n");

    await deckPage.fillDecklist(decklistWithBadLine);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Amber warning banner should be visible with the skipped line
    const warning = deckPage.page.getByTestId("parse-warnings");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Suki, Kyoshi Warrior");

    // Deck should still render with valid cards
    await expect(deckPage.deckDisplay.getByText("Sol Ring")).toBeVisible();
  });

  test("shows loading state during submission", async ({
    deckPage,
    page,
  }) => {
    // Hold the API response until we've asserted the loading state.
    // This avoids timing flakiness from a fixed-duration delay.
    let releaseRoute: (() => void) | null = null;
    await page.route("**/api/deck-parse", async (route) => {
      await new Promise<void>((resolve) => {
        releaseRoute = resolve;
        // Safety net: auto-resolve after 500ms to prevent hanging
        setTimeout(resolve, 500);
      });
      await route.continue();
    });

    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();

    // The button text changes to "Loading..." while the request is in-flight
    await expect(
      page.getByRole("button", { name: "Loading..." })
    ).toBeVisible();

    // Release the route so the test completes cleanly
    releaseRoute?.();
  });
});
