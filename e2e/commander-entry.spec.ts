import { test, expect, FLAT_DECKLIST, SAMPLE_DECKLIST } from "./fixtures";

/**
 * Mock the /api/card-autocomplete endpoint so e2e tests never hit Scryfall.
 * Returns a fixed set of suggestions matching the query.
 */
async function mockAutocomplete(
  page: import("@playwright/test").Page,
  suggestions: string[]
) {
  await page.route("**/api/card-autocomplete*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ suggestions }),
    });
  });
}

test.describe("Commander Entry — Input UI", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("commander input field is visible and optional", async ({
    deckPage,
  }) => {
    await expect(deckPage.commanderInput).toBeVisible();
    // The label should indicate the field is optional
    await expect(
      deckPage.page.getByText("Commander (optional)")
    ).toBeVisible();
  });

  test("typing in commander input shows autocomplete dropdown", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Atraxa, Praetors' Voice"]);
    await deckPage.fillDecklist(FLAT_DECKLIST);

    await deckPage.commanderInput.fill("Atraxa");

    // Wait for the dropdown to appear
    const option = page.getByRole("option", {
      name: "Atraxa, Praetors' Voice",
    });
    await expect(option).toBeVisible({ timeout: 5_000 });
  });

  test("selecting a commander adds it as a tag pill", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Atraxa, Praetors' Voice"]);
    await deckPage.fillDecklist(FLAT_DECKLIST);

    await deckPage.fillCommander("Atraxa, Praetors' Voice");

    // Tag pill should appear
    await expect(
      deckPage.commanderTags.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();
    // Input should be cleared
    await expect(deckPage.commanderInput).toHaveValue("");
  });

  test("removing a commander tag clears it", async ({ deckPage, page }) => {
    await mockAutocomplete(page, ["Atraxa, Praetors' Voice"]);
    await deckPage.fillDecklist(FLAT_DECKLIST);

    await deckPage.fillCommander("Atraxa, Praetors' Voice");
    await expect(
      deckPage.commanderTags.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();

    await deckPage.removeCommander("Atraxa, Praetors' Voice");

    // Tag should be gone
    await expect(deckPage.commanderTags).not.toBeVisible();
  });

  test("submitting with commander override places card in Commander section", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Atraxa, Praetors' Voice"]);
    await deckPage.fillDecklist(FLAT_DECKLIST);
    await deckPage.fillCommander("Atraxa, Praetors' Voice");

    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    // Atraxa should appear in the Commander section
    await expect(
      deck.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();
    // Other cards should be in mainboard
    await expect(deck.getByText("Sol Ring")).toBeVisible();
  });

  test("submitting without commander input preserves existing parser behavior", async ({
    deckPage,
  }) => {
    // Use the sample decklist which has an explicit COMMANDER: header
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    // Commander should still be detected via the COMMANDER: header
    await expect(
      deck.getByText("Atraxa, Praetors' Voice")
    ).toBeVisible();
    await expect(deck.getByText("Sol Ring")).toBeVisible();
  });

  test("selecting a commander NOT in decklist text still adds it to Commander section", async ({
    deckPage,
    page,
  }) => {
    // Decklist does NOT contain "Suki, Kyoshi Warrior"
    const decklist = `1 Sol Ring\n1 Command Tower\n1 Arcane Signet`;
    await deckPage.fillDecklist(decklist);

    // Mock autocomplete to return the commander
    await mockAutocomplete(page, ["Suki, Kyoshi Warrior"]);
    await deckPage.fillCommander("Suki, Kyoshi Warrior");

    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const deck = deckPage.deckDisplay;
    // Commander should appear in the rendered deck
    await expect(deck.getByText("Suki, Kyoshi Warrior")).toBeVisible();
    // Mainboard cards should still be present
    await expect(deck.getByText("Sol Ring")).toBeVisible();
    await expect(deck.getByText("Command Tower")).toBeVisible();
    await expect(deck.getByText("Arcane Signet")).toBeVisible();
  });

  test("input is disabled when 2 commanders are selected", async ({
    deckPage,
    page,
  }) => {
    const decklist = `1 Thrasios, Triton Hero\n1 Tymna the Weaver\n1 Sol Ring`;
    await deckPage.fillDecklist(decklist);

    // Mock autocomplete for first commander
    await mockAutocomplete(page, ["Thrasios, Triton Hero", "Tymna the Weaver"]);

    await deckPage.fillCommander("Thrasios, Triton Hero");
    await deckPage.fillCommander("Tymna the Weaver");

    // Input should now be disabled
    await expect(deckPage.commanderInput).toBeDisabled();
  });
});
