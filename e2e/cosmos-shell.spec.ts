import { test, expect } from "@playwright/test";

test.describe("Cosmos shell — fixed background + top nav", () => {
  test("renders the cosmos background layer behind content", async ({
    page,
  }) => {
    await page.goto("/");
    const bg = page.getByTestId("cosmos-background");
    await expect(bg).toBeAttached();

    const layout = await bg.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, zIndex: cs.zIndex };
    });
    expect(layout.position).toBe("fixed");
    expect(Number(layout.zIndex)).toBeLessThanOrEqual(0);
  });

  test("top nav exposes brand link, navigation tabs, and right meta", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /main navigation/i });
    await expect(nav).toBeVisible();

    // Brand mark links home
    const brand = nav.getByRole("link", { name: /astral.*home|deck evaluator/i });
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute("href", "/");

    // Tabs
    await expect(nav.getByRole("link", { name: /compare/i })).toBeVisible();

    // Right-meta region present
    await expect(nav.getByTestId("nav-meta")).toBeAttached();
  });

  test("active tab gets aria-current=page", async ({ page }) => {
    await page.goto("/compare");
    const compareLink = page
      .getByRole("navigation", { name: /main navigation/i })
      .getByRole("link", { name: /compare/i });
    await expect(compareLink).toHaveAttribute("aria-current", "page");
  });

  test("brand wordmark hides below 768px while icon stays", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const wordmark = page.getByTestId("brand-wordmark");
    const icon = page.getByTestId("brand-icon");
    await expect(icon).toBeVisible();
    await expect(wordmark).toBeHidden();
  });
});
