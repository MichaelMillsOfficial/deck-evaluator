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
- New `SupertypeBreakdown` UI component (separate from CreatureTypeBreakdown)
- Known combos for supertype archetypes

**Scope — out:**
- New UI tabs or pages (reuse existing Analysis/Synergy sections)
- "Party" mechanic (Warrior/Wizard/Cleric/Rogue grouping — different enough to be its own feature)
- Planeswalker-specific synergies (Superfriends — also its own feature)
- "Modified creatures" mechanic (equipped/enchanted/countered — NEO-specific, future feature)

## Resolved Ambiguities

These questions were identified during review and are resolved here to prevent implementation confusion:

1. **Nearly every commander is Legendary.** Commander Legendary supertype contributes only +1 to anchor score (below threshold of 4), so it alone does NOT trigger legendary-matters detection. Oracle text references (+4) or high density (+3 at 20+) are required.

2. **Tier overlap in commander tribal boost.** When a creature type appears in both `commanderSubtypes` and `commanderOracleTypes`, use the HIGHEST tier rate (0.25), not the sum. Do not stack tiers for the same type.

3. **Partner commanders.** Both commanders contribute to all type sets (subtypes, oracle types). Both get the +0.25 commander subtype rate.

4. **"Artifact" is a card type, not a supertype.** `card.supertypes` only contains Legendary, Snow, Basic, etc. For historic detection, `isHistoric()` must check `card.supertypes` for Legendary, `card.typeLine` for Artifact, and `card.subtypes` for Saga.

5. **"Historic" is a virtual anchor.** It is not a supertype — it's a composite game mechanic. `identifySupertypeAnchors` detects it from oracle text containing the literal word "historic". `boostSupertypeScores` handles it via `isHistoric()` which expands to Legendary OR Artifact OR Saga.

6. **Double-scoring for Jhoira.** Jhoira matches both `SUPERTYPE_LEGENDARY_CAST_RE` (+0.7, via "historic" alternative) and `SUPERTYPE_HISTORIC_RE` (+0.5) for total 1.2, capped to 1.0. This is intentional — Jhoira is the ultimate historic payoff and should max out.

7. **UI component choice.** Create a NEW `SupertypeBreakdown` component rather than extending `CreatureTypeBreakdown`. They measure different things (creature types vs supertypes/card types) and have different rendering needs.

8. **Narfi snow detection.** The original `SNOW_PERMANENT_RE: /\bsnow (?:permanent|creature|land)/i` would miss "Other snow and Zombie creatures" because "and" sits between "snow" and "creatures". Fixed by: (a) broadened regex `/\bsnow\b[^.]*?\b(?:permanent|creature|land)s?\b/i` and (b) separate `/\bother snow\b/i` pattern.

9. **{S} detection in mana cost.** The `detect()` function checks `card.oracleText` for most patterns but ALSO checks `card.manaCost` for `{S}`. This is the only pattern that needs to inspect the mana cost field.

10. **Ratadrabik + Blade of the Bloodchief was not a real combo.** Replaced with verified combos: Jhoira + Sensei's Divining Top and Teshar + Mox Amber.

11. **Phase ordering for supertypes.ts.** Tests are written BEFORE implementation (TDD). Phase 5 creates tests, Phase 6 creates the module.

## Design Decisions

### Commander Alignment Boost

The current `boostTribalScores()` applies a uniform `min(0.4, matchCount * 0.15)` boost for any anchor match. We will add a separate **commander alignment bonus** that stacks on top:

| Match type | Current boost | New boost |
|------------|--------------|-----------|
| Card subtype matches non-commander anchor | +0.15/match (cap 0.4) | +0.15/match (cap 0.4) — unchanged |
| Card subtype matches commander's subtype | +0.15/match (cap 0.4) | +0.25/match (cap 0.5) — stronger |
| Card subtype matches commander's oracle-referenced type | +0.15/match (cap 0.4) | +0.20/match (cap 0.45) — moderate |

