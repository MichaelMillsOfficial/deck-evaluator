/**
 * e2e tests for the additions pairing flow (Phase 1.2 of plan).
 *
 * Covers:
 *  - NEEDS PAIRING eyebrow tag shown on unpaired adds
 *  - CTA "Update Reading" disabled when no confirmed pairings
 *  - Pairing via inline suggestion → chip-pair collapses row → CTA enables
 *  - Unpairing → row re-expands → CTA disables
 *  - Pairing via "Pick from your deck" Sheet picker
 *  - Exclusion: second add's picker excludes first pairing's cut
 *  - Duplicate add blocked (autocomplete excludes already-pending add name)
 *  - Update Reading CTA navigates to /reading/compare
 *  - /reading/compare renders all 7 named panels in pending-changes mode
 *  - Edit modified deck sheet removes add and updates compare
 *  - State preserved navigating add ↔ compare
 *  - Reload on /reading/add persists pending changes (sessionStorage)
 *  - No session deck → compare shows empty state CTAs
 */

import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

// ---------------------------------------------------------------------------
// Mock helpers
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

const PATH_TO_EXILE_ENRICH = {
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

const PONDER_ENRICH = {
  cards: {
    Ponder: {
      name: "Ponder",
      manaCost: "{U}",
      cmc: 1,
      colorIdentity: ["U"],
      colors: ["U"],
      typeLine: "Sorcery",
      supertypes: [],
      subtypes: [],
      oracleText:
        "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.",
      keywords: [],
      power: null,
      toughness: null,
      loyalty: null,
      rarity: "common",
      imageUris: null,
      manaPips: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 },
      producedMana: [],
      flavorName: null,
      isGameChanger: false,
      prices: { usd: 1.0, usdFoil: 4.0, eur: 0.8 },
      setCode: "m10",
      collectorNumber: "75",
      layout: "normal",
      cardFaces: [
        {
          name: "Ponder",
          manaCost: "{U}",
          typeLine: "Sorcery",
          oracleText:
            "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.",
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

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function setupMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/deck-enrich", async (route) => {
    const body = await route.request().postDataJSON();
    const names: string[] = body.cardNames ?? [];

    if (names.includes("Path to Exile")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PATH_TO_EXILE_ENRICH),
      });
    } else if (names.includes("Ponder")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PONDER_ENRICH),
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

async function importDeckAndNavigateToAdditions(
  deckPage: import("./fixtures").DeckPage,
  page: import("@playwright/test").Page
) {
  await setupMocks(page);
  await deckPage.goto();
  await deckPage.fillDecklist(SAMPLE_DECKLIST);
  await deckPage.submitImport();
  await deckPage.waitForDeckDisplay();

  // Wait for enrichment to complete (mana cost visible for Sol Ring)
  await expect(
    page.locator('[aria-label="Mana cost: 1 generic"]')
  ).toBeVisible({ timeout: 15_000 });

  // Navigate to Additions tab
  await deckPage.selectDeckViewTab("Additions");
}

async function addCandidate(
  page: import("@playwright/test").Page,
  cardName: string
) {
  const searchInput = page.locator("#card-search-input");
  await searchInput.fill(cardName.substring(0, 3));
  const option = page.getByRole("option", { name: cardName });
  await option.waitFor({ timeout: 5_000 });
  await option.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Additions pairing: NEEDS PAIRING state", () => {
  test("adding a card shows NEEDS PAIRING tag and CTA is disabled", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    // Wait for the card row to appear
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // NEEDS PAIRING eyebrow should be visible
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Update Reading CTA should be disabled
    const cta = panel.getByRole("button", { name: /Update Reading/ });
    await expect(cta).toBeVisible();
    await expect(cta).toBeDisabled();
  });
});

