import {
  test,
  expect,
  LARGE_PILE,
  LARGE_PILE_SIZE,
  SAMPLE_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

const ALL_ROWS = '[data-testid^="crucible-row-"]';

function relic(n: number) {
  return `Relic ${String(n).padStart(3, "0")}`;
}

test.describe("Crucible row virtualization", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("large piles render only a windowed subset of rows", async ({
    page,
    crucible,
  }) => {
    await crucible.importPile(LARGE_PILE);
    await crucible.selectLens("Flat List");

    // The first rows are on screen from the start.
    await expect(crucible.row(relic(1))).toBeVisible();

    // Virtualization means the DOM holds far fewer rows than the full pile.
    const rendered = await page.locator(ALL_ROWS).count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(LARGE_PILE_SIZE);

    // A row deep in the list is not mounted while the top is in view.
    await expect(crucible.row(relic(LARGE_PILE_SIZE))).toHaveCount(0);
  });

  test("scrolling mounts previously-absent rows", async ({ page, crucible }) => {
    await crucible.importPile(LARGE_PILE);
    await crucible.selectLens("Flat List");

    const lastRow = crucible.row(relic(LARGE_PILE_SIZE));
    await expect(lastRow).toHaveCount(0);

    // Scroll the whole page to the bottom; the window virtualizer should mount
    // the tail rows that were absent before.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(lastRow).toBeVisible();

    // And the very first row is now virtualized out of the DOM.
    await expect(crucible.row(relic(1))).toHaveCount(0);
  });

  test("collapsing a group still removes its rows under virtualization", async ({
    page,
    crucible,
  }) => {
    await crucible.importPile(LARGE_PILE);
    await crucible.selectLens("Flat List");

    await expect(crucible.row(relic(1))).toBeVisible();

    const groupToggle = page.getByRole("button", { name: /all cards group/i });
    await expect(groupToggle).toHaveAttribute("aria-expanded", "true");
    await groupToggle.click();
    await expect(groupToggle).toHaveAttribute("aria-expanded", "false");

    // No card rows remain once the only group is collapsed.
    await expect(page.locator(ALL_ROWS)).toHaveCount(0);
  });

  test("keep toggle works on a virtualized row", async ({ crucible }) => {
    await crucible.importPile(LARGE_PILE);
    await crucible.selectLens("Flat List");

    await crucible.keepButton(relic(1)).click();
    await expect(crucible.keepButton(relic(1))).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(crucible.keptCount).toContainText("1");
  });

  test("small piles render every row for scroll-free access", async ({
    page,
    crucible,
  }) => {
    await crucible.importPile(SAMPLE_PILE);
    await crucible.selectLens("Flat List");

    // A dozen-ish rows all fit; Sol Ring and a land are both present at once.
    await expect(crucible.row("Sol Ring")).toBeVisible();
    await expect(crucible.row("Forest")).toBeVisible();
    await expect(crucible.row("Island")).toBeVisible();

    const rendered = await page.locator(ALL_ROWS).count();
    expect(rendered).toBeGreaterThanOrEqual(13);
  });
});
