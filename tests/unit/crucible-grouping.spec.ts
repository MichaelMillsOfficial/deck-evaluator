import { test, expect } from "@playwright/test";
import {
  groupByCategory,
  groupBySynergyAxis,
  groupByTypeLine,
  groupByManaValue,
  groupByColorIdentity,
  gameChangers,
  UNCATEGORIZED_LABEL,
  UNALIGNED_AXIS_ID,
  UNRESOLVED_LABEL,
  UNRESOLVED_GROUP_ID,
  AXIS_RELEVANCE_MIN,
} from "../../src/lib/crucible-grouping";
import { makeCard } from "../helpers";
import type { DeckCard, EnrichedCard } from "../../src/lib/types";

const SOL_RING = makeCard({
  name: "Sol Ring",
  typeLine: "Artifact",
  manaCost: "{1}",
  cmc: 1,
  oracleText: "{T}: Add {C}{C}.",
  isGameChanger: true,
});

const PLAINS = makeCard({
  name: "Plains",
  typeLine: "Basic Land — Plains",
  cmc: 0,
  supertypes: ["Basic"],
});

const VANILLA = makeCard({
  name: "Grizzly Bears",
  typeLine: "Creature — Bear",
  manaCost: "{1}{G}",
  cmc: 2,
  colors: ["G"],
  colorIdentity: ["G"],
});

const TOKEN_MAKER = makeCard({
  name: "Secure the Wastes",
  typeLine: "Instant",
  manaCost: "{X}{W}",
  cmc: 1,
  colors: ["W"],
  colorIdentity: ["W"],
  oracleText: "Create X 1/1 white Warrior creature tokens.",
});

const GOLD_CARD = makeCard({
  name: "Wilt-Leaf Liege",
  typeLine: "Creature — Elf Knight",
  manaCost: "{1}{G/W}{G/W}{G/W}",
  cmc: 4,
  colors: ["G", "W"],
  colorIdentity: ["G", "W"],
});

const BIG_SPELL = makeCard({
  name: "Expropriate",
  typeLine: "Sorcery",
  manaCost: "{7}{U}{U}",
  cmc: 9,
  colors: ["U"],
  colorIdentity: ["U"],
});

function pool(...cards: EnrichedCard[]): {
  pool: DeckCard[];
  cardMap: Record<string, EnrichedCard>;
} {
  return {
    pool: cards.map((c) => ({ name: c.name, quantity: 1 })),
    cardMap: Object.fromEntries(cards.map((c) => [c.name, c])),
  };
}

test.describe("groupByCategory", () => {
  test("lands get their own group, untagged cards land in Uncategorized", () => {
    const { pool: p, cardMap } = pool(SOL_RING, PLAINS, VANILLA);
    const groups = groupByCategory(p, cardMap);

    const lands = groups.find((g) => g.label === "Lands");
    expect(lands?.cards).toEqual([{ name: "Plains", quantity: 1 }]);

    const ramp = groups.find((g) => g.label === "Ramp");
    expect(ramp?.cards.map((c) => c.name)).toContain("Sol Ring");

    const uncategorized = groups.find((g) => g.label === UNCATEGORIZED_LABEL);
    expect(uncategorized?.cards.map((c) => c.name)).toContain("Grizzly Bears");
  });

  test("cards missing from the cardMap are skipped, group cards sort by name", () => {
    const { cardMap } = pool(SOL_RING, PLAINS);
    const p: DeckCard[] = [
      { name: "Sol Ring", quantity: 1 },
      { name: "Unenriched Mystery", quantity: 1 },
      { name: "Plains", quantity: 1 },
    ];
    const groups = groupByCategory(p, cardMap);
    const all = groups.flatMap((g) => g.cards.map((c) => c.name));
    expect(all).not.toContain("Unenriched Mystery");
    for (const g of groups) {
      const names = g.cards.map((c) => c.name);
      expect(names).toEqual([...names].sort());
    }
  });
});

test.describe("groupBySynergyAxis", () => {
  test("assigns each card to its strongest axis only, with other homes listed", () => {
    const { pool: p, cardMap } = pool(TOKEN_MAKER, VANILLA);
    const groups = groupBySynergyAxis(p, cardMap);

    const tokenGroup = groups.find((g) => g.axisId === "tokens");
    expect(tokenGroup).toBeTruthy();
    const entry = tokenGroup!.cards.find((c) => c.name === "Secure the Wastes");
    expect(entry).toBeTruthy();
    expect(entry!.relevance).toBeGreaterThanOrEqual(AXIS_RELEVANCE_MIN);

    // The card must not appear in any other axis group.
    for (const g of groups) {
      if (g.axisId === "tokens" || g.axisId === UNALIGNED_AXIS_ID) continue;
      expect(g.cards.map((c) => c.name)).not.toContain("Secure the Wastes");
    }
  });

  test("cards with no axis above the threshold collect in the unaligned bucket", () => {
    const { pool: p, cardMap } = pool(VANILLA);
    const groups = groupBySynergyAxis(p, cardMap);
    const unaligned = groups.find((g) => g.axisId === UNALIGNED_AXIS_ID);
    expect(unaligned?.cards.map((c) => c.name)).toContain("Grizzly Bears");
  });

  test("axis groups sort cards by relevance desc, then name", () => {
    const { pool: p, cardMap } = pool(TOKEN_MAKER, VANILLA, SOL_RING);
    const groups = groupBySynergyAxis(p, cardMap);
    for (const g of groups) {
      for (let i = 1; i < g.cards.length; i++) {
        const prev = g.cards[i - 1];
        const cur = g.cards[i];
        const ordered =
          prev.relevance > cur.relevance ||
          (prev.relevance === cur.relevance && prev.name <= cur.name);
        expect(ordered).toBe(true);
      }
    }
  });
});

