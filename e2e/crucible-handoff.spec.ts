import { test, expect, mockCommanderRules } from "./crucible-helpers";

/** 101 cards including Sol Ring so one cut leaves a legal 100 with a
 * sideboard entry to verify on the reading side. */
const HUNDRED_ONE_PILE = `1 Atraxa, Praetors' Voice
1 Sol Ring
59 Forest
40 Island`;

test.describe("Crucible handoff", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("sealing hands the deck to the ritual and reading journey with cuts as sideboard", async ({ page, crucible }) => {
    await crucible.importPile(HUNDRED_ONE_PILE);

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await crucible.keepButton("Forest").click();
    await crucible.keepButton("Island").click();
    await crucible.cutButton("Sol Ring").click();

    await expect(crucible.keptCount).toContainText("100");
    await expect(crucible.sealButton).toBeEnabled();
    await crucible.sealButton.click();

    // __SKIP_RITUAL_FLOOR__ is set by the fixture, so the ritual forwards
    // immediately once the reading session's enrichment resolves.
    await page.waitForURL(/\/reading/, { timeout: 15_000 });
    await expect(page.getByTestId("reading-section-grid")).toBeVisible({ timeout: 15_000 });

    // The cut Sol Ring survives as sideboard on the reading side.
    await page
      .getByTestId("reading-section-grid")
      .getByRole("link", { name: /cards/i })
      .first()
      .click();
    await page.waitForURL(/\/reading\/cards/, { timeout: 5_000 });
    const display = page.getByTestId("deck-display");
    await expect(display).toContainText("Sideboard");
    await expect(display).toContainText("Sol Ring");
    await expect(display).toContainText("Atraxa, Praetors' Voice");
  });
});
