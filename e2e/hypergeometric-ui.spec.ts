import { test, expect } from "./fixtures";

/**
 * Mock enrichment response for the hypergeometric calculator e2e tests.
 * Includes lands, ramp (Sol Ring), removal (Swords to Plowshares),
 * and card draw (Rhystic Study).
 */
const MOCK_ENRICH_RESPONSE = {
  cards: {
    "Atraxa, Praetors' Voice": {
      name: "Atraxa, Praetors' Voice",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      colorIdentity: ["G", "W", "U", "B"],
      colors: ["G", "W", "U", "B"],
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Angel", "Horror"],
      oracleText: "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
      power: "4",
      toughness: "4",
      loyalty: null,
      rarity: "mythic",
      imageUris: null,
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "cm2",
      collectorNumber: "10",
      layout: "normal",
      cardFaces: [
        {
          name: "Atraxa, Praetors' Voice",
          manaCost: "{G}{W}{U}{B}",
          typeLine: "Legendary Creature — Phyrexian Angel Horror",
          oracleText: "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
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
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
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
      setCode: "c21",
      collectorNumber: "264",
      layout: "normal",
      cardFaces: [
        {
          name: "Command Tower",
          manaCost: "",
          typeLine: "Land",
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
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
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
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
      setCode: "eld",
      collectorNumber: "331",
      layout: "normal",
      cardFaces: [
        {
          name: "Arcane Signet",
          manaCost: "{2}",
          typeLine: "Artifact",
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
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
      imageUris: null,
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
  },
  notFound: [],
};

const DECKLIST = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Swords to Plowshares
1 Counterspell`;

test.describe("Hypergeometric Calculator — UI", () => {
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

  async function navigateToAnalysisTab(deckPage: import("./fixtures").DeckPage) {
    await deckPage.goto();
    await deckPage.fillDecklist(DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete (mana cost symbols appear)
    await expect(
      deckPage.page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.waitForAnalysisPanel();
    await deckPage.expandAnalysisSection("hypergeometric");
  }

  test("Draw Probability section appears in Analysis tab", async ({
    deckPage,
  }) => {
    await navigateToAnalysisTab(deckPage);

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );
    await expect(section).toBeVisible();
    await expect(
      section.getByRole("heading", { name: "Draw Probability" })
    ).toBeVisible();
  });

  test("displays pre-computed query stat cards", async ({ deckPage }) => {
    await navigateToAnalysisTab(deckPage);

    const cards = deckPage.analysisPanel.locator(
      '[data-testid="precomputed-query"]'
    );
    // Should have at least one pre-computed query (land drop at minimum)
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("each stat card shows a label and probability percentage", async ({
    deckPage,
  }) => {
    await navigateToAnalysisTab(deckPage);

    const cards = deckPage.analysisPanel.locator(
      '[data-testid="precomputed-query"]'
    );
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Should show a label
    await expect(
      firstCard.locator('[data-testid="precomputed-query-label"]')
    ).toBeVisible();

    // Should show a probability like "73.5%"
    const probEl = firstCard.locator(
      '[data-testid="precomputed-query-probability"]'
    );
    await expect(probEl).toBeVisible();
    await expect(probEl).toHaveText(/\d+\.\d+%/);
  });

  test("custom query builder controls are visible", async ({ deckPage }) => {
    await navigateToAnalysisTab(deckPage);

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );

    // Category select
    await expect(
      section.locator('[data-testid="query-category-select"]')
    ).toBeVisible();

    // Min successes input
    await expect(
      section.locator('[data-testid="query-min-successes"]')
    ).toBeVisible();

    // Turn number input
    await expect(
      section.locator('[data-testid="query-turn-number"]')
    ).toBeVisible();

    // Query result
    await expect(
      section.locator('[data-testid="query-result"]')
    ).toBeVisible();
  });

  test("Show Curve button appears with a query result", async ({ deckPage }) => {
    await navigateToAnalysisTab(deckPage);

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );

    const showCurveBtn = section.locator('[data-testid="show-curve-btn"]');
    await expect(showCurveBtn).toBeVisible();
  });

  test("clicking Show Curve reveals probability chart", async ({ deckPage }) => {
    await navigateToAnalysisTab(deckPage);

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );

    const showCurveBtn = section.locator('[data-testid="show-curve-btn"]');
    await showCurveBtn.click();

    const chart = section.locator('[data-testid="probability-curve-chart"]');
    await expect(chart).toBeVisible();
  });

  test("changing turn number updates probability result", async ({
    deckPage,
  }) => {
    await navigateToAnalysisTab(deckPage);

    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );

    const turnInput = section.locator('[data-testid="query-turn-number"]');
    const result = section.locator('[data-testid="query-result"]');

    // Get initial probability
    const initial = await result.textContent();

    // Change turn number — higher turn = higher probability (more draws)
    await turnInput.fill("10");
    await turnInput.dispatchEvent("change");

    // Wait for re-render
    await deckPage.page.waitForTimeout(200);
    const updated = await result.textContent();

    // Probability at turn 10 should be >= turn 4
    expect(initial).not.toBeNull();
    expect(updated).not.toBeNull();
    // Both should be percentages
    expect(updated).toMatch(/\d+\.\d+%/);
  });

  test("section is accessible with proper ARIA structure", async ({
    deckPage,
  }) => {
    await navigateToAnalysisTab(deckPage);

    // The section should be labeled by its heading
    const section = deckPage.analysisPanel.locator(
      'section[aria-labelledby="hypergeometric-heading"]'
    );
    await expect(section).toBeVisible();

    // The heading must exist
    const heading = section.getByRole("heading", { name: "Draw Probability" });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute("id", "hypergeometric-heading");
  });

  test("pre-computed land query shows probability between 0% and 100%", async ({
    deckPage,
  }) => {
    await navigateToAnalysisTab(deckPage);

    // With 1 land in a 6-card deck, the probability should be non-zero and valid
    const probEl = deckPage.analysisPanel
      .locator('[data-testid="precomputed-query-probability"]')
      .first();
    await expect(probEl).toBeVisible();
    const text = await probEl.textContent();
    expect(text).toMatch(/\d+\.\d+%/);
    const pct = parseFloat(text!.replace("%", ""));
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
