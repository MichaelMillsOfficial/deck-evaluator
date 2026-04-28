import type { EnrichedCard } from "@/lib/types";

/**
 * Static EnrichedCard fixtures for cards used in test decklists.
 *
 * Why these exist:
 *   E2E tests historically hit Scryfall live for /api/deck-enrich. Across
 *   parallel workers this saturates the upstream API (429 storms) and
 *   bloats CI runs. The fixtures below give the deckPage fixture a
 *   deterministic, instant response for the common cards.
 *
 * Coverage:
 *   - SAMPLE_DECKLIST + SAMPLE_DECKLIST_WITH_SIDEBOARD cards
 *   - Cards used in inline decklists across spec files (mana ramp, removal,
 *     basics, etc.)
 *
 * Anything not in the bank is auto-synthesized by `synthesizeEnrichedCard`
 * so the suite degrades gracefully when a new card is introduced. Tests
 * that genuinely depend on data we don't fixture should opt out of the
 * mock via `deckPage.useLiveEnrichment()`.
 *
 * The shape is `EnrichedCard` from `@/lib/types`. The route handler at
 * `/api/deck-enrich` returns `{ cards: Record<string, EnrichedCard>,
 * notFound: string[] }`; the mock responds with that shape.
 */

interface PartialEnrichedCard
  extends Partial<Omit<EnrichedCard, "name" | "manaPips" | "prices">> {
  name: string;
  manaPips?: Partial<EnrichedCard["manaPips"]>;
  prices?: Partial<EnrichedCard["prices"]>;
}

const ZERO_PIPS: EnrichedCard["manaPips"] = {
  W: 0,
  U: 0,
  B: 0,
  R: 0,
  G: 0,
  C: 0,
};

function pips(p: Partial<EnrichedCard["manaPips"]>): EnrichedCard["manaPips"] {
  return { ...ZERO_PIPS, ...p };
}

export function makeEnrichedCard(partial: PartialEnrichedCard): EnrichedCard {
  const manaCost = partial.manaCost ?? "";
  const typeLine = partial.typeLine ?? "Land";
  return {
    name: partial.name,
    manaCost,
    cmc: partial.cmc ?? 0,
    colorIdentity: partial.colorIdentity ?? [],
    colors: partial.colors ?? [],
    typeLine,
    supertypes: partial.supertypes ?? [],
    subtypes: partial.subtypes ?? [],
    oracleText: partial.oracleText ?? "",
    keywords: partial.keywords ?? [],
    power: partial.power ?? null,
    toughness: partial.toughness ?? null,
    loyalty: partial.loyalty ?? null,
    rarity: partial.rarity ?? "common",
    imageUris: partial.imageUris ?? null,
    manaPips: pips(partial.manaPips ?? {}),
    producedMana: partial.producedMana ?? [],
    flavorName: partial.flavorName ?? null,
    isGameChanger: partial.isGameChanger ?? false,
    prices: {
      usd: partial.prices?.usd ?? null,
      usdFoil: partial.prices?.usdFoil ?? null,
      eur: partial.prices?.eur ?? null,
    },
    setCode: partial.setCode ?? "tst",
    collectorNumber: partial.collectorNumber ?? "0",
    layout: partial.layout ?? "normal",
    cardFaces: partial.cardFaces ?? [],
  };
}