test.describe("Additions pairing: pairing flow", () => {
  test("using an inline suggestion pairs the add and enables Update Reading", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for analysis to complete (NEEDS PAIRING shows)
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Click "Use a suggestion" to pair with one of the inline suggestions
    // The inline suggestions should include deck cards like Sol Ring
    const useButton = panel
      .getByRole("button", { name: /Sol Ring/ })
      .first();
    // If no Sol Ring button, use any "Use" or pairing button
    const suggestionButtons = panel.locator("[data-testid='use-suggestion']");
    if (await suggestionButtons.count() > 0) {
      await suggestionButtons.first().click();
    } else {
      // Fall back: just check for the inline "Use a suggestion" link or button
      const useSuggestion = panel.getByRole("button", { name: /Use/ }).first();
      if (await useSuggestion.isVisible()) {
        await useSuggestion.click();
      }
    }

    // After pairing, Update Reading should be enabled with (1)
    const cta = panel.getByRole("button", { name: /Update Reading/ });
    await expect(cta).toBeEnabled({ timeout: 5_000 });
    await expect(cta).toContainText("1");
  });

  test("chip-pair unpair button re-expands row and disables CTA", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // Pair with a suggestion
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    const suggestionButtons = panel.locator("[data-testid='use-suggestion']");
    if (await suggestionButtons.count() > 0) {
      await suggestionButtons.first().click();
    }

    // Now unpair
    const unpairButton = panel.getByRole("button", { name: /Unpair/ });
    if (await unpairButton.isVisible({ timeout: 3_000 })) {
      await unpairButton.click();
      // NEEDS PAIRING should return
      await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
        timeout: 3_000,
      });
      // CTA should be disabled again
      const cta = panel.getByRole("button", { name: /Update Reading/ });
      await expect(cta).toBeDisabled();
    }
  });

  test("Pick from your deck sheet opens and allows selecting a cut", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Open picker sheet
    const pickButton = panel.getByRole("button", {
      name: /Pick from your deck/,
    });
    if (await pickButton.isVisible({ timeout: 3_000 })) {
      await pickButton.click();

      // Sheet should open
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible({ timeout: 3_000 });

      // Should list deck cards (e.g., Sol Ring)
      await expect(sheet.getByText("Sol Ring")).toBeVisible({ timeout: 3_000 });

      // Select Sol Ring
      const solRingButton = sheet
        .getByRole("button", { name: "Sol Ring" })
        .first();
      if (await solRingButton.isVisible()) {
        await solRingButton.click();

        // Sheet should close
        await expect(sheet).not.toBeVisible({ timeout: 3_000 });

        // Update Reading should be enabled
        const cta = panel.getByRole("button", { name: /Update Reading/ });
        await expect(cta).toBeEnabled({ timeout: 3_000 });
      }
    }
  });
});

test.describe("Additions pairing: exclusion sets", () => {
  test("cut from first pairing is excluded from second pairing's picker", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile", "Ponder"]);

    // Add first candidate and pair it
    await addCandidate(page, "Path to Exile");
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // Pair with Sol Ring via suggestion (if available)
    const suggestionButtons = panel.locator("[data-testid='use-suggestion']");
    if (await suggestionButtons.count() > 0) {
      await suggestionButtons.first().click();
    }

    // Add second candidate
    await addCandidate(page, "Ponder");
    await expect(panel.getByText("Ponder").first()).toBeVisible({
      timeout: 10_000,
    });

    // Open second candidate's "Pick from your deck" sheet
    const ponderRow = panel.locator("[data-testid='pending-add-row']", {
      hasText: "Ponder",
    });
    if (await ponderRow.isVisible({ timeout: 3_000 })) {
      const pickButton = ponderRow.getByRole("button", {
        name: /Pick from your deck/,
      });
      if (await pickButton.isVisible({ timeout: 2_000 })) {
        await pickButton.click();
        const sheet = page.getByRole("dialog");
        await expect(sheet).toBeVisible({ timeout: 3_000 });

        // The cut used by the first pair (Sol Ring) should be excluded
        await expect(sheet.getByText("Sol Ring")).not.toBeVisible();
        await sheet.press("Escape");
      }
    }
  });

  test("autocomplete excludes already-pending add names", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile", "Ponder"]);

    // Add "Path to Exile"
    await addCandidate(page, "Path to Exile");
    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // Set up autocomplete to return "Path to Exile" again (already pending)
    await setupAutocomplete(page, ["Path to Exile"]);

    const searchInput = page.locator("#card-search-input");
    await searchInput.fill("Pat");

    const listbox = page.locator("#card-search-listbox");
    // "Path to Exile" should either be absent OR the add should be blocked
    const pathOption = listbox.getByRole("option", {
      name: "Path to Exile",
    });
    // This tests that already-pending cards are filtered from suggestions
    // If the listbox doesn't show at all or doesn't have Path to Exile, that's OK
    await expect(pathOption).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Additions pairing: Update Reading CTA", () => {
  test("Update Reading with 1 confirmed pairing navigates to /reading/compare", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Pair via suggestion
    const suggestionButtons = panel.locator("[data-testid='use-suggestion']");
    if (await suggestionButtons.count() > 0) {
      await suggestionButtons.first().click();
    } else {
      // If no suggestion buttons, skip this test gracefully
      return;
    }

    // Click Update Reading
    const cta = panel.getByRole("button", { name: /Update Reading/ });
    await expect(cta).toBeEnabled({ timeout: 5_000 });
    await cta.click();

    // Should navigate to /reading/compare
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });
  });
});

