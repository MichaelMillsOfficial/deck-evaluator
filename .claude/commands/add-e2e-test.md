# Add an e2e test

Create or extend an e2e test file for a UI feature. The feature: $ARGUMENTS

## Required patterns

### File location
Place at `e2e/<kebab-case-feature>.spec.ts`

### Imports — CRITICAL
Always import from `./fixtures`, never from `@playwright/test` directly:
```ts
import { test, expect, SAMPLE_DECKLIST } from "./fixtures";
```

Available fixtures: `SAMPLE_DECKLIST`, `SAMPLE_DECKLIST_WITH_SIDEBOARD`, `MINIMAL_DECKLIST`

### Test structure
```ts
test.describe("Feature Name — Context", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("description of expected behavior", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Scope assertions to deckDisplay to avoid strict-mode violations
    const display = deckPage.deckDisplay;
    await expect(display.getByText("Sol Ring")).toBeVisible();
  });
});
```

### DeckPage API
Action methods:
- `deckPage.goto()` — navigate to home, wait for form
- `deckPage.fillDecklist(text)` — fill textarea
- `deckPage.submitImport()` — click Import Deck
- `deckPage.loadExample()` — click Load Example
- `deckPage.selectTab("Manual Import" | "Moxfield" | "Archidekt")` — switch import tab
- `deckPage.selectDeckViewTab("Deck List" | "Analysis" | "Synergy")` — switch deck view tab
- `deckPage.waitForDeckDisplay()` — wait for "Imported Decklist" heading (15s timeout)
- `deckPage.waitForAnalysisPanel()` — wait for "Mana Curve" heading
- `deckPage.waitForSynergySection()` — wait for "Card Synergy" heading

Locator getters:
- `deckPage.deckDisplay` — scoped to `data-testid="deck-display"`
- `deckPage.analysisPanel` — `#tabpanel-deck-analysis`
- `deckPage.synergySection` — `section[aria-labelledby="synergy-heading"]`
- `deckPage.importButton`, `deckPage.loadExampleButton`, `deckPage.decklistTextarea`

### API mocking (if needed)
```ts
test.beforeEach(async ({ deckPage }) => {
  await deckPage.page.route("**/api/deck-enrich", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ENRICHMENT),
    })
  );
  await deckPage.goto();
});
```

### Adding new page-object methods
If the feature introduces new UI elements, add methods/getters to the `DeckPage` class in `e2e/fixtures.ts`:
```ts
/** Locator for the new feature section */
get featureSection() {
  return this.page.locator('section[aria-labelledby="feature-heading"]');
}

/** Wait for the new feature to appear */
async waitForFeature() {
  await this.page
    .getByRole("heading", { name: "Feature Name" })
    .waitFor({ timeout: 15_000 });
}
```

### Test naming
- Use plain English: `"submits a decklist and displays parsed cards"`
- Use `→` arrow in unit-style assertions: `"Sol Ring (tap for mana) → Ramp"`

### Assertions
- Prefer semantic locators: `getByRole`, `getByText`, `getByTestId`, `getByLabel`
- Always scope card assertions to `deckPage.deckDisplay`
- Use `data-testid` for structural elements: `stat-*`, `card-*`, `pair-*`, `theme-pill-*`
- Test accessibility: `toHaveAttribute("aria-expanded", "true")`, `toHaveAttribute("aria-label", ...)`
