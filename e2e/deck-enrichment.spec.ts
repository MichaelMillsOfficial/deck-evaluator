import { test, expect } from "./fixtures";

// Mock enrichment response for Sol Ring and Command Tower
const MOCK_ENRICH_RESPONSE = {
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
      flavorName: null,
    },
  },
  notFound: [],
};

test.describe("Deck Enrichment", () => {
  test("shows enriched card details after import", async ({ deckPage }) => {
    const { page } = deckPage;

    // Mock the enrichment API
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring\n1 Command Tower");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Enriched table should appear with type lines
    const deckDisplay = deckPage.deckDisplay;
    await expect(deckDisplay.getByRole("cell", { name: "Artifact" })).toBeVisible({ timeout: 10_000 });
    await expect(deckDisplay.getByRole("cell", { name: "Land" })).toBeVisible();

    // Mana cost for Sol Ring should show
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible();
  });

  test("basic decklist renders immediately before enrichment", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Delay enrichment response to test progressive loading
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring\n1 Command Tower");
    await deckPage.submitImport();

    // Basic decklist should appear immediately
    await deckPage.waitForDeckDisplay();
    await expect(deckPage.deckDisplay.getByText("Sol Ring")).toBeVisible();

    // Loading card details indicator should be shown
    await expect(page.getByText("Enriching card data...")).toBeVisible();
  });

  test("form re-enables immediately after deck data loads", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Delay enrichment so it's still loading after deck parses
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Form should be re-enabled even though enrichment is still loading
    await expect(deckPage.importButton).toBeEnabled();
    await expect(page.locator("textarea#decklist")).toBeEnabled();
  });

  test("enrichment failure shows warning but keeps basic decklist", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Mock enrichment failure
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scryfall is down" }),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring\n1 Command Tower");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Basic decklist should still be visible
    await expect(deckPage.deckDisplay.getByText("Sol Ring")).toBeVisible();

    // Warning should appear
    await expect(
      page.getByText("Could not load card details")
    ).toBeVisible({ timeout: 10_000 });

    // Dismiss button should work
    await page.getByLabel("Dismiss warning").click();
    await expect(
      page.getByText("Could not load card details")
    ).not.toBeVisible();
  });

  test("clicking card name expands details", async ({ deckPage }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to load
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Click the card name disclosure button
    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");

    await solRingButton.click();
    await expect(solRingButton).toHaveAttribute("aria-expanded", "true");

    // Oracle text detail row should be visible via aria-controls
    const controlsId = await solRingButton.getAttribute("aria-controls");
    const detailRow = page.locator(`#${controlsId}`);
    await expect(detailRow).toBeVisible();
    await expect(page.getByText("Rarity: uncommon")).toBeVisible();
  });

  test("chevron is visible on disclosure button and rotates when expanded", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    const chevron = solRingButton.locator("[data-testid='expand-chevron']");
    await expect(chevron).toBeVisible();

    // Not rotated when collapsed
    await expect(chevron).not.toHaveClass(/rotate-90/);

    // Rotated when expanded
    await solRingButton.click();
    await expect(chevron).toHaveClass(/rotate-90/);
  });

  test("mana cost symbols render as img tags with Scryfall SVG src", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const manaCost = page.locator('[aria-label="Mana cost: 1 generic"]');
    await expect(manaCost).toBeVisible({ timeout: 10_000 });

    const img = manaCost.locator("img");
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute(
      "src",
      "https://svgs.scryfall.io/card-symbols/1.svg"
    );
  });

  test("oracle text symbols render as img tags in expanded detail", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Expand Sol Ring details
    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await solRingButton.click();

    const controlsId = await solRingButton.getAttribute("aria-controls");
    const detailRow = page.locator(`#${controlsId}`);

    // Oracle text should contain img tags for {T}, {C}, {C}
    const oracleImgs = detailRow.locator("img");
    await expect(oracleImgs).toHaveCount(3);
    await expect(oracleImgs.nth(0)).toHaveAttribute(
      "src",
      "https://svgs.scryfall.io/card-symbols/T.svg"
    );
    await expect(oracleImgs.nth(1)).toHaveAttribute(
      "src",
      "https://svgs.scryfall.io/card-symbols/C.svg"
    );
  });
});

const MOCK_TAGS_RESPONSE = {
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
      flavorName: null,
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
      flavorName: null,
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
      flavorName: null,
    },
  },
  notFound: [],
};

