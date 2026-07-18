import {
  test,
  expect,
  SAMPLE_PILE,
  TRAILING_COMMANDER_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

test.describe("Crucible pile import", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("renders the import form with the eyebrow pattern and nav entry", async ({ page, crucible }) => {
    await crucible.goto();

    await expect(page.getByTestId("section-header-crucible")).toBeVisible();
    await expect(crucible.pileTextarea).toBeVisible();
    await expect(crucible.submitButton).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /main navigation/i }).getByRole("link", { name: "The Crucible" })
    ).toBeVisible();
  });

  test("pasting a pile shows the cosmic loader, then the workbench with every card undecided", async ({ page, crucible }) => {
    // Delay enrichment so the loader is observable, then fall through to the
    // fixture-bank mock registered by the deckPage fixture.
    await page.route("**/api/deck-enrich", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fallback();
    });

    await crucible.goto();
    await crucible.pileTextarea.fill(SAMPLE_PILE);
    await crucible.submitButton.click();

    await expect(page.getByTestId("cosmic-loader")).toBeVisible();
    await crucible.workbench.waitFor({ timeout: 15_000 });

    await expect(crucible.poolCount).toContainText("16");
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "false");
    await expect(crucible.cutButton("Sol Ring")).toHaveAttribute("aria-pressed", "false");
    await expect(crucible.keptCount).toContainText("0");
  });

  test("a trailing blank-line group stays in the pool instead of becoming the commander", async ({ crucible }) => {
    await crucible.importPile(TRAILING_COMMANDER_PILE);

    await expect(crucible.row("Ezuri, Stalker of Spheres")).toBeVisible();
    await expect(crucible.commanderPicker).toContainText(/choose a commander/i);
  });
});
