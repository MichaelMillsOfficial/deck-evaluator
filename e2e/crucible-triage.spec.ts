import {
  test,
  expect,
  SAMPLE_PILE,
  HUNDRED_PILE,
  PARTNER_PILE,
  BACKGROUND_PILE,
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

  test("commander candidates live in a popover, not inline in the header", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    // Candidates are collapsed behind a fixed-height trigger — nothing
    // renders inline in the header until the popover opens.
    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toHaveCount(0);
    await expect(crucible.commanderTrigger).toContainText(/choose from 2 candidates/i);

    await crucible.openCommanderPopover();
    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toBeVisible();

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await expect(crucible.commanderPopover).toHaveCount(0);
    await expect(crucible.commanderPicker).toContainText("Atraxa, Praetors' Voice");
    // Lightning Bolt (R) is outside Atraxa's WUBG identity.
    await expect(crucible.row("Lightning Bolt").first()).toContainText(/off-identity/i);
  });

  test("the commander popover filters candidates and closes on Escape", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.openCommanderPopover();
    await page.getByLabel("Filter commander candidates").fill("ezuri");
    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(crucible.commanderPopover).toHaveCount(0);

    // Reopening starts from a clean, unfiltered list.
    await crucible.openCommanderPopover();
    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toBeVisible();
  });

  test("the commander popover is navigable by arrow keys and Enter selects", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.openCommanderPopover();
    // The filter input holds focus on open; ArrowDown steps into the list.
    const firstOption = page.getByRole("button", {
      name: "Choose Atraxa, Praetors' Voice",
    });
    await expect(page.getByLabel("Filter commander candidates")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(firstOption).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toBeFocused();
    // ArrowUp returns to the first option, then Enter chooses it.
    await page.keyboard.press("ArrowUp");
    await expect(firstOption).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(crucible.commanderPopover).toHaveCount(0);
    await expect(crucible.commanderPicker).toContainText("Atraxa, Praetors' Voice");
  });

  test("stacked rows keep a partial count via the kept-copies input", async ({ page, crucible }) => {
    await crucible.importPile(HUNDRED_PILE);

    await page.getByLabel("Kept copies of Forest").fill("30");
    await expect(crucible.keptCount).toContainText("30");
    await expect(crucible.keepButton("Forest")).toHaveAttribute("aria-pressed", "true");

    // The all-or-nothing buttons still work as shortcuts: toggling keep off
    // and on again snaps back to the full stack.
    await crucible.keepButton("Forest").click();
    await expect(crucible.keptCount).toContainText("0");
    await crucible.keepButton("Forest").click();
    await expect(crucible.keptCount).toContainText("59");
  });

  test("a chosen commander is locked to keep", async ({ crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await expect(crucible.keepButton("Atraxa, Praetors' Voice").first()).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(crucible.cutButton("Atraxa, Praetors' Voice").first()).toBeDisabled();
    await expect(crucible.keptCount).toContainText("1");
  });

  test("a legal Partner pair can be selected and removed; non-partners are not offered", async ({ page, crucible }) => {
    await crucible.importPile(PARTNER_PILE);

    await crucible.chooseCommander("Thrasios, Triton Hero");
    await expect(crucible.commanderPicker).toContainText("Add a partner");
    await crucible.openCommanderPopover();
    await expect(
      page.getByRole("button", { name: "Choose Tymna the Weaver" })
    ).toBeVisible();
    // Atraxa and Ezuri are legal solo commanders but have no Partner ability,
    // so they must not be offered as a second commander.
    await expect(
      page.getByRole("button", { name: "Choose Atraxa, Praetors' Voice" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toHaveCount(0);

    await crucible.chooseCommander("Tymna the Weaver");
    await expect(crucible.commanderPicker).toContainText("Thrasios, Triton Hero");
    await expect(crucible.commanderPicker).toContainText("Tymna the Weaver");

    await page.getByRole("button", { name: "Remove Tymna the Weaver" }).click();
    await expect(
      page.getByRole("button", { name: "Remove Tymna the Weaver" })
    ).toHaveCount(0);
    await expect(crucible.commanderPicker).toContainText("Thrasios, Triton Hero");
  });

  test("a non-partner second commander cannot be chosen from the picker", async ({ page, crucible }) => {
    await crucible.importPile(SAMPLE_PILE);

    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await expect(crucible.commanderPicker).not.toContainText("Add a partner");
    await expect(
      page.getByRole("button", { name: "Choose Ezuri, Stalker of Spheres" })
    ).toHaveCount(0);
  });

  test("a Background pairs with its Choose-a-Background commander and seals legal", async ({ page, crucible }) => {
    await crucible.importPile(BACKGROUND_PILE);

    // A Background is never offered as a solo commander.
    await crucible.openCommanderPopover();
    await expect(
      page.getByRole("button", { name: "Choose Wilson, Refined Grizzly" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose Raised by Giants" })
    ).toHaveCount(0);

    await crucible.chooseCommander("Wilson, Refined Grizzly");
    await expect(crucible.commanderPicker).toContainText("Add a partner");
    await crucible.chooseCommander("Raised by Giants");
    await expect(crucible.commanderPicker).toContainText("Wilson, Refined Grizzly");
    await expect(crucible.commanderPicker).toContainText("Raised by Giants");

    await crucible.keepButton("Forest").click();
    await expect(crucible.keptCount).toContainText("100");
    await expect(crucible.sealButton).toBeEnabled();
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