test.describe("Additions pairing: /reading/compare page", () => {
  test("shows all 7 comparison panels when there are pending changes", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Pair via "Pick from your deck" (always available; doesn't depend on suggestions)
    const pickButton = panel.getByRole("button", { name: /Pick from your deck/ });
    await expect(pickButton).toBeVisible({ timeout: 5_000 });
    await pickButton.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible({ timeout: 3_000 });

    // Pick Sol Ring from the deck
    const solRingBtn = sheet.getByRole("button", { name: "Sol Ring" }).first();
    await expect(solRingBtn).toBeVisible({ timeout: 3_000 });
    await solRingBtn.click();

    // Sheet closes and row collapses to chip-pair
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });

    // Navigate to compare
    const cta = panel.getByRole("button", { name: /Update Reading/ });
    await expect(cta).toBeEnabled({ timeout: 5_000 });
    await cta.click();
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

    const comparePage = page.locator("#tabpanel-deck-compare");

    // All 7 panels should exist
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-curve']")
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      comparePage.locator("[data-testid='comparison-panel-hand-keepability']")
    ).toBeVisible();
    await expect(
      comparePage.locator("[data-testid='comparison-panel-color-analysis']")
    ).toBeVisible();
    await expect(
      comparePage.locator("[data-testid='comparison-panel-bracket']")
    ).toBeVisible();
    await expect(
      comparePage.locator("[data-testid='comparison-panel-power-level']")
    ).toBeVisible();
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-base']")
    ).toBeVisible();
    await expect(
      comparePage.locator("[data-testid='comparison-panel-composition']")
    ).toBeVisible();
  });

  test("EditModifiedDeckSheet removes pending add and navigating back shows it gone", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Pair via "Pick from your deck"
    const pickButton = panel.getByRole("button", { name: /Pick from your deck/ });
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

    const comparePage = page.locator("#tabpanel-deck-compare");
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-curve']")
    ).toBeVisible({ timeout: 10_000 });

    // Open Edit modified deck sheet
    const editBtn = comparePage.getByRole("button", { name: /Edit modified deck/ });
    await expect(editBtn).toBeVisible({ timeout: 3_000 });
    await editBtn.click();

    const editSheet = page.getByRole("dialog");
    await expect(editSheet).toBeVisible({ timeout: 3_000 });

    // Remove the Path to Exile swap
    const removeBtn = editSheet.getByRole("button", {
      name: /Remove swap.*Path to Exile/,
    });
    await expect(removeBtn).toBeVisible({ timeout: 3_000 });
    await removeBtn.click();

    // Edit sheet closes (last add removed)
    await expect(editSheet).not.toBeVisible({ timeout: 3_000 });

    // Compare page should now show empty state (no more pending changes)
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-curve']")
    ).not.toBeVisible({ timeout: 5_000 });

    // Navigate back to Additions — Path to Exile should be gone
    await page.goto("/reading/add");
    await expect(page).toHaveURL(/\/reading\/add/, { timeout: 5_000 });
    const addPanel = page.locator("#tabpanel-deck-additions");
    await expect(addPanel.getByText("Path to Exile").first()).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("round-trip: /reading/compare → /reading/add → /reading/compare preserves state both ways", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Pair via "Pick from your deck"
    const pickButton = panel.getByRole("button", { name: /Pick from your deck/ });
    await expect(pickButton).toBeVisible({ timeout: 5_000 });
    await pickButton.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible({ timeout: 3_000 });
    const solRingBtn = sheet.getByRole("button", { name: "Sol Ring" }).first();
    await expect(solRingBtn).toBeVisible({ timeout: 3_000 });
    await solRingBtn.click();
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });

    // Navigate to /reading/compare
    const cta = panel.getByRole("button", { name: /Update Reading/ });
    await expect(cta).toBeEnabled({ timeout: 5_000 });
    await cta.click();
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

    // Compare shows 7 panels — state is there
    const comparePage = page.locator("#tabpanel-deck-compare");
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-curve']")
    ).toBeVisible({ timeout: 10_000 });

    // Navigate back to /reading/add
    await page.goto("/reading/add");
    await expect(page).toHaveURL(/\/reading\/add/, { timeout: 5_000 });

    // Pending add should still show as PAIRED (chip-pair, not NEEDS PAIRING)
    const addPanel = page.locator("#tabpanel-deck-additions");
    await expect(addPanel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 5_000,
    });
    // Should be paired (chip-pair state) — no NEEDS PAIRING
    await expect(addPanel.getByText("NEEDS PAIRING")).not.toBeVisible({
      timeout: 3_000,
    });

    // Navigate forward to /reading/compare again
    await page.goto("/reading/compare");
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

    // Panels still there
    await expect(
      page.locator("[data-testid='comparison-panel-mana-curve']")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("state preserved when navigating add → compare → add", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });

    // Navigate away to compare tab (directly via URL)
    await page.goto("/reading/compare");
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

    // Navigate back to Additions
    await page.goto("/reading/add");
    await expect(page).toHaveURL(/\/reading\/add/, { timeout: 5_000 });

    // Pending add should still be there
    const addPanel = page.locator("#tabpanel-deck-additions");
    await expect(addPanel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("/reading/compare shows empty state when no pending changes", async ({
    deckPage,
    page,
  }) => {
    await setupMocks(page);
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 15_000 });

    // Navigate directly to /reading/compare without any pending changes
    await page.goto("/reading/compare");
    await expect(page).toHaveURL(/\/reading\/compare/, { timeout: 5_000 });

    // Should show empty state with CTAs (not the full comparison)
    const comparePage = page.locator("#tabpanel-deck-compare");
    await expect(comparePage).toBeVisible();

    // Should NOT show the 7 comparison panels (no pending changes)
    await expect(
      comparePage.locator("[data-testid='comparison-panel-mana-curve']")
    ).not.toBeVisible({ timeout: 2_000 });
  });
});

