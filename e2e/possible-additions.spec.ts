import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ENRICH_RESPONSE = {
  cards: {
    "Atraxa, Praetors' Voice": {
      name: "Atraxa, Praetors' Voice",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      colorIdentity: ["W", "U", "B", "G"],
      colors: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Angel", "Horror"],
      oracleText:
        "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
      power: "4",
      toughness: "4",
      loyalty: null,
      rarity: "mythic",
      imageUris: null,
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 10.0, usdFoil: 20.0, eur: 8.0 },
      setCode: "cm2",
      collectorNumber: "10",
      layout: "normal",
      cardFaces: [
        {
          name: "Atraxa, Praetors' Voice",
          manaCost: "{G}{W}{U}{B}",
          typeLine: "Legendary Creature — Phyrexian Angel Horror",
          oracleText:
            "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
          power: "4",
          toughness: "4",
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Sol Ring": {
      name: "Sol Ring",
      manaCost: "{1}",
      cmc: 1,
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
      prices: { usd: 1.5, usdFoil: 5.0, eur: 1.0 },
      setCode: "c21",
      collectorNumber: "263",
      layout: "normal",
      cardFaces: [
        {
          name: "Sol Ring",
          manaCost: "{1}",
          typeLine: "Artifact",
          oracleText: "{T}: Add {C}{C}.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Command Tower": {
      name: "Command Tower",
      manaCost: "",
      cmc: 0,
      colorIdentity: [],
      colors: [],
      typeLine: "Land",
      supertypes: [],
      subtypes: [],
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
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
      prices: { usd: 0.25, usdFoil: 1.0, eur: 0.2 },
      setCode: "c21",
      collectorNumber: "264",
      layout: "normal",
      cardFaces: [
        {
          name: "Command Tower",
          manaCost: "",
          typeLine: "Land",
          oracleText:
            "{T}: Add one mana of any color in your commander's color identity.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Arcane Signet": {
      name: "Arcane Signet",
      manaCost: "{2}",
      cmc: 2,
      colorIdentity: [],
      colors: [],
      typeLine: "Artifact",
      supertypes: [],
      subtypes: [],
      oracleText:
        "{T}: Add one mana of any color in your commander's color identity.",
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
      prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
      setCode: "eld",
      collectorNumber: "331",
      layout: "normal",
      cardFaces: [
        {
          name: "Arcane Signet",
          manaCost: "{2}",
          typeLine: "Artifact",
          oracleText:
            "{T}: Add one mana of any color in your commander's color identity.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Swords to Plowshares": {
      name: "Swords to Plowshares",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Exile target creature. Its controller gains life equal to its power.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: null,
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 2.0, usdFoil: 6.0, eur: 1.5 },
      setCode: "ice",
      collectorNumber: "274",
      layout: "normal",
      cardFaces: [
        {
          name: "Swords to Plowshares",
          manaCost: "{W}",
          typeLine: "Instant",
          oracleText:
            "Exile target creature. Its controller gains life equal to its power.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    Counterspell: {
      name: "Counterspell",
      manaCost: "{U}{U}",
      cmc: 2,
      colorIdentity: ["U"],
      colors: ["U"],
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
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 1.0, usdFoil: 3.0, eur: 0.8 },
      setCode: "tmp",
      collectorNumber: "64",
      layout: "normal",
      cardFaces: [
        {
          name: "Counterspell",
          manaCost: "{U}{U}",
          typeLine: "Instant",
          oracleText: "Counter target spell.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
  },
  notFound: [],
};

// Candidate card enrichment response (returned when candidate is added)
const CANDIDATE_ENRICH_RESPONSE = {
  cards: {
    "Path to Exile": {
      name: "Path to Exile",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Exile target creature. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: null,
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 3.0, usdFoil: 8.0, eur: 2.5 },
      setCode: "mm3",
      collectorNumber: "17",
      layout: "normal",
      cardFaces: [
        {
          name: "Path to Exile",
          manaCost: "{W}",
          typeLine: "Instant",
          oracleText:
            "Exile target creature. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
  },
  notFound: [],
};

// Off-identity candidate
const OFF_IDENTITY_ENRICH_RESPONSE = {
  cards: {
    "Lightning Bolt": {
      name: "Lightning Bolt",
      manaCost: "{R}",
      cmc: 1,
      colorIdentity: ["R"],
      colors: ["R"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
      setCode: "a25",
      collectorNumber: "141",
      layout: "normal",
      cardFaces: [
        {
          name: "Lightning Bolt",
          manaCost: "{R}",
          typeLine: "Instant",
          oracleText: "Lightning Bolt deals 3 damage to any target.",
          power: null,
          toughness: null,
          loyalty: null,
          imageUris: null,
        },
      ],
    },
  },
  notFound: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupMocks(page: import("@playwright/test").Page) {
  // Track enrich request count so we can return different responses
  let enrichCallCount = 0;

  await page.route("**/api/deck-enrich", async (route) => {
    enrichCallCount++;
    const body = await route.request().postDataJSON();
    const names: string[] = body.cardNames ?? [];

    // If request contains candidate cards, return candidate enrichment
    if (names.includes("Path to Exile")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CANDIDATE_ENRICH_RESPONSE),
      });
    } else if (names.includes("Lightning Bolt")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(OFF_IDENTITY_ENRICH_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    }
  });

  // Mock Commander Spellbook to avoid external calls
  await page.route("**/api/commander-spellbook*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
    })
  );
}

async function setupAutocomplete(
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

async function importDeckAndGoToAdditions(
  deckPage: import("./fixtures").DeckPage,
  page: import("@playwright/test").Page
) {
  await setupMocks(page);
  await deckPage.goto();
  await deckPage.fillDecklist(SAMPLE_DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Wait for enrichment to complete (mana cost visible for Sol Ring)
  await expect(
    page.locator('[aria-label="Mana cost: 1 generic"]')
  ).toBeVisible({ timeout: 10_000 });

  // Navigate to Additions tab
  await deckPage.selectDeckViewTab("Additions");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Additions tab", () => {
  test("appears as the last tab in deck view", async ({ deckPage, page }) => {
    await setupMocks(page);
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const tabs = tablist.getByRole("tab");

    // Should have 7 tabs total (Interactions + Suggestions added after Additions)
    await expect(tabs).toHaveCount(7);

    // Additions should be the second-to-last tab
    const additionsTab = tablist.getByRole("tab", { name: "Additions" });
    await expect(additionsTab).toBeVisible();
  });

  test("becomes enabled after enrichment completes", async ({
    deckPage,
    page,
  }) => {
    await setupMocks(page);
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Additions tab should be enabled after enrichment
    const additionsTab = page
      .getByRole("tablist", { name: "Deck view" })
      .getByRole("tab", { name: "Additions" });
    await expect(additionsTab).toBeEnabled();
  });

  test("shows empty state with search input when no candidates", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);

    // Should show the additions panel
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel).toBeVisible();

    // Should have a search input
    const searchInput = panel.locator("#card-search-input");
    await expect(searchInput).toBeVisible();

    // Should show empty state message
    await expect(
      panel.getByText("Search for cards to evaluate as possible additions")
    ).toBeVisible();
  });
});

test.describe("Card search autocomplete", () => {
  test("shows autocomplete suggestions when typing", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, [
      "Path to Exile",
      "Ponder",
      "Preordain",
    ]);

    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");

    // Wait for suggestions to appear
    const listbox = page.locator("#card-search-listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await expect(listbox.getByRole("option")).toHaveCount(3);
  });

  test("filters out cards already in the deck", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    // Include "Sol Ring" in suggestions — it's already in the deck
    await setupAutocomplete(page, [
      "Sol Ring",
      "Path to Exile",
      "Ponder",
    ]);

    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("So");

    const listbox = page.locator("#card-search-listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // "Sol Ring" should NOT appear (already in deck)
    await expect(
      listbox.getByRole("option", { name: "Sol Ring" })
    ).toHaveCount(0);
  });

  test("adds a candidate card when suggestion is selected", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");

    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Should see the candidate card row appear
    await expect(
      page.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Search input should be cleared
    await expect(searchInput).toHaveValue("");
  });

  test("keyboard navigation works (ArrowDown, Enter, Escape)", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, [
      "Path to Exile",
      "Ponder",
    ]);

    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");

    const listbox = page.locator("#card-search-listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // Arrow down to first option
    await searchInput.press("ArrowDown");
    // Arrow down to second option
    await searchInput.press("ArrowDown");

    // Escape closes the dropdown
    await searchInput.press("Escape");
    await expect(listbox).not.toBeVisible();
  });
});

test.describe("Candidate card display", () => {
  test("shows candidate with mana cost, tags, and price", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // Add candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Wait for enrichment + analysis
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Should show price
    await expect(panel.getByText("$3.00")).toBeVisible({ timeout: 5_000 });
  });

  test("shows off-identity warning for cards outside commander colors", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Lightning Bolt"]);

    // Add off-identity candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Li");
    const option = page.getByRole("option", { name: "Lightning Bolt" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Wait for enrichment
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Lightning Bolt").first()
    ).toBeVisible({ timeout: 10_000 });

    // Should show off-identity warning
    await expect(
      panel.getByText("Off-identity")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("can remove a candidate card", async ({ deckPage, page }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // Add candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Click remove button
    await panel.getByRole("button", { name: "Remove Path to Exile" }).click();

    // Should be gone
    await expect(
      panel.getByText("Path to Exile")
    ).not.toBeVisible();

    // Empty state should return
    await expect(
      panel.getByText("Search for cards to evaluate as possible additions")
    ).toBeVisible();
  });

  test("shows synergy score and CMC delta in collapsed view", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // Add candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Synergy score badge should be visible without expanding
    await expect(
      panel.getByTestId("synergy-badge")
    ).toBeVisible({ timeout: 5_000 });

    // CMC delta should be visible without expanding
    await expect(panel.getByTestId("cmc-delta")).toBeVisible();
  });

  test("expands to show replacement suggestions and CMC detail", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // Add candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Click expand button
    const expandButton = panel
      .getByRole("button", { name: /Path to Exile/ })
      .first();
    await expandButton.click();

    // Should show CMC detail with current → projected
    await expect(
      panel.getByText("CMC Impact")
    ).toBeVisible({ timeout: 5_000 });

    // Should show replacement suggestions
    await expect(panel.getByText("Replacement Suggestions")).toBeVisible();
  });
});

test.describe("Candidate error handling", () => {
  test("shows loading state while enrichment is in progress", async ({
    deckPage,
    page,
  }) => {
    // Set up mocks but delay the candidate enrichment response
    await page.route("**/api/deck-enrich", async (route) => {
      const body = await route.request().postDataJSON();
      const names: string[] = body.cardNames ?? [];

      if (names.includes("Path to Exile")) {
        // Delay response to make loading state observable
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(CANDIDATE_ENRICH_RESPONSE),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ENRICH_RESPONSE),
        });
      }
    });
    await page.route("**/api/commander-spellbook*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
      })
    );
    await setupAutocomplete(page, ["Path to Exile"]);

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Additions");

    // Select a candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Should show loading state
    const loading = page.getByTestId("candidate-loading");
    await expect(loading).toBeVisible();
    await expect(loading.getByText("Loading Path to Exile...")).toBeVisible();

    // Eventually the card should load
    await expect(
      page.locator("#tabpanel-deck-additions").getByText("$3.00")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows error state when enrichment API fails", async ({
    deckPage,
    page,
  }) => {
    // Return 500 for candidate enrichment
    await page.route("**/api/deck-enrich", async (route) => {
      const body = await route.request().postDataJSON();
      const names: string[] = body.cardNames ?? [];

      if (names.includes("Path to Exile")) {
        await route.fulfill({ status: 500 });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ENRICH_RESPONSE),
        });
      }
    });
    await page.route("**/api/commander-spellbook*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
      })
    );
    await setupAutocomplete(page, ["Path to Exile"]);

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Additions");

    // Select a candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Should show error state
    const errorRow = page.getByTestId("candidate-error");
    await expect(errorRow).toBeVisible({ timeout: 10_000 });
    await expect(errorRow.getByText("Path to Exile")).toBeVisible();
    await expect(
      errorRow.getByText("Failed to fetch card data")
    ).toBeVisible();

    // Should have retry and remove buttons
    await expect(errorRow.getByText("Retry")).toBeVisible();
    await expect(
      errorRow.getByRole("button", { name: "Remove Path to Exile" })
    ).toBeVisible();
  });

  test("retry button re-attempts enrichment", async ({ deckPage, page }) => {
    let enrichAttempts = 0;

    await page.route("**/api/deck-enrich", async (route) => {
      const body = await route.request().postDataJSON();
      const names: string[] = body.cardNames ?? [];

      if (names.includes("Path to Exile")) {
        enrichAttempts++;
        if (enrichAttempts === 1) {
          // First attempt fails
          await route.fulfill({ status: 500 });
        } else {
          // Second attempt succeeds
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(CANDIDATE_ENRICH_RESPONSE),
          });
        }
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ENRICH_RESPONSE),
        });
      }
    });
    await page.route("**/api/commander-spellbook*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
      })
    );
    await setupAutocomplete(page, ["Path to Exile"]);

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Additions");

    // Select a candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Wait for error state
    const errorRow = page.getByTestId("candidate-error");
    await expect(errorRow).toBeVisible({ timeout: 10_000 });

    // Click retry
    await errorRow.getByText("Retry").click();

    // Should now show the loaded card
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("$3.00")).toBeVisible({ timeout: 10_000 });
    await expect(errorRow).not.toBeVisible();
  });

  test("remove button dismisses error row", async ({ deckPage, page }) => {
    await page.route("**/api/deck-enrich", async (route) => {
      const body = await route.request().postDataJSON();
      const names: string[] = body.cardNames ?? [];

      if (names.includes("Path to Exile")) {
        await route.fulfill({ status: 500 });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ENRICH_RESPONSE),
        });
      }
    });
    await page.route("**/api/commander-spellbook*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
      })
    );
    await setupAutocomplete(page, ["Path to Exile"]);

    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Additions");

    // Select a candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // Wait for error
    const errorRow = page.getByTestId("candidate-error");
    await expect(errorRow).toBeVisible({ timeout: 10_000 });

    // Click remove
    await errorRow
      .getByRole("button", { name: "Remove Path to Exile" })
      .click();

    // Error row should be gone, empty state should show
    await expect(errorRow).not.toBeVisible();
    await expect(
      page.getByText("Search for cards to evaluate as possible additions")
    ).toBeVisible();
  });
});

test.describe("Candidate state persistence", () => {
  test("candidates persist when switching tabs", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndGoToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // Add candidate
    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pa");
    const option = page.getByRole("option", { name: "Path to Exile" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(
      panel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 10_000 });

    // Switch to Deck List tab and back
    await deckPage.selectDeckViewTab("Deck List");
    await deckPage.selectDeckViewTab("Additions");

    // Candidate should still be there
    const additionsPanel = page.locator("#tabpanel-deck-additions");
    await expect(
      additionsPanel.getByText("Path to Exile").first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