const FIXTURES: PartialEnrichedCard[] = [
  // ─── SAMPLE_DECKLIST commanders + spells ────────────────────────────────
  {
    name: "Atraxa, Praetors' Voice",
    manaCost: "{G}{W}{U}{B}",
    cmc: 4,
    colorIdentity: ["W", "U", "B", "G"],
    colors: ["W", "U", "B", "G"],
    typeLine: "Legendary Creature — Phyrexian Angel Horror",
    supertypes: ["Legendary"],
    subtypes: ["Phyrexian", "Angel", "Horror"],
    oracleText: "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
    keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
    power: "4",
    toughness: "4",
    rarity: "mythic",
    manaPips: { W: 1, U: 1, B: 1, G: 1 },
    isGameChanger: true,
    prices: { usd: 25 },
  },
  {
    name: "Sol Ring",
    manaCost: "{1}",
    cmc: 1,
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    rarity: "uncommon",
    producedMana: ["C"],
    prices: { usd: 2 },
  },
  {
    name: "Command Tower",
    typeLine: "Land",
    oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    rarity: "common",
    producedMana: ["W", "U", "B", "R", "G"],
  },
  {
    name: "Arcane Signet",
    manaCost: "{2}",
    cmc: 2,
    typeLine: "Artifact",
    oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    rarity: "common",
    producedMana: ["W", "U", "B", "R", "G"],
  },
  {
    name: "Swords to Plowshares",
    manaCost: "{W}",
    cmc: 1,
    colorIdentity: ["W"],
    colors: ["W"],
    typeLine: "Instant",
    oracleText: "Exile target creature. Its controller gains life equal to its power.",
    rarity: "uncommon",
    manaPips: { W: 1 },
  },
  {
    name: "Counterspell",
    manaCost: "{U}{U}",
    cmc: 2,
    colorIdentity: ["U"],
    colors: ["U"],
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    rarity: "common",
    manaPips: { U: 2 },
  },

  // ─── SAMPLE_DECKLIST_WITH_SIDEBOARD additions ───────────────────────────
  {
    name: "Rest in Peace",
    manaCost: "{1}{W}",
    cmc: 2,
    colorIdentity: ["W"],
    colors: ["W"],
    typeLine: "Enchantment",
    oracleText: "When Rest in Peace enters the battlefield, exile all graveyards.",
    rarity: "rare",
    manaPips: { W: 1 },
  },
  {
    name: "Grafdigger's Cage",
    manaCost: "{1}",
    cmc: 1,
    typeLine: "Artifact",
    oracleText: "Creature cards in graveyards and libraries can't enter the battlefield.",
    rarity: "rare",
  },

  // ─── Mana ramp cards used in synergy/goldfish/etc tests ─────────────────
  {
    name: "Birds of Paradise",
    manaCost: "{G}",
    cmc: 1,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Creature — Bird",
    subtypes: ["Bird"],
    oracleText: "Flying\n{T}: Add one mana of any color.",
    keywords: ["Flying"],
    power: "0",
    toughness: "1",
    rarity: "rare",
    manaPips: { G: 1 },
    producedMana: ["W", "U", "B", "R", "G"],
  },
  {
    name: "Llanowar Elves",
    manaCost: "{G}",
    cmc: 1,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Creature — Elf Druid",
    subtypes: ["Elf", "Druid"],
    oracleText: "{T}: Add {G}.",
    power: "1",
    toughness: "1",
    rarity: "common",
    manaPips: { G: 1 },
    producedMana: ["G"],
  },
  {
    name: "Elvish Mystic",
    manaCost: "{G}",
    cmc: 1,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Creature — Elf Druid",
    subtypes: ["Elf", "Druid"],
    oracleText: "{T}: Add {G}.",
    power: "1",
    toughness: "1",
    rarity: "common",
    manaPips: { G: 1 },
    producedMana: ["G"],
  },
  {
    name: "Cultivate",
    manaCost: "{2}{G}",
    cmc: 3,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText: "Search your library for up to two basic land cards, reveal them, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    rarity: "uncommon",
    manaPips: { G: 1 },
  },
  {
    name: "Kodama's Reach",
    manaCost: "{2}{G}",
    cmc: 3,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    subtypes: ["Arcane"],
    oracleText: "Search your library for up to two basic land cards, reveal them, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    rarity: "common",
    manaPips: { G: 1 },
  },
  {
    name: "Farseek",
    manaCost: "{1}{G}",
    cmc: 2,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText: "Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.",
    rarity: "common",
    manaPips: { G: 1 },
  },
  {
    name: "Rampant Growth",
    manaCost: "{1}{G}",
    cmc: 2,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText: "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    rarity: "common",
    manaPips: { G: 1 },
  },
  {
    name: "Three Visits",
    manaCost: "{1}{G}",
    cmc: 2,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText: "Search your library for a Forest card, put it onto the battlefield, then shuffle.",
    rarity: "rare",
    manaPips: { G: 1 },
  },
  {
    name: "Nature's Lore",
    manaCost: "{1}{G}",
    cmc: 2,
    colorIdentity: ["G"],
    colors: ["G"],
    typeLine: "Sorcery",
    oracleText: "Search your library for a Forest card, put it onto the battlefield, then shuffle.",
    rarity: "common",
    manaPips: { G: 1 },
  },

  // ─── Talisman cycle (signets) ───────────────────────────────────────────
  ...["Creativity", "Dominance", "Progress", "Unity"].map((variant) => {
    const colors: Record<string, [string, string]> = {
      Creativity: ["U", "R"],
      Dominance: ["U", "B"],
      Progress: ["W", "U"],
      Unity: ["G", "W"],
    };
    const [c1, c2] = colors[variant];
    return {
      name: `Talisman of ${variant}`,
      manaCost: "{2}",
      cmc: 2,
      typeLine: "Artifact",
      oracleText: `{T}: Add {C}.\n{T}: Add {${c1}} or {${c2}}. Talisman of ${variant} deals 1 damage to you.`,
      rarity: "uncommon",
      producedMana: ["C", c1, c2],
    } satisfies PartialEnrichedCard;
  }),

  // ─── Fast spells / tribal pieces ────────────────────────────────────────
  {
    name: "Lightning Bolt",
    manaCost: "{R}",
    cmc: 1,
    colorIdentity: ["R"],
    colors: ["R"],
    typeLine: "Instant",
    oracleText: "Lightning Bolt deals 3 damage to any target.",
    rarity: "common",
    manaPips: { R: 1 },
  },
  {
    name: "Path to Exile",
    manaCost: "{W}",
    cmc: 1,
    colorIdentity: ["W"],
    colors: ["W"],
    typeLine: "Instant",
    oracleText: "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    rarity: "uncommon",
    manaPips: { W: 1 },
  },
  {
    name: "Goblin Guide",
    manaCost: "{R}",
    cmc: 1,
    colorIdentity: ["R"],
    colors: ["R"],
    typeLine: "Creature — Goblin Scout",
    subtypes: ["Goblin", "Scout"],
    oracleText: "Haste\nWhenever Goblin Guide attacks, defending player reveals the top card of their library. If it's a land card, that player puts it into their hand.",
    keywords: ["Haste"],
    power: "2",
    toughness: "2",
    rarity: "rare",
    manaPips: { R: 1 },
  },
  {
    name: "Ezuri, Stalker of Spheres",
    manaCost: "{1}{G}{U}",
    cmc: 3,
    colorIdentity: ["G", "U"],
    colors: ["G", "U"],
    typeLine: "Legendary Creature — Phyrexian Elf",
    supertypes: ["Legendary"],
    subtypes: ["Phyrexian", "Elf"],
    oracleText: "Whenever you cast a noncreature spell, put a +1/+1 counter on Ezuri, Stalker of Spheres. Then if it has three or more +1/+1 counters on it, draw a card.",
    power: "2",
    toughness: "2",
    rarity: "mythic",
    manaPips: { G: 1, U: 1 },
  },

  // ─── Basic + dual lands ─────────────────────────────────────────────────
  {
    name: "Forest",
    typeLine: "Basic Land — Forest",
    supertypes: ["Basic"],
    subtypes: ["Forest"],
    oracleText: "({T}: Add {G}.)",
    rarity: "common",
    producedMana: ["G"],
  },
  {
    name: "Island",
    typeLine: "Basic Land — Island",
    supertypes: ["Basic"],
    subtypes: ["Island"],
    oracleText: "({T}: Add {U}.)",
    rarity: "common",
    producedMana: ["U"],
  },
  {
    name: "Plains",
    typeLine: "Basic Land — Plains",
    supertypes: ["Basic"],
    subtypes: ["Plains"],
    oracleText: "({T}: Add {W}.)",
    rarity: "common",
    producedMana: ["W"],
  },
  {
    name: "Swamp",
    typeLine: "Basic Land — Swamp",
    supertypes: ["Basic"],
    subtypes: ["Swamp"],
    oracleText: "({T}: Add {B}.)",
    rarity: "common",
    producedMana: ["B"],
  },
  {
    name: "Mountain",
    typeLine: "Basic Land — Mountain",
    supertypes: ["Basic"],
    subtypes: ["Mountain"],
    oracleText: "({T}: Add {R}.)",
    rarity: "common",
    producedMana: ["R"],
  },
  {
    name: "Breeding Pool",
    typeLine: "Land — Forest Island",
    subtypes: ["Forest", "Island"],
    oracleText: "({T}: Add {G} or {U}.)\nAs Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters tapped.",
    rarity: "rare",
    producedMana: ["G", "U"],
  },
];

const FIXTURE_MAP: Record<string, EnrichedCard> = Object.fromEntries(
  FIXTURES.map((p) => [p.name, makeEnrichedCard(p)])
);

/**
 * Synthesize a fallback EnrichedCard for unknown card names. Heuristic:
 *   - Names ending in "Land" → basic-style colorless land
 *   - Otherwise → 2cmc colorless artifact spell
 *
 * This is intentionally crude; tests that depend on real data should
 * extend FIXTURES or opt into live enrichment.
 */
export function synthesizeEnrichedCard(name: string): EnrichedCard {
  const isLand = /\bland\b/i.test(name);
  return makeEnrichedCard({
    name,
    typeLine: isLand ? "Land" : "Artifact",
    cmc: isLand ? 0 : 2,
    manaCost: isLand ? "" : "{2}",
    rarity: "common",
  });
}

export function getEnrichedFixture(name: string): EnrichedCard {
  return FIXTURE_MAP[name] ?? synthesizeEnrichedCard(name);
}

export function isFixtured(name: string): boolean {
  return name in FIXTURE_MAP;
}
