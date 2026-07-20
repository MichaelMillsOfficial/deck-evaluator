import { test, expect, SAMPLE_DECKLIST, META_DECKLIST, DEFAULT_META_ENVELOPE } from "./fixtures";

/** Import the meta deck with the rich envelope and land on /reading. */
async function importMeta(deckPage: import("./fixtures").DeckPage) {
  await deckPage.goto();
  await deckPage.mockMeta(DEFAULT_META_ENVELOPE);
  await deckPage.fillDecklist(META_DECKLIST);
  await deckPage.submitImport();
  await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
}

test.describe("/reading meta panel (Stock ↔ Spicy)", () => {
  test("shows the deck-level meta panel with the coverage readout and rated basis", async ({ deckPage }) => {
    await importMeta(deckPage);
    const panel = deckPage.page.getByTestId("meta-panel");
    await expect(panel).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-readout")).toContainText(/coverage/i);
    await expect(deckPage.page.getByTestId("meta-bands")).toBeVisible();
    // Basis communicates how many cards EDHREC actually rates (12 of 14, 2 unrated).
    await expect(deckPage.page.getByTestId("meta-basis")).toContainText(/12 of 14 cards/i);
    await expect(deckPage.page.getByTestId("meta-basis")).toContainText(/2 unrated/i);
  });

  test("switching the lens recomputes the readout", async ({ deckPage }) => {
    await importMeta(deckPage);
    const readout = deckPage.page.getByTestId("meta-readout");
    await expect(readout).toContainText(/coverage/i);
    await deckPage.page.getByRole("button", { name: "Percentile" }).click();
    await expect(readout).toContainText(/more stock than/i);
    await deckPage.page.getByRole("button", { name: "Mean" }).click();
    await expect(readout).toContainText(/mean inclusion/i);
  });

  test("cards page shows the inclusion heat list with sort and filter", async ({ deckPage }) => {
    await importMeta(deckPage);
    await deckPage.page.goto("/reading/cards");
    const list = deckPage.page.getByTestId("meta-heat-list");
    await expect(list).toBeVisible();

    // Contentious Plan (6%) is spice; Sol Ring (85%) is a staple.
    await expect(deckPage.page.getByTestId("meta-row-Contentious Plan")).toBeVisible();

    // Filter to spice only → Sol Ring drops out.
    await deckPage.page.getByTestId("meta-filter").selectOption("spice");
    await expect(deckPage.page.getByTestId("meta-row-Contentious Plan")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-row-Sol Ring")).toHaveCount(0);

    // Back to all, sort most-stock-first → Sol Ring returns.
    await deckPage.page.getByTestId("meta-filter").selectOption("all");
    await deckPage.page.getByTestId("meta-sort").selectOption("stock");
    await expect(deckPage.page.getByTestId("meta-row-Sol Ring")).toBeVisible();
  });

  test("hovering a heat-list row reveals its card preview", async ({ deckPage }) => {
    await importMeta(deckPage);
    await deckPage.page.goto("/reading/cards");
    await expect(deckPage.page.getByTestId("meta-heat-list")).toBeVisible();

    await deckPage.page.getByTestId("meta-row-Sol Ring").hover();
    const preview = deckPage.page.getByTestId("meta-card-preview");
    await expect(preview).toBeVisible();
  });
});

test.describe("/reading meta panel — failure & low-data states", () => {
  async function importWith(deckPage: import("./fixtures").DeckPage, body: unknown, deck = SAMPLE_DECKLIST, status = 200) {
    await deckPage.goto();
    await deckPage.mockMeta(body, status);
    await deckPage.fillDecklist(deck);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
  }

  test("missing commander shows the empty 'No meta read yet' panel", async ({ deckPage }) => {
    await importWith(deckPage, {
      source: null,
      commanderLabel: "Atraxa, Praetors' Voice",
      potentialDecks: 0,
      inclusionMap: {},
    });
    await expect(deckPage.page.getByTestId("meta-no-data")).toBeVisible();
  });

  test("too few rated cards shows the insufficient-data panel", async ({ deckPage }) => {
    // Only 2 of the sample deck's cards are rated → below the basis threshold.
    await importWith(deckPage, {
      source: "primary",
      commanderLabel: "Atraxa, Praetors' Voice",
      potentialDecks: 12480,
      inclusionMap: { "sol ring": 0.85, "command tower": 0.92 },
    });
    await expect(deckPage.page.getByTestId("meta-insufficient")).toBeVisible();
  });

  test("fetch error shows the error card with a Retry button", async ({ deckPage }) => {
    await importWith(deckPage, { error: "EDHREC responded 503", commanderLabel: "" });
    await expect(deckPage.page.getByTestId("meta-error")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-retry")).toBeVisible();
  });

  test("thin sample shows a low-confidence caveat", async ({ deckPage }) => {
    // Enough rated cards to clear the basis gate, but a tiny commander sample.
    await importWith(deckPage, { ...DEFAULT_META_ENVELOPE, potentialDecks: 42 }, META_DECKLIST);
    await expect(deckPage.page.getByTestId("meta-thin-caveat")).toBeVisible();
    await expect(deckPage.page.getByTestId("meta-thin-caveat")).toContainText(/42 decks/);
  });
});