**Tier priority rule:** When a type appears in multiple tiers, use the **highest** tier rate for that type. Do not stack tiers for the same type.

### Supertype Matters Axis

A **single axis** (`"supertypeMatter"`) detects all supertype-matters patterns. This axis does NOT conflict with existing axes — a Jhoira deck correctly scores on both `artifacts` and `supertypeMatter`. `conflictsWith: []`.

**Legendary-matters patterns:**

| Pattern | Regex | Score | Example cards |
|---------|-------|-------|---------------|
| Cast/play legendary/historic | `/whenever you (?:cast\|play) a (?:legendary\|historic)/i` | +0.7 | Jodah, Jhoira, Shanid |
| Legendary ETB/death trigger | `/whenever (?:a\|another) legendary.*(?:enters\|dies)/i` | +0.6 | Ratadrabik, Yoshimaru |
| Static legendary buff | `/legendary (?:creature\|permanent)s? you control (?:get \+\|have)/i` | +0.5 | Jodah ("Legendary creatures you control get +1/+1") |
| Other legendary lord | `/other legendary (?:creature\|permanent)s? you control/i` | +0.5 | Shanid ("Other legendary creatures you control have menace") |
| For each / each legendary | `/\b(?:for each\|each\|number of) legendary\b/i` | +0.5 | Kethis, Heroes' Podium |
| Legendary cost reduction | `/legendary.*(?:spell\|permanent\|card)s?.*cost.*less/i` | +0.6 | Kethis |
| Legendary graveyard synergy | `/legendary cards? (?:from\|in) your graveyard/i` | +0.5 | Kethis second ability |
| Legend rule manipulation | `/\blegend rule\b/i` | +0.4 | Mirror Box, Sakashima |
| "historic" keyword | `/\bhistoric\b/i` | +0.5 | Raff Capashen, Teshar |

**Snow-matters patterns:**

| Pattern | Regex | Score | Example cards |
|---------|-------|-------|---------------|
| Snow permanent/creature/land (broad) | `/\bsnow\b[^.]*?\b(?:permanent\|creature\|land)s?\b/i` | +0.5 | Marit Lage's Slumber |
| "other snow" lord | `/\bother snow\b/i` | +0.6 | Narfi |
| Snow trigger/for-each | `/whenever a snow.*enters\|for each snow/i` | +0.5 | Marit Lage's Slumber |
| {S} in oracle text | `/\{S\}/` on `card.oracleText` | +0.4 | Snow activated abilities |
| {S} in mana cost | `/\{S\}/` on `card.manaCost` | +0.3 | Icehide Golem |

### Supertype Anchor Identification

| Signal | Score | Notes |
|--------|-------|-------|
| Commander has "Snow" supertype | +3 | Snow commanders are rare and always intentional |
| Commander has "Legendary" supertype | +1 | Low because nearly universal — not a strong signal alone |
| Commander oracle text references supertype | +4 | Strongest signal |
| Other card oracle text references supertype | +2 | Payoff cards in the 99 |
| Density: >= 20 legendary permanents | +3 | High threshold (legendary is common) |
| Density: >= 8 snow permanents | +3 | Low threshold (snow is all-or-nothing) |

**Anchor threshold: >= 4 points.** Examples:
- Legendary commander alone (+1) → NOT an anchor (correct)
- Legendary commander (+1) + oracle refs (+4) → anchor at 5 (Jodah/Kethis — correct)
- Legendary commander (+1) + 20+ legendary density (+3) → anchor at 4 (legend-heavy decks — correct)
- Snow commander (+3) + oracle refs (+4) → anchor at 7 (Narfi — correct)

### Card Type Resolution for isHistoric

```typescript
function isHistoric(card: EnrichedCard): boolean {
  return (
    card.supertypes.includes("Legendary") ||
    card.typeLine.toLowerCase().includes("artifact") ||
    card.subtypes.includes("Saga")
  );
}
```

### Card Tags

