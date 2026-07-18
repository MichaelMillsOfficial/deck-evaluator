import {
  test,
  expect,
  SAMPLE_PILE,
  mockCommanderRules,
} from "./crucible-helpers";

test.describe("Crucible triage", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("keep and cut toggles update row state and the kept counter", async ({ crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.keepButton("Sol Ring").click();
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "true");
    await expect(crucible.keptCount).toContainText("1");

    await crucible.cutButton("Counterspell").click();
    await expect(crucible.cutButton("Counterspell")).toHaveAttribute("aria-pressed", "true");
    await expect(crucible.keptCount).toContainText("1");

    // Toggling keep off returns the card to undecided.
    await crucible.keepButton("Sol Ring").click();
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "false");
    await expect(crucible.keptCount).toContainText("0");
  });

  test("cut rows stay visible dimmed, collect in the Cut Pile, and restore", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.cutButton("Counterspell").click();
    await expect(crucible.row("Counterspell").first()).toHaveAttribute("data-status", "cut");

    await crucible.selectLens("Cut Pile");
    await expect(crucible.row("Counterspell")).toBeVisible();
    await crucible.restoreButton("Counterspell").click();
    await expect(page.getByTestId("crucible-cut-pile")).not.toContainText("Counterspell");
  });

  test("lens switching regroups without losing statuses", async ({ crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.keepButton("Sol Ring").click();
    await crucible.selectLens("By Type Line");
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "true");
  });

  test("category groups collapse and the undecided filter hides decided rows", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    // Collapse the Lands group.
    const landsToggle = page.getByRole("button", { name: /lands group/i });
    await expect(landsToggle).toHaveAttribute("aria-expanded", "true");
    await landsToggle.click();
    await expect(landsToggle).toHaveAttribute("aria-expanded", "false");
    await expect(crucible.row("Forest")).toHaveCount(0);

    // Undecided-only filter hides kept rows.
    await crucible.keepButton("Sol Ring").click();
    await page.getByRole("button", { name: /undecided only/i }).click();
    await expect(crucible.row("Sol Ring")).toHaveCount(0);
    await page.getByRole("button", { name: /undecided only/i }).click();
    await expect(crucible.row("Sol Ring").first()).toBeVisible();
  });

  test("commander picker lists legal commanders and flags off-identity cards", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toBeVisible();

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await expect(crucible.commanderPicker).toContainText("Atraxa, Praetors' Voice");
    // Lightning Bolt (R) is outside Atraxa's WUBG identity.
    await expect(crucible.row("Lightning Bolt").first()).toContainText(/off-identity/i);
  });

  test("reloading mid-triage restores statuses from sessionStorage", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.keepButton("Sol Ring").click();
    await crucible.cutButton("Counterspell").click();

    await page.reload();
    await crucible.workbench.waitFor({ timeout: 15_000 });
    await expect(crucible.keepButton("Sol Ring")).toHaveAttribute("aria-pressed", "true");
    await expect(crucible.cutButton("Counterspell")).toHaveAttribute("aria-pressed", "true");
  });

  test("hovering a card name reveals its preview", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.row("Sol Ring").first().getByTestId("crucible-card-name").hover();
    const preview = page.getByTestId("crucible-card-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Artifact");
  });
});
