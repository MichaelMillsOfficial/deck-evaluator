# Commander Tribal Weight & Supertype-Matters Synergy

## Context

The tribal synergy system introduced in Issue #44 provides creature-type-aware detection across the analysis pipeline — but it has two significant gaps:

**1. Commander tribal weighting is too flat.** `identifyTribalAnchors()` correctly weights commander signals higher (+3 subtypes, +4 oracle refs) when *identifying* which types matter, but this distinction is lost in `boostTribalScores()`. Once anchors are resolved to a flat set, every matching creature gets the same +0.15/match boost regardless of whether the match is against the commander's own type or a secondary density-based anchor. A creature sharing the commander's subtype should receive a stronger signal — the commander is the strategic centerpiece and its type identity defines the deck.

**2. Supertype-matters mechanics are completely undetected.** Cards like Jodah, the Unifier ("Whenever you cast a legendary nontoken spell..."), Jhoira, Weatherlight Captain ("Whenever you cast a historic spell..."), and snow-matters cards produce zero synergy scores despite being major deck-building axes. The `EnrichedCard.supertypes[]` field is already populated from Scryfall (`"Legendary"`, `"Snow"`, `"Basic"`, etc.) but is never used in the synergy pipeline. This means entire commander archetypes — legendary-matters, historic, snow — are invisible to the analysis engine.

**Intended outcome:** (a) Cards sharing the commander's creature type get a distinct, higher tribal boost. (b) A new "Supertype Matters" synergy axis detects legendary-matters, snow-matters, and historic-matters patterns. (c) A new `boostSupertypeScores()` engine step rewards legendary/snow permanents in decks with supertype payoffs, mirroring how `boostTribalScores()` works for creature types. (d) New card tags surface these mechanics in the UI.

