import type { Page } from "@playwright/test";
import { test as deckTest, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Sample piles — all names exist in the enriched-cards fixture bank so the
// default /api/deck-enrich mock returns realistic data.
// ---------------------------------------------------------------------------

/** 13 unique names, 16 total cards. Atraxa + Ezuri are legal commanders;
 * Lightning Bolt is off Atraxa's WUBG identity. */
export const SAMPLE_PILE = `1 Atraxa, Praetors' Voice
1 Ezuri, Stalker of Spheres
1 Sol Ring
1 Command Tower
1 Arcane Signet
1 Swords to Plowshares
1 Counterspell
1 Cultivate
1 Llanowar Elves
1 Lightning Bolt
1 Path to Exile
3 Forest
2 Island`;

/** Exactly 100 cards with 3 unique names, so a test can reach a legal
 * hundred with two keep clicks plus the commander pick. */
export const HUNDRED_PILE = `1 Atraxa, Praetors' Voice
59 Forest
40 Island`;

/** SAMPLE_PILE plus the Thrasios/Tymna Partner pair, for two-commander
 * selection tests. Atraxa and Ezuri stay in as non-partner legendaries. */
export const PARTNER_PILE = `${SAMPLE_PILE}
1 Thrasios, Triton Hero
1 Tymna the Weaver`;

/** A Choose-a-Background commander, its Background, and 98 basics — pairable
 * in the picker and sealable as a legal hundred. */
export const BACKGROUND_PILE = `1 Wilson, Refined Grizzly
1 Raised by Giants
98 Forest`;

/** A pile whose trailing blank-line group would trigger the parser's
 * commander-inference heuristic if the Crucible didn't flatten it. */
export const TRAILING_COMMANDER_PILE = `1 Sol Ring
1 Command Tower
1 Cultivate

1 Ezuri, Stalker of Spheres`;

/**
 * Mock the card-autocomplete route with a tiny catalog; the real route hits
 * Scryfall. Used by both the import-screen and workbench search tests.
 */
export async function mockAutocomplete(page: Page) {
  const catalog = ["Birds of Paradise", "Sol Ring", "Tymna the Weaver"];
  await page.route("**/api/card-autocomplete**", (route) => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        suggestions: catalog.filter((name) => name.toLowerCase().includes(q)),
      }),
    });
  });
}

/** Type into the card search and pick a suggestion. */
export async function searchAndAdd(page: Page, query: string, name: string) {
  await page.locator("#card-search-input").fill(query);
  const option = page.getByRole("option", { name });
  await option.waitFor({ timeout: 5_000 });
  await option.click();
}

/**
 * Mock GET /api/commander-rules so crucible tests never hit Scryfall.
 * Shape mirrors the real route: banned names + game-changer cards.
 */
export async function mockCommanderRules(page: Page) {
  await page.route("**/api/commander-rules", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        banned: ["Black Lotus"],
        gameChangers: [
          { name: "Atraxa, Praetors' Voice", oracleText: "" },
        ],
      }),
    })
  );
}

// ---------------------------------------------------------------------------
// Page object
// ---------------------------------------------------------------------------

export class CruciblePage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto("/crucible");
  }

  get pileTextarea() {
    return this.page.getByLabel("Card pile");
  }

  get submitButton() {
    return this.page.getByRole("button", { name: "Begin Refinement" });
  }

  get workbench() {
    return this.page.getByTestId("crucible-workbench");
  }

  get poolCount() {
    return this.page.getByTestId("crucible-pool-count");
  }

  get commanderPicker() {
    return this.page.getByTestId("crucible-commander-picker");
  }

  get tracker() {
    return this.page.getByTestId("crucible-tracker");
  }

  get keptCount() {
    return this.page.getByTestId("crucible-kept-count");
  }

  get sealButton() {
    return this.page.getByRole("button", { name: /seal the deck/i });
  }

  /** Import a pile end-to-end and wait for the workbench. */
  async importPile(text: string) {
    await this.goto();
    await this.pileTextarea.fill(text);
    await this.submitButton.click();
    await this.workbench.waitFor({ timeout: 15_000 });
  }

  row(name: string) {
    return this.page.getByTestId(`crucible-row-${name}`);
  }

  keepButton(name: string) {
    return this.page.getByRole("button", { name: `Keep ${name}`, exact: true });
  }

  cutButton(name: string) {
    return this.page.getByRole("button", { name: `Cut ${name}`, exact: true });
  }

  restoreButton(name: string) {
    return this.page.getByRole("button", { name: `Restore ${name}`, exact: true });
  }

  /** Select a lens or insight view in the sidebar. */
  async selectLens(label: string) {
    await this.page
      .getByTestId("crucible-lens-switcher")
      .getByRole("button", { name: label })
      .click();
  }

  async chooseCommander(name: string) {
    await this.page
      .getByRole("button", { name: `Choose ${name}`, exact: true })
      .click();
  }
}

/**
 * Crucible test fixture. Depends on `deckPage` so the base fixture's route
 * mocks (/api/deck-enrich fixture bank, empty /api/deck-combos) and the
 * ritual-floor skip are active — Playwright fixtures are lazy, so a test
 * that only destructures `page` would otherwise hit the live APIs.
 */
export const test = deckTest.extend<{ crucible: CruciblePage }>({
  crucible: async ({ page, deckPage }, provide) => {
    void deckPage;
    await provide(new CruciblePage(page));
  },
});

export { expect };
