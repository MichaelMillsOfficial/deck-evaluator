import { test, expect } from "./fixtures";

/**
 * Mock enrichment response with a mix of land types for testing
 * the Mana Base Recommendations section. Uses the same Ezuri deck
 * as land-base-efficiency-ui but this small deck will trigger
 * several recommendations (low land count, etc.)
 */
const MOCK_RESPONSE = {
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
      prices: { usd: null, usdFoil: null, eur: null },
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
      imageUris: null,
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
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
      prices: { usd: null, usdFoil: null, eur: null },
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
      prices: { usd: null, usdFoil: null, eur: null },
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
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: ["W", "U", "B", "R", "G"],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
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

test.describe("Mana Base Recommendations — UI", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSE),
      })
    );
  });

  test("Mana Base Recommendations section appears inside Land Base Efficiency", async ({
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
    await deckPage.expandAnalysisSection("land-efficiency");

    const section = deckPage.analysisPanel.getByTestId("mana-recommendations");
    await expect(section).toBeVisible();
  });

  test("displays health summary banner", async ({ deckPage }) => {
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
    await deckPage.expandAnalysisSection("land-efficiency");

    const banner = deckPage.analysisPanel.getByTestId(
      "recommendations-health-summary"
    );
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("role", "status");
  });

  test("displays recommendation rows when issues exist", async ({
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
    await deckPage.expandAnalysisSection("land-efficiency");

    // This tiny deck should trigger recommendations (low land count, etc.)
    const rows = deckPage.analysisPanel.locator(
      '[data-testid="recommendation-row"]'
    );
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});
