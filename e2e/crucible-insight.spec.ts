import {
  test,
  expect,
  SAMPLE_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

const FAKE_COMBO = {
  id: "test-combo-1",
  cards: ["Sol Ring", "Counterspell"],
  description: "A purely hypothetical engine for testing.",
  produces: ["Infinite testing"],
  missingCards: [],
  templateRequirements: [],
  manaNeeded: "",
  bracketTag: "",
  identity: "wu",
  type: "exact",
};

test.describe("Crucible insight panels", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("Charts renders curve and pip coverage for the kept subset with a pool toggle", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await crucible.keepButton("Sol Ring").click();

    await crucible.selectLens("Charts");
    const charts = page.getByTestId("crucible-charts");
    await expect(charts).toBeVisible();
    await expect(charts).toContainText(/mana curve/i);
    await expect(charts).toContainText(/pip coverage/i);

    const poolToggle = charts.getByRole("button", { name: /pool/i });
    await expect(poolToggle).toHaveAttribute("aria-pressed", "false");
    await poolToggle.click();
    await expect(poolToggle).toHaveAttribute("aria-pressed", "true");
  });

  test("Combos derive intact, possible, and broken states from triage", async ({ page, crucible }) => {
    await page.route("**/api/deck-combos", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ exactCombos: [FAKE_COMBO], nearCombos: [] }),
      })
    );

    await crucible.importPile(SAMPLE_PILE);
    await crucible.selectLens("Combos in Pile");

    const combos = page.getByTestId("crucible-combos");
    await expect(combos).toContainText("Sol Ring");
    await expect(combos).toContainText(/possible/i);

    await crucible.selectLens("By Category");
    await crucible.keepButton("Sol Ring").click();
    await crucible.keepButton("Counterspell").click();
    await crucible.selectLens("Combos in Pile");
    await expect(combos).toContainText(/intact/i);

    await crucible.selectLens("By Category");
    await crucible.cutButton("Counterspell").click();
    await crucible.selectLens("Combos in Pile");
    await expect(combos).toContainText(/broken/i);
    await combos.getByRole("button", { name: "Restore Counterspell" }).click();
    await expect(combos).not.toContainText(/broken/i);
  });

  test("Suggested Cuts ranks off-identity cards with reasons; accepting cuts, dismissing hides", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await crucible.chooseCommander("Atraxa, Praetors' Voice");

    await crucible.selectLens("Suggested Cuts");
    const suggestions = page.getByTestId("crucible-suggested-cuts");
    await expect(suggestions).toContainText("Lightning Bolt");
    await expect(suggestions).toContainText(/off-identity/i);

    await suggestions.getByRole("button", { name: "Cut Lightning Bolt" }).click();
    await expect(suggestions).not.toContainText("Lightning Bolt");

    // Dismissing removes without cutting.
    const dismissable = suggestions.getByRole("button", { name: /^Dismiss / }).first();
    if (await dismissable.isVisible()) {
      const label = await dismissable.getAttribute("aria-label");
      const name = label?.replace(/^Dismiss /, "") ?? "";
      await dismissable.click();
      await expect(suggestions).not.toContainText(name);
    }
  });

  test("Game Changers lens lists flagged cards with the kept count", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.selectLens("Game Changers");
    const panel = page.getByTestId("crucible-groups");
    await expect(crucible.row("Atraxa, Praetors' Voice")).toBeVisible();
    await expect(panel).not.toContainText("Counterspell");
  });
});
