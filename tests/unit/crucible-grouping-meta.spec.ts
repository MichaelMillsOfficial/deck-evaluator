import { test, expect } from "@playwright/test";
import { groupByMeta } from "../../src/lib/crucible-grouping";
import { normalizeCardName } from "../../src/lib/edhrec-meta";
import { makeCard } from "../helpers";
import type { DeckCard, EnrichedCard } from "../../src/lib/types";

function pool(...names: string[]): DeckCard[] {
  return names.map((name) => ({ name, quantity: 1 }));
}

function mapOf(...cards: EnrichedCard[]): Record<string, EnrichedCard> {
  const m: Record<string, EnrichedCard> = {};
  for (const c of cards) m[c.name] = c;
  return m;
}

const inclusion = {
  [normalizeCardName("Sol Ring")]: 0.96,
  [normalizeCardName("Doubling Season")]: 0.71,
  [normalizeCardName("Evolution Sage")]: 0.38,
  [normalizeCardName("Contentious Plan")]: 0.06,
};

test.describe("groupByMeta", () => {
  test("buckets cards into Staples / Flex / Spice, with Lands and Unresolved", () => {
    const cardMap = mapOf(
      makeCard({ name: "Sol Ring", typeLine: "Artifact" }),
      makeCard({ name: "Doubling Season", typeLine: "Enchantment" }),
      makeCard({ name: "Evolution Sage", typeLine: "Creature" }),
      makeCard({ name: "Contentious Plan", typeLine: "Sorcery" }),
      makeCard({ name: "Forest", typeLine: "Basic Land — Forest" })
    );
    const groups = groupByMeta(
      pool("Sol Ring", "Doubling Season", "Evolution Sage", "Contentious Plan", "Forest", "Mystery Card"),
      cardMap,
      inclusion
    );
    const byId = Object.fromEntries(groups.map((g) => [g.id, g.cards.map((c) => c.name)]));

    expect(byId["staples"]).toEqual(["Doubling Season", "Sol Ring"]);
    expect(byId["flex"]).toEqual(["Evolution Sage"]);
    expect(byId["spice"]).toEqual(["Contentious Plan"]);
    expect(byId["lands"]).toEqual(["Forest"]);
    expect(byId["unresolved"]).toEqual(["Mystery Card"]);
  });

  test("a card with no EDHREC data falls into Spice", () => {
    const cardMap = mapOf(makeCard({ name: "Homebrew Engine", typeLine: "Artifact" }));
    const groups = groupByMeta(pool("Homebrew Engine"), cardMap, inclusion);
    const spice = groups.find((g) => g.id === "spice");
    expect(spice?.cards.map((c) => c.name)).toEqual(["Homebrew Engine"]);
  });

  test("empty inclusion map returns no bucket groups (only unresolved/lands)", () => {
    const cardMap = mapOf(makeCard({ name: "Sol Ring", typeLine: "Artifact" }));
    const groups = groupByMeta(pool("Sol Ring"), cardMap, {});
    // With no data, Sol Ring is inclusion 0 → spice bucket.
    expect(groups.find((g) => g.id === "spice")?.cards.map((c) => c.name)).toEqual(["Sol Ring"]);
  });
});
