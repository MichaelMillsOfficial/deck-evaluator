import { test, expect } from "./fixtures";

/**
 * Mock enrichment response with cards that have clear synergy patterns:
 * - Counters theme: Hardened Scales, Walking Ballista, Doubling Season
 * - Graveyard vs Graveyard Hate anti-synergy: Reanimate vs Rest in Peace
 * - Known combo: Thassa's Oracle + Demonic Consultation
 */
const MOCK_SYNERGY_RESPONSE = {
  cards: {
    "Hardened Scales": {
      name: "Hardened Scales",
      manaCost: "{G}",
      cmc: 1,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Enchantment",
      supertypes: [],
      subtypes: [],
      oracleText:
        "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "rare",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/0/1/01323d2b.jpg",
        normal: "https://cards.scryfall.io/normal/front/0/1/01323d2b.jpg",
        large: "https://cards.scryfall.io/large/front/0/1/01323d2b.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    "Walking Ballista": {
      name: "Walking Ballista",
      manaCost: "{X}{X}",
      cmc: 0,
      colorIdentity: [],
      colors: [],
      typeLine: "Artifact Creature — Construct",
      supertypes: [],
      subtypes: ["Construct"],
      oracleText:
        "Walking Ballista enters the battlefield with X +1/+1 counters on it.\n{4}: Put a +1/+1 counter on Walking Ballista.\nRemove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.",
      keywords: [],
      power: "0",
      toughness: "0",
      loyalty: null,
      rarity: "rare",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/3/2/329a8738.jpg",
        normal: "https://cards.scryfall.io/normal/front/3/2/329a8738.jpg",
        large: "https://cards.scryfall.io/large/front/3/2/329a8738.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    "Doubling Season": {
      name: "Doubling Season",
      manaCost: "{4}{G}",
      cmc: 5,
      colorIdentity: ["G"],
      colors: ["G"],
      typeLine: "Enchantment",
      supertypes: [],
      subtypes: [],
      oracleText:
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "mythic",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/8/6/8676d164.jpg",
        normal: "https://cards.scryfall.io/normal/front/8/6/8676d164.jpg",
        large: "https://cards.scryfall.io/large/front/8/6/8676d164.jpg",
      },
      manaPips: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    Reanimate: {
      name: "Reanimate",
      manaCost: "{B}",
      cmc: 1,
      colorIdentity: ["B"],
      colors: ["B"],
      typeLine: "Sorcery",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/6/5/652271a0.jpg",
        normal: "https://cards.scryfall.io/normal/front/6/5/652271a0.jpg",
        large: "https://cards.scryfall.io/large/front/6/5/652271a0.jpg",
      },
      manaPips: { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
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
    },
    "Thassa's Oracle": {
      name: "Thassa's Oracle",
      manaCost: "{U}{U}",
      cmc: 2,
      colorIdentity: ["U"],
      colors: ["U"],
      typeLine: "Creature — Merfolk Wizard",
      supertypes: [],
      subtypes: ["Merfolk", "Wizard"],
      oracleText:
        "When Thassa's Oracle enters the battlefield, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of your library in a random order. If X is greater than or equal to the number of cards in your library, you win the game.",
      keywords: [],
      power: "1",
      toughness: "3",
      loyalty: null,
      rarity: "rare",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/7/2/726e8b29.jpg",
        normal: "https://cards.scryfall.io/normal/front/7/2/726e8b29.jpg",
        large: "https://cards.scryfall.io/large/front/7/2/726e8b29.jpg",
      },
      manaPips: { W: 0, U: 2, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
    },
    "Demonic Consultation": {
      name: "Demonic Consultation",
      manaCost: "{B}",
      cmc: 1,
      colorIdentity: ["B"],
      colors: ["B"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Name a card. Exile the top six cards of your library, then reveal cards from the top of your library until you reveal the named card. Put that card into your hand and exile all other cards revealed this way.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "uncommon",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/1/d/1d779f19.jpg",
        normal: "https://cards.scryfall.io/normal/front/1/d/1d779f19.jpg",
        large: "https://cards.scryfall.io/large/front/1/d/1d779f19.jpg",
      },
      manaPips: { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 },
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

const SYNERGY_DECKLIST = [
  "1 Hardened Scales",
  "1 Walking Ballista",
  "1 Doubling Season",
  "1 Reanimate",
  "1 Rest in Peace",
  "1 Thassa's Oracle",
  "1 Demonic Consultation",
  "1 Command Tower",
].join("\n");

test.describe("Deck Analysis — Card Synergy", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SYNERGY_RESPONSE),
      })
    );
    await deckPage.goto();
    await deckPage.fillDecklist(SYNERGY_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Synergy");
  });

  test("clicking Synergy tab shows synergy section", async ({ deckPage }) => {
    const { page } = deckPage;
    await expect(
      page.getByRole("heading", { name: "Card Synergy", exact: true })
    ).toBeVisible();
  });

  test("synergy section renders on its own tab panel", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const panel = page.locator("#tabpanel-deck-synergy");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Card Synergy", exact: true })
    ).toBeVisible();
  });

  test("Analysis tab no longer contains synergy heading", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.selectDeckViewTab("Analysis");
    const analysisPanel = page.locator("#tabpanel-deck-analysis");
    await expect(
      analysisPanel.getByRole("heading", { name: "Card Synergy", exact: true })
    ).toHaveCount(0);
  });

  test("deck theme pills render for a themed deck", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("themes");
    const themes = page.getByTestId("deck-themes");
    await expect(themes).toBeVisible();
    // Should show at least one theme pill (Counters is expected)
    const pills = themes.locator("[data-testid^='theme-pill-']");
    await expect(pills.first()).toBeVisible();
  });

  test("synergy stat cards show values", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    await expect(page.getByTestId("stat-avg-synergy")).toBeVisible();
    await expect(page.getByTestId("stat-combo-count")).toBeVisible();
    await expect(page.getByTestId("stat-anti-synergy-count")).toBeVisible();
  });

  test("known combos count shows at least 1 (Thoracle + Consultation)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const comboStat = page.getByTestId("stat-combo-count");
    // Should show at least "1" for the Thoracle combo
    await expect(comboStat).not.toContainText("0");
  });

  test("anti-synergy count shows at least 1 (Rest in Peace vs Reanimate)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const antiStat = page.getByTestId("stat-anti-synergy-count");
    await expect(antiStat).not.toContainText("0");
  });

  test("top synergy pairs list is visible", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-pairs");
    const synergyList = page.getByTestId("synergy-pairs");
    await expect(synergyList).toBeVisible();
  });

  test("anti-synergy warnings render with amber/warning styling", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("anti-synergies");
    const antiList = page.getByTestId("anti-synergy-pairs");
    await expect(antiList).toBeVisible();
    // Should contain at least one warning item
    const items = antiList.locator("[data-testid^='pair-item-']");
    await expect(items.first()).toBeVisible();
  });

  test("per-card synergy table is visible with score badges", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("card-scores");
    const table = page.getByTestId("card-synergy-table");
    await expect(table).toBeVisible();
    // Should have score badges
    const badges = table.locator("[data-testid^='synergy-score-']");
    await expect(badges.first()).toBeVisible();
  });

  test("stat cards are expandable — Avg Synergy shows score bands", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const avgCard = page.getByTestId("stat-avg-synergy");
    const button = avgCard.getByRole("button");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // Should show score band breakdown
    await expect(avgCard.getByTestId("score-band-breakdown")).toBeVisible();
  });

  test("stat cards are expandable — Known Combos lists combo details", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const comboCard = page.getByTestId("stat-combo-count");
    const button = comboCard.getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(comboCard.getByTestId("combo-detail-list")).toBeVisible();
  });

  test("stat cards are expandable — Anti-Synergies lists pair details", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const antiCard = page.getByTestId("stat-anti-synergy-count");
    const button = antiCard.getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(
      antiCard.getByTestId("anti-synergy-detail-list")
    ).toBeVisible();
  });

  test("stat card collapses on Escape key", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const avgCard = page.getByTestId("stat-avg-synergy");
    const button = avgCard.getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await button.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("pair items are expandable to show card images", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-pairs");
    // Find a synergy pair item and expand it
    const pairItem = page
      .getByTestId("synergy-pairs")
      .locator("[data-testid^='pair-item-']")
      .first();
    const button = pairItem.getByRole("button");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // Should show card images or card names
    await expect(pairItem.getByTestId("pair-card-images")).toBeVisible();
  });

  test("pair item card images show for cards with imageUris", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-pairs");
    const pairItem = page
      .getByTestId("synergy-pairs")
      .locator("[data-testid^='pair-item-']")
      .first();
    const button = pairItem.getByRole("button");
    await button.click();
    const images = pairItem.getByTestId("pair-card-images").locator("img");
    // At least one image should be visible (cards with imageUris)
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });

  test("pair item collapses on Escape key", async ({ deckPage }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-pairs");
    const pairItem = page
      .getByTestId("synergy-pairs")
      .locator("[data-testid^='pair-item-']")
      .first();
    const button = pairItem.getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await button.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
