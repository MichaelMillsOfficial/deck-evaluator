import { test as base, expect, type Page } from "@playwright/test";
import {
  getEnrichedFixture,
  isFixtured,
} from "./fixtures/enriched-cards";

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

  // ---------------------------------------------------------------------------
  // Archidekt URL flow
  // ---------------------------------------------------------------------------

  /** Click the Archidekt import tab */
  async selectArchidektTab() {
    await this.selectTab("Archidekt");
  }

  /** Fill the Archidekt URL input field */
  async fillArchidektUrl(url: string) {
    await this.archidektUrlInput.fill(url);
  }

  /** Submit the Archidekt URL fetch form */
  async submitArchidektFetch() {
    await this.page
      .getByRole("button", { name: /^(import deck|fetch deck)$/i })
      .click();
  }

  /** Locator for the Archidekt URL input */
  get archidektUrlInput() {
    return this.page.getByLabel(/archidekt deck url/i);
  }

  /** Locator for the rendered Archidekt synopsis card */
  get archidektSynopsis() {
    return this.page.getByTestId("archidekt-synopsis");
  }

  /** Click the "Continue to reading" button on the Archidekt synopsis */
  async clickContinueFromSynopsis() {
    await this.page.getByRole("button", { name: /continue to reading/i }).click();
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

  /**
   * Wait for the deck header to appear after a successful import.
   *
   * After Phase 3, /reading is the verdict overview (no deck-header) and
   * the deck list lives at /reading/cards. Most existing tests expect to
   * interact with deck-list / tabs / panels — they don't care about the
   * intermediate overview hop. If we're on /reading, navigate forward to
   * /reading/cards before waiting. Tests that explicitly want the
   * overview don't call waitForDeckDisplay; they assert reading-hero
   * directly.
   */
  async waitForDeckDisplay() {
    // Wait for the post-submit navigation to settle on any /reading URL.
    // submitImport() returns before router.push completes, so checking the
    // URL too early would still see / or /ritual.
    await this.page.waitForURL(/\/reading/, { timeout: 15_000 });
    // /reading is the verdict overview (no deck-header); deck-header lives
    // on /reading/cards. Click the Cards section link to soft-navigate
    // there. (page.goto would do a full page reload, remounting the
    // DeckSessionProvider and dropping in-memory error state — that
    // breaks tests that probe the post-error retry UI.)
    const url = new URL(this.page.url());
    if (url.pathname === "/reading" || url.pathname === "/reading/") {
      await this.page
        .getByTestId("reading-section-grid")
        .getByRole("link", { name: /cards/i })
        .first()
        .click();
      await this.page.waitForURL(/\/reading\/cards/, { timeout: 5_000 });
    }
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
  async selectDeckViewTab(tab: "Deck List" | "Analysis" | "Synergy" | "Hands" | "Additions" | "Interactions" | "Suggestions") {
    await this.page
      .getByTestId("deck-header")
      .getByRole("tab", { name: tab })
      .click();
  }

  /** Locator for the deck header */
  get deckHeader() {
    return this.page.getByTestId("deck-header");
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

  /** Locator for the interactions panel */
  get interactionsPanel() {
    return this.page.locator("#tabpanel-deck-interactions");
  }

  /** Wait for the interactions panel to display content */
  async waitForInteractionsPanel() {
    await this.page
      .getByTestId("interactions-content")
      .waitFor({ timeout: 15_000 });
  }

  /** Expand a collapsible section in the Interactions tab by its ID */
  async expandInteractionsSection(id: string) {
    return this.expandAnalysisSection(id);
  }

  // ---------------------------------------------------------------------------
  // Card lookup (manual tab only)
  // ---------------------------------------------------------------------------

  /** Locator for the card lookup search input */
  get cardLookupInput() {
    return this.page.locator("#card-lookup-input");
  }

  /** Locator for the card lookup quantity spinner */
  get cardLookupQuantity() {
    return this.page.getByLabel("Card quantity");
  }

  /** Locator for the card lookup status live region */
  get cardLookupStatus() {
    return this.page.getByTestId("card-lookup-status");
  }

  /**
   * Opt out of the default /api/deck-enrich mock and route the request to
   * the live API instead. Use this in tests that genuinely need real
   * Scryfall data (rare; most tests should use the fixture bank).
   */
  async useLiveEnrichment() {
    await this.page.unroute("**/api/deck-enrich");
  }

  /**
   * Opt out of the default /api/deck-combos mock and route the request to
   * the live Commander Spellbook API instead.
   */
  async useLiveCombos() {
    await this.page.unroute("**/api/deck-combos");
  }

  /**
   * Type a card name into the card lookup input, wait for the autocomplete
   * dropdown to appear, and click the matching suggestion.
   * NOTE: Callers must mock /api/card-autocomplete via page.route() first.
   */
  async fillCardLookup(name: string) {
    await this.cardLookupInput.fill(name);
    const option = this.page.getByRole("option", { name });
    await option.waitFor({ timeout: 5_000 });
    await option.click();
  }

  // ---------------------------------------------------------------------------
  // Commander input
  // ---------------------------------------------------------------------------

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
    // Skip the /ritual loader's 2s minimum floor by default so the e2e
    // suite isn't paying 2s on every import. Tests that explicitly verify
    // the floor remove this flag via their own addInitScript.
    await page.addInitScript(() => {
      (window as Window).__SKIP_RITUAL_FLOOR__ = true;
    });

    // Default mock for /api/deck-enrich. Reads the requested cardNames from
    // the request body, looks each up in the static fixture bank, and
    // returns the same shape as the real route handler. Unknown cards are
    // synthesized with sensible defaults so the suite degrades gracefully.
    // Tests that need real Scryfall data call deckPage.useLiveEnrichment().
    await page.route("**/api/deck-enrich", async (route) => {
      const request = route.request();
      let cardNames: string[] = [];
      try {
        const body = JSON.parse(request.postData() ?? "{}");
        if (Array.isArray(body.cardNames)) cardNames = body.cardNames;
      } catch {
        // Malformed body — let the real route handler reject it.
        await route.continue();
        return;
      }

      const cards: Record<string, ReturnType<typeof getEnrichedFixture>> = {};
      const notFound: string[] = [];
      for (const name of cardNames) {
        // Synthesize unknown cards rather than 404ing — keeps existing tests
        // green when they happen to use a card not yet in the fixture bank.
        cards[name] = getEnrichedFixture(name);
        if (!isFixtured(name)) {
          // Surface this in test output so missing fixtures are easy to
          // notice and add. Tests aren't failed by it.
          // eslint-disable-next-line no-console
          console.warn(`[e2e] enrichment fixture missing for: ${name}`);
        }
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cards, notFound }),
      });
    });

    // Default mock for /api/deck-combos: empty result. The Commander
    // Spellbook API is rate-limited and slow under parallel load; tests
    // that exercise combo detection (spellbook-combos.spec.ts) opt back in
    // to the live API via deckPage.useLiveCombos().
    await page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [], nearCombos: [] }),
      })
    );

    const deckPage = new DeckPage(page);
    await use(deckPage);
  },
});

export { expect };
