import { test, expect } from "@playwright/test";

test.describe("/preview — Astral primitives gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/preview");
  });

  test("renders all primitive sections", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: /Astral · Primitives/i }),
    ).toBeVisible();

    for (const section of [
      "Eyebrow",
      "Button",
      "Input",
      "Card",
      "Tag",
      "CardTag",
      "StatTile",
      "Sheet",
    ]) {
      await expect(
        page.getByRole("heading", { level: 2, name: section, exact: true }),
      ).toBeVisible();
    }
  });

  test("renders all Button variants and sizes", async ({ page }) => {
    const buttonSection = page.getByTestId("preview-button");
    for (const label of [
      "Primary md",
      "Primary sm",
      "Primary lg",
      "Primary disabled",
      "Secondary md",
      "Ghost md",
      "Danger md",
    ]) {
      await expect(
        buttonSection.getByRole("button", { name: label }),
      ).toBeVisible();
    }
    await expect(buttonSection.getByLabel("Close")).toBeVisible();
  });

  test("renders Input states including error and disabled", async ({
    page,
  }) => {
    const inputSection = page.getByTestId("preview-input");
    await expect(inputSection.getByPlaceholder(/Search by name/)).toBeVisible();
    await expect(
      inputSection.getByPlaceholder(/moxfield\.com\/decks/),
    ).toBeVisible();
    await expect(inputSection.getByPlaceholder("Disabled")).toBeDisabled();
    await expect(inputSection.getByRole("textbox", { name: /URL/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("renders CardTag for every deck role", async ({ page }) => {
    const cardTagSection = page.getByTestId("preview-cardtag");
    for (const role of [
      "COMMANDER",
      "ENGINE",
      "DRAW",
      "RAMP",
      "REMOVAL",
      "WINCON",
    ]) {
      await expect(cardTagSection.getByText(role, { exact: true })).toBeVisible();
    }
  });

  test("Sheet opens and closes via trigger and escape key", async ({ page }) => {
    const sheetSection = page.getByTestId("preview-sheet");
    await sheetSection.getByRole("button", { name: /Open sheet/i }).click();

    const dialog = page.getByRole("dialog", { name: /Crucible of Worlds/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Re-open and close via the close button.
    await sheetSection.getByRole("button", { name: /Open sheet/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Close sheet/i }).click();
    await expect(dialog).toBeHidden();
  });
});
