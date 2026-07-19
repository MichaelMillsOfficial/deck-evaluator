import { test, expect, SAMPLE_DECKLIST, DEFAULT_META_ENVELOPE } from "./fixtures";

/** Import the sample deck with the rich meta envelope and land on /reading. */
async function importSample(deckPage: import("./fixtures").DeckPage) {
  await deckPage.goto();
  await deckPage.mockMeta(DEFAULT_META_ENVELOPE);
  await deckPage.fillDecklist(SAMPLE_DECKLIST);
  await deckPage.submitImport();
  await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
}

test.describe("/reading meta panel (Stock ↔ Spicy)", () => {
  test("shows the deck-level meta panel with the coverage readout", async ({ deckPage }) => {
    await importSample(deckPage);
    const panel = deckPage.page.getByTestId("meta-panel");
    await expect(panel).toBeVisible();
    // Coverage lens is the default: "N% coverage · M spice".
    await expect(deckPage.page.getByTestId("meta-readout")).toContainText(/coverage/i);
    await expect(deckPage.page.getByTestId("meta-bands")).toBeVisible();
  });

  test("switching the lens recomputes the readout", async ({ deckPage }) => {
    await importSample(deckPage);
    const readout = deckPage.page.getByTestId("meta-readout");
    await expect(readout).toContainText(/coverage/i);
    await deckPage.page.getByRole("button", { name: "Percentile" }).click();
    await expect(readout).toContainText(/more stock than/i);
    await deckPage.page.getByRole("button", { name: "Mean" }).click();
    await expect(readout).toContainText(/mean inclusion/i);
  });

  test("cards page shows the inclusion heat list with sort and filter", async ({ deckPage }) => {
    await importSample(deckPage);
    await deckPage.page.goto("/reading/cards");
    const list = deckPage.page.getByTestId("meta-heat-list");
    await expect(list).toBeVisible();

    // Counterspell (6%) is spice — its row is present with a Spice tag.
    await expect(deckPage.page.getByTestId("meta-row-Counterspell")).toBeVisible();

    // Filter to spice only → Sol Ring (staple) drops out.
    await deckPage.page.getByTestId("meta-filter").selectOption("spice");
    await expect(deckPage.page.getByTestId("meta-row-Counterspell")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-row-Sol Ring")).toHaveCount(0);

    // Back to all, sort most-stock-first → Sol Ring returns.
    await deckPage.page.getByTestId("meta-filter").selectOption("all");
    await deckPage.page.getByTestId("meta-sort").selectOption("stock");
    await expect(deckPage.page.getByTestId("meta-row-Sol Ring")).toBeVisible();
  });
});

test.describe("/reading meta panel — failure states", () => {
  test("missing commander shows the empty 'No meta read yet' panel", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.mockMeta({
      source: null,
      commanderLabel: "Atraxa, Praetors' Voice",
      potentialDecks: 0,
      inclusionMap: {},
    });
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
    await expect(deckPage.page.getByTestId("meta-no-data")).toBeVisible();
  });

  test("fetch error shows the error card with a Retry button", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.mockMeta({ error: "EDHREC responded 503", commanderLabel: "" });
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
    await expect(deckPage.page.getByTestId("meta-error")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-retry")).toBeVisible();
  });

  test("thin sample shows a low-confidence caveat", async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.mockMeta({
      source: "primary",
      commanderLabel: "Atraxa, Praetors' Voice",
      potentialDecks: 42,
      inclusionMap: { "sol ring": 0.96, counterspell: 0.06 },
    });
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
    await expect(deckPage.page.getByTestId("meta-thin-caveat")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-thin-caveat")).toContainText(/42 decks/);
  });
});
