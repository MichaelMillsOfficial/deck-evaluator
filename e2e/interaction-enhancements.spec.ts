import { test, expect } from "./fixtures";

/**
 * Reuse the same mock enrichment data from interactions-tab.spec.ts.
 * These six cards produce clear mechanical interactions via the client-side
 * interaction engine:
 *   - Viscera Seer + Blood Artist: sacrifice outlet triggers death drain
 *   - Viscera Seer + Reassembling Skeleton: sacrifice loop with recursion
 *   - Rest in Peace: blocker that disrupts graveyard interactions
 */
const MOCK_INTERACTIONS_RESPONSE = {
  cards: {
    "Viscera Seer": {
      name: "Viscera Seer",
      manaCost: "{B}",
      cmc: 1,
      colorIdentity: ["B"],
      colors: ["B"],
      typeLine: "Creature — Vampire Wizard",
      supertypes: [],
      subtypes: ["Vampire", "Wizard"],
      oracleText: "Sacrifice a creature: Scry 1.",
      keywords: [],
      power: "1",
      toughness: "1",
      loyalty: null,
      rarity: "common",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/b/b/bbd94119.jpg",
        normal: "https://cards.scryfall.io/normal/front/b/b/bbd94119.jpg",
        large: "https://cards.scryfall.io/large/front/b/b/bbd94119.jpg",
      },
      manaPips: { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "m11",
      collectorNumber: "117",
      layout: "normal",
      cardFaces: [
        {
          name: "Viscera Seer",
          manaCost: "{B}",
          typeLine: "Creature — Vampire Wizard",
          oracleText: "Sacrifice a creature: Scry 1.",
          power: "1",
          toughness: "1",
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Blood Artist": {
      name: "Blood Artist",
      manaCost: "{1}{B}",
      cmc: 2,
      colorIdentity: ["B"],
      colors: ["B"],
      typeLine: "Creature — Vampire",
      supertypes: [],
      subtypes: ["Vampire"],
      oracleText:
        "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      keywords: [],
      power: "0",
      toughness: "1",
      loyalty: null,
      rarity: "uncommon",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/4/6/465d8c18.jpg",
        normal: "https://cards.scryfall.io/normal/front/4/6/465d8c18.jpg",
        large: "https://cards.scryfall.io/large/front/4/6/465d8c18.jpg",
      },
      manaPips: { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "avr",
      collectorNumber: "86",
      layout: "normal",
      cardFaces: [
        {
          name: "Blood Artist",
          manaCost: "{1}{B}",
          typeLine: "Creature — Vampire",
          oracleText:
            "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
          power: "0",
          toughness: "1",
          loyalty: null,
          imageUris: null,
        },
      ],
    },
    "Reassembling Skeleton": {
      name: "Reassembling Skeleton",
      manaCost: "{1}{B}",
      cmc: 2,
      colorIdentity: ["B"],
      colors: ["B"],
      typeLine: "Creature — Skeleton Warrior",
      supertypes: [],
      subtypes: ["Skeleton", "Warrior"],
      oracleText:
        "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
      keywords: [],
      power: "1",
      toughness: "1",
      loyalty: null,
      rarity: "uncommon",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/a/3/a3d4ac21.jpg",
        normal: "https://cards.scryfall.io/normal/front/a/3/a3d4ac21.jpg",
        large: "https://cards.scryfall.io/large/front/a/3/a3d4ac21.jpg",
      },
      manaPips: { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "m19",
      collectorNumber: "116",
      layout: "normal",
      cardFaces: [
        {
          name: "Reassembling Skeleton",
          manaCost: "{1}{B}",
          typeLine: "Creature — Skeleton Warrior",
          oracleText:
            "{1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.",
          power: "1",
          toughness: "1",
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
    "Rest in Peace": {
      name: "Rest in Peace",
      manaCost: "{1}{W}",
      cmc: 2,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Enchantment",
      supertypes: [],
      subtypes: [],
      oracleText:
        "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "rare",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/9/f/9f2b39be.jpg",
        normal: "https://cards.scryfall.io/normal/front/9/f/9f2b39be.jpg",
        large: "https://cards.scryfall.io/large/front/9/f/9f2b39be.jpg",
      },
      manaPips: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      prices: { usd: null, usdFoil: null, eur: null },
      isGameChanger: false,
      setCode: "rtr",
      collectorNumber: "18",
      layout: "normal",
      cardFaces: [
        {
          name: "Rest in Peace",
          manaCost: "{1}{W}",
          typeLine: "Enchantment",
          oracleText:
            "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
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

const INTERACTIONS_DECKLIST = [
  "1 Viscera Seer",
  "1 Blood Artist",
  "1 Reassembling Skeleton",
  "1 Sol Ring",
  "1 Rest in Peace",
  "1 Command Tower",
].join("\n");

const MOCK_SPELLBOOK_RESPONSE = {
  exactCombos: [],
  nearCombos: [],
};

// ---------------------------------------------------------------------------
// Shared setup: mock APIs, import deck, navigate to Interactions tab, and
// wait for the interaction engine to finish running client-side.
// ---------------------------------------------------------------------------

async function setupInteractionsTab(deckPage: import("./fixtures").DeckPage) {
  const { page } = deckPage;

  await page.route("**/api/deck-enrich", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_INTERACTIONS_RESPONSE),
    })
  );
  await page.route("**/api/deck-combos", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SPELLBOOK_RESPONSE),
    })
  );

  await deckPage.goto();
  await deckPage.fillDecklist(INTERACTIONS_DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Wait for enrichment symbols to confirm enrichment completed
  await expect(page.locator('[aria-label*="Mana cost"]').first()).toBeVisible({
    timeout: 10_000,
  });

  await deckPage.selectDeckViewTab("Interactions");
  await deckPage.waitForInteractionsPanel();
}

// ---------------------------------------------------------------------------
// Centrality Ranking tests
// ---------------------------------------------------------------------------

test.describe("Centrality Ranking panel", () => {
  test("centrality panel exists and is collapsible after interactions load", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // The centrality panel is rendered by CollapsiblePanel with testId="centrality-panel"
    const centralityPanel = page.getByTestId("centrality-panel");
    await expect(centralityPanel).toBeVisible({ timeout: 10_000 });
  });

  test("expanding centrality panel shows the ranking table", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand the centrality + removal impact collapsible section
    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });
  });

  test("centrality table contains card name rows", async ({ deckPage }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    // The table must have at least one data row
    const rows = rankingTable.locator("[data-testid='centrality-row']");
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("centrality rows show category badges from the expected label set", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    // Each row contains one of the four centrality category badge labels
    const validLabels = [
      "Makes Your Deck Tick",
      "Solid Fit",
      "Light Connection",
      "No Connections",
    ];

    const rows = rankingTable.locator("[data-testid='centrality-row']");
    const firstRowText = await rows.first().textContent();
    expect(
      validLabels.some((label) => firstRowText?.includes(label))
    ).toBe(true);
  });

  test("centrality table is sorted: rank 1 appears before rank 2", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    const rows = rankingTable.locator("[data-testid='centrality-row']");
    const rowCount = await rows.count();

    // There should be multiple rows for a meaningful sort check
    if (rowCount >= 2) {
      const firstCellText = await rows.nth(0).locator("td").nth(0).textContent();
      const secondCellText = await rows.nth(1).locator("td").nth(0).textContent();
      // Rank column (first td) should show ascending integers
      expect(Number(firstCellText?.trim())).toBeLessThan(
        Number(secondCellText?.trim())
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Removal Impact Inspector tests
// ---------------------------------------------------------------------------

test.describe("Removal Impact Inspector", () => {
  test("removal impact inspector is visible after selecting a card in the centrality panel", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    // Floating panel should not be visible before selecting a card
    const floatingPanel = page.getByTestId("removal-impact-floating-panel");
    await expect(floatingPanel).not.toBeVisible();

    // Click the first centrality row to open the floating panel
    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });
    const firstRow = rankingTable.locator("[data-testid='centrality-row']").first();
    await firstRow.click();

    // Inspector should now be visible inside the floating panel
    const inspector = page.getByTestId("removal-impact-inspector");
    await expect(inspector).toBeVisible({ timeout: 5_000 });
  });

  test("clicking a centrality row updates the removal impact inspector", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    // Click the first row to select a card
    const firstRow = rankingTable.locator("[data-testid='centrality-row']").first();
    const selectedCardName = await firstRow.getAttribute("data-card");
    await firstRow.click();

    // Inspector should now show the selected card's removal summary
    const inspector = page.getByTestId("removal-impact-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText(selectedCardName ?? "");
  });

  test("removal impact inspector shows Hard to Replace or Safe to Swap badge", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    // Select the top-ranked card (most connections — most likely "Hard to Replace")
    const firstRow = rankingTable.locator("[data-testid='centrality-row']").first();
    await firstRow.click();

    const inspector = page.getByTestId("removal-impact-inspector");

    // The badge carries an aria-label describing replaceability
    const badge = inspector.locator(
      '[aria-label="This card is hard to replace"], [aria-label="This card is safe to swap"]'
    );
    await expect(badge).toBeVisible();
  });

  test("removal impact inspector shows a description summary", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const { page } = deckPage;

    // Expand centrality panel (uses custom testId, not panel-${id} pattern)
    {
      const panel = deckPage.page.getByTestId("centrality-panel");
      await panel.waitFor({ timeout: 10_000 });
      const btn = panel.locator("button").first();
      const expanded = await btn.getAttribute("aria-expanded");
      if (expanded !== "true") await btn.click();
    }

    const rankingTable = page.getByTestId("centrality-ranking");
    await expect(rankingTable).toBeVisible({ timeout: 5_000 });

    await rankingTable.locator("[data-testid='centrality-row']").first().click();

    const summary = page.getByTestId("removal-impact-summary");
    await expect(summary).toBeVisible();
    // Summary text should be non-empty
    const text = await summary.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Citation tests
// ---------------------------------------------------------------------------

test.describe("Interaction Citation toggle", () => {
  test("interaction items expose a Show rules text toggle button", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const panel = deckPage.interactionsPanel;

    // Expand the interactions section to reveal items
    await deckPage.expandInteractionsSection("ie-interactions");

    // At least one interaction item must have a citation toggle
    const citationToggle = panel
      .locator("[data-testid='show-citations-toggle']")
      .first();
    await expect(citationToggle).toBeVisible({ timeout: 5_000 });
  });

  test("citation toggle button is collapsed by default (aria-expanded=false)", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const panel = deckPage.interactionsPanel;

    await deckPage.expandInteractionsSection("ie-interactions");

    const citationToggle = panel
      .locator("[data-testid='show-citations-toggle']")
      .first();
    await expect(citationToggle).toBeVisible({ timeout: 5_000 });
    await expect(citationToggle).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking Show rules text expands the citation section", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const panel = deckPage.interactionsPanel;

    await deckPage.expandInteractionsSection("ie-interactions");

    const citationToggle = panel
      .locator("[data-testid='show-citations-toggle']")
      .first();
    await expect(citationToggle).toBeVisible({ timeout: 5_000 });

    await citationToggle.click();

    // Toggle should now indicate expanded
    await expect(citationToggle).toHaveAttribute("aria-expanded", "true");

    // At least one citation blockquote should be present
    const citation = panel.locator("[data-testid='interaction-citation']").first();
    await expect(citation).toBeVisible({ timeout: 5_000 });
  });

  test("citation blockquote contains oracle text snippet from one of the interacting cards", async ({
    deckPage,
  }) => {
    await setupInteractionsTab(deckPage);
    const panel = deckPage.interactionsPanel;

    await deckPage.expandInteractionsSection("ie-interactions");

    const citationToggle = panel
      .locator("[data-testid='show-citations-toggle']")
      .first();
    await expect(citationToggle).toBeVisible({ timeout: 5_000 });
    await citationToggle.click();

    const citation = panel.locator("[data-testid='interaction-citation']").first();
    await expect(citation).toBeVisible({ timeout: 5_000 });

    // The citation must include a card attribution — one of the known card names
    const knownCards = [
      "Viscera Seer",
      "Blood Artist",
      "Reassembling Skeleton",
      "Sol Ring",
      "Rest in Peace",
      "Command Tower",
    ];
    const citationText = await citation.textContent();
    expect(
      knownCards.some((card) => citationText?.includes(card))
    ).toBe(true);
  });
});
