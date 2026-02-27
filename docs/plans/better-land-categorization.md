# Better Land Categorization (Issue #33)

## Context

The deck evaluator currently has 10 card tags in `src/lib/card-tags.ts` (Ramp, Card Draw, Removal, etc.) that describe a card's **functional role** in a deck. None of these tags are specific to lands — basic lands get no tags at all, and non-basic lands only receive a "Ramp" tag if they search for other lands.

Meanwhile, `src/lib/land-base-efficiency.ts` already classifies lands as `untapped`/`conditional`/`tapped` and scores deck-level mana base metrics, but this information is not surfaced on individual cards as tags. There is a gap: users cannot glance at a land and immediately understand its properties (ETB behavior, color production, fetch ability, extra types, mana acceleration).

This feature adds **9 new land-specific tags** to `card-tags.ts` that coexist with existing tags (including Ramp). These tags describe **land properties** visible as pill badges on each card, and serve as forward-looking data points for future analysis and recommendations about card interactions.

Scope: Only `card-tags.ts` and its tests are modified. No changes to the land-base-efficiency module (though we reuse its conditional ETB patterns), no UI component changes (CardTags.tsx already renders any tag string from TAG_COLORS), and no synergy-axis changes.

## Design Decisions

### Tag Definitions

| Tag | Description | Example Cards |
|-----|-------------|---------------|
| **Fetch Land** | Land that searches your library for another land | Polluted Delta, Evolving Wilds, Fabled Passage, Prismatic Vista |
| **ETB Tapped** | Land that always enters the battlefield tapped | Temple of Malice, Guildgates, Bojuka Bog |
| **Conditional ETB** | Land that enters tapped unless a condition is met | Breeding Pool, Glacial Fortress, Blackcleave Cliffs |
| **Mana Fixing** | Land that produces 2+ colors of mana | Command Tower, Mana Confluence, City of Brass, dual lands |
| **Utility Land** | Land with meaningful abilities beyond mana production | Reliquary Tower, Maze of Ith, Urborg, Blast Zone, creature-lands |
| **Basic Types** | Non-basic land that has basic land subtypes (fetchable) | Breeding Pool (Forest Island), Blood Crypt (Swamp Mountain) |
| **Mana Accel Land** | Land that can produce 2+ mana from a single activation | Ancient Tomb, Temple of the False God, Gaea's Cradle, Nykthos |
| **Non-Land Types** | Land that is also another card type | Dryad Arbor (Creature), Urza's Saga (Enchantment), Darksteel Citadel (Artifact) |
| **Cycling** | Land with cycling or basic landcycling ability | Irrigated Farmland, Fetid Pools, Ash Barrens, Scattered Groves |

### Tag Colors (Tailwind)

Existing tags use: emerald, blue, sky, red, orange, cyan, yellow, amber, violet, pink. New land tags use the remaining distinct palette:

| Tag | Background | Text |
|-----|-----------|------|
| Fetch Land | `bg-teal-500/20` | `text-teal-300` |
| ETB Tapped | `bg-rose-500/20` | `text-rose-300` |
| Conditional ETB | `bg-stone-500/20` | `text-stone-300` |
| Mana Fixing | `bg-indigo-500/20` | `text-indigo-300` |
| Utility Land | `bg-lime-500/20` | `text-lime-300` |
| Basic Types | `bg-green-500/20` | `text-green-300` |
| Mana Accel Land | `bg-fuchsia-500/20` | `text-fuchsia-300` |
| Non-Land Types | `bg-purple-500/20` | `text-purple-300` |
| Cycling | `bg-zinc-500/20` | `text-zinc-300` |

### Detection Logic

All new tags apply **only to lands** (typeLine contains "Land"). Basic lands receive no tags (unchanged behavior, except Basic Types which excludes basics by definition).

1. **Fetch Land**: Land + oracle text matches `search your library for a...land` pattern (reuse existing `RAMP_LAND_SEARCH_RE` or a land-specific variant). Fetch lands also keep the "Ramp" tag since they accelerate mana.

2. **ETB Tapped**: Land + oracle text contains "enters the battlefield tapped" or "enters tapped" + does NOT match any conditional pattern. Reuse `CONDITIONAL_PATTERNS` exported from `land-base-efficiency.ts`.

3. **Conditional ETB**: Land + oracle text has ETB tapped text + matches at least one conditional pattern from `land-base-efficiency.ts`.

4. **Mana Fixing**: Land + (`producedMana` has 2+ entries after filtering out "C") OR oracle text matches "any color" / "any one color" / "any type". Basic lands excluded (they only produce one color).

