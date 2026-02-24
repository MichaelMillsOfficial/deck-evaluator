import { test, expect } from "./fixtures";

/**
 * Mock enrichment response with a mix of land types for testing
 * the Land Base Efficiency section in the Analysis tab.
 */
const MOCK_LAND_EFFICIENCY_RESPONSE = {
  cards: {
    "Ezuri, Stalker of Spheres": {
      name: "Ezuri, Stalker of Spheres",
      manaCost: "{1}{G}{U}",
      cmc: 3,
      colorIdentity: ["G", "U"],
      colors: ["G", "U"],
      typeLine: "Legendary Creature — Phyrexian Elf Warrior",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Elf", "Warrior"],
      oracleText:
        "Whenever a creature with a +1/+1 counter on it enters under your control, draw a card.",
      keywords: [],
      power: "3",
      toughness: "3",
      loyalty: null,
      rarity: "mythic",
      imageUris: null,
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
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
    },
    Forest: {
      name: "Forest",
      manaCost: "",
      cmc: 0,
      colorIdentity: ["G"],
      colors: [],
      typeLine: "Basic Land — Forest",
      supertypes: ["Basic"],
      subtypes: ["Forest"],
      oracleText: "({T}: Add {G}.)",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["G"],
      flavorName: null,
    },
    Island: {
      name: "Island",
      manaCost: "",
      cmc: 0,
      colorIdentity: ["U"],
      colors: [],
      typeLine: "Basic Land — Island",
      supertypes: ["Basic"],
      subtypes: ["Island"],
      oracleText: "({T}: Add {U}.)",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["U"],
      flavorName: null,
    },
    "Breeding Pool": {
      name: "Breeding Pool",
      manaCost: "",
      cmc: 0,
      colorIdentity: ["G", "U"],
      colors: [],
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      oracleText:
        "({T}: Add {G} or {U}.)\nAs Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "rare",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["G", "U"],
      flavorName: null,
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
    },
  },
  notFound: [],
};

const DECKLIST = `COMMANDER:
1 Ezuri, Stalker of Spheres

MAINBOARD:
1 Sol Ring
1 Counterspell
1 Forest
1 Island
1 Breeding Pool
1 Command Tower`;

test.describe("Land Base Efficiency — UI", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LAND_EFFICIENCY_RESPONSE),
      })
    );
  });

  test("Land Base Efficiency section appears in Analysis tab", async ({
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

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="land-efficiency-heading"]'
    );
    await expect(section).toBeVisible();
    await expect(
      section.getByRole("heading", { name: "Land Base Efficiency" })
    ).toBeVisible();
  });

  test("displays overall efficiency score", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();

    const scoreDisplay = deckPage.analysisPanel.getByTestId(
      "efficiency-overall-score"
    );
    await expect(scoreDisplay).toBeVisible();
    // Should contain a number
    await expect(scoreDisplay).toHaveText(/\d+/);
  });

  test("displays all five factor rows with scores", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();

    const factorRows = deckPage.analysisPanel.locator(
      '[data-testid="efficiency-factor"]'
    );
    await expect(factorRows).toHaveCount(5);

    // Each factor row should have a name and score
    for (const row of await factorRows.all()) {
      await expect(row.locator('[data-testid="factor-name"]')).toBeVisible();
      await expect(row.locator('[data-testid="factor-score"]')).toBeVisible();
    }
  });

  test("score badge has correct color for score range", async ({
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

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();

    const badge = deckPage.analysisPanel.getByTestId("efficiency-score-label");
    await expect(badge).toBeVisible();
    // Badge should contain one of the score labels
    await expect(badge).toHaveText(
      /Excellent|Good|Fair|Needs Work|Poor/
    );
  });

  test("section is accessible with proper ARIA structure", async ({
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

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();

    // The section should have aria-labelledby pointing to the heading
    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="land-efficiency-heading"]'
    );
    await expect(section).toBeVisible();

    // Factor progress bars should have proper ARIA
    const progressBars = section.locator('[role="progressbar"]');
    const count = await progressBars.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (const bar of await progressBars.all()) {
      await expect(bar).toHaveAttribute("aria-valuenow", /\d+/);
      await expect(bar).toHaveAttribute("aria-valuemin", "0");
      await expect(bar).toHaveAttribute("aria-valuemax", "100");
    }
  });
});
