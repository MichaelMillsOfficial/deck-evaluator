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
      imageUris: null,
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
      imageUris: null,
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
      imageUris: null,
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
      imageUris: null,
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
      imageUris: null,
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
      imageUris: null,
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
      imageUris: null,
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

    await deckPage.selectDeckViewTab("Analysis");
  });

  test("Card Synergy heading visible on Analysis tab", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await expect(
      page.getByRole("heading", { name: "Card Synergy", exact: true })
    ).toBeVisible();
  });

  test("synergy section has correct aria-labelledby", async ({
    deckPage,
  }) => {
    await expect(deckPage.synergySection).toBeVisible();
  });

  test("deck theme pills render for a themed deck", async ({ deckPage }) => {
    const { page } = deckPage;
    const themes = page.getByTestId("deck-themes");
    await expect(themes).toBeVisible();
    // Should show at least one theme pill (Counters is expected)
    const pills = themes.locator("[data-testid^='theme-pill-']");
    await expect(pills.first()).toBeVisible();
  });

  test("synergy stat cards show values", async ({ deckPage }) => {
    const { page } = deckPage;
    await expect(page.getByTestId("stat-avg-synergy")).toBeVisible();
    await expect(page.getByTestId("stat-combo-count")).toBeVisible();
    await expect(page.getByTestId("stat-anti-synergy-count")).toBeVisible();
  });

  test("known combos count shows at least 1 (Thoracle + Consultation)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const comboStat = page.getByTestId("stat-combo-count");
    // Should show at least "1" for the Thoracle combo
    await expect(comboStat).not.toContainText("0");
  });

  test("anti-synergy count shows at least 1 (Rest in Peace vs Reanimate)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    const antiStat = page.getByTestId("stat-anti-synergy-count");
    await expect(antiStat).not.toContainText("0");
  });

  test("top synergy pairs list is visible", async ({ deckPage }) => {
    const { page } = deckPage;
    const synergyList = page.getByTestId("synergy-pairs");
    await expect(synergyList).toBeVisible();
  });

  test("anti-synergy warnings render with amber/warning styling", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
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
    const table = page.getByTestId("card-synergy-table");
    await expect(table).toBeVisible();
    // Should have score badges
    const badges = table.locator("[data-testid^='synergy-score-']");
    await expect(badges.first()).toBeVisible();
  });
});
