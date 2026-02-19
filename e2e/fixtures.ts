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

  /** Fill the deck name field */
  async fillDeckName(name: string) {
    await this.page.getByPlaceholder("Enter deck name").fill(name);
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

  /** Return the deck name input locator */
  get deckNameInput() {
    return this.page.getByPlaceholder("Enter deck name");
  }

  /** Return the format input locator (manual tab only) */
  get formatInput() {
    return this.page.getByPlaceholder(
      "e.g. Commander, Standard, Modern"
    );
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