**Scope — in:**
- Commander-alignment tribal boost (extra weight for commander's own types)
- "Legendary Matters" synergy detection (oracle text patterns + supertype density)
- "Snow Matters" synergy detection
- "Historic" detection (legendary + artifact + saga — composite pattern)
- Card tags: "Legendary Payoff", "Snow Payoff"
- Supertype breakdown in CreatureTypeBreakdown component (or new companion component)
- Known combos for supertype archetypes

**Scope — out:**
- New UI tabs or pages (reuse existing Analysis/Synergy sections)
- "Party" mechanic (Warrior/Wizard/Cleric/Rogue grouping — different enough to be its own feature)
- Planeswalker-specific synergies (Superfriends — also its own feature)

## Design Decisions

### Commander Alignment Boost

The current `boostTribalScores()` applies a uniform `min(0.4, matchCount * 0.15)` boost for any anchor match. We will add a separate **commander alignment bonus** that stacks on top:

| Match type | Current boost | New boost |
|------------|--------------|-----------|
| Card subtype matches non-commander anchor | +0.15/match (cap 0.4) | +0.15/match (cap 0.4) — unchanged |
| Card subtype matches commander's subtype | +0.15/match (cap 0.4) | +0.25/match (cap 0.5) — stronger |
| Card subtype matches commander's oracle-referenced type | +0.15/match (cap 0.4) | +0.20/match (cap 0.45) — moderate |

This preserves the existing logic but adds a distinct tier for commander-aligned creatures. The commander's own subtypes get the highest premium because they represent the most intentional deckbuilding signal.

### Supertype Matters Axis

Rather than one axis per supertype, we use a **single axis** (`"supertypeMatter"`) that detects all supertype-matters patterns, similar to how the tribal axis covers all creature types. The axis detect() function checks for legendary-matters, snow-matters, and historic-matters patterns.

| Pattern | Score | Example cards |
|---------|-------|---------------|
| "whenever you cast a legendary" | +0.7 | Jodah the Unifier |
| "whenever a legendary.*enters" | +0.6 | Ratadrabik of Urborg |
| "for each legendary" / "number of legendary" | +0.5 | Kethis, the Hidden Hand |
| "legendary.*(?:spell\|permanent\|card).*cost.*less" | +0.6 | Jhoira's Familiar (partial) |
| "whenever you cast a historic" | +0.7 | Jhoira, Weatherlight Captain |
| "historic" keyword pattern | +0.5 | Raff Capashen, Ship's Mage |
| card.supertypes includes "Snow" AND snow payoff text | +0.6 | Marit Lage's Slumber |
| "snow permanent" / "snow mana" | +0.5 | Narfi, Betrayer King |
| "{S}" (snow mana symbol) in cost or text | +0.4 | Icehide Golem |

### Supertype Anchor Identification

Mirrors `identifyTribalAnchors()` logic but for supertypes:

| Signal | Score |
|--------|-------|
| Commander has supertype (e.g., Legendary) | +2 |
| Commander oracle text references supertype | +4 |
| Other card oracle text references supertype | +2 |
| Density: >= 15 legendary permanents in deck | +3 |
| Density: >= 8 snow permanents in deck | +3 |

Higher density thresholds than creature types because "Legendary" is far more common than any single creature type.

### Card Tags

| Tag | Color | Detection |
|-----|-------|-----------|
| `"Legendary Payoff"` | `bg-amber-500/20`, `text-amber-300` | Oracle text references legendary spells/permanents as payoff |
| `"Snow Payoff"` | `bg-cyan-500/20`, `text-cyan-300` | Oracle text references snow permanents/mana as payoff |

### UI: Supertype Breakdown

Extend `CreatureTypeBreakdown` to optionally show a "Supertypes" section when a supertype-matters theme is detected, or create a lightweight `SupertypeBreakdown` component. The bar chart shows Legendary/Snow/Basic counts across the deck.

## Algorithm Design

### Commander Alignment Boost (modified boostTribalScores)

```
1. Resolve commanders → EnrichedCard[]
2. Extract commanderTypes = Set of commander creature subtypes
3. Extract commanderOracleTypes = Set of types referenced in commander oracle text
4. Call identifyTribalAnchors() → anchors[]
5. For each card in deck:
   a. Get creature subtypes
   b. Classify each matching anchor:
      - commanderSubtype match → boost = 0.25
      - commanderOracleType match → boost = 0.20
      - other anchor match → boost = 0.15
   c. Total boost = min(0.5, sum of per-match boosts)
   d. Apply to tribal axis score
```

### Supertype Scoring Pipeline

```
1. computeAxisScores() — supertypeMatter axis detect() scores oracle-text payoffs
2. boostSupertypeScores():
   a. Resolve commanders, call identifySupertypeAnchors()
   b. If no anchors, return
   c. For each card:
      - Check card.supertypes against anchors
      - Historic check: if "historic" anchor, match Legendary OR Artifact OR Saga
      - Compute boost = min(0.4, matchCount * 0.15)
      - Apply to supertypeMatter axis score
3. Theme annotation: "Legendary Matters", "Snow Matters", etc.
```

## Implementation Tasks

### Phase 1: Enhanced Commander Tribal Boost — Tests

- [ ] 1.1 Add tests to `tests/unit/synergy-engine.spec.ts`
  - Test case: Commander's creature type gets higher boost than non-commander anchor
    - Deck: Elf commander + 10 Elves + 5 Goblins (Goblins as secondary density anchor)
    - Assert: Elf creatures score higher than Goblin creatures
  - Test case: Commander oracle-referenced type gets moderate boost
    - Deck: Najeela (references Warriors in oracle text) + Warriors + Soldiers
    - Assert: Warriors score higher than Soldiers (both have density, but Warriors referenced by commander)
  - Test case: Non-commander anchor cards still receive standard boost
    - Assert: Cards matching only density-based anchors still get boosted (no regression)
  - Test case: Commander alignment boost stacks with tribal payoff score
    - Elvish Archdruid (Elf lord + Elf creature) in Elf commander deck → score reflects both detect() and alignment boost

### Phase 2: Enhanced Commander Tribal Boost — Implementation

- [ ] 2.1 Modify `src/lib/creature-types.ts`
  - New export: `getCommanderTypes(commanders: EnrichedCard[]): { subtypes: Set<string>; oracleTypes: Set<string> }`
  - Extracts commander creature subtypes and oracle-referenced types as separate sets

- [ ] 2.2 Modify `src/lib/synergy-engine.ts` — update `boostTribalScores()`
  - Import `getCommanderTypes` from creature-types
  - Before boost loop: call `getCommanderTypes(commanders)` to get `commanderSubtypes` and `commanderOracleTypes`
  - In boost loop: classify each anchor match into tiers:
    - `commanderSubtypes.has(anchor)` → 0.25 per match
    - `commanderOracleTypes.has(anchor)` → 0.20 per match
    - else → 0.15 per match (unchanged)
  - Update cap from `min(0.4, ...)` to `min(0.5, ...)` for commander-aligned cards
  - Changeling: matches all anchors at their respective tier rates

### Phase 3: Supertype Matters Axis — Tests

- [ ] 3.1 Create or extend `tests/unit/synergy-axes.spec.ts` with supertypeMatter axis tests
  - Test case: Jodah, the Unifier — "Whenever you cast a legendary nontoken spell" → score > 0
  - Test case: Jhoira, Weatherlight Captain — "Whenever you cast a historic spell" → score > 0
  - Test case: Ratadrabik of Urborg — "Whenever another legendary creature you control dies" → score > 0
  - Test case: Kethis, the Hidden Hand — "legendary spells you cast cost {1} less" + "exile two legendary cards from your graveyard" → score > 0
  - Test case: Narfi, Betrayer King — "Other snow and Zombie creatures you control get +1/+1" → score > 0
  - Test case: Marit Lage's Slumber — "Whenever a snow permanent enters the battlefield" → score > 0
  - Test case: Card with {S} in oracle text → score > 0
  - Test case: Generic creature with no supertype references → score = 0
  - Test case: Card that happens to be Legendary but has no supertype payoff text → score = 0

### Phase 4: Supertype Matters Axis — Implementation

- [ ] 4.1 Add regex patterns to `src/lib/synergy-axes.ts`
  - `LEGENDARY_CAST_RE`: `/whenever you cast a (?:legendary|historic)/i`
  - `LEGENDARY_ETB_RE`: `/whenever (?:a|another) legendary.*(?:enters|dies)/i`
  - `LEGENDARY_FOR_EACH_RE`: `/\b(?:for each|number of) legendary\b/i`
  - `LEGENDARY_COST_RE`: `/legendary.*(?:spell|permanent|card)s?.*cost.*less/i`
  - `HISTORIC_RE`: `/\bhistoric\b/i`
  - `SNOW_PERMANENT_RE`: `/\bsnow (?:permanent|creature|land)/i`
  - `SNOW_MANA_RE`: `/\{S\}/`
  - `SNOW_MATTERS_RE`: `/whenever a snow.*enters|for each snow/i`

- [ ] 4.2 Add new axis definition to `SYNERGY_AXES` array in `src/lib/synergy-axes.ts`
  - `id: "supertypeMatter"`
  - `name: "Supertype Matters"`
  - `description: "Legendary, historic, and snow permanent synergies"`
  - `color: { bg: "bg-amber-500/20", text: "text-amber-300" }`
  - `detect(card)` scoring: per the algorithm design table above
  - `conflictsWith: []`

### Phase 5: Supertype Anchoring & Engine Boost — Tests

- [ ] 5.1 Add tests to `tests/unit/synergy-engine.spec.ts`
  - Test case: Jodah commander + 15 legendary creatures → legendary-matters theme detected
  - Test case: Legendary creatures get boosted scores in Jodah deck
  - Test case: Non-legendary cards (e.g., basic sorcery) do NOT get supertype boost
  - Test case: Snow commander (e.g., Narfi) + snow permanents → snow-matters theme detected
  - Test case: Deck with no supertype payoffs → no supertype theme, no boost applied
  - Test case: Historic anchor matches Legendary creatures, Artifacts, AND Saga enchantments

### Phase 6: Supertype Anchoring & Engine Boost — Implementation

- [ ] 6.1 Create `src/lib/supertypes.ts`
  - `identifySupertypeAnchors(commanders: EnrichedCard[], cardNames: string[], cardMap: Record<string, EnrichedCard>): string[]`
    - Scoring: commander supertypes (+2), commander oracle refs (+4), card oracle refs (+2), density thresholds (+3)
    - Returns anchors like `["legendary"]`, `["snow"]`, `["historic"]`
  - `isHistoric(card: EnrichedCard): boolean`
    - Returns true if card is Legendary, Artifact, or has "Saga" subtype
  - `computeSupertypeBreakdown(cardNames: string[], cardMap: Record<string, EnrichedCard>): Map<string, number>`
    - Counts Legendary, Snow, Basic, etc. across deck

- [ ] 6.2 Add `tests/unit/supertypes.spec.ts`
  - Tests for `identifySupertypeAnchors`, `isHistoric`, `computeSupertypeBreakdown`
  - Test case: Jodah as commander → "legendary" is anchor
  - Test case: Narfi as commander → "snow" is anchor
  - Test case: Jhoira as commander → "historic" is anchor
  - Test case: Non-legendary commander with no supertype text → no anchors
  - Test case: isHistoric returns true for Legendary creature, Artifact, Saga; false for regular creature
  - Test case: computeSupertypeBreakdown counts correctly

- [ ] 6.3 Modify `src/lib/synergy-engine.ts` — add `boostSupertypeScores()`
  - Function signature: `boostSupertypeScores(deck: DeckData, cardNames: string[], cardMap: Record<string, EnrichedCard>, axisScores: Map<string, CardAxisScore[]>): void`
  - Calls `identifySupertypeAnchors()` to get anchors
  - For each card: check `card.supertypes` against anchors (historic = Legendary OR Artifact OR Saga)
  - Boost = `min(0.4, matchCount * 0.15)`
  - Insert call after `boostTribalScores()` in main pipeline

- [ ] 6.4 Modify `identifyDeckThemes()` in `src/lib/synergy-engine.ts`
  - Accept optional `supertypeAnchors?: string[]` parameter
  - Annotate supertypeMatter theme with primary anchor: `"Legendary Matters"`, `"Snow Matters"`, `"Historic"`
  - Set `theme.detail` to anchor value

### Phase 7: Card Tags — Tests

- [ ] 7.1 Add tests to `tests/unit/card-tags.spec.ts`
  - Test case: Jodah, the Unifier → "Legendary Payoff"
  - Test case: Kethis, the Hidden Hand → "Legendary Payoff"
  - Test case: Jhoira, Weatherlight Captain (historic) → "Legendary Payoff" (historic includes legendary)
  - Test case: Narfi, Betrayer King → "Snow Payoff"
  - Test case: Marit Lage's Slumber → "Snow Payoff"
  - Test case: Card with {S} in oracle text → "Snow Payoff"
  - Test case: Generic legendary creature (no payoff text) → no "Legendary Payoff"
  - Test case: Grizzly Bears → no supertype payoff tags

### Phase 8: Card Tags — Implementation

- [ ] 8.1 Modify `src/lib/card-tags.ts`
  - Add TAG_COLORS entries for `"Legendary Payoff"` and `"Snow Payoff"`
  - Add regex patterns (reuse from synergy-axes or define locally):
    - `LEGENDARY_PAYOFF_RE`: matches legendary/historic cast triggers, cost reduction, ETB/death triggers
    - `SNOW_PAYOFF_RE`: matches snow permanent triggers, snow mana references, {S} costs
  - Add detection block in `generateTags()`:
    - If legendary/historic payoff patterns match → `tags.add("Legendary Payoff")`
    - If snow payoff patterns match → `tags.add("Snow Payoff")`

### Phase 9: UI Integration

- [ ] 9.1 Create `src/components/SupertypeBreakdown.tsx`
  - Follow pattern of `CreatureTypeBreakdown.tsx`
  - Props: `{ deck: DeckData; cardMap: Record<string, EnrichedCard> }`
  - Uses `computeSupertypeBreakdown()` from supertypes.ts
  - Shows horizontal bar chart of Legendary, Snow, Basic counts
  - Self-hides when no relevant supertypes found (returns null)
  - Dark theme: `bg-amber-500/60` bars on `bg-slate-700` (amber for legendary theme)

- [ ] 9.2 Modify `src/components/SynergySection.tsx`
  - Render `SupertypeBreakdown` when supertypeMatter theme detected (alongside existing CreatureTypeBreakdown for tribal)

- [ ] 9.3 Modify `src/components/DeckAnalysis.tsx`
  - Add `"supertypes"` to `ANALYSIS_SECTIONS` array
  - Add `SupertypeBreakdown` in a `CollapsiblePanel` near the creature types section

### Phase 10: Known Combos

- [ ] 10.1 Add legendary/historic combos to `src/lib/known-combos.ts`
  - Kethis, the Hidden Hand + Mox Amber (legendary mana loop)
  - Jhoira, Weatherlight Captain + Aetherflux Reservoir (historic storm)
  - Ratadrabik of Urborg + Blade of the Bloodchief (legendary death value — if applicable)

- [ ] 10.2 Add tests to `tests/unit/known-combos.spec.ts`
  - Test case: Kethis + Mox Amber detected
  - Test case: Jhoira + Aetherflux Reservoir detected

### Phase 11: Full Test Verification & Review

- [ ] 11.1 Run `npm run test:unit` — all unit tests pass (0 failures)
- [ ] 11.2 Run `npx tsc --noEmit` — no new TypeScript errors in changed files
- [ ] 11.3 Code review sub-agent — verify pattern adherence, naming, test quality
- [ ] 11.4 MTG card expert review — verify detection accuracy against real cards:
  - Jodah, the Unifier (legendary-matters commander)
  - Jhoira, Weatherlight Captain (historic commander)
  - Narfi, Betrayer King (snow commander)
  - Kethis, the Hidden Hand (legendary graveyard)
  - Marit Lage's Slumber (snow payoff)
  - A generic legendary creature (should NOT get Legendary Payoff tag)
  - Commander with Elf type in Elf deck (should get enhanced tribal boost)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/supertypes.ts` | Create | Supertype anchor identification, historic check, supertype breakdown |
| `tests/unit/supertypes.spec.ts` | Create | Unit tests for supertypes module |
| `src/components/SupertypeBreakdown.tsx` | Create | Bar chart for supertype frequency |
| `src/lib/creature-types.ts` | Modify | Add `getCommanderTypes()` export |
| `src/lib/synergy-engine.ts` | Modify | Update `boostTribalScores()` with commander tiers; add `boostSupertypeScores()`; update `identifyDeckThemes()` |
| `src/lib/synergy-axes.ts` | Modify | Add `supertypeMatter` axis with legendary/snow/historic patterns |
| `src/lib/card-tags.ts` | Modify | Add "Legendary Payoff" and "Snow Payoff" tags |
| `src/lib/known-combos.ts` | Modify | Add legendary/historic combos |
| `src/components/SynergySection.tsx` | Modify | Render SupertypeBreakdown for supertypeMatter theme |
| `src/components/DeckAnalysis.tsx` | Modify | Add supertypes collapsible panel |
| `tests/unit/synergy-engine.spec.ts` | Modify | Commander alignment boost tests + supertype engine tests |
| `tests/unit/synergy-axes.spec.ts` | Modify | supertypeMatter axis tests |
| `tests/unit/card-tags.spec.ts` | Modify | Legendary Payoff / Snow Payoff tag tests |
| `tests/unit/known-combos.spec.ts` | Modify | Legendary combo tests |

No changes to: `src/lib/types.ts` (DeckTheme.detail already supports string), `src/lib/deck-composition.ts`, `src/lib/mana.ts`, `src/lib/decklist-parser.ts`, `src/lib/scryfall.ts`, `src/lib/archidekt.ts`, e2e test files.

## Verification

1. `npm run test:unit` — all unit tests pass (0 failures)
2. `npx tsc --noEmit` — no new TypeScript errors in changed files
3. Manual: Import an Elf tribal deck with an Elf commander → verify Elf creatures score higher than non-Elf creatures → verify "Elf Tribal" theme detected
4. Manual: Import a Jodah, the Unifier deck → verify "Legendary Matters" theme appears → verify legendary creatures get boosted scores → verify "Legendary Payoff" tag on Jodah
5. Manual: Import a snow-themed deck → verify "Snow Matters" theme appears → verify SupertypeBreakdown shows Legendary/Snow counts
6. Code review sub-agent passes all quality categories
7. MTG card expert confirms detection accuracy for all test card scenarios
