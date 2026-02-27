import { test, expect } from "./fixtures";

/**
 * Mock enrichment response with cards that include a known combo (Thoracle).
 */
const MOCK_ENRICH_RESPONSE = {
  cards: {
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
      prices: { usd: null, usdFoil: null, eur: null },
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
      prices: { usd: null, usdFoil: null, eur: null },
    },
    "Dramatic Reversal": {
      name: "Dramatic Reversal",
      manaCost: "{1}{U}",
      cmc: 2,
      colorIdentity: ["U"],
      colors: ["U"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText: "Untap all nonland permanents you control.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: {
        small: "https://cards.scryfall.io/small/front/d/c/dcb59045.jpg",
        normal: "https://cards.scryfall.io/normal/front/d/c/dcb59045.jpg",
        large: "https://cards.scryfall.io/large/front/d/c/dcb59045.jpg",
      },
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
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

/**
 * Mock Commander Spellbook response with exact and near combos.
 */
const MOCK_SPELLBOOK_RESPONSE = {
  exactCombos: [
    {
      id: "spell-exact-1",
      cards: ["Thassa's Oracle", "Demonic Consultation"],
      description:
        "Cast Demonic Consultation naming a card not in your deck, then cast Thassa's Oracle to win the game.",
      produces: ["Win the game"],
      missingCards: [],
      templateRequirements: [],
      manaNeeded: "{U}{U}{B}",
      bracketTag: "4",
      identity: "UB",
      type: "exact" as const,
    },
  ],
  nearCombos: [
    {
      id: "spell-near-1",
      cards: ["Dramatic Reversal", "Isochron Scepter"],
      description:
        "Imprint Dramatic Reversal on Isochron Scepter for infinite mana with 3+ mana from nonland sources.",
      produces: ["Infinite mana", "Infinite untap"],
      missingCards: ["Isochron Scepter"],
      templateRequirements: [],
      manaNeeded: "{1}{U}",
      bracketTag: "4",
      identity: "U",
      type: "near" as const,
    },
  ],
};

const MOCK_SPELLBOOK_EMPTY_RESPONSE = {
  exactCombos: [],
  nearCombos: [],
};

const SPELLBOOK_DECKLIST = [
  "1 Thassa's Oracle",
  "1 Demonic Consultation",
  "1 Dramatic Reversal",
  "1 Sol Ring",
  "1 Command Tower",
].join("\n");

test.describe("Spellbook Verified Combos", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;

    // Mock enrichment API
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    // Mock spellbook combos API
    await page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SPELLBOOK_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(SPELLBOOK_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Synergy");
  });

  test("Verified Combos section appears in Synergy tab when spellbook returns combos", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("verified-combos");
    await expect(
      page.getByTestId("verified-combos-section")
    ).toBeVisible();
  });

  test("exact combos display card names, description, and produces", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("verified-combos");
    const section = page.getByTestId("verified-combos-section");

    // Should show the combo card names
    await expect(
      section.getByText("Thassa's Oracle + Demonic Consultation")
    ).toBeVisible();

    // Should show description
    await expect(
      section.getByText(/Cast Demonic Consultation naming/)
    ).toBeVisible();

    // Should show produces
    const produces = section.getByTestId("combo-produces");
    await expect(produces).toBeVisible();
    await expect(produces.getByText("Win the game")).toBeVisible();
  });

  test("near combos display with missing cards highlighted", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("near-combos");
    const section = page.getByTestId("near-combos-section");

    // Should show the near combo card names
    await expect(
      section.getByText("Dramatic Reversal + Isochron Scepter")
    ).toBeVisible();

    // Missing card should be highlighted
    await expect(
      section.getByTestId("missing-card-Isochron Scepter")
    ).toBeVisible();
  });

  test("expanding a verified combo shows card images", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("verified-combos");
    const section = page.getByTestId("verified-combos-section");

    // Find combo item and expand it
    const comboItem = section.getByTestId("verified-combo-item-0");
    const button = comboItem.getByRole("button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    // Should show card images
    await expect(comboItem.getByTestId("combo-card-images")).toBeVisible();
  });

  test("combo count stat card reflects spellbook combo count", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("synergy-stats");
    const comboStat = page.getByTestId("stat-combo-count");
    // Should show at least "1" for spellbook combos
    await expect(comboStat).not.toContainText("0");
  });

  test("empty state when no combos found", async ({ deckPage }) => {
    const { page } = deckPage;

    // Navigate fresh with empty spellbook response
    await page.unroute("**/api/deck-combos");
    await page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SPELLBOOK_EMPTY_RESPONSE),
      })
    );

    // Navigate to fresh page to avoid strict mode violations
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring\n1 Command Tower");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Synergy");

    // The verified-combos panel should still exist but show empty message
    await deckPage.expandSynergySection("verified-combos");
    await expect(
      page.getByText("No verified combos found")
    ).toBeVisible();
  });

  test("near combo missing card has distinct visual treatment (amber text)", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.expandSynergySection("near-combos");
    const missingCard = page.getByTestId("missing-card-Isochron Scepter");
    await expect(missingCard).toBeVisible();
    // The element should use amber styling (we check the class)
    await expect(missingCard).toHaveClass(/amber/);
  });
});

test.describe("Spellbook Graceful Fallback", () => {
  test("when spellbook API fails, local combos still display", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Mock enrichment
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    // Mock spellbook to return error (graceful degradation response)
    await page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exactCombos: [],
          nearCombos: [],
          error: "Commander Spellbook unavailable",
        }),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Thassa's Oracle\n1 Demonic Consultation\n1 Sol Ring\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });
    await deckPage.selectDeckViewTab("Synergy");

    // Local combos should still be visible in synergy-pairs section
    await deckPage.expandSynergySection("synergy-pairs");
    const synergyPairs = page.getByTestId("synergy-pairs");
    await expect(synergyPairs).toBeVisible();
    // The local combo should still show up
    await expect(
      synergyPairs.getByText("Thassa's Oracle + Demonic Consultation")
    ).toBeVisible();
  });

  test("loading state shown while spellbook request is pending", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Mock enrichment to complete immediately
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    // Hold the spellbook request in flight
    let releaseSpellbook: (() => void) | null = null;
    await page.route("**/api/deck-combos", async (route) => {
      await new Promise<void>((resolve) => {
        releaseSpellbook = resolve;
        setTimeout(resolve, 500);
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SPELLBOOK_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist(SPELLBOOK_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label*="Mana cost"]').first()
    ).toBeVisible({ timeout: 10_000 });

    await deckPage.selectDeckViewTab("Synergy");
    await deckPage.expandSynergySection("verified-combos");

    // Loading shimmer should be visible
    await expect(
      page.getByTestId("spellbook-loading")
    ).toBeVisible();

    // Release the spellbook request
    releaseSpellbook?.();

    // After loading completes, combos should appear
    await expect(
      page.getByTestId("verified-combos-section")
    ).toBeVisible({ timeout: 10_000 });
  });
});
