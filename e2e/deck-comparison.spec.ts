import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared mock card shape — re-used across both enrich responses
// ---------------------------------------------------------------------------

function makeLand(name: string) {
  return {
    name,
    manaCost: "",
    cmc: 0,
    colorIdentity: [],
    colors: [],
    typeLine: "Land",
    supertypes: [],
    subtypes: [],
    oracleText: "{T}: Add one mana of any color.",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: ["W", "U", "B", "R", "G"],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "cmd",
    collectorNumber: "1",
    layout: "normal",
    cardFaces: [],
  };
}

function makeArtifact(name: string, manaCost: string, cmc: number) {
  return {
    name,
    manaCost,
    cmc,
    colorIdentity: [],
    colors: [],
    typeLine: "Artifact",
    supertypes: [],
    subtypes: [],
    oracleText: "{T}: Add {C}{C}.",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "uncommon",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: ["C"],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "c21",
    collectorNumber: "1",
    layout: "normal",
    cardFaces: [],
  };
}

function makeInstant(name: string, manaCost: string, cmc: number, colors: string[]) {
  return {
    name,
    manaCost,
    cmc,
    colorIdentity: colors,
    colors,
    typeLine: "Instant",
    supertypes: [],
    subtypes: [],
    oracleText: "Counter target spell.",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "uncommon",
    imageUris: null,
    manaPips: { W: 0, U: colors.includes("U") ? cmc : 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "tmp",
    collectorNumber: "1",
    layout: "normal",
    cardFaces: [],
  };
}

// ---------------------------------------------------------------------------
// Deck A — "Control Deck" (4 unique cards + 2 shared with Deck B)
//
// Shared:  Sol Ring, Command Tower
// Unique:  Counterspell, Arcane Signet
// ---------------------------------------------------------------------------

const DECK_A_TEXT = `MAINBOARD:
1 Sol Ring
1 Command Tower
1 Counterspell
1 Arcane Signet`;

const DECK_A_PARSE_RESPONSE = {
  name: "Control Deck",
  source: "text",
  url: null,
  commanders: [],
  mainboard: [
    { name: "Sol Ring", quantity: 1 },
    { name: "Command Tower", quantity: 1 },
    { name: "Counterspell", quantity: 1 },
    { name: "Arcane Signet", quantity: 1 },
  ],
  sideboard: [],
};

const DECK_A_ENRICH_RESPONSE = {
  cards: {
    "Sol Ring": makeArtifact("Sol Ring", "{1}", 1),
    "Command Tower": makeLand("Command Tower"),
    "Counterspell": makeInstant("Counterspell", "{U}{U}", 2, ["U"]),
    "Arcane Signet": makeArtifact("Arcane Signet", "{2}", 2),
  },
  notFound: [],
};

// ---------------------------------------------------------------------------
// Deck B — "Aggro Deck" (4 unique cards + 2 shared with Deck A)
//
// Shared:  Sol Ring, Command Tower
// Unique:  Lightning Bolt, Goblin Guide
// ---------------------------------------------------------------------------

const DECK_B_TEXT = `MAINBOARD:
1 Sol Ring
1 Command Tower
1 Lightning Bolt
1 Goblin Guide`;

const DECK_B_PARSE_RESPONSE = {
  name: "Aggro Deck",
  source: "text",
  url: null,
  commanders: [],
  mainboard: [
    { name: "Sol Ring", quantity: 1 },
    { name: "Command Tower", quantity: 1 },
    { name: "Lightning Bolt", quantity: 1 },
    { name: "Goblin Guide", quantity: 1 },
  ],
  sideboard: [],
};

const DECK_B_ENRICH_RESPONSE = {
  cards: {
    "Sol Ring": makeArtifact("Sol Ring", "{1}", 1),
    "Command Tower": makeLand("Command Tower"),
    "Lightning Bolt": makeInstant("Lightning Bolt", "{R}", 1, ["R"]),
    "Goblin Guide": {
      name: "Goblin Guide",
      manaCost: "{R}",
      cmc: 1,
      colorIdentity: ["R"],
      colors: ["R"],
      typeLine: "Creature — Goblin Scout",
      supertypes: [],
      subtypes: ["Goblin", "Scout"],
      oracleText: "Haste",
      keywords: ["Haste"],
      power: "2",
      toughness: "2",
      loyalty: null,
      rarity: "rare",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
      setCode: "zen",
      collectorNumber: "1",
      layout: "normal",
      cardFaces: [],
    },
  },
  notFound: [],
};

// ---------------------------------------------------------------------------
// Helper: sets up page.route() mocks for a single import slot.
//
// The compare page has two DeckInput forms that both POST to /api/deck-parse
// and /api/deck-enrich.  Playwright's route interceptor fires for every
// matching request, so we use a call counter to serve Deck A on the first
// call and Deck B on the second call.
// ---------------------------------------------------------------------------

function setupSequentialMocks(
  page: import("@playwright/test").Page,
  parseResponses: object[],
  enrichResponses: object[],
) {
  let parseCall = 0;
  let enrichCall = 0;

  page.route("**/api/deck-parse", (route) => {
    const response = parseResponses[parseCall] ?? parseResponses[parseResponses.length - 1];
    parseCall++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  page.route("**/api/deck-enrich", (route) => {
    const response = enrichResponses[enrichCall] ?? enrichResponses[enrichResponses.length - 1];
    enrichCall++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: fill and submit the deck import form inside a given slot.
//
// Each CompareImportSlot contains a DeckInput which renders a <textarea>
// labelled "Decklist" and a submit button labelled "Import Deck".  We scope
// lookups to the slot's data-testid container to avoid ambiguity when both
// slots are mounted simultaneously.
// ---------------------------------------------------------------------------

async function importDeckInSlot(
  page: import("@playwright/test").Page,
  slotTestId: "compare-slot-a" | "compare-slot-b",
  deckText: string,
) {
  const slot = page.getByTestId(slotTestId);
  await slot.getByLabel("Decklist").fill(deckText);
  await slot.getByRole("button", { name: "Import Deck" }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Deck Comparison page", () => {
  test("page loads and shows the Compare Decks heading", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByTestId("compare-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Compare Decks" })
    ).toBeVisible();
  });

  test("shows empty-state prompt when no decks have been imported", async ({ page }) => {
    await page.goto("/compare");
    await expect(
      page.getByText("Import two decklists above to start comparing them.")
    ).toBeVisible();
  });

  test("both import slots are visible on page load", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByTestId("compare-slot-a")).toBeVisible();
    await expect(page.getByTestId("compare-slot-b")).toBeVisible();
  });

  test("slot A shows 'Your deck' label and slot B shows 'Comparison deck' label", async ({ page }) => {
    await page.goto("/compare");
    await expect(
      page.getByTestId("compare-slot-a").getByRole("heading", { name: "Your deck" })
    ).toBeVisible();
    await expect(
      page.getByTestId("compare-slot-b").getByRole("heading", { name: "Comparison deck" })
    ).toBeVisible();
  });

  test("shows single-deck prompt after importing only one deck", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    // Wait for the deck summary to appear in slot A
    await expect(
      page.getByTestId("compare-slot-a").getByText("Control Deck")
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText("Import a second deck to see the comparison.")
    ).toBeVisible();

    // Comparison results must NOT appear yet
    await expect(page.getByTestId("comparison-results")).not.toBeVisible();
  });

  test("comparison results appear after both decks are imported", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE, DECK_B_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE, DECK_B_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    // Wait for slot A enrichment before importing slot B so the second parse
    // mock fires in the correct order
    await expect(
      page.getByTestId("compare-slot-a").getByText("Card details loaded")
    ).toBeVisible({ timeout: 10_000 });

    await importDeckInSlot(page, "compare-slot-b", DECK_B_TEXT);

    await expect(page.getByTestId("comparison-results")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("comparison overview shows shared-card count and unique counts", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE, DECK_B_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE, DECK_B_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    await expect(
      page.getByTestId("compare-slot-a").getByText("Card details loaded")
    ).toBeVisible({ timeout: 10_000 });

    await importDeckInSlot(page, "compare-slot-b", DECK_B_TEXT);

    const overview = page.getByTestId("comparison-overview");
    await expect(overview).toBeVisible({ timeout: 15_000 });

    // Sol Ring and Command Tower are shared — expect 2 shared cards
    await expect(overview.getByTestId("shared-count")).toHaveText("2");

    // Each deck has 2 cards not in the other
    await expect(overview.getByTestId("unique-a-count")).toHaveText("2");
    await expect(overview.getByTestId("unique-b-count")).toHaveText("2");
  });

  test("metric comparison table renders with at least one metric row", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE, DECK_B_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE, DECK_B_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    await expect(
      page.getByTestId("compare-slot-a").getByText("Card details loaded")
    ).toBeVisible({ timeout: 10_000 });

    await importDeckInSlot(page, "compare-slot-b", DECK_B_TEXT);

    const table = page.getByTestId("metric-comparison-table");
    await expect(table).toBeVisible({ timeout: 15_000 });

    // At least one data row must be present
    await expect(table.getByTestId("metric-row").first()).toBeVisible();
  });

  test("mana curve overlay and tag comparison chart are visible after both decks load", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE, DECK_B_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE, DECK_B_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    await expect(
      page.getByTestId("compare-slot-a").getByText("Card details loaded")
    ).toBeVisible({ timeout: 10_000 });

    await importDeckInSlot(page, "compare-slot-b", DECK_B_TEXT);

    await expect(page.getByTestId("comparison-results")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByTestId("mana-curve-overlay")).toBeVisible();
    await expect(page.getByTestId("tag-comparison-chart")).toBeVisible();
  });

  test("clearing a deck removes the summary and hides comparison results", async ({ page }) => {
    setupSequentialMocks(
      page,
      [DECK_A_PARSE_RESPONSE, DECK_B_PARSE_RESPONSE],
      [DECK_A_ENRICH_RESPONSE, DECK_B_ENRICH_RESPONSE],
    );

    await page.goto("/compare");
    await importDeckInSlot(page, "compare-slot-a", DECK_A_TEXT);

    await expect(
      page.getByTestId("compare-slot-a").getByText("Card details loaded")
    ).toBeVisible({ timeout: 10_000 });

    await importDeckInSlot(page, "compare-slot-b", DECK_B_TEXT);

    await expect(page.getByTestId("comparison-results")).toBeVisible({
      timeout: 15_000,
    });

    // Clear slot A using its accessible button
    await page
      .getByTestId("compare-slot-a")
      .getByRole("button", { name: /clear.*deck/i })
      .click();

    // Comparison results must disappear
    await expect(page.getByTestId("comparison-results")).not.toBeVisible();

    // The import form should reappear in slot A (textarea is back)
    await expect(
      page.getByTestId("compare-slot-a").getByLabel("Decklist")
    ).toBeVisible();
  });

  test("nav bar Compare Decks link navigates to /compare", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Main navigation").getByRole("link", { name: "Compare Decks" }).click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByTestId("compare-page")).toBeVisible();
  });
});
