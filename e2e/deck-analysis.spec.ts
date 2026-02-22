import { test, expect } from "./fixtures";

const MOCK_ANALYSIS_RESPONSE = {
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
      imageUris: null,
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    "Cultivate": {
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

test.describe("Deck Analysis — Tab Navigation", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    );
  });

  test("Deck List and Analysis tabs visible after import, defaults to Deck List", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    await expect(tablist).toBeVisible();

    const deckListTab = tablist.getByRole("tab", { name: "Deck List" });
    const analysisTab = tablist.getByRole("tab", { name: "Analysis" });
    await expect(deckListTab).toBeVisible();
    await expect(analysisTab).toBeVisible();

    // Defaults to Deck List
    await expect(deckListTab).toHaveAttribute("aria-selected", "true");
    await expect(analysisTab).toHaveAttribute("aria-selected", "false");
  });

  test("arrow key navigation between tabs", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const deckListTab = tablist.getByRole("tab", { name: "Deck List" });
    const analysisTab = tablist.getByRole("tab", { name: "Analysis" });

    await deckListTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(analysisTab).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(deckListTab).toBeFocused();

    await page.keyboard.press("End");
    await expect(analysisTab).toBeFocused();

    await page.keyboard.press("Home");
    await expect(deckListTab).toBeFocused();
  });
});

test.describe("Deck Analysis — Tab Availability", () => {
  test("Analysis tab disabled while enrichment loads, enabled after completion", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Delay enrichment to observe disabled state
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const analysisTab = tablist.getByRole("tab", { name: "Analysis" });

    // Should be disabled while loading
    await expect(analysisTab).toBeDisabled();

    // Wait for enrichment to complete, then it should be enabled
    await expect(analysisTab).toBeEnabled({ timeout: 10_000 });
  });
});

test.describe("Deck Analysis — Mana Curve Content", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    );
  });

  test("clicking Analysis shows Mana Curve heading and chart", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");

    await expect(
      page.getByRole("heading", { name: "Mana Curve" })
    ).toBeVisible();

    // Chart wrapper should have role="img" with aria-label
    const chartWrapper = page.getByRole("img", { name: /mana curve/i });
    await expect(chartWrapper).toBeVisible();
  });

  test("switching back to Deck List shows deck-display", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await expect(
      page.getByRole("heading", { name: "Mana Curve" })
    ).toBeVisible();

    await deckPage.selectDeckViewTab("Deck List");
    await expect(deckPage.deckDisplay).toBeVisible();
  });
});

test.describe("Deck Analysis — Accessibility", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    );
  });

  test("tab buttons have role=tab with correct aria-selected", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const deckListTab = tablist.getByRole("tab", { name: "Deck List" });
    const analysisTab = tablist.getByRole("tab", { name: "Analysis" });

    await expect(deckListTab).toHaveAttribute("aria-selected", "true");
    await expect(analysisTab).toHaveAttribute("aria-selected", "false");

    await deckPage.selectDeckViewTab("Analysis");

    await expect(deckListTab).toHaveAttribute("aria-selected", "false");
    await expect(analysisTab).toHaveAttribute("aria-selected", "true");
  });

  test("aria-controls matches panel IDs and inactive panel has hidden", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const deckListTab = tablist.getByRole("tab", { name: "Deck List" });
    const analysisTab = tablist.getByRole("tab", { name: "Analysis" });

    // Deck List tab controls list panel
    await expect(deckListTab).toHaveAttribute(
      "aria-controls",
      "tabpanel-deck-list"
    );
    await expect(analysisTab).toHaveAttribute(
      "aria-controls",
      "tabpanel-deck-analysis"
    );

    // List panel visible, analysis panel hidden
    const listPanel = page.locator("#tabpanel-deck-list");
    const analysisPanel = page.locator("#tabpanel-deck-analysis");
    await expect(listPanel).not.toHaveAttribute("hidden", "");
    await expect(analysisPanel).toHaveAttribute("hidden", "");

    // Switch tabs
    await deckPage.selectDeckViewTab("Analysis");
    await expect(listPanel).toHaveAttribute("hidden", "");
    await expect(analysisPanel).not.toHaveAttribute("hidden", "");
  });

  test("tablist has aria-label 'Deck view'", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const tablist = page.getByRole("tablist", { name: "Deck view" });
    await expect(tablist).toBeVisible();
  });
});

