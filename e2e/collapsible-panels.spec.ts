import { test, expect } from "./fixtures";

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
    Cultivate: {
      name: "Cultivate",
      manaCost: "{2}{G}",
      cmc: 3,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Sorcery",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: null, usdFoil: null, eur: null },
      setCode: "c19",
      collectorNumber: "167",
      layout: "normal",
      cardFaces: [
        {
          name: "Cultivate",
          manaCost: "{2}{G}",
          typeLine: "Sorcery",
          oracleText:
            "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
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
  },
  notFound: [],
};

const DECKLIST =
  "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower";

test.describe("Collapsible Panels — Analysis Tab", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
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

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
  });

  test("all analysis sections are collapsed by default", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const sectionIds = [
      "commander",
      "composition",
      "deck-classification",
      "mana-curve",
      "color-distribution",
      "land-efficiency",
      "hypergeometric",
    ];
    for (const id of sectionIds) {
      const panel = page.getByTestId(`panel-${id}`);
      await expect(panel).toBeVisible();
      const button = panel.locator("button").first();
      await expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("panel headers are always visible when collapsed", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Check a few panel headers are visible
    await expect(page.getByTestId("panel-mana-curve")).toBeVisible();
    await expect(page.getByTestId("panel-commander")).toBeVisible();
    await expect(page.getByTestId("panel-deck-classification")).toBeVisible();
  });

  test("clicking a panel header expands it", async ({ deckPage }) => {
    const { page } = deckPage;
    const panel = page.getByTestId("panel-mana-curve");
    const button = panel.locator("button").first();

    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    // Content should now be visible
    const chartWrapper = page.getByRole("img", { name: /mana curve/i });
    await expect(chartWrapper).toBeVisible();
  });

  test("clicking an expanded header collapses it", async ({ deckPage }) => {
    const { page } = deckPage;
    const panel = page.getByTestId("panel-mana-curve");
    const button = panel.locator("button").first();

    // Expand
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    // Collapse
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape key collapses an expanded panel", async ({ deckPage }) => {
    const { page } = deckPage;
    const panel = page.getByTestId("panel-mana-curve");
    const button = panel.locator("button").first();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await button.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("multiple sections can be expanded simultaneously", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Expand mana curve
    const curvePanel = page.getByTestId("panel-mana-curve");
    await curvePanel.locator("button").first().click();

    // Expand deck classification
    const powerPanel = page.getByTestId("panel-deck-classification");
    await powerPanel.locator("button").first().click();

    // Both should be expanded
    await expect(
      curvePanel.locator("button").first()
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      powerPanel.locator("button").first()
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("section navigation chips are visible", async ({ deckPage }) => {
    const { page } = deckPage;
    const nav = page.getByTestId("section-nav");
    await expect(nav).toBeVisible();

    // Should have chips for all 7 sections
    await expect(page.getByTestId("section-nav-commander")).toBeVisible();
    await expect(page.getByTestId("section-nav-mana-curve")).toBeVisible();
    await expect(page.getByTestId("section-nav-deck-classification")).toBeVisible();
    await expect(page.getByTestId("section-nav-hypergeometric")).toBeVisible();
  });

  test("clicking a nav chip expands the target section", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const chip = page.getByTestId("section-nav-mana-curve");
    await chip.click();

    const panel = page.getByTestId("panel-mana-curve");
    const button = panel.locator("button").first();
    await expect(button).toHaveAttribute("aria-expanded", "true");
  });

  // Removed: "expanded section state persists across tab switches"
  // Phase 4 split each view tab into its own /reading/* route. Each route
  // mounts fresh React state, so collapsible-panel expansion no longer
  // persists across navigations. Acceptable trade-off for the verdict-
  // first IA: each route is a clean drill-in. The within-tab persistence
  // (across re-renders, refreshes, etc.) is still verified by the other
  // tests in this describe block.
});

test.describe("Collapsible Panels — Synergy Tab", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
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

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Synergy");
  });

  test("all synergy sections are collapsed by default", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const sectionIds = [
      "themes",
      "synergy-stats",
      "synergy-pairs",
      "anti-synergies",
      "card-scores",
    ];
    for (const id of sectionIds) {
      const panel = page.getByTestId(`panel-${id}`);
      await expect(panel).toBeVisible();
      const button = panel.locator("button").first();
      await expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("synergy section nav chips are visible", async ({ deckPage }) => {
    const { page } = deckPage;
    const nav = page.getByTestId("section-nav");
    await expect(nav).toBeVisible();

    await expect(page.getByTestId("section-nav-themes")).toBeVisible();
    await expect(page.getByTestId("section-nav-synergy-stats")).toBeVisible();
    await expect(page.getByTestId("section-nav-card-scores")).toBeVisible();
  });
});
