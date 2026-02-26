import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Sample decklists used across test files
//
// NOTE: The parser does not reset zones on blank lines. Once a zone header
// like COMMANDER: is set, all subsequent cards belong to that zone until
// another zone header appears. Always include explicit zone headers.
// ---------------------------------------------------------------------------

export const SAMPLE_DECKLIST = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
1 Sol Ring
1 Command Tower
1 Arcane Signet
1 Swords to Plowshares
1 Counterspell`;

export const SAMPLE_DECKLIST_WITH_SIDEBOARD = `COMMANDER:
1 Atraxa, Praetors' Voice

MAINBOARD:
1 Sol Ring
1 Command Tower

SIDEBOARD:
1 Rest in Peace
1 Grafdigger's Cage`;

export const MINIMAL_DECKLIST = "1 Sol Ring";

// ---------------------------------------------------------------------------
// Page-object helpers — keep tests focused on intent, not selectors
// ---------------------------------------------------------------------------

export class DeckPage {
  constructor(public readonly page: Page) {}

  /** Navigate to the home page and wait for the deck input form */
  async goto() {
    await this.page.goto("/");
    await this.page.locator("form").waitFor();
  }

  /** Click a specific import tab by label text */
  async selectTab(tab: "Manual Import" | "Moxfield" | "Archidekt") {
    await this.page.getByRole("tab", { name: tab }).click();
  }

  /** Fill the decklist textarea */
  async fillDecklist(text: string) {
    await this.page.getByLabel("Decklist").fill(text);
  }

  /** Click the Import Deck submit button */
  async submitImport() {
    await this.page.getByRole("button", { name: "Import Deck" }).click();
  }

  /** Click the Load Example button (manual tab only) */
  async loadExample() {
    await this.page.getByRole("button", { name: "Load Example" }).click();
  }

  /** Return the Import Deck button locator for assertions */
  get importButton() {
    return this.page.getByRole("button", { name: "Import Deck" });
  }

  /** Return the Load Example button locator */
  get loadExampleButton() {
    return this.page.getByRole("button", { name: "Load Example" });
  }

  /** Return the textarea locator */
  get decklistTextarea() {
    return this.page.getByLabel("Decklist");
  }

  /** Wait for the deck list panel to appear after a successful import */
  async waitForDeckDisplay() {
    await this.page
      .getByRole("heading", { name: "Imported Decklist" })
      .waitFor({ timeout: 15_000 });
  }

  /**
   * Scoped locator for the rendered deck display panel.
   * Use this to avoid strict-mode violations where card names also appear
   * in the still-visible textarea.
   */
  get deckDisplay() {
    return this.page.getByTestId("deck-display");
  }

  /** Return the error alert container, if visible */
  get errorAlert() {
    return this.page.locator('[class*="red"]');
  }

  /** Click a deck view tab (Deck List, Analysis, Synergy, or Hands) */
  async selectDeckViewTab(tab: "Deck List" | "Analysis" | "Synergy" | "Hands") {
    await this.page
      .getByRole("tablist", { name: "Deck view" })
      .getByRole("tab", { name: tab })
      .click();
  }

  /** Wait for the analysis panel to appear (section nav is visible) */
  async waitForAnalysisPanel() {
    await this.page
      .getByTestId("section-nav")
      .waitFor({ timeout: 15_000 });
  }

  /** Expand a collapsible section in the Analysis tab by its ID */
  async expandAnalysisSection(id: string) {
    const panel = this.page.getByTestId(`panel-${id}`);
    const button = panel.locator("button").first();
    const expanded = await button.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await button.click();
    }
  }

  /** Expand a collapsible section in the Synergy tab by its ID */
  async expandSynergySection(id: string) {
    return this.expandAnalysisSection(id);
  }

  /** Locator for the analysis panel */
  get analysisPanel() {
    return this.page.locator("#tabpanel-deck-analysis");
  }

  /** Locator for the deck view tabs container */
  get deckViewTabs() {
    return this.page.getByTestId("deck-view-tabs");
  }

  /** Locator for the synergy analysis section */
  get synergySection() {
    return this.page.locator(
      'section[aria-labelledby="synergy-heading"]'
    );
  }

  /** Wait for the synergy section to appear on the Analysis tab */
  async waitForSynergySection() {
    await this.page
      .getByRole("heading", { name: "Card Synergy" })
      .waitFor({ timeout: 15_000 });
  }

  /** Wait for the hands panel to appear */
  async waitForHandsPanel() {
    await this.page
      .getByTestId("hand-simulator")
      .waitFor({ timeout: 15_000 });
  }

  /** Locator for the hands panel */
  get handsPanel() {
    return this.page.locator("#tabpanel-deck-hands");
  }

  /** Locator for the verified combos section */
  get verifiedCombosSection() {
    return this.page.getByTestId("verified-combos-section");
  }

  /** Locator for the near combos section */
  get nearCombosSection() {
    return this.page.getByTestId("near-combos-section");
  }
}

// ---------------------------------------------------------------------------
// Extended test fixture that provides `deckPage` automatically
// ---------------------------------------------------------------------------

export const test = base.extend<{ deckPage: DeckPage }>({
  deckPage: async ({ page }, use) => {
    const deckPage = new DeckPage(page);
    await use(deckPage);
  },
});

export { expect };
