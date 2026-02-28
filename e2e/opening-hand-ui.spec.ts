import { test, expect } from "./fixtures";

// Mock enrichment response with a mix of lands and spells that have imageUris
const MOCK_HAND_ENRICH_RESPONSE = {
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
        small: "https://cards.scryfall.io/small/sol-ring.jpg",
        normal: "https://cards.scryfall.io/normal/sol-ring.jpg",
        large: "https://cards.scryfall.io/large/sol-ring.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["C"],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
      imageUris: {
        small: "https://cards.scryfall.io/small/command-tower.jpg",
        normal: "https://cards.scryfall.io/normal/command-tower.jpg",
        large: "https://cards.scryfall.io/large/command-tower.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["W", "U", "B", "R", "G"],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
        small: "https://cards.scryfall.io/small/arcane-signet.jpg",
        normal: "https://cards.scryfall.io/normal/arcane-signet.jpg",
        large: "https://cards.scryfall.io/large/arcane-signet.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["W", "U", "B", "R", "G"],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
        small: "https://cards.scryfall.io/small/swords.jpg",
        normal: "https://cards.scryfall.io/normal/swords.jpg",
        large: "https://cards.scryfall.io/large/swords.jpg",
      },
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
      imageUris: {
        small: "https://cards.scryfall.io/small/counterspell.jpg",
        normal: "https://cards.scryfall.io/normal/counterspell.jpg",
        large: "https://cards.scryfall.io/large/counterspell.jpg",
      },
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
      power: "4",
      toughness: "4",
      loyalty: null,
      rarity: "mythic",
      imageUris: {
        small: "https://cards.scryfall.io/small/atraxa.jpg",
        normal: "https://cards.scryfall.io/normal/atraxa.jpg",
        large: "https://cards.scryfall.io/large/atraxa.jpg",
      },
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
    },
  },
  notFound: [],
};

