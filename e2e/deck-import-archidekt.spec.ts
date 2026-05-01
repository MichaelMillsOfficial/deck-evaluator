import { test, expect } from "./fixtures";
import type { DeckData } from "../src/lib/types";

const SAMPLE_ARCHIDEKT_DECK: DeckData = {
  name: "Atraxa Counters",
  source: "archidekt",
  url: "https://archidekt.com/decks/123456",
  commanders: [{ name: "Atraxa, Praetors' Voice", quantity: 1 }],
  mainboard: [
    { name: "Sol Ring", quantity: 1 },
    { name: "Command Tower", quantity: 1 },
    { name: "Arcane Signet", quantity: 1 },
    { name: "Swords to Plowshares", quantity: 1 },
    { name: "Counterspell", quantity: 1 },
  ],
  sideboard: [],
};

test.describe("Deck Import — Archidekt URL Flow", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("Archidekt tab shows URL input and hides textarea/load-example/commander/lookup", async ({
    deckPage,
  }) => {
    await deckPage.selectArchidektTab();

    // URL input is visible
    await expect(deckPage.archidektUrlInput).toBeVisible();

    // Textarea / Load Example / commander input / card lookup all hidden
    await expect(deckPage.decklistTextarea).toBeHidden();
    await expect(deckPage.loadExampleButton).toBeHidden();
    await expect(deckPage.commanderInput).toBeHidden();
    await expect(deckPage.cardLookupInput).toBeHidden();

    // The Archidekt how-to guide is visible
    const guide = deckPage.page.getByTestId("archidekt-import-guide");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("archidekt.com");
  });

  test("submits a valid Archidekt URL and shows the synopsis", async ({
    deckPage,
    page,
  }) => {
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });

    await deckPage.selectArchidektTab();
    await deckPage.fillArchidektUrl("https://archidekt.com/decks/123456");
    await deckPage.submitArchidektFetch();

    const synopsis = deckPage.archidektSynopsis;
    await expect(synopsis).toBeVisible();
    await expect(synopsis).toContainText("Atraxa Counters");
    await expect(synopsis).toContainText("Atraxa, Praetors' Voice");
    // Total cards: 1 commander + 5 mainboard = 6
    await expect(
      synopsis.getByText("6", { exact: true })
    ).toBeVisible();

    // Link out to the archidekt deck
    const link = synopsis.getByRole("link", { name: /archidekt/i });
    await expect(link).toHaveAttribute("href", SAMPLE_ARCHIDEKT_DECK.url);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("Continue from synopsis navigates to ritual / reading", async ({
    deckPage,
    page,
  }) => {
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });

    await deckPage.selectArchidektTab();
    await deckPage.fillArchidektUrl("https://archidekt.com/decks/123456");
    await deckPage.submitArchidektFetch();

    await expect(deckPage.archidektSynopsis).toBeVisible();
    await deckPage.clickContinueFromSynopsis();

    await page.waitForURL(/\/(ritual|reading)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(ritual|reading)/);
  });

  test("Choose another deck returns to URL form without navigating", async ({
    deckPage,
    page,
  }) => {
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });

    await deckPage.selectArchidektTab();
    await deckPage.fillArchidektUrl("https://archidekt.com/decks/123456");
    await deckPage.submitArchidektFetch();

    await expect(deckPage.archidektSynopsis).toBeVisible();

    await page.getByRole("button", { name: /choose another deck/i }).click();

    await expect(deckPage.archidektSynopsis).toBeHidden();
    await expect(deckPage.archidektUrlInput).toBeVisible();
    expect(page.url()).not.toMatch(/\/(ritual|reading)/);
  });

  test("server error surfaces inline without navigating", async ({
    deckPage,
    page,
  }) => {
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Archidekt is unavailable" }),
      });
    });

    await deckPage.selectArchidektTab();
    await deckPage.fillArchidektUrl("https://archidekt.com/decks/123456");
    await deckPage.submitArchidektFetch();

    const error = deckPage.page.getByTestId("archidekt-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/archidekt is unavailable/i);

    expect(page.url()).not.toMatch(/\/(ritual|reading)/);
    await expect(deckPage.archidektSynopsis).toBeHidden();
  });

  test("invalid (non-archidekt) URL shows inline error and does not fetch", async ({
    deckPage,
    page,
  }) => {
    let fetched = false;
    await page.route(/\/api\/deck\?/, async (route) => {
      fetched = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });

    await deckPage.selectArchidektTab();
    await deckPage.fillArchidektUrl("https://moxfield.com/decks/abc");
    await deckPage.submitArchidektFetch();

    const error = deckPage.page.getByTestId("archidekt-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/archidekt/i);

    // No network call was made
    expect(fetched).toBe(false);
    expect(page.url()).not.toMatch(/\/(ritual|reading)/);
  });
});

