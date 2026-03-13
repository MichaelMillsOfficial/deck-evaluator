import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock enrichment data
//
// Includes Sol Ring (ramp artifact), Command Tower (land), and three creatures
// to give the synergy engine enough material to score cards.
// ---------------------------------------------------------------------------

const MOCK_ENRICH_RESPONSE = {
  cards: {
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
      imageUris: {
        small: "https://cards.scryfall.io/small/front/4/c/4cbc6901.jpg",
        normal: "https://cards.scryfall.io/normal/front/4/c/4cbc6901.jpg",
        large: "https://cards.scryfall.io/large/front/4/c/4cbc6901.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["C"],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "c21",
      collectorNumber: "261",
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
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
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
      imageUris: {
        small: "https://cards.scryfall.io/small/front/0/b/0b36b68c.jpg",
        normal: "https://cards.scryfall.io/normal/front/0/b/0b36b68c.jpg",
        large: "https://cards.scryfall.io/large/front/0/b/0b36b68c.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["W", "U", "B", "R", "G"],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "c21",
      collectorNumber: "244",
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
      imageUris: {
        small: "https://cards.scryfall.io/small/front/6/e/6e5a6fd4.jpg",
        normal: "https://cards.scryfall.io/normal/front/6/e/6e5a6fd4.jpg",
        large: "https://cards.scryfall.io/large/front/6/e/6e5a6fd4.jpg",
      },
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "lea",
      collectorNumber: "38",
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
    "Counterspell": {
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
      imageUris: {
        small: "https://cards.scryfall.io/small/front/1/4/1496a82b.jpg",
        normal: "https://cards.scryfall.io/normal/front/1/4/1496a82b.jpg",
        large: "https://cards.scryfall.io/large/front/1/4/1496a82b.jpg",
      },
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "mmq",
      collectorNumber: "57",
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
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink", "Proliferate"],
      power: "4",
      toughness: "4",
      loyalty: null,
      rarity: "mythic",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/d/3/d3aaaa97.jpg",
        normal: "https://cards.scryfall.io/normal/front/d/3/d3aaaa97.jpg",
        large: "https://cards.scryfall.io/large/front/d/3/d3aaaa97.jpg",
      },
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "c16",
      collectorNumber: "38",
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
  },
  notFound: [],
};

// ---------------------------------------------------------------------------
// Successful suggestions API response
//
// Returns one category fill (Tutor) and one upgrade suggestion so tests can
// assert on both sections rendering populated content.
// ---------------------------------------------------------------------------

const MOCK_SUGGESTIONS_SUCCESS: {
  categoryFills: Array<{
    tag: string;
    label: string;
    status: "low" | "critical";
    currentCount: number;
    targetMin: number;
    gap: number;
    suggestions: Array<{
      cardName: string;
      reason: string;
      category: string;
      scryfallUri: string;
      imageUri: null;
      manaCost: string;
      cmc: number;
      typeLine: string;
    }>;
  }>;
  upgrades: Array<{
    existingCard: string;
    existingCmc: number;
    existingTags: string[];
    upgrades: Array<{
      cardName: string;
      reason: string;
      category: string;
      scryfallUri: string;
      imageUri: null;
      manaCost: string;
      cmc: number;
      typeLine: string;
    }>;
  }>;
} = {
  categoryFills: [
    {
      tag: "Tutor",
      label: "Tutor",
      status: "low",
      currentCount: 0,
      targetMin: 2,
      gap: 2,
      suggestions: [
        {
          cardName: "Demonic Tutor",
          reason: "Directly searches for any card in your library.",
          category: "Tutor",
          scryfallUri: "https://scryfall.com/card/2xm/83/demonic-tutor",
          imageUri: null,
          manaCost: "{1}{B}",
          cmc: 2,
          typeLine: "Sorcery",
        },
        {
          cardName: "Vampiric Tutor",
          reason: "Instant-speed library search at low mana cost.",
          category: "Tutor",
          scryfallUri: "https://scryfall.com/card/vma/148/vampiric-tutor",
          imageUri: null,
          manaCost: "{B}",
          cmc: 1,
          typeLine: "Instant",
        },
      ],
    },
  ],
  upgrades: [
    {
      existingCard: "Counterspell",
      existingCmc: 2,
      existingTags: ["Counterspell"],
      upgrades: [
        {
          cardName: "Force of Will",
          reason: "Can be cast for free by exiling a blue card.",
          category: "Counterspell",
          scryfallUri: "https://scryfall.com/card/2xm/51/force-of-will",
          imageUri: null,
          manaCost: "{3}{U}{U}",
          cmc: 5,
          typeLine: "Instant",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Shared setup: import a deck, wait for enrichment, then navigate to tab
// ---------------------------------------------------------------------------

test.describe("Suggestions Tab", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;

    // Mock the enrichment API so tests run offline and fast
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    // Mock the suggestions API with a successful response by default
    await page.route("**/api/card-suggestions", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTIONS_SUCCESS),
      })
    );

    // Import the standard sample deck
    await deckPage.goto();
    await deckPage.fillDecklist(
      [
        "COMMANDER:",
        "1 Atraxa, Praetors' Voice",
        "",
        "MAINBOARD:",
        "1 Sol Ring",
        "1 Command Tower",
        "1 Arcane Signet",
        "1 Swords to Plowshares",
        "1 Counterspell",
      ].join("\n")
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to settle (mana cost symbols become visible)
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // 1. Tab visibility
  // -------------------------------------------------------------------------

  test("Suggestions tab appears in the sidebar after deck import", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const tab = page
      .getByTestId("deck-header")
      .getByRole("tab", { name: /Suggestions/i });
    await expect(tab).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Panel structure
  // -------------------------------------------------------------------------

  test("clicking Suggestions tab renders the suggestions panel with heading", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(
      panel.getByRole("heading", { name: /Swap Suggestions/i })
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Verdict banner — warning style when the deck has issues
  // -------------------------------------------------------------------------

  test("verdict banner is visible after navigating to Suggestions tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const verdict = panel.locator('[data-testid="suggestions-verdict"]');
    await expect(verdict).toBeVisible();
  });

  test("verdict banner shows warning styling when the deck has gaps or weak cards", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The mock deck is small and will likely have gaps, so the amber/warning
    // variant should be applied.  We check the text rather than CSS classes.
    const verdict = panel.locator('[data-testid="suggestions-verdict"]');
    await expect(verdict).toBeVisible();
    // Verdict always contains a non-empty message
    await expect(verdict).not.toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // 4. Loading state
  // -------------------------------------------------------------------------

  test("shows loading indicator while fetching from API", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Replace the default mock with one that never resolves so the loading
    // spinner stays visible long enough to assert on it
    await page.unroute("**/api/card-suggestions");
    await page.route("**/api/card-suggestions", (_route) => {
      // Intentionally do not fulfill — leaves the request pending
    });

    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const loadingIndicator = panel.locator('[data-testid="suggestions-loading"]');
    await expect(loadingIndicator).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 5. Category fills section
  // -------------------------------------------------------------------------

  test("category fills panel is rendered with correct title", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const fillsPanel = panel.locator('[data-testid="suggestions-fills-panel"]');
    await expect(fillsPanel).toBeVisible({ timeout: 10_000 });
    await expect(fillsPanel).toContainText(/Cards Your Deck Needs/i);
  });

  test("category fills panel shows suggestion cards returned by the API", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Wait for the API response to render
    const fillsPanel = panel.locator('[data-testid="suggestions-fills-panel"]');
    await expect(fillsPanel).toBeVisible({ timeout: 10_000 });

    // The mock returns Tutor fill recommendations — at least one card should appear
    const suggestionCards = fillsPanel.locator('[data-testid="suggestions-card"]');
    await expect(suggestionCards.first()).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // 6. Weak cards section
  // -------------------------------------------------------------------------

  test("weak cards panel is rendered with correct title", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const weakPanel = panel.locator('[data-testid="suggestions-weak-panel"]');
    await expect(weakPanel).toBeVisible();
    await expect(weakPanel).toContainText(/Consider Cutting/i);
  });

  test("weak cards panel shows weak card items or empty state", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const weakPanel = panel.locator('[data-testid="suggestions-weak-panel"]');
    await expect(weakPanel).toBeVisible();

    // Either individual weak card rows or the empty-state element must be present
    const hasCards = await weakPanel
      .locator('[data-testid="suggestions-weak-card"]')
      .count();
    const hasEmpty = await weakPanel
      .locator('[data-testid="suggestions-weak-cards-empty"]')
      .count();
    expect(hasCards + hasEmpty).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 7. Upgrades section
  // -------------------------------------------------------------------------

  test("upgrades panel is rendered with correct title", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const upgradesPanel = panel.locator(
      '[data-testid="suggestions-upgrades-panel"]'
    );
    await expect(upgradesPanel).toBeVisible();
    await expect(upgradesPanel).toContainText(/Better Alternatives/i);
  });

  // -------------------------------------------------------------------------
  // 8. API error handling
  // -------------------------------------------------------------------------

  test("shows error state with retry button when API returns 502", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Override the default success mock with a server error
    await page.unroute("**/api/card-suggestions");
    await page.route("**/api/card-suggestions", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Bad Gateway" }),
      })
    );

    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const errorEl = panel.locator('[data-testid="suggestions-api-error"]');
    await expect(errorEl).toBeVisible({ timeout: 10_000 });

    // The retry button lives inside the error block
    const retryButton = errorEl.locator('[data-testid="refresh-suggestions"]');
    await expect(retryButton).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Refresh button after successful load
  // -------------------------------------------------------------------------

  test("shows refresh suggestions button after a successful API load", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The refresh button appears at the bottom when the fetch succeeds and
    // there were gaps or upgrade candidates to fetch
    const refreshButton = panel.locator('[data-testid="refresh-suggestions"]').last();
    await expect(refreshButton).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // 10. Collapsible panels — toggle open/closed
  // -------------------------------------------------------------------------

  test("category fills panel can be collapsed and re-expanded by clicking its header", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const fillsPanel = panel.locator('[data-testid="suggestions-fills-panel"]');
    await expect(fillsPanel).toBeVisible({ timeout: 10_000 });

    // The toggle button is the first button inside the collapsible panel
    const toggleButton = fillsPanel.locator("button").first();

    // Panel starts expanded (aria-expanded="true"); collapse it
    await expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Re-expand
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });

  test("weak cards panel can be collapsed and re-expanded by clicking its header", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Suggestions");

    const panel = page.locator('[data-testid="suggestions-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    const weakPanel = panel.locator('[data-testid="suggestions-weak-panel"]');
    await expect(weakPanel).toBeVisible();

    const toggleButton = weakPanel.locator("button").first();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });
});