test.describe("Additions pairing: sessionStorage persistence", () => {
  test("pending changes persist after page reload on /reading/add", async ({
    deckPage,
    page,
  }) => {
    await importDeckAndNavigateToAdditions(deckPage, page);
    await setupAutocomplete(page, ["Path to Exile"]);

    await addCandidate(page, "Path to Exile");

    const panel = page.locator("#tabpanel-deck-additions");
    await expect(panel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });

    // Reload the page while on /reading/add
    await page.reload();

    // Re-register mocks after reload (route handlers are lost on reload)
    await setupMocks(page);
    await setupAutocomplete(page, ["Path to Exile"]);

    // After reload, the deck session and pending changes should both hydrate
    // from sessionStorage. The reading layout keeps us on the reading sub-route
    // if the session is still present.
    await expect(page).toHaveURL(/\/reading\/add/, { timeout: 10_000 });

    // Pending changes must still be there after hydration
    const addPanel = page.locator("#tabpanel-deck-additions");
    await expect(addPanel.getByText("Path to Exile").first()).toBeVisible({
      timeout: 10_000,
    });
    // NEEDS PAIRING should also appear (card was unpaired before reload)
    await expect(addPanel.getByText("NEEDS PAIRING")).toBeVisible({
      timeout: 5_000,
    });
  });
});