| Tag | Color | Detection |
|-----|-------|-----------|
| `"Legendary Payoff"` | `bg-amber-500/20`, `text-amber-300` | Oracle text matches any legendary/historic payoff pattern |
| `"Snow Payoff"` | `bg-cyan-500/20`, `text-cyan-300` | Oracle text or manaCost references snow permanents/mana |

## Algorithm Design

### Commander Alignment Boost (modified boostTribalScores)

```
1. Resolve commanders → EnrichedCard[]
2. Extract commanderSubtypes = Set of all commander creature subtypes
3. Extract commanderOracleTypes = Set of types referenced in commander oracle text
4. Call identifyTribalAnchors() → anchors[]
5. For each card in deck:
   a. Get creature subtypes
   b. For each subtype matching an anchor, determine tier:
      - If subtype in commanderSubtypes → rate = 0.25
      - Else if subtype in commanderOracleTypes → rate = 0.20
      - Else → rate = 0.15
      (Highest tier wins per type — no stacking)
   c. Total boost = min(0.5, sum of per-match rates)
   d. Changelings: iterate all anchors, each at its respective tier rate
   e. Apply boost to tribal axis score (cap at 1.0)
```

### Supertype Scoring Pipeline

```
1. computeAxisScores() — supertypeMatter detect() scores oracle-text payoffs
   detect() checks: card.oracleText for all legendary/snow/historic patterns
                     card.manaCost for {S} (snow mana)
2. boostSupertypeScores():
   a. Resolve commanders, call identifySupertypeAnchors()
   b. If no anchors, return
   c. For each card:
      - "legendary" anchor → card.supertypes.includes("Legendary")
      - "snow" anchor → card.supertypes.includes("Snow")
      - "historic" anchor → isHistoric(card) (Legendary OR Artifact OR Saga)
      - boost = min(0.4, matchCount * 0.15)
      - Apply to supertypeMatter axis score
3. Theme annotation: "Legendary Matters", "Snow Matters", "Historic"
```

## Implementation Tasks

### Phase 1: Enhanced Commander Tribal Boost — Tests

- [ ] 1.1 Add tests to `tests/unit/synergy-engine.spec.ts`
  - Test case: Commander subtype gets higher boost than density-only anchor
    - Deck: Elf commander + 10 Elves + 5 Goblins (secondary density anchor)
    - Assert: Elf creature scores higher than Goblin creature
  - Test case: Commander oracle-referenced type gets moderate boost
    - Deck: Najeela (references Warriors) + 5 Warriors + 5 Soldiers
    - Assert: Warriors score higher than Soldiers
  - Test case: Overlapping tiers use highest rate (not sum)
  - Test case: Non-commander anchor cards still get standard boost (no regression)
  - Test case: Partner commanders — both subtypes get +0.25 rate
  - Test case: Changeling gets tiered boost across all anchors

### Phase 2: Enhanced Commander Tribal Boost — Implementation

- [ ] 2.1 Modify `src/lib/creature-types.ts`
  - New export: `getCommanderTypes(commanders: EnrichedCard[]): { subtypes: Set<string>; oracleTypes: Set<string> }`

- [ ] 2.2 Modify `src/lib/synergy-engine.ts` — update `boostTribalScores()`
  - Import and call `getCommanderTypes` before boost loop
  - Classify each anchor match into tiers: 0.25 / 0.20 / 0.15
  - Update cap to `min(0.5, sum)` for commander-aligned cards

### Phase 3: Supertype Matters Axis — Tests

- [ ] 3.1 Add tests to `tests/unit/synergy-axes.spec.ts` for `supertypeMatter` axis
  - Jodah ("Whenever you cast a legendary...Legendary creatures you control get +1/+1") → score > 0
  - Jhoira ("Whenever you cast a historic spell") → score > 0
  - Ratadrabik ("Whenever another legendary creature you control dies") → score > 0
  - Kethis ("Legendary spells...cost {1} less" + "each legendary card in your graveyard") → score > 0
  - Shanid ("play a legendary land or cast a legendary spell") → score > 0
  - Mirror Box ("legend rule") → score > 0
  - Narfi ("Other snow and Zombie creatures...get +1/+1" + {S}{S}{S} ability) → score > 0
  - Marit Lage's Slumber ("Whenever a snow permanent enters") → score > 0
  - Card with {S} in manaCost only → score > 0
  - Generic creature (no supertype refs) → score = 0
  - Legendary creature with no payoff text (e.g., Thalia) → score = 0
  - Hylda of the Icy Crown (ice-themed, NOT snow-matters) → score = 0

