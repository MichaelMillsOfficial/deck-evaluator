import type { Page } from "@playwright/test";
import {
  test,
  expect,
  SAMPLE_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

/** Mock the autocomplete with a tiny catalog; the real route hits Scryfall. */
async function mockAutocomplete(page: Page) {
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

async function addCard(page: Page, query: string, name: string) {
  await page.locator("#card-search-input").fill(query);
  const option = page.getByRole("option", { name });
  await option.waitFor({ timeout: 5_000 });
  await option.click();
}

test.describe("Crucible add cards mid-triage", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
    await mockAutocomplete(page);
  });

  test("searching adds a new card to the pool as undecided", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await expect(crucible.poolCount).toContainText("16");

    await addCard(page, "Birds", "Birds of Paradise");

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

    await addCard(page, "Sol R", "Sol Ring");

    await expect(crucible.poolCount).toContainText("17");
    await expect(crucible.row("Sol Ring").first()).toContainText("2");
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "true");
  });

  test("an added legendary becomes a commander candidate and additions survive reload", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await addCard(page, "Tymna", "Tymna the Weaver");
    await expect(
      page.getByRole("button", { name: "Choose Tymna the Weaver" })
    ).toBeVisible();

    await page.reload();
    await crucible.workbench.waitFor({ timeout: 15_000 });
    await expect(crucible.row("Tymna the Weaver").first()).toBeVisible();
    await expect(crucible.poolCount).toContainText("17");
  });
});