5. **Utility Land**: Land + has oracle text with activated abilities, triggered abilities, or static abilities beyond basic mana production. Detection: oracle text (after stripping `({T}: Add {X}.)` parenthesized basic mana ability) has meaningful remaining text. Exclude ETB-tapped-only text. A card qualifies if it has abilities like: removal effects, card draw, damage prevention, hand size modification, animation, sacrifice outlets, etc.

6. **Basic Types**: NOT a basic land (supertypes does not include "Basic") + IS a land + subtypes include at least one of: Plains, Island, Swamp, Mountain, Forest.

7. **Mana Accel Land**: Land + oracle text shows producing 2+ mana from a single activation. Patterns: `{T}: Add {C}{C}` (Ancient Tomb), `add X mana` / `add an amount` (Gaea's Cradle, Nykthos), `add {C} for each` or similar scaling patterns.

8. **Non-Land Types**: typeLine contains "Land" AND also contains at least one of: Creature, Enchantment, Artifact, Planeswalker. Detection uses the typeLine string directly (the `—` separator is part of the format, but types appear before it). This catches artifact lands (Darksteel Citadel, Seat of the Synod), creature lands (Dryad Arbor), and enchantment lands (Urza's Saga).

9. **Cycling**: Land + keywords include "Cycling" or "Basic landcycling", OR oracle text matches cycling/landcycling patterns. Cycling lands are notable because they're never dead draws in the late game, interact with cycling synergies (Astral Drift, Drake Haven, Abandoned Sarcophagus), and basic landcycling provides mana fixing.

### Coexistence Rules

- All land tags coexist with each other and with existing tags
- A Breeding Pool can be: Conditional ETB + Mana Fixing + Basic Types
- A Polluted Delta can be: Fetch Land + Ramp
- A Dryad Arbor can be: Non-Land Types + Basic Types + Mana Fixing (if applicable)
- An Ancient Tomb can be: Mana Accel Land + Utility Land (if it has extra text)
- A Bojuka Bog can be: ETB Tapped + Utility Land
- An Irrigated Farmland can be: ETB Tapped + Mana Fixing + Basic Types + Cycling (4 tags)
- A Darksteel Citadel can be: Non-Land Types (1 tag)
- An Ash Barrens can be: Cycling (1 tag — has basic landcycling, enters untapped, produces {C})
- Basic lands still receive no tags (unchanged)

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Add new test describe blocks to `tests/unit/card-tags.spec.ts` for each land tag:

  **Fetch Land tests:**
  - Polluted Delta (`{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.`) → Fetch Land + Ramp
  - Evolving Wilds (`{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.`) → Fetch Land + Ramp
  - Non-land with land search (Cultivate) → NOT Fetch Land
  - Basic Forest → NOT Fetch Land

  **ETB Tapped tests:**
  - Temple of Malice (`Temple of Malice enters the battlefield tapped. When Temple of Malice enters the battlefield, scry 1. {T}: Add {B} or {R}.`, typeLine: `Land`) → ETB Tapped
  - Guildgate (e.g., Boros Guildgate: `Boros Guildgate enters the battlefield tapped. {T}: Add {R} or {W}.`) → ETB Tapped
  - Breeding Pool (has conditional) → NOT ETB Tapped
  - Command Tower (no tapped text) → NOT ETB Tapped

  **Conditional ETB tests:**
  - Breeding Pool (`({T}: Add {G} or {U}.) As Breeding Pool enters the battlefield, you may pay 2 life. If you don't, it enters the battlefield tapped.`) → Conditional ETB
  - Glacial Fortress (`Glacial Fortress enters the battlefield tapped unless you control a Plains or an Island. {T}: Add {W} or {U}.`) → Conditional ETB
  - Temple of Malice (unconditional tapped) → NOT Conditional ETB
  - Command Tower (no tapped text) → NOT Conditional ETB

  **Mana Fixing tests:**
  - Command Tower (`{T}: Add one mana of any color in your commander's color identity.`, producedMana: `["W","U","B","R","G"]`) → Mana Fixing
  - City of Brass (`Whenever City of Brass becomes tapped, it deals 1 damage to you. {T}: Add one mana of any color.`, producedMana: `["W","U","B","R","G"]`) → Mana Fixing
  - Breeding Pool (producedMana: `["G","U"]`) → Mana Fixing
  - Forest (basic, producedMana: `["G"]`) → NOT Mana Fixing (basic lands excluded)
  - Ancient Tomb (producedMana: `["C"]`) → NOT Mana Fixing

  **Utility Land tests:**
  - Reliquary Tower (`You have no maximum hand size. {T}: Add {C}.`) → Utility Land
  - Bojuka Bog (`Bojuka Bog enters the battlefield tapped. When Bojuka Bog enters the battlefield, exile all cards from target player's graveyard. {T}: Add {B}.`) → Utility Land
  - Maze of Ith (`{T}: Untap target attacking creature. Prevent all combat damage that would be dealt to and dealt by that creature this turn.`) → Utility Land
  - Basic Forest → NOT Utility Land
  - Command Tower (only mana production) → NOT Utility Land
  - Breeding Pool (only mana + ETB condition) → NOT Utility Land

  **Basic Types tests:**
  - Breeding Pool (subtypes: `["Forest", "Island"]`, supertypes: `[]`) → Basic Types
  - Blood Crypt (subtypes: `["Swamp", "Mountain"]`, supertypes: `[]`) → Basic Types
  - Forest (supertypes: `["Basic"]`, subtypes: `["Forest"]`) → NOT Basic Types (is a basic land)
  - Command Tower (subtypes: `[]`) → NOT Basic Types

  **Mana Accel Land tests:**
  - Ancient Tomb (`{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.`, typeLine: `Land`) → Mana Accel Land
  - Temple of the False God (`{T}: Add {C}{C}. Activate only if you control five or more lands.`, typeLine: `Land`) → Mana Accel Land
  - Gaea's Cradle (`{T}: Add {G} for each creature you control.`, typeLine: `Legendary Land`) → Mana Accel Land
  - Nykthos, Shrine to Nyx (`{2}, {T}: Choose a color. Add an amount of mana of that color equal to your devotion to that color.`) → Mana Accel Land
  - Cabal Coffers (`{2}, {T}: Add {B} for each Swamp you control.`) → Mana Accel Land
  - Command Tower (only 1 mana) → NOT Mana Accel Land
  - Sol Ring (`{T}: Add {C}{C}`, typeLine: `Artifact`) → NOT Mana Accel Land (not a land)

  **Non-Land Types tests:**
  - Dryad Arbor (typeLine: `Land Creature — Forest Dryad`) → Non-Land Types
  - Urza's Saga (typeLine: `Enchantment Land — Urza's Saga`) → Non-Land Types
  - Darksteel Citadel (typeLine: `Artifact Land`) → Non-Land Types
  - Command Tower (typeLine: `Land`) → NOT Non-Land Types
  - Basic Forest (typeLine: `Basic Land — Forest`) → NOT Non-Land Types

  **Cycling tests:**
  - Irrigated Farmland (`Irrigated Farmland enters the battlefield tapped. {T}: Add {W} or {U}. Cycling {2}`, typeLine: `Land — Plains Island`, keywords: `["Cycling"]`) → Cycling
  - Fetid Pools (`Fetid Pools enters the battlefield tapped. {T}: Add {U} or {B}. Cycling {2}`, typeLine: `Land — Island Swamp`, keywords: `["Cycling"]`) → Cycling
  - Ash Barrens (`{T}: Add {C}. Basic landcycling {1}`, typeLine: `Land`, keywords: `["Basic landcycling"]`) → Cycling
  - Scattered Groves (`Scattered Groves enters the battlefield tapped. {T}: Add {G} or {W}. Cycling {2}`, typeLine: `Land — Forest Plains`, keywords: `["Cycling"]`) → Cycling
  - Command Tower (no cycling) → NOT Cycling
  - Basic Forest (no cycling) → NOT Cycling

  **Multi-tag coexistence tests:**
  - Breeding Pool → Conditional ETB + Mana Fixing + Basic Types (3 tags)
  - Polluted Delta → Fetch Land + Ramp (2 tags)
  - Bojuka Bog → ETB Tapped + Utility Land (2 tags)
  - Ancient Tomb → Mana Accel Land + Utility Land (has damage text) (2 tags)
  - Dryad Arbor → Non-Land Types + Basic Types (subtypes: Forest) (2 tags)
  - Irrigated Farmland → ETB Tapped + Mana Fixing + Basic Types + Cycling (4 tags)
  - Darksteel Citadel → Non-Land Types (1 tag)

- [x] 1.2 Run `npm run test:unit` to confirm all new tests fail (TDD red phase)

### Phase 2: Export Shared Patterns

- [x] 2.1 In `src/lib/land-base-efficiency.ts`, export the `CONDITIONAL_PATTERNS` array so it can be reused:
  - Change `const CONDITIONAL_PATTERNS` → `export const CONDITIONAL_PATTERNS`

### Phase 3: Implement Detection Logic

- [x] 3.1 In `src/lib/card-tags.ts`, add 9 new entries to `TAG_COLORS`:
  - `"Fetch Land"`, `"ETB Tapped"`, `"Conditional ETB"`, `"Mana Fixing"`, `"Utility Land"`, `"Basic Types"`, `"Mana Accel Land"`, `"Non-Land Types"`, `"Cycling"`

- [x] 3.2 Add new regex constants at the top of `card-tags.ts`:
  - `FETCH_LAND_RE` — land-specific search pattern (land type + searches library for land)
  - `ETB_TAPPED_RE` — `/enters the battlefield tapped|enters tapped/i`
  - `MANA_FIXING_ANY_COLOR_RE` — `/\bany\s+(?:one\s+)?(?:color|type)\b/i`
  - `MANA_ACCEL_DOUBLE_RE` — `/\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}\s*\{[WUBRGC]\}/` (two symbols in a row)
  - `MANA_ACCEL_FOR_EACH_RE` — `/[Aa]dd\s+\{[WUBRGC]\}\s+for each\b/i`
  - `MANA_ACCEL_AMOUNT_RE` — `/[Aa]dd\s+(?:an\s+amount\s+of|X)\s+/i`
  - `BASIC_MANA_ABILITY_RE` — `/\(\{T\}: Add \{[WUBRGC]\}\.\)/` (parenthesized reminder text)
  - `BASIC_LAND_SUBTYPES` — `new Set(["Plains", "Island", "Swamp", "Mountain", "Forest"])`
  - `NON_LAND_TYPES_RE` — `/\b(?:Creature|Enchantment|Artifact|Planeswalker)\b/`
  - `CYCLING_KEYWORDS` — `new Set(["Cycling", "Basic landcycling"])`
  - `CYCLING_RE` — `/\b(?:cycling|basic landcycling)\s+/i` (fallback oracle text check)
  - Import `CONDITIONAL_PATTERNS` from `land-base-efficiency.ts`

- [x] 3.3 Add land tag detection to `generateTags()` function, after the existing tag logic and before the return statement. All new tags are gated by `if (isLand && !isBasicLand)`:

  **Fetch Land**: `isLand && RAMP_LAND_SEARCH_RE.test(text)` — also qualifies for Ramp (already handled above for non-basic lands with land search)

  **ETB Tapped / Conditional ETB**: Use `ETB_TAPPED_RE.test(text)` to detect tapped text, then check `CONDITIONAL_PATTERNS` to distinguish. Mutually exclusive: a land is either ETB Tapped or Conditional ETB, never both.

  **Mana Fixing**: `producedMana` has 2+ entries after filtering "C", OR `MANA_FIXING_ANY_COLOR_RE.test(text)`

  **Utility Land**: Strip parenthesized basic mana ability and ETB-tapped boilerplate from oracle text, then check if remaining text has meaningful abilities (non-empty after cleanup). Alternatively: detect specific utility patterns (static abilities, triggered abilities, removal, etc.).

  **Basic Types**: `card.subtypes.some(s => BASIC_LAND_SUBTYPES.has(s))`

  **Mana Accel Land**: Match `MANA_ACCEL_DOUBLE_RE` or `MANA_ACCEL_FOR_EACH_RE` or `MANA_ACCEL_AMOUNT_RE`

  **Non-Land Types**: `NON_LAND_TYPES_RE.test(card.typeLine)` on the portion before "Land" or simply test the whole typeLine (since the regex only matches non-land types)

  **Cycling**: `card.keywords.some(kw => CYCLING_KEYWORDS.has(kw))` OR `CYCLING_RE.test(text)` as a fallback. This catches both regular cycling and basic landcycling.

### Phase 4: Verify

- [x] 4.1 Run `npm run test:unit` — all unit tests pass (TDD green phase)
- [x] 4.2 Run `npm run test:e2e` — no regressions in browser tests
- [x] 4.3 Run `npm run build` — production build succeeds
- [x] 4.4 Run `npm run lint` — no lint errors

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/card-tags.spec.ts` | Modify | Add 9 new describe blocks with land tag tests + multi-tag coexistence tests |
| `src/lib/land-base-efficiency.ts` | Modify | Export `CONDITIONAL_PATTERNS` (add `export` keyword) |
| `src/lib/card-tags.ts` | Modify | Add 9 TAG_COLORS entries, new regex constants, import CONDITIONAL_PATTERNS, add land tag detection to `generateTags()` |

No changes to: `src/lib/types.ts`, `src/components/CardTags.tsx`, `src/components/EnrichedCardRow.tsx`, `src/lib/synergy-axes.ts`, any API routes, any e2e tests, `land-base-efficiency.ts` logic (only export modifier).

## Verification

1. `npm run test:unit` — all unit tests pass including new land tag tests
2. `npm run test:e2e` — all e2e tests pass (no regressions)
3. `npm run build` — production build succeeds
4. `npm run lint` — no lint errors
5. Manual: Import a Commander deck with diverse lands (fetches, shocks, basics, utility lands, Dryad Arbor) and verify land cards show appropriate tag pills
