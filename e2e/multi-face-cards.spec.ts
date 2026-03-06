import { test, expect, DeckPage } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock enrichment responses for multi-face cards
// ---------------------------------------------------------------------------

const MOCK_CARDS = {
  // Transform DFC — dual images, back face has no mana cost
  "Delver of Secrets": {
    name: "Delver of Secrets // Insectile Aberration",
    manaCost: "{U}",
    cmc: 1,
    colorIdentity: ["U"],
    colors: ["U"],
    typeLine: "Creature — Human Wizard // Creature — Human Insect",
    supertypes: [],
    subtypes: ["Human", "Wizard"],
    oracleText:
      "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.\n\nFlying",
    keywords: ["Transform"],
    power: "1",
    toughness: "1",
    loyalty: null,
    rarity: "common",
    imageUris: null,
    manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "isd",
    collectorNumber: "51",
    layout: "transform",
    cardFaces: [
      {
        name: "Delver of Secrets",
        manaCost: "{U}",
        typeLine: "Creature — Human Wizard",
        oracleText:
          "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.",
        power: "1",
        toughness: "1",
        loyalty: null,
        imageUris: null,
      },
      {
        name: "Insectile Aberration",
        manaCost: "",
        typeLine: "Creature — Human Insect",
        oracleText: "Flying",
        power: "3",
        toughness: "2",
        loyalty: null,
        imageUris: null,
      },
    ],
  },

  // Modal DFC — dual images, both faces have mana costs
  "Esika, God of the Tree": {
    name: "Esika, God of the Tree // The Prismatic Bridge",
    manaCost: "{1}{G}{G}",
    cmc: 3,
    colorIdentity: ["W", "U", "B", "R", "G"],
    colors: ["G"],
    typeLine: "Legendary Creature — God // Legendary Enchantment",
    supertypes: ["Legendary"],
    subtypes: ["God"],
    oracleText:
      'Vigilance\nOther legendary creatures you control have vigilance and "{T}: Add one mana of any color."\n\nAt the beginning of your upkeep, reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.',
    keywords: ["Vigilance"],
    power: "1",
    toughness: "4",
    loyalty: null,
    rarity: "mythic",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 0, G: 2, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "khm",
    collectorNumber: "168",
    layout: "modal_dfc",
    cardFaces: [
      {
        name: "Esika, God of the Tree",
        manaCost: "{1}{G}{G}",
        typeLine: "Legendary Creature — God",
        oracleText:
          'Vigilance\nOther legendary creatures you control have vigilance and "{T}: Add one mana of any color."',
        power: "1",
        toughness: "4",
        loyalty: null,
        imageUris: null,
      },
      {
        name: "The Prismatic Bridge",
        manaCost: "{W}{U}{B}{R}{G}",
        typeLine: "Legendary Enchantment",
        oracleText:
          "At the beginning of your upkeep, reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
    ],
  },

  // Adventure — shared image, inline display
  "Bonecrusher Giant": {
    name: "Bonecrusher Giant // Stomp",
    manaCost: "{2}{R} // {1}{R}",
    cmc: 3,
    colorIdentity: ["R"],
    colors: ["R"],
    typeLine: "Creature — Giant // Instant — Adventure",
    supertypes: [],
    subtypes: ["Giant"],
    oracleText:
      "Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell's controller.\n\nDamage can't be prevented this turn. Stomp deals 2 damage to any target.",
    keywords: [],
    power: "4",
    toughness: "3",
    loyalty: null,
    rarity: "rare",
    imageUris: null,
    manaPips: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
    producedMana: [],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "eld",
    collectorNumber: "115",
    layout: "adventure",
    cardFaces: [
      {
        name: "Bonecrusher Giant",
        manaCost: "{2}{R}",
        typeLine: "Creature — Giant",
        oracleText:
          "Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell's controller.",
        power: "4",
        toughness: "3",
        loyalty: null,
        imageUris: null,
      },
      {
        name: "Stomp",
        manaCost: "{1}{R}",
        typeLine: "Instant — Adventure",
        oracleText:
          "Damage can't be prevented this turn. Stomp deals 2 damage to any target.",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
    ],
  },

  // Normal single-face card — baseline
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
};

const MOCK_ENRICH_RESPONSE = {
  cards: MOCK_CARDS,
  notFound: [],
};

const MULTI_FACE_DECKLIST =
  "1 Delver of Secrets\n1 Esika, God of the Tree\n1 Bonecrusher Giant\n1 Sol Ring";

// ---------------------------------------------------------------------------
// Helper: set up mocked enrichment and import the decklist
// ---------------------------------------------------------------------------

async function importMultiFaceDeck(deckPage: DeckPage) {
  const { page } = deckPage;

  await page.route("**/api/deck-enrich", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ENRICH_RESPONSE),
    })
  );

  await deckPage.goto();
  await deckPage.fillDecklist(MULTI_FACE_DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Wait for enrichment to complete (type lines appear)
  await expect(
    deckPage.deckDisplay.getByRole("cell", { name: "Artifact" })
  ).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Multi-face card display", () => {
  test("transform DFC shows face tabs when expanded", async ({ deckPage }) => {
    await importMultiFaceDeck(deckPage);

    const delverButton = deckPage.page.getByRole("button", {
      name: /Delver of Secrets/,
    });
    await delverButton.click();
    await expect(delverButton).toHaveAttribute("aria-expanded", "true");

    // Should show tab buttons with face names
    const tabList = deckPage.page.getByRole("tablist", { name: "Card faces" });
    await expect(tabList).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Delver of Secrets" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Insectile Aberration" })).toBeVisible();

    // Front face tab should be active by default
    await expect(
      tabList.getByRole("tab", { name: "Delver of Secrets" })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("clicking second tab shows back-face details", async ({ deckPage }) => {
    await importMultiFaceDeck(deckPage);

    // Expand Delver
    await deckPage.page.getByRole("button", { name: /Delver of Secrets/ }).click();

    const tabList = deckPage.page.getByRole("tablist", { name: "Card faces" });

    // Click back face tab
    await tabList.getByRole("tab", { name: "Insectile Aberration" }).click();

    // Back face details should be visible
    const backFace = deckPage.page.getByTestId("face-detail-Insectile-Aberration");
    await expect(backFace).toBeVisible();
    await expect(backFace.getByText("Creature — Human Insect")).toBeVisible();
    await expect(backFace.getByText("Flying")).toBeVisible();
    await expect(backFace.getByText("P/T: 3/2")).toBeVisible();
  });

  test("modal DFC shows face tabs with both face names", async ({ deckPage }) => {
    await importMultiFaceDeck(deckPage);

    await deckPage.page.getByRole("button", { name: /Esika, God of the Tree/ }).click();

    const tabList = deckPage.page.getByRole("tablist", { name: "Card faces" });
    await expect(tabList).toBeVisible();
    await expect(
      tabList.getByRole("tab", { name: "Esika, God of the Tree" })
    ).toBeVisible();
    await expect(
      tabList.getByRole("tab", { name: "The Prismatic Bridge" })
    ).toBeVisible();
  });

  test("modal DFC back face shows its own mana cost", async ({ deckPage }) => {
    await importMultiFaceDeck(deckPage);

    await deckPage.page.getByRole("button", { name: /Esika, God of the Tree/ }).click();

    const tabList = deckPage.page.getByRole("tablist", { name: "Card faces" });
    await tabList.getByRole("tab", { name: "The Prismatic Bridge" }).click();

    const backFace = deckPage.page.getByTestId(
      "face-detail-The-Prismatic-Bridge"
    );
    await expect(backFace).toBeVisible();
    await expect(backFace.getByText("Legendary Enchantment")).toBeVisible();
    // The Prismatic Bridge's oracle text
    await expect(
      backFace.getByText(/reveal cards from the top/)
    ).toBeVisible();
  });

  test("adventure card shows inline display with both halves visible", async ({
    deckPage,
  }) => {
    await importMultiFaceDeck(deckPage);

    await deckPage.page
      .getByRole("button", { name: /Bonecrusher Giant/ })
      .click();

    // Should NOT show tabs
    await expect(
      deckPage.page.getByRole("tablist", { name: "Card faces" })
    ).toHaveCount(0);

    // Both faces should have detail sections visible simultaneously
    const creatureFace = deckPage.page.getByTestId("face-detail-Bonecrusher-Giant");
    const adventureFace = deckPage.page.getByTestId("face-detail-Stomp");
    await expect(creatureFace).toBeVisible();
    await expect(adventureFace).toBeVisible();

    // Both faces' oracle text should be visible simultaneously
    await expect(
      creatureFace.getByText(/2 damage to that spell's controller/)
    ).toBeVisible();
    await expect(
      adventureFace.getByText(/Damage can't be prevented/)
    ).toBeVisible();
  });

  test("normal card does not show tabs or face labels", async ({
    deckPage,
  }) => {
    await importMultiFaceDeck(deckPage);

    await deckPage.page.getByRole("button", { name: "Sol Ring" }).click();

    // No tabs
    await expect(
      deckPage.page.getByRole("tablist", { name: "Card faces" })
    ).toHaveCount(0);

    // Stats row renders directly (not inside face detail sections)
    const detailRow = deckPage.page.locator("#card-detail-Sol-Ring");
    await expect(detailRow).toBeVisible();
    await expect(detailRow.getByText("Rarity: uncommon")).toBeVisible();
  });

  test("face tab content includes type line and P/T for front face", async ({
    deckPage,
  }) => {
    await importMultiFaceDeck(deckPage);

    await deckPage.page.getByRole("button", { name: /Delver of Secrets/ }).click();

    const frontFace = deckPage.page.getByTestId(
      "face-detail-Delver-of-Secrets"
    );
    await expect(frontFace).toBeVisible();
    await expect(frontFace.getByText("Creature — Human Wizard")).toBeVisible();
    await expect(frontFace.getByText("P/T: 1/1")).toBeVisible();
    await expect(
      frontFace.getByText(/transform Delver of Secrets/)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// MDFC land annotation in mana curve
// ---------------------------------------------------------------------------

const MDFC_LAND_CARDS = {
  "Emeria's Call": {
    name: "Emeria's Call // Emeria, Shattered Skyclave",
    manaCost: "{4}{W}{W}{W}",
    cmc: 7,
    colorIdentity: ["W"],
    colors: ["W"],
    typeLine: "Sorcery // Land",
    supertypes: [],
    subtypes: [],
    oracleText:
      "Create two 4/4 white Angel Warrior creature tokens with flying. Non-Angel creatures you control gain indestructible until your next turn.\n\nAs Emeria, Shattered Skyclave enters the battlefield, you may pay 3 life. If you don't, it enters the battlefield tapped.\n{T}: Add {W}.",
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    rarity: "mythic",
    imageUris: null,
    manaPips: { W: 3, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: ["W"],
    flavorName: null,
    isGameChanger: false,
    prices: { usd: null, usdFoil: null, eur: null },
    setCode: "znr",
    collectorNumber: "12",
    layout: "modal_dfc",
    cardFaces: [
      {
        name: "Emeria's Call",
        manaCost: "{4}{W}{W}{W}",
        typeLine: "Sorcery",
        oracleText:
          "Create two 4/4 white Angel Warrior creature tokens with flying. Non-Angel creatures you control gain indestructible until your next turn.",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
      {
        name: "Emeria, Shattered Skyclave",
        manaCost: "",
        typeLine: "Land",
        oracleText:
          "As Emeria, Shattered Skyclave enters the battlefield, you may pay 3 life. If you don't, it enters the battlefield tapped.\n{T}: Add {W}.",
        power: null,
        toughness: null,
        loyalty: null,
        imageUris: null,
      },
    ],
  },
  "Sol Ring": MOCK_CARDS["Sol Ring"],
};

const MDFC_LAND_DECKLIST = "1 Emeria's Call\n1 Sol Ring";

test.describe("MDFC land annotation", () => {
  test("mana curve shows MDFC land count annotation", async ({ deckPage }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cards: MDFC_LAND_CARDS, notFound: [] }),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(MDFC_LAND_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      deckPage.deckDisplay.getByRole("cell", { name: "Artifact" })
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to Analysis tab and expand Mana Curve
    await deckPage.selectDeckViewTab("Analysis");
    await deckPage.expandAnalysisSection("mana-curve");

    // Annotation should be visible
    const annotation = page.getByTestId("mdfc-land-annotation");
    await expect(annotation).toBeVisible();
    await expect(annotation).toHaveText(
      "1 card in this curve is also MDFC land"
    );
  });
});
