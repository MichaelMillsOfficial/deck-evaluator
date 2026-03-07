import { test, expect } from "./fixtures";

// Reuse the same mock enrichment from opening-hand-ui tests with enough cards
// to form meaningful hands
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
        small: "https://cards.scryfall.io/small/sol-ring.jpg",
        normal: "https://cards.scryfall.io/normal/sol-ring.jpg",
        large: "https://cards.scryfall.io/large/sol-ring.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["C"],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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
        small: "https://cards.scryfall.io/small/arcane-signet.jpg",
        normal: "https://cards.scryfall.io/normal/arcane-signet.jpg",
        large: "https://cards.scryfall.io/large/arcane-signet.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["W", "U", "B", "R", "G"],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
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

/** Navigate to Hands tab with enrichment loaded */
async function setupHandsTab(deckPage: Awaited<ReturnType<typeof test["info"]> extends never ? never : any>) {
  const { page } = deckPage;
  await page.route("**/api/deck-enrich", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ENRICH_RESPONSE),
    })
  );

  await deckPage.goto();
  await deckPage.fillDecklist(DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Wait for enrichment
  await page
    .locator('[aria-label="Mana cost: 1 generic"]')
    .first()
    .waitFor({ timeout: 10_000 });

  // Navigate to Hands tab
  await deckPage.selectDeckViewTab("Hands");
  await deckPage.waitForHandsPanel();
}

test.describe("Top 5 Best Hands", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );
  });

  test("Top hands section appears after simulation completes", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand top hands panel
    await page
      .getByTestId("panel-top-hands")
      .locator("button")
      .first()
      .click();

    // Top hands section should be visible
    await expect(page.getByTestId("top-hands")).toBeVisible();

    // Wait for at least one ranked hand to appear (simulation must finish)
    await expect(page.getByTestId("top-hand-1")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Top hands show rank, verdict badge, and reasoning", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand top hands panel
    await page
      .getByTestId("panel-top-hands")
      .locator("button")
      .first()
      .click();

    // Wait for top hand to load
    const topHand = page.getByTestId("top-hand-1");
    await expect(topHand).toBeVisible({ timeout: 15_000 });

    // Should contain rank "1" (purple badge)
    await expect(topHand.locator(".bg-purple-600")).toContainText("1");

    // Should contain a verdict badge
    await expect(
      topHand.locator(".rounded-full.border").first()
    ).toBeVisible();

    // Should contain score text
    await expect(topHand).toContainText("Score:");
  });
});

test.describe("Hand Builder", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );
  });

  test("Hand builder section is visible on Hands tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Hand builder panel should be visible (collapsed by default)
    await expect(page.getByTestId("panel-hand-builder")).toBeVisible();
  });

  test("Card picker shows deck cards after expanding", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Should show card picker rows
    await expect(
      page.getByTestId("card-picker-row-sol-ring")
    ).toBeVisible();
    await expect(
      page.getByTestId("card-picker-row-command-tower")
    ).toBeVisible();
  });

  test("Selecting cards updates count indicator", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Initially 0 / 7
    await expect(page.getByTestId("selected-count")).toContainText(
      "0 / 7 cards selected"
    );

    // Add Sol Ring
    await page.getByRole("button", { name: "Add Sol Ring" }).click();

    // Should update to 1 / 7
    await expect(page.getByTestId("selected-count")).toContainText(
      "1 / 7 cards selected"
    );
  });

  test("Analyze button disabled when no cards selected", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    await expect(page.getByTestId("analyze-hand-btn")).toBeDisabled();
  });

  test("Analyze button produces hand evaluation", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Select some cards
    await page.getByRole("button", { name: "Add Command Tower" }).click();
    await page.getByRole("button", { name: "Add Sol Ring" }).click();
    await page
      .getByRole("button", { name: "Add Swords to Plowshares" })
      .click();

    // Click Analyze
    await page.getByTestId("analyze-hand-btn").click();

    // Result should appear with verdict
    await expect(page.getByTestId("hand-builder-result")).toBeVisible();
    await expect(
      page.getByTestId("hand-builder-result").getByTestId("verdict-badge")
    ).toBeVisible();
  });

  test("Clear button resets selection", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Select a card
    await page.getByRole("button", { name: "Add Sol Ring" }).click();
    await expect(page.getByTestId("selected-count")).toContainText(
      "1 / 7 cards selected"
    );

    // Click Clear
    await page.getByTestId("clear-selection-btn").click();

    // Count should reset
    await expect(page.getByTestId("selected-count")).toContainText(
      "0 / 7 cards selected"
    );
  });

  test("Search filters card list by name", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // All cards should be visible initially
    await expect(
      page.getByTestId("card-picker-row-sol-ring")
    ).toBeVisible();
    await expect(
      page.getByTestId("card-picker-row-command-tower")
    ).toBeVisible();

    // Type search query
    await page.getByTestId("hand-builder-search").fill("sol");

    // Sol Ring should still be visible, Command Tower should be hidden
    await expect(
      page.getByTestId("card-picker-row-sol-ring")
    ).toBeVisible();
    await expect(
      page.getByTestId("card-picker-row-command-tower")
    ).not.toBeVisible();
  });

  test("Search filters by type line", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Search for "instant" type
    await page.getByTestId("hand-builder-search").fill("instant");

    // Swords and Counterspell are instants, others should be hidden
    await expect(
      page.getByTestId("card-picker-row-swords-to-plowshares")
    ).toBeVisible();
    await expect(
      page.getByTestId("card-picker-row-counterspell")
    ).toBeVisible();
    await expect(
      page.getByTestId("card-picker-row-sol-ring")
    ).not.toBeVisible();
  });

  test("Hand builder does not list commander in card picker", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Mainboard cards should be visible
    await expect(
      page.getByTestId("card-picker-row-sol-ring")
    ).toBeVisible();

    // Commander should NOT be in the card picker
    await expect(
      page.getByTestId("card-picker-row-atraxa-praetors-voice")
    ).not.toBeVisible();
  });

  test("Hand builder shows command zone above card picker", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Command zone display should be visible with commander name
    const commandZone = page.getByTestId("hand-builder-command-zone");
    await expect(commandZone).toBeVisible();
    await expect(commandZone).toContainText("Atraxa");
  });

  test("Search shows no-match message for unmatched query", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await page
      .locator('[aria-label="Mana cost: 1 generic"]')
      .first()
      .waitFor({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Hands");
    await deckPage.waitForHandsPanel();

    // Expand hand builder
    await page
      .getByTestId("panel-hand-builder")
      .locator("button")
      .first()
      .click();

    // Search for something that doesn't exist
    await page.getByTestId("hand-builder-search").fill("zzzznotacard");

    // Should show no-match message
    await expect(
      page.locator("text=No cards match")
    ).toBeVisible();
  });
});
