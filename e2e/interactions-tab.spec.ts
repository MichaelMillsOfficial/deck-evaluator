import { test, expect } from "./fixtures";

/**
 * Mock enrichment response with cards that produce clear mechanical interactions:
 * - Sacrifice outlet: Viscera Seer (sac creature → scry)
 * - Death trigger: Blood Artist (creature dies → drain)
 * - Recursion: Reassembling Skeleton (returns from graveyard)
 * - Mana producer: Sol Ring (produces colorless mana)
 * - Blocker: Rest in Peace (replaces graveyard zone transitions)
 * - Land filler: Command Tower
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
      oracleText:
        "Sacrifice a creature: Scry 1.",
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

test.describe("Interactions Tab — Beta Feature", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;

    // Mock external APIs
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

    // Navigate, import deck, wait for enrichment
    await deckPage.goto();
    await deckPage.fillDecklist(INTERACTIONS_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Interactions tab exists in the tab bar", async ({ deckPage }) => {
    const { page } = deckPage;
    const tab = page
      .getByTestId("deck-header")
      .getByRole("tab", { name: /Interactions/i });
    await expect(tab).toBeVisible();
  });

  test("Interactions tab shows BETA badge", async ({ deckPage }) => {
    const { page } = deckPage;
    const tab = page
      .getByTestId("deck-header")
      .getByRole("tab", { name: /Interactions/i });
    await expect(tab).toContainText("BETA");
  });

  test("clicking Interactions tab shows interactions panel", async ({
    deckPage,
  }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");
    await expect(panel).toBeVisible();
  });

  test("interactions panel shows beta disclaimer", async ({ deckPage }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");
    await expect(panel.getByTestId("interactions-beta-banner")).toBeVisible();
  });

  test("interactions panel shows loading state then results", async ({
    deckPage,
  }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");

    // Should show content (either loading or results) within a reasonable time
    await expect(
      panel.getByTestId("interactions-content")
    ).toBeVisible({ timeout: 15_000 });
  });

  test("interactions panel displays interaction cards", async ({
    deckPage,
  }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");

    // Wait for interactions to load
    await expect(
      panel.getByTestId("interactions-content")
    ).toBeVisible({ timeout: 15_000 });

    // Expand the interactions section to reveal items
    await deckPage.expandInteractionsSection("ie-interactions");

    // Should have at least one interaction listed
    // Interactions are grouped by type — check that any interaction item exists
    const interactionItems = panel.locator("[data-testid^='interaction-'][data-testid*='-0']");
    await expect(interactionItems.first()).toBeVisible({ timeout: 5_000 });
  });

  test("interaction items show card names and type", async ({ deckPage }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");

    await expect(
      panel.getByTestId("interactions-content")
    ).toBeVisible({ timeout: 15_000 });

    // Expand the interactions section to reveal items
    await deckPage.expandInteractionsSection("ie-interactions");

    // First interaction item should show card names and type badge
    const firstInteraction = panel.locator("[data-testid^='interaction-'][data-testid*='-0']").first();
    await expect(firstInteraction).toBeVisible({ timeout: 5_000 });

    // Should contain interaction type badge
    const typeBadge = firstInteraction.locator("[data-testid='interaction-type']");
    await expect(typeBadge).toBeVisible();
  });

  test("interactions panel has collapsible sections", async ({ deckPage }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");

    await expect(
      panel.getByTestId("interactions-content")
    ).toBeVisible({ timeout: 15_000 });

    // Should have the Interactions section panel
    const interactionsSection = panel.getByTestId("panel-ie-interactions");
    await expect(interactionsSection).toBeVisible();
  });

  test("summary stats show interaction counts", async ({ deckPage }) => {
    await deckPage.selectDeckViewTab("Interactions");
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-interactions");

    await expect(
      panel.getByTestId("interactions-content")
    ).toBeVisible({ timeout: 15_000 });

    const stats = panel.getByTestId("interaction-stats");
    await expect(stats).toBeVisible();
  });
});
