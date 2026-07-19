import { test, CruciblePage, SAMPLE_PILE } from "./crucible-helpers";
import { expect, DEFAULT_META_ENVELOPE } from "./fixtures";

const META_LENS = "By Meta";

/** Override the default (empty) /api/deck-meta mock with the rich Atraxa
 * envelope so the meta lens has inclusion data to group by. */
async function mockRichMeta(crucible: CruciblePage) {
  await crucible.page.unroute("**/api/deck-meta");
  await crucible.page.route("**/api/deck-meta", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEFAULT_META_ENVELOPE),
    })
  );
}

function groupHeader(crucible: CruciblePage, label: string) {
  return crucible.page.getByRole("button", { name: `${label} group` });
}

test.describe("Crucible — Meta (Stock ↔ Spicy) lens", () => {
  test("the Meta lens is present but not selected by default", async ({ crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    const metaButton = crucible.page
      .getByTestId("crucible-lens-switcher")
      .getByRole("button", { name: META_LENS });
    await expect(metaButton).toBeVisible();
    await expect(metaButton).toHaveAttribute("aria-pressed", "false");
    // No stock/spice grouping until the lens is chosen.
    await expect(groupHeader(crucible, "Staples")).toHaveCount(0);
  });

  test("with no commander, the lens prompts to pick one", async ({ crucible }) => {
    await crucible.importPile(SAMPLE_PILE);
    await crucible.selectLens(META_LENS);
    await expect(groupHeader(crucible, "No commander yet")).toBeVisible();
  });

  test("with a commander, it regroups into Staples / Flex / Spice", async ({ crucible }) => {
    await mockRichMeta(crucible);
    await crucible.importPile(SAMPLE_PILE);
    await crucible.chooseCommander("Atraxa, Praetors' Voice");
    await crucible.selectLens(META_LENS);

    // Sol Ring / Command Tower / Arcane Signet (≥50%) → Staples.
    await expect(groupHeader(crucible, "Staples")).toBeVisible();
    // Counterspell (6%) and unknown cards → Spice.
    await expect(groupHeader(crucible, "Spice")).toBeVisible();
    await expect(crucible.row("Sol Ring")).toBeVisible();
  });
});