### Phase 4: Supertype Matters Axis — Implementation

- [ ] 4.1 Add regex patterns to `src/lib/synergy-axes.ts` (per pattern tables above)

- [ ] 4.2 Add `supertypeMatter` axis definition to `SYNERGY_AXES`
  - `id: "supertypeMatter"`, `name: "Supertype Matters"`, `conflictsWith: []`
  - `detect(card)`: check `card.oracleText` for all patterns; check `card.manaCost` for `{S}`

### Phase 5: Supertype Module — Tests (TDD: tests before implementation)

- [ ] 5.1 Create `tests/unit/supertypes.spec.ts`
  - `identifySupertypeAnchors` tests:
    - Jodah commander → `["legendary"]`
    - Narfi commander → `["snow"]`
    - Jhoira commander → `["historic"]`
    - Yarok commander (Legendary, no legendary oracle text) + 10 legendaries → no anchors
    - Jodah + 20 legendary permanents → anchor score boosted by density
  - `isHistoric` tests:
    - Legendary Creature → true; Artifact → true; Saga → true
    - Regular Creature → false; Instant → false
  - `computeSupertypeBreakdown` tests:
    - Counts Legendary, Snow correctly; empty deck → empty Map

### Phase 6: Supertype Module — Implementation

- [ ] 6.1 Create `src/lib/supertypes.ts`
  - `isHistoric(card)`: checks `card.supertypes` for Legendary, `card.typeLine` for Artifact, `card.subtypes` for Saga
  - `identifySupertypeAnchors(commanders, cardNames, cardMap)`: scoring per anchor table, threshold >= 4
  - `computeSupertypeBreakdown(cardNames, cardMap)`: counts supertypes across deck

### Phase 7: Supertype Engine Boost — Tests

- [ ] 7.1 Add tests to `tests/unit/synergy-engine.spec.ts`
  - Jodah + 20 legendary creatures → supertypeMatter theme with detail "legendary"
  - Legendary creatures get boosted scores in Jodah deck
  - Non-legendary sorcery does NOT get boost
  - Narfi + 8 snow permanents → snow-matters theme
  - Jhoira + legendary creatures + artifacts + Saga → historic matches all three
  - Yarok + 10 legendaries → no supertypeMatter theme

### Phase 8: Supertype Engine Boost — Implementation

- [ ] 8.1 Add `boostSupertypeScores()` to `src/lib/synergy-engine.ts`
  - Match cards against anchors using supertypes/typeLine/subtypes (not just supertypes)
  - Insert after `boostTribalScores()` in pipeline

- [ ] 8.2 Update `identifyDeckThemes()` for supertypeMatter annotation
  - `"legendary"` → "Legendary Matters", `"snow"` → "Snow Matters", `"historic"` → "Historic"

### Phase 9: Card Tags — Tests

- [ ] 9.1 Add tests to `tests/unit/card-tags.spec.ts`
  - Jodah → "Legendary Payoff"; Kethis → "Legendary Payoff"; Jhoira → "Legendary Payoff"
  - Shanid → "Legendary Payoff"; Mirror Box → "Legendary Payoff"
  - Narfi → "Snow Payoff"; Marit Lage's Slumber → "Snow Payoff"
  - Card with {S} in manaCost → "Snow Payoff"
  - Thalia (Legendary, no payoff text) → no "Legendary Payoff"
  - Grizzly Bears → no supertype payoff tags

### Phase 10: Card Tags — Implementation

