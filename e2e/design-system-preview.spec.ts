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
      "ManaCost",
      "ColorPie",
      "CurveConstellation",
      "CardRow",
      "DeckHero",
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

  test("ManaCost renders one Scryfall SVG per symbol with the right size", async ({
    page,
  }) => {
    const mc = page.getByTestId("preview-manacost");
    // {2}{U}{G} demo cost should produce 3 pips. The preview renders the
    // same cost at md and lg sizes; .first() picks the md instance.
    const cost = mc
      .getByLabel("Mana cost: 2 generic, 1 blue, 1 green")
      .first();
    await expect(cost).toBeVisible();
    const pips = cost.locator("[data-pip]");
    await expect(pips).toHaveCount(3);
    // First pip is "2" generic, served by Scryfall at the default md (16px) size.
    await expect(pips.first()).toHaveAttribute(
      "src",
      /scryfall\.io\/card-symbols\/2\.svg/,
    );
    await expect(pips.first()).toHaveAttribute("width", "16");
    await expect(pips.last()).toHaveAttribute(
      "src",
      /scryfall\.io\/card-symbols\/G\.svg/,
    );
  });

  test("ColorPie renders one segment per non-zero color", async ({ page }) => {
    const pie = page.getByTestId("preview-colorpie");
    // 4 non-zero colors in our demo (W, U, R, G — B is 0, C is 0)
    await expect(pie.locator('[data-segment]')).toHaveCount(4);
  });

  test("CurveConstellation renders a planet per CMC bucket", async ({
    page,
  }) => {
    const cc = page.getByTestId("preview-curveconstellation");
    // 8 buckets: 0,1,2,3,4,5,6,7+
    await expect(cc.locator('[data-planet]')).toHaveCount(8);
  });

  test("CardRow exposes qty, name, role tag, and price", async ({ page }) => {
    const cr = page.getByTestId("preview-cardrow");
    await expect(cr.getByText("Slogurk, the Overslime")).toBeVisible();
    await expect(cr.getByText("COMMANDER")).toBeVisible();
    await expect(cr.getByText("$4.20")).toBeVisible();
  });

  test("DeckHero shows eyebrow, title, tagline, and power score", async ({
    page,
  }) => {
    const hero = page.getByTestId("preview-deckhero");
    await expect(hero.getByText(/READING/i)).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: /Slogurk, the Overslime/i }),
    ).toBeVisible();
    await expect(hero.getByText(/landfall engine/i)).toBeVisible();
    await expect(hero.getByText("7.4")).toBeVisible();
    await expect(hero.getByText(/UPGRADED BRACKET/i)).toBeVisible();
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
