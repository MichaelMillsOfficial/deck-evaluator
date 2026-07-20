import { test, expect, META_DECKLIST, DEFAULT_META_ENVELOPE } from "./fixtures";

const EVIDENCE_DIR =
  "/var/folders/5h/xwb2_w856w3fgxszkbhc00r00000gn/T/no-mistakes-evidence/01KXYRK5XTJV2N5MRRQKK7FBEN";

async function importMeta(deckPage: import("./fixtures").DeckPage) {
  await deckPage.goto();
  await deckPage.mockMeta(DEFAULT_META_ENVELOPE);
  await deckPage.fillDecklist(META_DECKLIST);
  await deckPage.submitImport();
  await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
}

test.describe("evidence: dedicated /reading/meta page", () => {
  test("nav to Meta tab from the sidebar opens the dedicated page and captures it", async ({
    deckPage,
  }) => {
    const page = deckPage.page;
    await importMeta(deckPage);

    // Start on the cards page — the heat list was moved OFF here.
    await page.goto("/reading/cards");
    await expect(page.getByTestId("meta-heat-list")).toHaveCount(0);

    // The Meta sidebar tab in the Deck group navigates to the dedicated page.
    const tablist = page.getByRole("tablist", { name: "Deck view" });
    const metaTab = tablist.getByRole("tab", { name: "Meta" });
    await expect(metaTab).toBeVisible();
    await metaTab.click();
    await page.waitForURL(/\/reading\/meta(\/|$|\?)/, { timeout: 15_000 });

    // The dedicated page hosts the full analysis.
    await expect(page.getByTestId("section-header-meta")).toBeVisible();
    await expect(page.getByTestId("meta-panel")).toBeVisible();
    await expect(page.getByTestId("meta-heat-list")).toBeVisible();

    await page.waitForTimeout(400); // let dial/band transitions settle
    await page.screenshot({
      path: `${EVIDENCE_DIR}/reading-meta-page-full.png`,
      fullPage: true,
    });

    // Close-up of the heat list living on this page.
    await page.getByTestId("meta-heat-list").scrollIntoViewIfNeeded();
    await page
      .getByTestId("meta-heat-list")
      .screenshot({ path: `${EVIDENCE_DIR}/reading-meta-heat-list.png` });
  });

  test("heat list sort + filter on the meta page, captured", async ({ deckPage }) => {
    const page = deckPage.page;
    await importMeta(deckPage);
    await page.goto("/reading/meta");

    await expect(page.getByTestId("meta-heat-list")).toBeVisible();
    // Filter to spice → staple drops out.
    await page.getByTestId("meta-filter").selectOption("spice");
    await expect(page.getByTestId("meta-row-Contentious Plan")).toBeVisible();
    await expect(page.getByTestId("meta-row-Sol Ring")).toHaveCount(0);
    await page.getByTestId("meta-heat-list").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${EVIDENCE_DIR}/reading-meta-filtered-spice.png`,
      fullPage: true,
    });
  });

  test("meta panel still on /reading overview (glance), captured", async ({ deckPage }) => {
    const page = deckPage.page;
    await importMeta(deckPage);
    await page.goto("/reading");
    await expect(page.getByTestId("meta-panel")).toBeVisible();
    await page.getByTestId("meta-panel").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.getByTestId("meta-panel").screenshot({
      path: `${EVIDENCE_DIR}/reading-overview-meta-panel.png`,
    });
  });
});
