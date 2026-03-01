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

/** Decklist without a COMMANDER: header — used for commander input tests */
export const FLAT_DECKLIST = `1 Atraxa, Praetors' Voice
1 Sol Ring
1 Command Tower
1 Arcane Signet
1 Swords to Plowshares
1 Counterspell`;

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

  /** Wait for the deck header to appear after a successful import */
  async waitForDeckDisplay() {
    await this.page
      .getByTestId("deck-header")
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

  /** Click a deck view tab */
  async selectDeckViewTab(tab: "Deck List" | "Analysis" | "Synergy" | "Hands" | "Additions") {
    await this.page
      .getByTestId("deck-header")
      .getByRole("tab", { name: tab })
      .click();
  }

  /** Locator for the deck header */
  get deckHeader() {
    return this.page.getByTestId("deck-header");
  }

  /** Locator for the share button */
  get shareButton() {
    return this.page.getByTestId("share-button");
  }

  /** Locator for the bracket/power badge */
  get bracketBadge() {
    return this.page.getByTestId("bracket-power-badge");
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

  /** Locator for the top hands section */
  get topHandsSection() {
    return this.page.getByTestId("top-hands");
  }

  /** Locator for the hand builder section */
  get handBuilder() {
    return this.page.getByTestId("hand-builder");
  }

  /** Locator for the analyze hand button */
  get analyzeHandButton() {
    return this.page.getByTestId("analyze-hand-btn");
  }

  /** Expand a collapsible section in the Hands tab by its ID */
  async expandHandsSection(id: string) {
    const panel = this.page.getByTestId(`panel-${id}`);
    const button = panel.locator("button").first();
    const expanded = await button.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await button.click();
    }
  }

  /** Locator for the verified combos section */
  get verifiedCombosSection() {
    return this.page.getByTestId("verified-combos-section");
  }

  /** Locator for the near combos section */
  get nearCombosSection() {
    return this.page.getByTestId("near-combos-section");
  }

  /** Locator for the additions panel */
  get additionsPanel() {
    return this.page.locator("#tabpanel-deck-additions");
  }

  /** Locator for the commander input field */
  get commanderInput() {
    return this.page.locator("#commander-input");
  }

  /** Locator for the commander tag pills container */
  get commanderTags() {
    return this.page.getByTestId("commander-tags");
  }

  /**
   * Type a commander name into the commander input, wait for the autocomplete
   * dropdown to appear, and click the matching suggestion.
   * NOTE: Callers must mock /api/card-autocomplete via page.route() first.
   */
  async fillCommander(name: string) {
    await this.commanderInput.fill(name);
    // Wait for autocomplete dropdown to appear
    const option = this.page.getByRole("option", { name });
    await option.waitFor({ timeout: 5_000 });
    await option.click();
  }

  /** Remove a commander tag by clicking its × button */
  async removeCommander(name: string) {
    await this.page
      .getByRole("button", { name: `Remove ${name}` })
      .click();
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
