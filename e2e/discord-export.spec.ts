import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

/**
 * Probe Scryfall reachability so we can skip all tests when the API
 * is unreachable (sandboxed CI, offline dev).
 */
let scryfallReachable = true;

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.post("/api/deck-enrich", {
      data: { cardNames: ["Sol Ring"] },
      timeout: 15_000,
    });
    if (res.status() === 502) {
      scryfallReachable = false;
    } else if (res.ok()) {
      const body = await res.json();
      if (!body.cards?.["Sol Ring"]) {
        scryfallReachable = false;
      }
    }
  } catch {
    scryfallReachable = false;
  }
});

async function openDiscordModal(deckPage: import("./fixtures").DeckPage) {
  await deckPage.page.goto("/reading/share");
  const openExporter = deckPage.page.getByTestId("share-discord-button");
  await expect(openExporter).toBeVisible();
  await openExporter.click();
}

test.describe("Discord Export Modal", () => {
  test.beforeEach(async ({ deckPage }) => {
    test.skip(!scryfallReachable, "Scryfall API is unreachable");
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();

    // Wait for enrichment so the Share tile actions are clickable.
    await deckPage.page.waitForFunction(
      () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        const analysisTab = Array.from(tabs).find(
          (t) => t.textContent === "Analysis"
        );
        return analysisTab && !(analysisTab as HTMLButtonElement).disabled;
      },
      { timeout: 20_000 }
    );
  });

  test('clicking "Open Exporter" opens modal', async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    await expect(
      deckPage.page.getByTestId("discord-export-modal")
    ).toBeVisible();
  });

  test("modal shows checkbox list with section labels", async ({
    deckPage,
  }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    const sectionsList = modal.locator("label");
    await expect(sectionsList.filter({ hasText: "Header" })).toBeVisible();
    await expect(sectionsList.filter({ hasText: "Mana Curve" })).toBeVisible();
    await expect(sectionsList.filter({ hasText: "Land Efficiency" })).toBeVisible();
  });

  test("Header checkbox is checked and disabled", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    const headerCheckbox = modal
      .locator("label")
      .filter({ hasText: "Header" })
      .locator('input[type="checkbox"]');
    await expect(headerCheckbox).toBeChecked();
    await expect(headerCheckbox).toBeDisabled();
  });

  test("live preview pane shows content", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const preview = deckPage.page.getByTestId("discord-preview");
    await expect(preview).toContainText("Imported Decklist");
  });

  test("character counter is visible", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal.getByText(/\/2000/)).toBeVisible();
  });

  test("Escape closes modal", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal).toBeVisible();

    await deckPage.page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("modal has aria-label", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    await expect(modal).toHaveAttribute("aria-label", "Export to Discord");
  });

  test("modal shows Analysis Link checkbox checked for small decks", async ({
    deckPage,
  }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    const linkLabel = modal
      .locator("label")
      .filter({ hasText: "Analysis Link" });
    await expect(linkLabel).toBeVisible();

    const linkCheckbox = linkLabel.locator('input[type="checkbox"]');
    await expect(linkCheckbox).toBeChecked();
    await expect(linkCheckbox).not.toBeDisabled();
  });

  test("preview includes share URL for small decks", async ({ deckPage }) => {
    await openDiscordModal(deckPage);
    const preview = deckPage.page.getByTestId("discord-preview");
    await expect(preview).toContainText("View full analysis:");
    await expect(preview).toContainText("/shared?d=");
  });

  test("unchecking Analysis Link removes URL from preview", async ({
    deckPage,
  }) => {
    await openDiscordModal(deckPage);
    const modal = deckPage.page.getByTestId("discord-export-modal");
    const linkCheckbox = modal
      .locator("label")
      .filter({ hasText: "Analysis Link" })
      .locator('input[type="checkbox"]');

    await linkCheckbox.click();
    await expect(linkCheckbox).not.toBeChecked();

    const preview = deckPage.page.getByTestId("discord-preview");
    await expect(preview).not.toContainText("View full analysis:");
  });
});
