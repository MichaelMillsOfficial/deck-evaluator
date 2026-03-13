import { test, expect } from "./fixtures";

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

test.describe("Card Lookup — Manual Tab", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("card lookup input is visible on Manual tab", async ({ deckPage }) => {
    await expect(deckPage.cardLookupInput).toBeVisible();
    await expect(deckPage.cardLookupQuantity).toBeVisible();
  });

  test("card lookup input is hidden on Moxfield tab", async ({ deckPage }) => {
    await deckPage.selectTab("Moxfield");
    await expect(deckPage.cardLookupInput).toBeHidden();
  });

  test("card lookup input is hidden on Archidekt tab", async ({
    deckPage,
  }) => {
    await deckPage.selectTab("Archidekt");
    await expect(deckPage.cardLookupInput).toBeHidden();
  });

  test("typing triggers autocomplete dropdown", async ({ deckPage, page }) => {
    await mockAutocomplete(page, ["Sol Ring", "Solemnity", "Solar Blaze"]);

    await deckPage.cardLookupInput.fill("sol");

    const listbox = page.locator("#card-lookup-listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("option", { name: "Sol Ring" })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Solemnity" })
    ).toBeVisible();
  });

  test("selecting a card appends it to the textarea", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.fillCardLookup("Sol Ring");

    await expect(deckPage.decklistTextarea).toHaveValue("1 Sol Ring");
  });

  test("selecting multiple cards appends each on a new line", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, [
      "Sol Ring",
      "Command Tower",
      "Arcane Signet",
    ]);

    await deckPage.fillCardLookup("Sol Ring");
    await deckPage.fillCardLookup("Command Tower");

    await expect(deckPage.decklistTextarea).toHaveValue(
      "1 Sol Ring\n1 Command Tower"
    );
  });

  test("quantity spinner changes the appended quantity", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Lightning Bolt"]);

    await deckPage.cardLookupQuantity.fill("4");
    await deckPage.fillCardLookup("Lightning Bolt");

    await expect(deckPage.decklistTextarea).toHaveValue("4 Lightning Bolt");
  });

  test("status message appears after selection", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.fillCardLookup("Sol Ring");

    await expect(deckPage.cardLookupStatus).toHaveText("Added 1 Sol Ring");
  });

  test("search input clears and retains focus after selection", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.fillCardLookup("Sol Ring");

    await expect(deckPage.cardLookupInput).toHaveValue("");
    await expect(deckPage.cardLookupInput).toBeFocused();
  });

  test("keyboard navigation: ArrowDown, Enter to select", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring", "Solemnity"]);

    await deckPage.cardLookupInput.fill("sol");
    // Wait for dropdown
    await page.getByRole("option", { name: "Sol Ring" }).waitFor();

    // ArrowDown to first option, Enter to select
    await deckPage.cardLookupInput.press("ArrowDown");
    await deckPage.cardLookupInput.press("Enter");

    await expect(deckPage.decklistTextarea).toHaveValue("1 Sol Ring");
  });

  test("keyboard navigation: Escape closes dropdown", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.cardLookupInput.fill("sol");
    const listbox = page.locator("#card-lookup-listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    await deckPage.cardLookupInput.press("Escape");
    await expect(listbox).toBeHidden();
  });

  test("appends to existing textarea content", async ({ deckPage, page }) => {
    await mockAutocomplete(page, ["Arcane Signet"]);

    // Pre-fill textarea with some content
    await deckPage.fillDecklist("1 Sol Ring\n1 Command Tower");

    await deckPage.fillCardLookup("Arcane Signet");

    await expect(deckPage.decklistTextarea).toHaveValue(
      "1 Sol Ring\n1 Command Tower\n1 Arcane Signet"
    );
  });

  test("consolidates quantity when adding a card already in textarea", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Cyclonic Rift"]);

    // Pre-fill textarea with an existing card
    await deckPage.fillDecklist("1 Cyclonic Rift");

    await deckPage.fillCardLookup("Cyclonic Rift");

    // Should update the existing line to 2, not add a duplicate
    await expect(deckPage.decklistTextarea).toHaveValue("2 Cyclonic Rift");
  });

  test("consolidates with custom quantity when card already exists", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Lightning Bolt"]);

    await deckPage.fillDecklist("2 Lightning Bolt\n1 Sol Ring");

    await deckPage.cardLookupQuantity.fill("3");
    await deckPage.fillCardLookup("Lightning Bolt");

    // 2 + 3 = 5
    await expect(deckPage.decklistTextarea).toHaveValue(
      "5 Lightning Bolt\n1 Sol Ring"
    );
  });

  test("consolidates case-insensitively", async ({ deckPage, page }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.fillDecklist("1 sol ring");

    await deckPage.fillCardLookup("Sol Ring");

    // Should update existing line, using the new casing from the lookup
    await expect(deckPage.decklistTextarea).toHaveValue("2 Sol Ring");
  });

  test("status message reflects updated total when consolidating", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, ["Sol Ring"]);

    await deckPage.fillDecklist("1 Sol Ring");

    await deckPage.fillCardLookup("Sol Ring");

    await expect(deckPage.cardLookupStatus).toHaveText(
      "Updated Sol Ring to 2"
    );
  });

  test("Enter in search input does not submit the import form", async ({
    deckPage,
    page,
  }) => {
    await mockAutocomplete(page, []);

    // Pre-fill some text so the form could technically be submitted
    await deckPage.fillDecklist("1 Sol Ring");

    // Focus card lookup and press Enter with no dropdown open
    await deckPage.cardLookupInput.focus();
    await deckPage.cardLookupInput.press("Enter");

    // The deck display should NOT appear (form was not submitted)
    await expect(page.getByTestId("deck-header")).toBeHidden();
  });
});
