import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock data — reused from possible-additions / additions-pairing specs
// ---------------------------------------------------------------------------

const MOCK_ENRICH_RESPONSE = {
  cards: {
    "Atraxa, Praetors' Voice": {
      name: "Atraxa, Praetors' Voice",
      manaCost: "{G}{W}{U}{B}",
      cmc: 4,
      colorIdentity: ["W", "U", "B", "G"],
      colors: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature — Phyrexian Angel Horror",
      supertypes: ["Legendary"],
      subtypes: ["Phyrexian", "Angel", "Horror"],
      oracleText:
        "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
      keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
      power: "4",
      toughness: "4",
      loyalty: null,
      rarity: "mythic",
      imageUris: null,
      manaPips: { W: 1, U: 1, B: 1, R: 0, G: 1, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 10.0, usdFoil: 20.0, eur: 8.0 },
      setCode: "cm2",
      collectorNumber: "10",
      layout: "normal",
      cardFaces: [
        {
          name: "Atraxa, Praetors' Voice",
          manaCost: "{G}{W}{U}{B}",
          typeLine: "Legendary Creature — Phyrexian Angel Horror",
          oracleText:
            "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
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
      prices: { usd: 1.5, usdFoil: 5.0, eur: 1.0 },
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
      prices: { usd: 0.25, usdFoil: 1.0, eur: 0.2 },
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
    "Arcane Signet": {
      name: "Arcane Signet",
      manaCost: "{2}",
      cmc: 2,
      colorIdentity: [],
      colors: [],
      typeLine: "Artifact",
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
      prices: { usd: 0.5, usdFoil: 2.0, eur: 0.4 },
      setCode: "eld",
      collectorNumber: "331",
      layout: "normal",
      cardFaces: [
        {
          name: "Arcane Signet",
          manaCost: "{2}",
          typeLine: "Artifact",
          oracleText:
            "{T}: Add one mana of any color in your commander's color identity.",
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
      prices: { usd: 2.0, usdFoil: 6.0, eur: 1.5 },
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
      prices: { usd: 1.0, usdFoil: 3.0, eur: 0.8 },
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

const PATH_TO_EXILE_RESPONSE = {
  cards: {
    "Path to Exile": {
      name: "Path to Exile",
      manaCost: "{W}",
      cmc: 1,
      colorIdentity: ["W"],
      colors: ["W"],
      typeLine: "Instant",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Exile target creature. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
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
      prices: { usd: 3.0, usdFoil: 8.0, eur: 2.5 },
      setCode: "mm3",
      collectorNumber: "17",
      layout: "normal",
      cardFaces: [
        {
          name: "Path to Exile",
          manaCost: "{W}",
          typeLine: "Instant",
          oracleText:
            "Exile target creature. Its controller searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.",
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

async function setupMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/deck-enrich", async (route) => {
    const body = await route.request().postDataJSON();
    const names: string[] = body.cardNames ?? [];
    if (names.includes("Path to Exile")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PATH_TO_EXILE_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    }
  });

  await page.route("**/api/commander-spellbook*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
    })
  );
}

async function setupAutocomplete(
  page: import("@playwright/test").Page,
  suggestions: string[]
) {
  await page.route("**/api/card-autocomplete*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ suggestions }),
    });
  });
}

async function importDeckPairAndOpenCompare(
  deckPage: import("./fixtures").DeckPage,
  page: import("@playwright/test").Page
) {
  await setupMocks(page);
  await deckPage.goto();
  await deckPage.fillDecklist(SAMPLE_DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  await expect(
    page.locator('[aria-label="Mana cost: 1 generic"]')
  ).toBeVisible({ timeout: 15_000 });

  await deckPage.selectDeckViewTab("Additions");
  await setupAutocomplete(page, ["Path to Exile"]);

  // Add a candidate
  const searchInput = page.locator("#card-search-input");
  await searchInput.fill("Pat");
  const option = page.getByRole("option", { name: "Path to Exile" });
  await option.waitFor({ timeout: 5_000 });
  await option.click();

  const panel = page.locator("#tabpanel-deck-additions");
  await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
    timeout: 5_000,
  });

  // Pair via "Pick from your deck"
  const pickButton = panel.getByRole("button", {
    name: /Pick from your deck/,
  });
  await expect(pickButton).toBeVisible({ timeout: 5_000 });
  await pickButton.click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 3_000 });
  const solRingBtn = sheet.getByRole("button", { name: "Sol Ring" }).first();
  await expect(solRingBtn).toBeVisible({ timeout: 3_000 });
  await solRingBtn.click();
  await expect(sheet).not.toBeVisible({ timeout: 3_000 });

  // Navigate to compare
  const cta = panel.getByRole("button", { name: /Update Reading/ });
  await expect(cta).toBeEnabled({ timeout: 5_000 });
  await cta.click();
  await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

  await expect(
    page.locator("[data-testid='comparison-panel-mana-curve']")
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("EditModifiedDeckSheet bugs", () => {
  test("focus stays on search input after typing in PairWithCutSheet", async ({
    deckPage,
    page,
  }) => {
    await importDeckPairAndOpenCompare(deckPage, page);

    // Set up autocomplete for the search inside Edit modified deck sheet
    await setupAutocomplete(page, ["Lightning Bolt"]);

    const editBtn = page.getByRole("button", { name: /Edit modified deck/ });
    await editBtn.click();

    const editDialog = page.getByRole("dialog", {
      name: /Edit Modified Deck/,
    });
    await expect(editDialog).toBeVisible({ timeout: 3_000 });

    // Search for a new card to add — picking it opens PairWithCutSheet
    const addSearchInput = editDialog.locator("#card-search-input");
    await addSearchInput.click();
    await addSearchInput.fill("Lig");
    const option = page.getByRole("option", { name: "Lightning Bolt" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    // PairWithCutSheet opens with title "Pick a card to cut"
    const pairDialog = page.getByRole("dialog", {
      name: /Pick a card to cut/,
    });
    await expect(pairDialog).toBeVisible({ timeout: 3_000 });

    const searchInput = pairDialog.locator("#pair-cut-search");
    await expect(searchInput).toBeVisible();

    await searchInput.click();
    await expect(searchInput).toBeFocused();

    // Each keystroke triggers PairWithCutSheet's local query state to update;
    // focus must remain on the input (regression: it used to snap to the
    // close button because the inline onClose prop changed identity, causing
    // Sheet's lifecycle effect to re-run and re-focus the first focusable).
    await page.keyboard.type("S", { delay: 50 });
    await expect(searchInput).toBeFocused();
    await page.keyboard.type("o", { delay: 50 });
    await expect(searchInput).toBeFocused();
    await page.keyboard.type("l", { delay: 50 });
    await expect(searchInput).toBeFocused();
  });

  test("body scroll is restored after closing the modal", async ({
    deckPage,
    page,
  }) => {
    await importDeckPairAndOpenCompare(deckPage, page);

    const initialOverflow = await page.evaluate(
      () => document.body.style.overflow
    );

    const editBtn = page.getByRole("button", { name: /Edit modified deck/ });
    await editBtn.click();

    const dialog = page.getByRole("dialog", { name: /Edit Modified Deck/ });
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // While open, body should be locked
    const lockedOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(lockedOverflow).toBe("hidden");

    // Close the sheet via the close button
    const closeBtn = dialog.getByRole("button", { name: /Close sheet/ });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });

    // Body overflow should be restored to the initial value (allowing scroll)
    const restoredOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(restoredOverflow).toBe(initialOverflow);
  });

  test("body scroll is restored after the PairWithCutSheet flow closes", async ({
    deckPage,
    page,
  }) => {
    await importDeckPairAndOpenCompare(deckPage, page);
    await setupAutocomplete(page, ["Lightning Bolt"]);

    const initialOverflow = await page.evaluate(
      () => document.body.style.overflow
    );

    const editBtn = page.getByRole("button", { name: /Edit modified deck/ });
    await editBtn.click();
    const editDialog = page.getByRole("dialog", {
      name: /Edit Modified Deck/,
    });
    await expect(editDialog).toBeVisible({ timeout: 3_000 });

    // Pick a new card → opens PairWithCutSheet
    const addSearchInput = editDialog.locator("#card-search-input");
    await addSearchInput.fill("Lig");
    const option = page.getByRole("option", { name: "Lightning Bolt" });
    await option.waitFor({ timeout: 5_000 });
    await option.click();

    const pairDialog = page.getByRole("dialog", {
      name: /Pick a card to cut/,
    });
    await expect(pairDialog).toBeVisible({ timeout: 3_000 });

    // Pick a card to cut → both sheets close
    const cutBtn = pairDialog.getByRole("button", { name: /Counterspell/ });
    await cutBtn.click();
    await expect(pairDialog).not.toBeVisible({ timeout: 3_000 });

    // EditModifiedDeck sheet may still be open — close it
    if (await editDialog.isVisible()) {
      const closeBtn = editDialog.getByRole("button", { name: /Close sheet/ });
      await closeBtn.click();
      await expect(editDialog).not.toBeVisible({ timeout: 3_000 });
    }

    // Body overflow should be restored
    const restoredOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(restoredOverflow).toBe(initialOverflow);
  });
});