const DECKLIST = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
1 Sol Ring
1 Command Tower
1 Arcane Signet
1 Swords to Plowshares
1 Counterspell`;

test.describe("Opening Hand Simulator", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HAND_ENRICH_RESPONSE),
      })
    );
  });

  test("Hands tab appears after deck import and enrichment", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to load
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Hands tab should be visible and enabled
    const handsTab = page
      .getByRole("tablist", { name: "Deck view" })
      .getByRole("tab", { name: "Hands" });
    await expect(handsTab).toBeVisible();
    await expect(handsTab).toBeEnabled();
  });

  test("Hands tab disabled while enrichment loading", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Hold enrichment
    let releaseEnrichment: (() => void) | null = null;
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise<void>((resolve) => {
        releaseEnrichment = resolve;
        setTimeout(resolve, 500);
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HAND_ENRICH_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Hands tab should be disabled
    const handsTab = page
      .getByRole("tablist", { name: "Deck view" })
      .getByRole("tab", { name: "Hands" });
    await expect(handsTab).toBeDisabled();

    releaseEnrichment?.();
  });

  test("Draw Hand button produces hand display with cards", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Hands tab
    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand Draw Hand section and click Draw Hand
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Hand display should appear
    await expect(page.getByTestId("hand-display")).toBeVisible();
    await expect(page.getByTestId("hand-cards")).toBeVisible();
  });

  test("Hand quality verdict displayed after drawing", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Verdict badge should be visible
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
    // Score should be visible
    await expect(page.getByTestId("hand-score")).toBeVisible();
    // Reasoning should be visible
    await expect(page.getByTestId("hand-reasoning")).toBeVisible();
  });

  test("Mulligan button draws new hand and increments count", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Click Mulligan
    await page.getByTestId("mulligan-btn").click();

    // Should show mulligan indicator
    await expect(page.getByTestId("mulligan-indicator")).toBeVisible();
    await expect(page.getByTestId("mulligan-indicator")).toContainText(
      "Mulligan 1"
    );
  });

  test("Mulligan button disabled after 3 mulligans", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Mulligan 3 times
    await page.getByTestId("mulligan-btn").click();
    await page.getByTestId("mulligan-btn").click();
    await page.getByTestId("mulligan-btn").click();

    // Button should be disabled after 3 mulligans
    await expect(page.getByTestId("mulligan-btn")).toBeDisabled();
  });

  test("New Hand button resets mulligan count", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Mulligan once
    await page.getByTestId("mulligan-btn").click();
    await expect(page.getByTestId("mulligan-indicator")).toBeVisible();

    // Click New Hand
    await page.getByTestId("new-hand-btn").click();

    // Mulligan indicator should be gone (mulligan count = 0)
    await expect(page.getByTestId("mulligan-indicator")).not.toBeVisible();

    // Mulligan button should be enabled again
    await expect(page.getByTestId("mulligan-btn")).toBeEnabled();
  });

  test("Simulation stats are visible", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand simulation stats section
    await deckPage.expandHandsSection("sim-stats");

    // Stat cards should be visible once the async simulation finishes.
    // The Monte Carlo simulation runs inside useEffect + requestAnimationFrame,
    // so the component starts in a loading/shimmer state and only renders the
    // real stat cards after the simulation completes.
    await expect(page.getByTestId("simulation-stats")).toBeVisible();
    await expect(page.getByTestId("stat-keepable-rate")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("stat-avg-lands")).toBeVisible();
    await expect(page.getByTestId("stat-t1-play")).toBeVisible();
    await expect(page.getByTestId("stat-t2-play")).toBeVisible();

    // Verdict distribution should be visible
    await expect(page.getByTestId("verdict-distribution")).toBeVisible();
  });

  test("Drawn hand does not contain commander cards", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Hand display should be visible
    await expect(page.getByTestId("hand-display")).toBeVisible();

    // Commander "Atraxa" should NOT appear in the hand cards
    const handCards = page.getByTestId("hand-cards");
    await expect(handCards).not.toContainText("Atraxa");
  });

  test("Command zone shows commander when drawing hand", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Command zone should be visible and contain the commander
    const commandZone = page.getByTestId("command-zone");
    await expect(commandZone).toBeVisible();
    await expect(commandZone).toContainText("Atraxa");
    await expect(commandZone).toContainText("Command Zone");
  });

  test("Tab accessible with proper ARIA attributes", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Hands tab should have correct ARIA attributes
    const handsTab = page
      .getByRole("tablist", { name: "Deck view" })
      .getByRole("tab", { name: "Hands" });
    await expect(handsTab).toHaveAttribute("aria-controls", "tabpanel-deck-hands");

    // Click the tab
    await handsTab.click();
    await expect(handsTab).toHaveAttribute("aria-selected", "true");

    // Tabpanel should have correct ARIA attributes
    const panel = page.locator("#tabpanel-deck-hands");
    await expect(panel).toHaveAttribute("role", "tabpanel");
    await expect(panel).toHaveAttribute("aria-labelledby", "tab-deck-hands");
  });

  test("Hand reasoning includes card advantage and interaction assessment", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("draw-hand");
    await page.getByTestId("draw-hand-btn").click();

    // Reasoning should include card advantage and interaction assessment
    const reasoning = page.getByTestId("hand-reasoning");
    await expect(reasoning).toBeVisible();
    const text = await reasoning.textContent();
    // Should mention card advantage/draw
    expect(text).toMatch(/card advantage|card draw|run out of gas/i);
    // Should mention interaction/threats
    expect(text).toMatch(/interaction|threat|answer/i);
  });

  test("Simulation stats show average strategy score", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();
    await deckPage.expandHandsSection("sim-stats");

    // Wait for simulation to complete
    await expect(page.getByTestId("stat-keepable-rate")).toBeVisible({
      timeout: 15_000,
    });

    // Average strategy score stat should be visible
    await expect(page.getByTestId("stat-avg-strategy")).toBeVisible();
  });
});
