import { test, expect, mockCommanderRules } from "./crucible-helpers";

const SAMPLE_DCK = `[metadata]
Name=My Test Pile
[Commander]
1 Atraxa, Praetors' Voice
[Main]
1 Sol Ring
3 Forest
`;

test.describe("Crucible .dck import", () => {
  test.beforeEach(async ({ page }) => {
    await mockCommanderRules(page);
  });

  test("importing a .dck file loads the pile straight into the workbench", async ({
    page,
    crucible,
  }) => {
    await crucible.goto();

    await page.getByTestId("crucible-dck-input").setInputFiles({
      name: "pile.dck",
      mimeType: "text/plain",
      buffer: Buffer.from(SAMPLE_DCK),
    });

    await crucible.workbench.waitFor({ timeout: 15_000 });
    await expect(crucible.row("Sol Ring").first()).toBeVisible();
    await expect(crucible.row("Forest").first()).toBeVisible();
    // The commander from the file is pre-selected.
    await expect(crucible.commanderPicker).toContainText("Atraxa, Praetors' Voice");
  });

  test("a malformed file surfaces an error and stays on the import screen", async ({
    page,
    crucible,
  }) => {
    await crucible.goto();

    await page.getByTestId("crucible-dck-input").setInputFiles({
      name: "bad.dck",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not a deck file at all"),
    });

    await expect(
      page.getByText("That file is not a readable .dck pile.")
    ).toBeVisible();
    await expect(crucible.workbench).toHaveCount(0);
  });
});
