import { test, expect } from "@playwright/test";

test.describe("Home page · Astral chrome", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders eyebrow, title, and tagline in the hero", async ({ page }) => {
    await expect(
      page.getByText(/DECK EVALUATION · BEGIN A READING/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Magic: The Gathering Deck Evaluator/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Import your deck and analyze its performance/i),
    ).toBeVisible();
  });

  test("Compare callout links to /compare", async ({ page }) => {
    const callout = page
      .getByRole("region", { name: /Compare Decks/i })
      .or(page.locator("section,div").filter({ hasText: /SIDE BY SIDE/i }))
      .first();
    await expect(callout).toBeVisible();
    await expect(callout.getByRole("link", { name: /Compare Decks/i })).toHaveAttribute(
      "href",
      "/compare",
    );
  });

  test("Features section lists six features", async ({ page }) => {
    const features = page.getByRole("heading", { name: "Features", level: 2 });
    await expect(features).toBeVisible();
    const list = features.locator("..").locator("ul li");
    await expect(list).toHaveCount(6);
  });
});