- [ ] 10.1 Modify `src/lib/card-tags.ts`
  - Add TAG_COLORS for "Legendary Payoff" and "Snow Payoff"
  - Add combined regex patterns; check oracle text AND manaCost for {S}

### Phase 11: UI Integration

- [ ] 11.1 Create `src/components/SupertypeBreakdown.tsx` (follow CreatureTypeBreakdown pattern)
- [ ] 11.2 Modify `src/components/SynergySection.tsx` — render when supertypeMatter theme detected
- [ ] 11.3 Modify `src/components/DeckAnalysis.tsx` — add supertypes collapsible panel

### Phase 12: Known Combos

- [ ] 12.1 Add combos to `src/lib/known-combos.ts`
  - Kethis + Mox Amber (legendary mana loop)
  - Jhoira + Aetherflux Reservoir (historic storm)
  - Jhoira + Sensei's Divining Top (draw deck with cost reducer)
  - Teshar + Mox Amber (historic recursion loop)

- [ ] 12.2 Add tests to `tests/unit/known-combos.spec.ts`

### Phase 13: Full Test Verification & Review

- [ ] 13.1 Run `npm run test:unit` — all pass
- [ ] 13.2 Run `npx tsc --noEmit` — no new errors in changed files
- [ ] 13.3 Code review sub-agent
- [ ] 13.4 MTG card expert review against: Jodah, Jhoira, Narfi, Kethis, Shanid, Mirror Box, Marit Lage's Slumber, Icehide Golem, Thalia (negative), Hylda (negative), Elf commander in Elf deck, partner commanders

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/supertypes.ts` | Create | `identifySupertypeAnchors`, `isHistoric`, `computeSupertypeBreakdown` |
| `tests/unit/supertypes.spec.ts` | Create | Unit tests for supertypes module |
| `src/components/SupertypeBreakdown.tsx` | Create | Bar chart for supertype frequency |
| `src/lib/creature-types.ts` | Modify | Add `getCommanderTypes()` export |
| `src/lib/synergy-engine.ts` | Modify | Update `boostTribalScores()` with commander tiers; add `boostSupertypeScores()`; update `identifyDeckThemes()` |
| `src/lib/synergy-axes.ts` | Modify | Add `supertypeMatter` axis with legendary/snow/historic patterns |
| `src/lib/card-tags.ts` | Modify | Add "Legendary Payoff" and "Snow Payoff" tags |
| `src/lib/known-combos.ts` | Modify | Add legendary/historic combos |
| `src/components/SynergySection.tsx` | Modify | Render SupertypeBreakdown for supertypeMatter theme |
| `src/components/DeckAnalysis.tsx` | Modify | Add supertypes collapsible panel |
| `tests/unit/synergy-engine.spec.ts` | Modify | Commander alignment boost + supertype engine tests |
| `tests/unit/synergy-axes.spec.ts` | Modify | supertypeMatter axis tests |
| `tests/unit/card-tags.spec.ts` | Modify | Legendary Payoff / Snow Payoff tag tests |
| `tests/unit/known-combos.spec.ts` | Modify | Legendary combo tests |

No changes to: `src/lib/types.ts`, `src/lib/deck-composition.ts`, `src/lib/mana.ts`, `src/lib/decklist-parser.ts`, `src/lib/scryfall.ts`, `src/lib/archidekt.ts`, e2e test files.

## Verification

1. `npm run test:unit` — all unit tests pass (0 failures)
2. `npx tsc --noEmit` — no new TypeScript errors in changed files
3. Manual: Import an Elf tribal deck with an Elf commander → verify Elf creatures score higher than non-Elf creatures → verify "Elf Tribal" theme detected
4. Manual: Import a Jodah, the Unifier deck → verify "Legendary Matters" theme appears → verify legendary creatures get boosted scores → verify "Legendary Payoff" tag on Jodah
5. Manual: Import a snow-themed deck → verify "Snow Matters" theme appears → verify SupertypeBreakdown shows Legendary/Snow counts
6. Code review sub-agent passes all quality categories
7. MTG card expert confirms detection accuracy for all test card scenarios
