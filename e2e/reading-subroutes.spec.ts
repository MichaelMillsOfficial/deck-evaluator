import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

const SUB_ROUTES: Array<{
  path: string;
  slug: string;
  expectedTitle: RegExp;
}> = [
  { path: "/reading/cards", slug: "cards", expectedTitle: /the decklist/i },
  { path: "/reading/composition", slug: "composition", expectedTitle: /shape of the deck/i },
  { path: "/reading/synergy", slug: "synergy", expectedTitle: /how the cards read together/i },
  { path: "/reading/interactions", slug: "interactions", expectedTitle: /mechanics in play/i },
  { path: "/reading/hands", slug: "hands", expectedTitle: /first seven/i },
  { path: "/reading/goldfish", slug: "goldfish", expectedTitle: /goldfish reading/i },
  { path: "/reading/suggestions", slug: "suggestions", expectedTitle: /what to cut, what to add/i },
  { path: "/reading/add", slug: "add", expectedTitle: /possible additions/i },
  { path: "/reading/compare", slug: "compare", expectedTitle: /original vs modified/i },
  { path: "/reading/share", slug: "share", expectedTitle: /take it elsewhere/i },
];

test.describe("/reading/* sub-route fan-out", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.page.waitForURL(/\/reading(\/|$|\?)/, { timeout: 15_000 });
  });

  for (const route of SUB_ROUTES) {
    test(`${route.path} renders its editorial header`, async ({ deckPage }) => {
      await deckPage.page.goto(route.path);
      const header = deckPage.page.getByTestId(`section-header-${route.slug}`);
      await expect(header).toBeVisible({ timeout: 15_000 });
      await expect(header.getByRole("heading", { name: route.expectedTitle })).toBeVisible();
    });
  }

  test("sidebar nav links to all sub-routes (active state follows pathname)", async ({
    deckPage,
  }) => {
    await deckPage.page.goto("/reading/cards");
    await deckPage.waitForDeckDisplay();
    const sidebar = deckPage.page.getByTestId("deck-header");

    // Click "Synergy" — soft nav, no full reload.
    await sidebar.getByRole("tab", { name: "Synergy" }).click();
    await deckPage.page.waitForURL(/\/reading\/synergy/, { timeout: 5_000 });
    await expect(
      deckPage.page.getByTestId("section-header-synergy")
    ).toBeVisible();

    // The Synergy tab should now report aria-selected="true".
    await expect(
      sidebar.getByRole("tab", { name: "Synergy" })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("chapter footer renders prev/next/index links per editorial order", async ({
    deckPage,
  }) => {
    // First chapter: no prev, next is Composition (the second item).
    await deckPage.page.goto("/reading/cards");
    const firstFooter = deckPage.page.getByTestId("chapter-footer-list");
    await expect(firstFooter).toBeVisible({ timeout: 15_000 });
    await expect(firstFooter.getByRole("link", { name: /all sections/i })).toBeVisible();
    await expect(firstFooter.getByRole("link", { name: /analysis/i })).toBeVisible();

    // Middle chapter: both prev (Synergy) and next (Hands) wired.
    await deckPage.page.goto("/reading/interactions");
    const midFooter = deckPage.page.getByTestId("chapter-footer-interactions");
    await expect(midFooter).toBeVisible({ timeout: 15_000 });
    await expect(midFooter.getByRole("link", { name: /synergy/i })).toBeVisible();
    await expect(midFooter.getByRole("link", { name: /hands/i })).toBeVisible();

    // Last chapter: prev is Compare, no next.
    await deckPage.page.goto("/reading/share");
    const lastFooter = deckPage.page.getByTestId("chapter-footer-share");
    await expect(lastFooter).toBeVisible({ timeout: 15_000 });
    await expect(lastFooter.getByRole("link", { name: /compare/i })).toBeVisible();
  });
});
