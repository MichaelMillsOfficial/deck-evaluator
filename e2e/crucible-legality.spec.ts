import {
  test,
  expect,
  SAMPLE_PILE,
  HUNDRED_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

test.describe("Crucible tracker and legality gate", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("rail shows kept count, category health, and the legality checklist", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await expect(crucible.tracker).toBeVisible();
    await expect(crucible.keptCount).toContainText("0");
    await expect(crucible.tracker).toContainText(/legality/i);
    await expect(crucible.sealButton).toBeDisabled();

    await crucible.keepButton("Sol Ring").click();
    await expect(crucible.keptCount).toContainText("1");
    await expect(page.getByTestId("crucible-category-health")).toBeVisible();
  });

  test("Seal the Deck enables only when the kept hundred is legal", async ({ crucible }) => {
    await crucible.importPile(HUNDRED_PILE);

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await crucible.keepButton("Forest").click();
    await expect(crucible.sealButton).toBeDisabled();

    await crucible.keepButton("Island").click();
    await expect(crucible.keptCount).toContainText("100");
    await expect(crucible.sealButton).toBeEnabled();

    // Cutting below 100 disables it again.
    await crucible.cutButton("Island").click();
    await expect(crucible.sealButton).toBeDisabled();
  });

  test("below 768px the tracker moves into a bottom sheet", async ({ page, crucible }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await crucible.importPile(SAMPLE_PILE);

    await expect(crucible.tracker).toBeHidden();
    await page.getByRole("button", { name: /open tracker/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("crucible-kept-count")).toContainText("0");
  });
});