test.describe("Deck Analysis — Type Filters", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    );
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
  });

  test("filter chips are visible on the Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const filterGroup = page.getByRole("group", {
      name: "Card type filters",
    });
    await expect(filterGroup).toBeVisible();

    // Should have chips for all 7 card types
    const buttons = filterGroup.getByRole("button");
    await expect(buttons).toHaveCount(7);
  });

  test("all filter chips are active (aria-pressed=true) by default", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const filterGroup = page.getByRole("group", {
      name: "Card type filters",
    });
    const buttons = filterGroup.getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("chips show correct counts from mock data", async ({ deckPage }) => {
    const { page } = deckPage;
    const filterGroup = page.getByRole("group", {
      name: "Card type filters",
    });

    // Mock data: 1 Artifact (Sol Ring), 1 Instant (Counterspell), 1 Sorcery (Cultivate)
    await expect(
      filterGroup.getByRole("button", { name: /Artifact \(1\)/ })
    ).toBeVisible();
    await expect(
      filterGroup.getByRole("button", { name: /Instant \(1\)/ })
    ).toBeVisible();
    await expect(
      filterGroup.getByRole("button", { name: /Sorcery \(1\)/ })
    ).toBeVisible();
    // No creatures in the mock
    await expect(
      filterGroup.getByRole("button", { name: /Creature \(0\)/ })
    ).toBeVisible();
  });

  test("clicking a chip toggles it off (aria-pressed changes)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const filterGroup = page.getByRole("group", {
      name: "Card type filters",
    });
    const artifactChip = filterGroup.getByRole("button", {
      name: /Artifact/,
    });

    await expect(artifactChip).toHaveAttribute("aria-pressed", "true");
    await artifactChip.click();
    await expect(artifactChip).toHaveAttribute("aria-pressed", "false");

    // Click again to re-enable
    await artifactChip.click();
    await expect(artifactChip).toHaveAttribute("aria-pressed", "true");
  });

  test("subtitle updates when filters change", async ({ deckPage }) => {
    const { page } = deckPage;
    const subtitle = page.getByTestId("curve-subtitle");

    // All enabled: "3 non-land spells by converted mana cost"
    await expect(subtitle).toHaveText(
      "3 non-land spells by converted mana cost"
    );

    // Disable Artifact (Sol Ring) — 2 of 3
    const filterGroup = page.getByRole("group", {
      name: "Card type filters",
    });
    await filterGroup.getByRole("button", { name: /Artifact/ }).click();

    await expect(subtitle).toHaveText(
      "2 of 3 non-land spells by converted mana cost"
    );
  });
});

test.describe("Deck Analysis — Color Distribution", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
      })
    );
    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
  });

  test("Color Distribution heading visible on Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await expect(
      page.getByRole("heading", { name: "Color Distribution" })
    ).toBeVisible();
  });

  test("color distribution chart has role=img with accessible label", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const chart = page.locator('[role="img"][aria-label*="color distribution" i]');
    await expect(chart).toBeVisible();
  });

  test("stat pills visible with land count, avg CMC, and colorless sources", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await expect(page.getByTestId("stat-land-count")).toBeVisible();
    await expect(page.getByTestId("stat-avg-cmc")).toBeVisible();
    await expect(page.getByTestId("stat-colorless-sources")).toBeVisible();
  });

  test("land count stat shows correct value from mock data", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Mock has 1 Command Tower (land) + 3 non-land = 4 total
    const landStat = page.getByTestId("stat-land-count");
    await expect(landStat).toContainText("1");
  });

  test("colorless sources stat shows correct value", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Mock has Sol Ring producing colorless
    const stat = page.getByTestId("stat-colorless-sources");
    await expect(stat).toContainText("1");
  });
});