test.describe("groupByTypeLine", () => {
  test("buckets by primary card type with lands separate", () => {
    const { pool: p, cardMap } = pool(SOL_RING, PLAINS, VANILLA, TOKEN_MAKER);
    const groups = groupByTypeLine(p, cardMap);
    expect(groups.find((g) => g.label === "Creature")?.cards.map((c) => c.name)).toContain("Grizzly Bears");
    expect(groups.find((g) => g.label === "Artifact")?.cards.map((c) => c.name)).toContain("Sol Ring");
    expect(groups.find((g) => g.label === "Instant")?.cards.map((c) => c.name)).toContain("Secure the Wastes");
    expect(groups.find((g) => g.label === "Lands")?.cards.map((c) => c.name)).toContain("Plains");
  });
});

test.describe("groupByManaValue", () => {
  test("buckets 0-1, 2, 7+ and keeps lands out of the numeric buckets", () => {
    const { pool: p, cardMap } = pool(SOL_RING, PLAINS, VANILLA, BIG_SPELL);
    const groups = groupByManaValue(p, cardMap);
    expect(groups.find((g) => g.label === "0–1")?.cards.map((c) => c.name)).toContain("Sol Ring");
    expect(groups.find((g) => g.label === "2")?.cards.map((c) => c.name)).toContain("Grizzly Bears");
    expect(groups.find((g) => g.label === "7+")?.cards.map((c) => c.name)).toContain("Expropriate");
    const numeric = groups.filter((g) => g.label !== "Lands");
    for (const g of numeric) {
      expect(g.cards.map((c) => c.name)).not.toContain("Plains");
    }
    expect(groups.find((g) => g.label === "Lands")?.cards.map((c) => c.name)).toContain("Plains");
  });
});

test.describe("groupByColorIdentity", () => {
  test("mono, multicolor, and colorless bucket correctly", () => {
    const { pool: p, cardMap } = pool(SOL_RING, VANILLA, TOKEN_MAKER, GOLD_CARD);
    const groups = groupByColorIdentity(p, cardMap);
    expect(groups.find((g) => g.label === "White")?.cards.map((c) => c.name)).toContain("Secure the Wastes");
    expect(groups.find((g) => g.label === "Green")?.cards.map((c) => c.name)).toContain("Grizzly Bears");
    expect(groups.find((g) => g.label === "Multicolor")?.cards.map((c) => c.name)).toContain("Wilt-Leaf Liege");
    expect(groups.find((g) => g.label === "Colorless")?.cards.map((c) => c.name)).toContain("Sol Ring");
  });
});

test.describe("gameChangers", () => {
  test("filters cards flagged isGameChanger", () => {
    const { pool: p, cardMap } = pool(SOL_RING, VANILLA);
    expect(gameChangers(p, cardMap)).toEqual([{ name: "Sol Ring", quantity: 1 }]);
  });
});

test.describe("unresolved cards", () => {
  const TYPO = { name: "Lighming Bolt", quantity: 2 };

  test("collect in a trailing Unresolved group so counts add up", () => {
    const { pool: p, cardMap } = pool(SOL_RING, PLAINS);
    for (const grouper of [
      groupByCategory,
      groupByTypeLine,
      groupByManaValue,
      groupByColorIdentity,
    ]) {
      const groups = grouper([...p, TYPO], cardMap);
      const unresolved = groups[groups.length - 1];
      expect(unresolved.id).toBe(UNRESOLVED_GROUP_ID);
      expect(unresolved.label).toBe(UNRESOLVED_LABEL);
      expect(unresolved.cards).toEqual([TYPO]);
      const grouped = groups.flatMap((g) => g.cards.map((c) => c.name));
      expect(new Set(grouped)).toEqual(
        new Set([...p.map((c) => c.name), TYPO.name])
      );
    }
  });

  test("appear as a trailing axis group in the synergy lens", () => {
    const { pool: p, cardMap } = pool(SOL_RING, TOKEN_MAKER);
    const groups = groupBySynergyAxis([...p, TYPO], cardMap);
    const last = groups[groups.length - 1];
    expect(last.axisId).toBe(UNRESOLVED_GROUP_ID);
    expect(last.axisName).toBe(UNRESOLVED_LABEL);
    expect(last.cards).toEqual([{ ...TYPO, relevance: 0, otherAxes: [] }]);
  });

  test("no Unresolved group when every card enriched", () => {
    const { pool: p, cardMap } = pool(SOL_RING, PLAINS);
    const groups = groupByCategory(p, cardMap);
    expect(groups.some((g) => g.id === UNRESOLVED_GROUP_ID)).toBe(false);
  });
});
