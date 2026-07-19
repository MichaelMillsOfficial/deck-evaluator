import { test, expect, SAMPLE_PILE, mockCommanderRules } from "./crucible-helpers";

test.describe("Crucible pile sharing", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("Share pile copies a /crucible?p= URL and confirms", async ({
    crucible,
    page,
  }) => {
    await crucible.importPile(SAMPLE_PILE);

    await page.getByTestId("crucible-share-pile").click();

    // Confirmation surfaces in the aria-live status region.
    await expect(page.getByTestId("crucible-share-status")).toHaveText(
      "Copied"
    );

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("/crucible?p=");
    const url = new URL(copied);
    expect(url.searchParams.get("p")).toBeTruthy();
  });

  test("opening a ?p= URL loads the shared pile into the workbench", async ({
    crucible,
    page,
  }) => {
    await crucible.importPile(SAMPLE_PILE);

    // Keep a couple cards so triage state is non-trivial, then share.
    await crucible.keepButton("Sol Ring").click();
    await page.getByTestId("crucible-share-pile").click();
    await expect(page.getByTestId("crucible-share-status")).toHaveText(
      "Copied"
    );
    const copied = await page.evaluate(() => navigator.clipboard.readText());

    // Open the shared link in a fresh navigation.
    await page.goto(copied);
    await crucible.workbench.waitFor({ timeout: 15_000 });

    // The pool total matches the shared pile (16 total cards in SAMPLE_PILE).
    await expect(crucible.poolCount).toContainText("16 cards");
    // The ?p= param is stripped after loading.
    await expect(page).toHaveURL(/\/crucible$/);
  });

  test("Download .dck triggers a crucible-pile.dck download", async ({
    crucible,
    page,
  }) => {
    await crucible.importPile(SAMPLE_PILE);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("crucible-download-dck").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("crucible-pile.dck");

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf-8");
    expect(text).toContain("[metadata]");
    expect(text).toContain("[Commander]");
    expect(text).toContain("[Main]");
    expect(text).toContain("1 Sol Ring");
  });
});
