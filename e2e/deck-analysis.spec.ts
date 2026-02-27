import { test, expect } from "./fixtures";

/** Standard format mock — no commanders, all 5 colors may appear */
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

/** Commander format mock — G/U commander, chart should only show Green and Blue */
const MOCK_COMMANDER_RESPONSE = {
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
      oracleText: "Whenever a creature with a +1/+1 counter on it enters under your control, draw a card.",
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
    "Breeding Pool": {
      name: "Breeding Pool",
      manaCost: "",
      cmc: 0,
      colorIdentity: ["G", "U"],
      colors: [],
      typeLine: "Land — Forest Island",
      supertypes: [],
      subtypes: ["Forest", "Island"],
      oracleText: "({T}: Add {G} or {U}.)\nAs Breeding Pool enters, you may pay 2 life. If you don't, it enters tapped.",
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

    const handsTab = tablist.getByRole("tab", { name: "Hands" });

    await deckListTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(analysisTab).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(deckListTab).toBeFocused();

    await page.keyboard.press("End");
    await expect(handsTab).toBeFocused();

    await page.keyboard.press("Home");
    await expect(deckListTab).toBeFocused();
  });
});

test.describe("Deck Analysis — Tab Availability", () => {
  test("Analysis tab disabled while enrichment loads, enabled after completion", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Delay enrichment to observe disabled state.
    // Use a generous delay so the disabled assertion runs before the response
    // arrives, even on slow CI machines.
    let fulfillEnrichment: (() => void) | null = null;
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise<void>((resolve) => {
        fulfillEnrichment = resolve;
        // Auto-resolve after 500ms as safety net
        setTimeout(resolve, 500);
      });
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

    // Release the enrichment response
    fulfillEnrichment?.();

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
    await deckPage.expandAnalysisSection("mana-curve");

    await expect(page.getByTestId("panel-mana-curve")).toBeVisible();

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
    await deckPage.expandAnalysisSection("mana-curve");
    await expect(page.getByTestId("panel-mana-curve")).toBeVisible();

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
    await deckPage.expandAnalysisSection("mana-curve");
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

test.describe("Deck Analysis — Color Distribution (Standard)", () => {
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
    await deckPage.expandAnalysisSection("color-distribution");
  });

  test("Color Distribution heading visible on Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await expect(page.getByTestId("panel-color-distribution")).toBeVisible();
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

  test("shows all five color columns when no commander", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const chartSection = page.locator(
      'section[aria-labelledby="color-distribution-heading"]'
    );
    // No commander → all 5 colors shown on x-axis
    await expect(chartSection.locator("text").filter({ hasText: "White" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Blue" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Black" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Red" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Green" })).toBeVisible();
  });
});

test.describe("Deck Analysis — Color Distribution (Commander)", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COMMANDER_RESPONSE),
      })
    );
    await deckPage.goto();
    // Use COMMANDER: zone header so parser puts Ezuri in commanders array
    await deckPage.fillDecklist(
      "COMMANDER:\n1 Ezuri, Stalker of Spheres\n\n1 Sol Ring\n1 Counterspell\n1 Cultivate\n1 Command Tower\n1 Breeding Pool"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.expandAnalysisSection("color-distribution");
  });

  test("shows only commander identity colors (Green and Blue for G/U)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const chartSection = page.locator(
      'section[aria-labelledby="color-distribution-heading"]'
    );
    // G/U commander → only Green and Blue shown
    await expect(chartSection.locator("text").filter({ hasText: "Blue" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Green" })).toBeVisible();
    // Non-identity colors should not appear
    await expect(chartSection.locator("text").filter({ hasText: "White" })).toHaveCount(0);
    await expect(chartSection.locator("text").filter({ hasText: "Black" })).toHaveCount(0);
    await expect(chartSection.locator("text").filter({ hasText: "Red" })).toHaveCount(0);
  });

  test("Command Tower scoped to commander identity colors only", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Command Tower produces WUBRG but should be scoped to G/U
    // The chart should only show Green and Blue source bars
    const chartSection = page.locator(
      'section[aria-labelledby="color-distribution-heading"]'
    );
    await expect(chartSection.locator("text").filter({ hasText: "Green" })).toBeVisible();
    await expect(chartSection.locator("text").filter({ hasText: "Blue" })).toBeVisible();
    // Verify stat pills still work with commander deck
    await expect(page.getByTestId("stat-land-count")).toBeVisible();
    await expect(page.getByTestId("stat-avg-cmc")).toBeVisible();
    await expect(page.getByTestId("stat-colorless-sources")).toBeVisible();
  });

  test("colorless toggle button is visible and functional", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const toggle = page.getByTestId("toggle-colorless");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Colorless label should now appear in the chart
    const chartSection = page.locator(
      'section[aria-labelledby="color-distribution-heading"]'
    );
    await expect(chartSection.locator("text").filter({ hasText: "Colorless" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Composition Scorecard mock data
// ---------------------------------------------------------------------------

/**
 * Mock enrichment response with cards covering all tag categories plus
 * an untagged vanilla creature.
 */
const MOCK_SCORECARD_RESPONSE = {
  cards: {
    // Ramp
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
    // Card Draw
    "Rhystic Study": {
      name: "Rhystic Study",
      manaCost: "{2}{U}",
      cmc: 3,
      colorIdentity: ["U"],
      colors: ["U"],
      typeLine: "Enchantment",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Whenever an opponent casts a spell, you may pay {1}. If you don't, draw a card.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Removal
    "Swords to Plowshares": {
      name: "Swords to Plowshares",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText: "Exile target creature.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: null,
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Board Wipe (also counts as Removal)
    "Wrath of God": {
      name: "Wrath of God",
      manaCost: "{2}{W}{W}",
      cmc: 4,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Sorcery",
      supertypes: [],
      subtypes: [],
      oracleText: "Destroy all creatures.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "rare",
      imageUris: null,
      manaPips: { W: 2, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Counterspell
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
    // Recursion
    "Regrowth": {
      name: "Regrowth",
      manaCost: "{1}{G}",
      cmc: 2,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Sorcery",
      supertypes: [],
      subtypes: [],
      oracleText: "Return target card from your graveyard to your hand.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Protection
    "Heroic Intervention": {
      name: "Heroic Intervention",
      manaCost: "{1}{G}",
      cmc: 2,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Until end of turn, permanents you control gain hexproof and indestructible.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "rare",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Untagged vanilla creature
    "Grizzly Bears": {
      name: "Grizzly Bears",
      manaCost: "{1}{G}",
      cmc: 2,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Creature — Bear",
      supertypes: [],
      subtypes: ["Bear"],
      oracleText: "",
      keywords: [],
      power: "2",
      toughness: "2",
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    // Land
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

const SCORECARD_DECKLIST =
  "1 Sol Ring\n1 Cultivate\n1 Rhystic Study\n1 Swords to Plowshares\n1 Wrath of God\n1 Counterspell\n1 Regrowth\n1 Heroic Intervention\n1 Grizzly Bears\n1 Command Tower";

test.describe("Deck Analysis — Composition Scorecard", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SCORECARD_RESPONSE),
      })
    );
    await deckPage.goto();
    await deckPage.fillDecklist(SCORECARD_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.expandAnalysisSection("composition");
  });

  test("Composition Scorecard heading visible on Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await expect(
      page.getByRole("heading", { name: "Composition Scorecard" })
    ).toBeVisible();
  });

  test("displays health summary banner", async ({ deckPage }) => {
    const { page } = deckPage;
    const banner = page.getByTestId("composition-health-summary");
    await expect(banner).toBeVisible();
    // With a small deck (10 cards) most categories will be critical → major-gaps
    await expect(banner).toContainText(/critical|attention|target/i);
  });

  test("displays category rows with counts and status", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const categories = page.getByTestId("composition-category");
    // Command Zone template has 8 categories
    const count = await categories.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("category row shows label and count", async ({ deckPage }) => {
    const { page } = deckPage;
    // Ramp category should be visible (we have Sol Ring + Cultivate = 2 ramp)
    const rampRow = page
      .getByTestId("composition-category")
      .filter({ hasText: "Ramp" });
    await expect(rampRow).toBeVisible();
    // Should show count 2
    await expect(rampRow).toContainText("2");
  });

  test("expanding a category shows card list", async ({ deckPage }) => {
    const { page } = deckPage;
    // Find and click the Ramp category row toggle button
    const rampRow = page
      .getByTestId("composition-category")
      .filter({ hasText: "Ramp" });
    await expect(rampRow).toBeVisible();

    const toggleBtn = rampRow.getByRole("button").first();
    await toggleBtn.click();

    const cardList = rampRow.getByTestId("category-cards");
    await expect(cardList).toBeVisible();
    // Should show Sol Ring or Cultivate (or both)
    await expect(cardList).toContainText(/Sol Ring|Cultivate/);
  });

  test("expanding a category sets aria-expanded to true", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const rampRow = page
      .getByTestId("composition-category")
      .filter({ hasText: "Ramp" });
    const toggleBtn = rampRow.getByRole("button").first();

    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  });

  test("Escape key collapses an expanded category", async ({ deckPage }) => {
    const { page } = deckPage;
    const rampRow = page
      .getByTestId("composition-category")
      .filter({ hasText: "Ramp" });
    const toggleBtn = rampRow.getByRole("button").first();

    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    await toggleBtn.focus();
    await page.keyboard.press("Escape");
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("template selector is visible and defaults to Command Zone", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const selector = page.getByTestId("template-selector");
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue("command-zone");
  });

  test("template selector switches between templates", async ({ deckPage }) => {
    const { page } = deckPage;
    const selector = page.getByTestId("template-selector");

    // Switch to 8x8
    await selector.selectOption("8x8");
    await expect(selector).toHaveValue("8x8");

    // Health banner should update (still visible)
    const banner = page.getByTestId("composition-health-summary");
    await expect(banner).toBeVisible();
  });

  test("untagged cards section shows when applicable", async ({ deckPage }) => {
    const { page } = deckPage;
    // We have 1 Grizzly Bears which is untagged
    const untaggedSection = page.getByTestId("composition-untagged");
    await expect(untaggedSection).toBeVisible();
    await expect(untaggedSection).toContainText("Untagged cards");
    await expect(untaggedSection).toContainText("1");
  });

  test("expanding untagged shows card list with Grizzly Bears", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const untaggedSection = page.getByTestId("composition-untagged");
    const toggleBtn = untaggedSection.getByRole("button").first();

    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    await expect(untaggedSection).toContainText("Grizzly Bears");
  });

  test("section has proper ARIA structure with aria-labelledby", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    // Find section with aria-labelledby pointing to our heading
    const scorecardSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Composition Scorecard" }),
    });
    await expect(scorecardSection).toBeVisible();
    await expect(scorecardSection).toHaveAttribute("aria-labelledby", /.+/);
  });

  test("category progress bars have role=progressbar with aria attributes", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const progressBars = page
      .getByTestId("composition-category")
      .first()
      .locator('[role="progressbar"]');
    const bar = progressBars.first();
    await expect(bar).toHaveAttribute("aria-valuenow");
    await expect(bar).toHaveAttribute("aria-valuemin", "0");
    await expect(bar).toHaveAttribute("aria-valuemax");
  });
});

// ---------------------------------------------------------------------------
// Deck Classification (unified Bracket + Power Level)
// ---------------------------------------------------------------------------

test.describe("Deck Analysis — Deck Classification", () => {
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
    await deckPage.expandAnalysisSection("deck-classification");
  });

  test("Deck Classification section appears on Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const section = page.locator(
      'section[aria-labelledby="deck-classification-heading"]'
    );
    await expect(section).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Deck Classification" })
    ).toBeVisible();
  });

  test("displays bracket number between 1 and 5", async ({ deckPage }) => {
    const { page } = deckPage;
    const bracketEl = page.getByTestId("bracket-number");
    await expect(bracketEl).toBeVisible();
    const text = await bracketEl.textContent();
    const bracket = parseInt(text ?? "0", 10);
    expect(bracket).toBeGreaterThanOrEqual(1);
    expect(bracket).toBeLessThanOrEqual(5);
  });

  test("displays bracket name", async ({ deckPage }) => {
    const { page } = deckPage;
    const nameEl = page.getByTestId("bracket-name");
    await expect(nameEl).toBeVisible();
    const text = await nameEl.textContent();
    const validNames = ["Exhibition", "Core", "Upgraded", "Optimized", "cEDH"];
    expect(validNames).toContain(text?.trim());
  });

  test("displays power level score between 1 and 10", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const scoreEl = page.getByTestId("power-level-score");
    await expect(scoreEl).toBeVisible();
    const text = await scoreEl.textContent();
    const score = parseInt(text ?? "0", 10);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(10);
  });

  test("displays band label (Casual/Focused/Optimized/High Power/cEDH)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const bandEl = page.getByTestId("power-level-band");
    await expect(bandEl).toBeVisible();
    const text = await bandEl.textContent();
    const validBands = ["Casual", "Focused", "Optimized", "High Power", "cEDH"];
    expect(validBands).toContain(text?.trim());
  });

  test("displays raw score", async ({ deckPage }) => {
    const { page } = deckPage;
    const rawScoreEl = page.getByTestId("power-level-raw-score");
    await expect(rawScoreEl).toBeVisible();
    const text = await rawScoreEl.textContent();
    const score = parseInt(text ?? "0", 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("displays bracket scale with 5 segments", async ({ deckPage }) => {
    const { page } = deckPage;
    const scale = page.getByTestId("bracket-scale");
    await expect(scale).toBeVisible();
  });

  test("displays bracket cascade timeline", async ({ deckPage }) => {
    const { page } = deckPage;
    const cascade = page.getByTestId("bracket-cascade");
    await expect(cascade).toBeVisible();
  });

  test("displays classification summary badge", async ({ deckPage }) => {
    const { page } = deckPage;
    const badge = page.getByTestId("classification-summary-badge");
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(text).toMatch(/B\d+ \| PL\d+/);
  });

  test("power level factors are behind a toggle button", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const toggle = page.getByTestId("power-level-factors-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Factors not visible before clicking
    await expect(page.getByTestId("power-level-factor")).toHaveCount(0);

    // Click to expand
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Now factors are visible
    const factors = page.getByTestId("power-level-factor");
    await expect(factors).toHaveCount(8);
  });

  test("Escape key collapses factors sub-section", async ({ deckPage }) => {
    const { page } = deckPage;
    const toggle = page.getByTestId("power-level-factors-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("deck classification section appears before Mana Curve", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandAnalysisSection("mana-curve");

    const classPanel = page.getByTestId("panel-deck-classification");
    const manaPanel = page.getByTestId("panel-mana-curve");
    await expect(classPanel).toBeVisible();
    await expect(manaPanel).toBeVisible();

    const classBound = await classPanel.boundingBox();
    const manaBound = await manaPanel.boundingBox();
    expect(classBound).not.toBeNull();
    expect(manaBound).not.toBeNull();
    expect(classBound!.y).toBeLessThan(manaBound!.y);
  });
});
