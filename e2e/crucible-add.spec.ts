import {
  test,
  expect,
  SAMPLE_PILE,
  mockCommanderRules,
  mockAutocomplete,
  searchAndAdd,
} from "./crucible-helpers";

test.describe("Crucible add cards mid-triage", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
    await mockAutocomplete(page);
  });

  test("searching adds a new card to the pool as undecided", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await expect(crucible.poolCount).toContainText("16");

    await searchAndAdd(page, "Birds", "Birds of Paradise");

    await expect(crucible.poolCount).toContainText("17");
    await expect(crucible.row("Birds of Paradise").first()).toBeVisible();
    await expect(crucible.keepButton("Birds of Paradise")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(crucible.keptCount).toContainText("0");
  });

  test("adding a card already in the pile bumps its quantity and keeps its status", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await crucible.keepButton("Sol Ring").click();

    await searchAndAdd(page, "Sol R", "Sol Ring");

    await expect(crucible.poolCount).toContainText("17");
    await expect(crucible.row("Sol Ring").first()).toContainText("2");
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "true");
  });

  test("a failing card search surfaces an error instead of silently showing nothing", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await page.route("**/api/card-autocomplete**", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scryfall autocomplete request failed" }),
      })
    );

    await page.locator("#card-search-input").fill("Birds");
    await expect(page.getByTestId("card-search-error")).toBeVisible();
    await expect(page.getByTestId("card-search-error")).toContainText(/search/i);
  });

  test("an added legendary becomes a commander candidate and additions survive reload", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await searchAndAdd(page, "Tymna", "Tymna the Weaver");
    await crucible.openCommanderPopover();
    await expect(
      page.getByRole("button", { name: "Choose Tymna the Weaver" })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.reload();
    await crucible.workbench.waitFor({ timeout: 15_000 });
    await expect(crucible.row("Tymna the Weaver").first()).toBeVisible();
    await expect(crucible.poolCount).toContainText("17");
  });
});