// ---------------------------------------------------------------------------
// Compare page Archidekt URL flow — locks in inline-mode behavior so the
// /compare slot's URL import can't silently regress when DeckInput evolves.
// ---------------------------------------------------------------------------

test.describe("Compare page — Archidekt URL import in slot", () => {
  test("slot Archidekt tab shows URL input (no textarea) and populates the slot on submit", async ({
    page,
  }) => {
    // Skip the default deckPage fixture so we can stub /api/deck cleanly
    // without colliding with the home-page enrich mocks in fixtures.ts.
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });
    // The Compare slot enriches after import; mock it so we don't hit the
    // real Scryfall API.
    await page.route("**/api/deck-enrich", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cards: {}, notFound: [] }),
      });
    });

    await page.goto("/compare");

    const slot = page.getByTestId("compare-slot-a");
    await expect(slot).toBeVisible();

    // Switch slot A's DeckInput to the Archidekt tab.
    await slot.getByRole("tab", { name: "Archidekt" }).click();

    // URL input is visible; the legacy textarea is NOT rendered on this tab.
    await expect(slot.getByLabel(/archidekt deck url/i)).toBeVisible();
    await expect(slot.getByLabel("Decklist")).toBeHidden();

    // Submit a valid Archidekt URL.
    await slot.getByLabel(/archidekt deck url/i).fill(
      "https://archidekt.com/decks/123456"
    );
    await slot.getByRole("button", { name: "Import Deck" }).click();

    // The slot replaces the import form with the deck summary card. The
    // import form's URL input goes away; the source label appears, and
    // the Clear deck control is rendered.
    await expect(slot.getByLabel(/archidekt deck url/i)).toBeHidden();
    await expect(
      slot.getByRole("button", { name: /clear .*? deck/i })
    ).toBeVisible();

    // Stays on /compare — no navigation away from the page.
    expect(page.url()).toMatch(/\/compare$/);
  });

  test("slot Archidekt tab does NOT show the synopsis card (synopsis is navigate-mode only)", async ({
    page,
  }) => {
    await page.route(/\/api\/deck\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...SAMPLE_ARCHIDEKT_DECK, warnings: [] }),
      });
    });
    await page.route("**/api/deck-enrich", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cards: {}, notFound: [] }),
      });
    });

    await page.goto("/compare");

    const slot = page.getByTestId("compare-slot-a");
    await slot.getByRole("tab", { name: "Archidekt" }).click();
    await slot.getByLabel(/archidekt deck url/i).fill(
      "https://archidekt.com/decks/123456"
    );
    await slot.getByRole("button", { name: "Import Deck" }).click();

    // Inline mode skips the synopsis pre-confirm step and goes straight to
    // the slot's deck summary.
    await expect(page.getByTestId("archidekt-synopsis")).toBeHidden();
    await expect(
      slot.getByRole("button", { name: /clear .*? deck/i })
    ).toBeVisible();
  });
});