test.describe("Card Tags", () => {
  test("Sol Ring displays a 'Ramp' tag badge", async ({ deckPage }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TAGS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Swords to Plowshares\n1 Counterspell\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      page.locator('[data-testid="card-tag"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // Sol Ring should show "Ramp" tag
    const solRingRow = page.locator("tr").filter({ hasText: "Sol Ring" });
    await expect(
      solRingRow.locator('[data-testid="card-tag"]', { hasText: "Ramp" })
    ).toBeVisible();
  });

  test("Swords to Plowshares displays a 'Removal' tag", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TAGS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Swords to Plowshares\n1 Counterspell\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[data-testid="card-tag"]').first()
    ).toBeVisible({ timeout: 10_000 });

    const swordsRow = page
      .locator("tr")
      .filter({ hasText: "Swords to Plowshares" });
    await expect(
      swordsRow.locator('[data-testid="card-tag"]', { hasText: "Removal" })
    ).toBeVisible();
  });

  test("Counterspell displays a 'Counterspell' tag", async ({ deckPage }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TAGS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Swords to Plowshares\n1 Counterspell\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    await expect(
      page.locator('[data-testid="card-tag"]').first()
    ).toBeVisible({ timeout: 10_000 });

    const counterRow = page.locator("tr").filter({ hasText: "Counterspell" });
    await expect(
      counterRow.locator('[data-testid="card-tag"]', {
        hasText: "Counterspell",
      })
    ).toBeVisible();
  });

  test("Command Tower (no functional tags) shows no tag badges", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TAGS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist(
      "1 Sol Ring\n1 Swords to Plowshares\n1 Counterspell\n1 Command Tower"
    );
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to finish
    await expect(
      page.locator('[data-testid="card-tag"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // Command Tower row should NOT have any tags
    const towerRow = page.locator("tr").filter({ hasText: "Command Tower" });
    await expect(
      towerRow.locator('[data-testid="card-tag"]')
    ).toHaveCount(0);
  });

  test("tags are visible without expanding the card detail row", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TAGS_RESPONSE),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Tag should be visible without clicking to expand
    const rampTag = page.locator('[data-testid="card-tag"]', {
      hasText: "Ramp",
    });
    await expect(rampTag).toBeVisible({ timeout: 10_000 });

    // Detail row should NOT be expanded
    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("Deck Enrichment — Accessibility", () => {
  test.beforeEach(async ({ deckPage }) => {
    const { page } = deckPage;
    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      })
    );
  });

  test("disclosure button has correct aria-expanded before and after click", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toBeVisible({ timeout: 10_000 });

    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");
    await solRingButton.click();
    await expect(solRingButton).toHaveAttribute("aria-expanded", "true");
    await solRingButton.click();
    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");
  });

  test("expanded detail row has matching id referenced by aria-controls", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toBeVisible({ timeout: 10_000 });

    const controlsId = await solRingButton.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();

    await solRingButton.click();
    const detailRow = page.locator(`#${controlsId}`);
    await expect(detailRow).toBeVisible();
  });

  test("ManaCost has aria-label and pips have aria-hidden", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // ManaCost container should have aria-label
    const manaCost = page.locator('[aria-label="Mana cost: 1 generic"]');
    await expect(manaCost).toBeVisible({ timeout: 10_000 });

    // Individual pips should be aria-hidden
    const pip = manaCost.locator("[aria-hidden='true']");
    await expect(pip).toHaveCount(1);
  });

  test("loading card details element has role=status", async ({
    deckPage,
  }) => {
    const { page } = deckPage;

    // Override to delay enrichment
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENRICH_RESPONSE),
      });
    });

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const loadingStatus = page.locator(
      'text="Enriching card data..."'
    );
    await expect(loadingStatus).toBeVisible();
    await expect(loadingStatus).toHaveAttribute("role", "status");
  });

  test("enrichment error warning has role=alert", async ({ deckPage }) => {
    const { page } = deckPage;

    await page.route("**/api/deck-enrich", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scryfall is down" }),
      })
    );

    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const warning = page.locator('[role="alert"]').filter({
      hasText: "Could not load card details",
    });
    await expect(warning).toBeVisible({ timeout: 10_000 });
  });

  test("keyboard: Tab reaches disclosure, Enter toggles, Escape collapses", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toBeVisible({ timeout: 10_000 });

    // Focus the button
    await solRingButton.focus();

    // Enter toggles expansion
    const controlsId = await solRingButton.getAttribute("aria-controls");
    const detailRow = page.locator(`#${controlsId}`);
    await page.keyboard.press("Enter");
    await expect(solRingButton).toHaveAttribute("aria-expanded", "true");
    await expect(detailRow).toBeVisible();

    // Escape collapses
    await page.keyboard.press("Escape");
    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");
    await expect(detailRow).not.toBeVisible();

    // Space also toggles
    await page.keyboard.press("Space");
    await expect(solRingButton).toHaveAttribute("aria-expanded", "true");
  });

  test("focus stays on disclosure button after Escape", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    const solRingButton = page.getByRole("button", { name: "Sol Ring" });
    await expect(solRingButton).toBeVisible({ timeout: 10_000 });

    await solRingButton.focus();
    await page.keyboard.press("Enter");
    await expect(solRingButton).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(solRingButton).toHaveAttribute("aria-expanded", "false");
    await expect(solRingButton).toBeFocused();
  });

  test("enriched table has accessible name via aria-labelledby", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Table should be accessible by its section name (includes count)
    const table = page.getByRole("table", { name: /Mainboard/i });
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test("'Card details loaded' live region is present after enrichment", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to complete
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // The live region should contain the announcement
    const liveRegion = page.locator('[role="status"][aria-live="polite"]').filter({
      hasText: "Card details loaded",
    });
    await expect(liveRegion).toBeAttached();
  });

  test("enriched table has proper th scope=col headers", async ({
    deckPage,
  }) => {
    const { page } = deckPage;
    await deckPage.goto();
    await deckPage.fillDecklist("1 Sol Ring");
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment to render the table
    await expect(
      page.locator('[aria-label="Mana cost: 1 generic"]')
    ).toBeVisible({ timeout: 10_000 });

    // Check column headers
    const headers = page.locator("th[scope='col']");
    await expect(headers).toHaveCount(4);
  });
});
