# Power Level Estimator

## Context

Power level discussions are the number one source of pre-game friction in Commander. Before every game, players ask "What's the power level of your deck?" and the answers are wildly inconsistent -- one player's "7" is another player's "4." Existing online calculators (EDHPowerLevel.com, BrackCheck.com) use opaque, unexplained formulas that players do not trust, so the scores feel arbitrary and cannot be challenged or discussed constructively.

This feature adds a **transparent, explainable power level score (1-10)** for Commander decks. The score is computed from 8 weighted heuristic factors, and the UI shows exactly which factors contributed and how. Every sub-score is visible, every weight is documented, and a human-readable explanation accompanies each factor.

### Intended Outcome

After importing and enriching a deck, the Analysis tab shows a prominent power level display (1-10) with a full factor breakdown. Players can see *why* the tool rated their deck at a 6 and discuss whether they agree.

## Why

- **Competitive advantage**: No existing tool provides full per-factor transparency in power level scoring. EDHPowerLevel.com and BrackCheck.com both produce a single opaque number.
- **User value**: Enables constructive pre-game conversations ("My deck is a 6 -- it has 2 tutors and 1 infinite combo but no fast mana") and helps players identify which axis to adjust.
- **Builds on existing infrastructure**: All 8 scoring inputs already exist in the codebase. No new APIs or external data sources needed.

## Dependencies

All dependencies are existing, shipped features:

| Dependency | Module | What It Provides |
|-----------|--------|------------------|
| Card tags | `src/lib/card-tags.ts` | `generateTags(card)` — Tutor, Removal, Counterspell, Board Wipe, Card Draw, Card Advantage counts |
| Known combos | `src/lib/known-combos.ts` | `findCombosInDeck(cardNames)` returns `KnownCombo[]` with `type: "infinite" \| "wincon" \| "lock" \| "value"` |
| Land base efficiency | `src/lib/land-base-efficiency.ts` | `computeLandBaseEfficiency()` returns `{ overallScore: 0-100 }` |
| Mana base metrics | `src/lib/color-distribution.ts` | `computeManaBaseMetrics()` returns `{ averageCmc, landCount, landPercentage }` |
| Types | `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard` |
| UI patterns | `src/components/LandBaseEfficiency.tsx` | Score display, color-coded badges, progress bars, factor rows |

**No hard dependencies on other unbuilt features.** Can be built in parallel with all other planned features.

## Existing Patterns to Reuse

| Pattern | Source | Application |
|---------|--------|-------------|
| Pure computation function | `src/lib/land-base-efficiency.ts` | `computePowerLevel(deck, cardMap)` returning typed result |
| Factor breakdown result | `LandBaseEfficiencyResult` | `{ overallScore, scoreLabel, factors[] }` shape |
| UI score display | `src/components/LandBaseEfficiency.tsx` | `getScoreColor()`, progress bars, factor rows |
| DeckAnalysis integration | `src/components/DeckAnalysis.tsx` | `useMemo` + `<section aria-labelledby>` |
| Unit test helpers | `tests/unit/synergy-engine.spec.ts` | `mockCard()`, `mockDeck()` patterns |

---

## Scoring Algorithm

### Factors and Weights

| # | Factor | Weight | Raw Value Source | Score Mapping |
|---|--------|--------|-----------------|---------------|
| 1 | Tutor density | 0.18 | Count of "Tutor" tagged cards | 0 → 0, 1-2 → 30, 3-4 → 55, 5-6 → 75, 7+ → 100 |
| 2 | Fast mana count | 0.16 | Name-based detection against curated list | 0 → 0, 1 → 25, 2 → 45, 3-4 → 70, 5+ → 100 |
| 3 | Average CMC | 0.12 | `computeManaBaseMetrics().averageCmc` | ≤1.8 → 100, 2.0-2.5 → 80, 2.5-3.0 → 60, 3.0-3.5 → 40, 3.5-4.0 → 20, ≥4.0 → 0 |
| 4 | Interaction density | 0.14 | "Removal" + "Counterspell" + "Board Wipe" tags | 0-2 → 0, 3-5 → 25, 6-8 → 45, 9-12 → 65, 13-16 → 80, 17+ → 100 |
| 5 | Infinite combo count | 0.14 | `findCombosInDeck()` filtered to infinite/wincon | 0 → 0, 1 → 50, 2 → 75, 3+ → 100 |
| 6 | Mana base quality | 0.10 | `computeLandBaseEfficiency().overallScore` | Direct passthrough (already 0-100) |
| 7 | Card draw density | 0.08 | "Card Draw" + "Card Advantage" tags | 0-3 → 0, 4-6 → 30, 7-9 → 55, 10-12 → 75, 13+ → 100 |
| 8 | Win condition speed | 0.08 | Avg CMC of combo pieces + efficient threats | Inverted CMC scale |

Weights sum to 1.00. Weighted sum produces raw score 0-100, mapped to power level 1-10.

### Raw Score to Power Level Mapping

| Raw Score | Power Level | Band Label |
|-----------|-------------|------------|
| 0-9 | 1 | Casual |
| 10-19 | 2 | Casual |
| 20-29 | 3 | Casual |
| 30-39 | 4 | Focused |
| 40-49 | 5 | Focused |
| 50-59 | 6 | Optimized |
| 60-69 | 7 | Optimized |
| 70-79 | 8 | High Power |
| 80-89 | 9 | High Power |
| 90-100 | 10 | cEDH |

### Power Level Band Descriptions

- **1-3 (Casual)**: Precon-level or jank. No tutors, no fast mana, high curve, minimal interaction.
- **4-5 (Focused)**: Clear strategy with some optimization. A few tutors, moderate curve, possibly 1 combo.
- **6-7 (Optimized)**: Efficient curve, multiple tutors, consistent game plan, 1-2 combos, solid interaction.
- **8-9 (High Power)**: Fast mana, efficient tutors, multiple win lines, low curve, high interaction density.
- **10 (cEDH)**: Fully optimized for speed. Maximum tutors, fast mana, redundant combo lines, turn 3-5 wins.

### Fast Mana Detection List

Exported as `FAST_MANA_NAMES: Set<string>` for testability:

```
Sol Ring, Mana Crypt, Mana Vault, Chrome Mox, Mox Diamond,
Jeweled Lotus, Mox Opal, Lotus Petal, Mox Amber, Lion's Eye Diamond,
Dark Ritual, Cabal Ritual, Simian Spirit Guide, Elvish Spirit Guide,
Rite of Flame, Pyretic Ritual, Desperate Ritual
```

---

## Implementation Tasks

### Phase 1: Core Logic (`src/lib/power-level.ts`)

- [ ] Create `src/lib/power-level.ts` with result types:
  - `PowerLevelFactor` — `{ id, name, rawValue, score, weight, maxRawValue, explanation }`
  - `PowerLevelResult` — `{ powerLevel, rawScore, bandLabel, bandDescription, factors[] }`
- [ ] Export `FAST_MANA_NAMES: Set<string>` with curated fast mana card list
- [ ] Implement `countTaggedCards(deck, cardMap, tags: string[]): number` — iterates all sections, calls `generateTags()`, counts matches
- [ ] Implement `countFastMana(deck, cardMap): number` — checks `FAST_MANA_NAMES.has(name)`
- [ ] Implement `scoreTutorDensity(count): { score, explanation }` — breakpoint mapping
- [ ] Implement `scoreFastMana(count): { score, explanation }` — breakpoint mapping
- [ ] Implement `scoreAverageCmc(avgCmc): { score, explanation }` — continuous mapping (lower = higher)
- [ ] Implement `scoreInteractionDensity(count): { score, explanation }` — breakpoint mapping
- [ ] Implement `scoreInfiniteCombos(combos): { score, explanation }` — filters to infinite/wincon types
- [ ] Implement `scoreManaBaseQuality(landEfficiencyScore): { score, explanation }` — direct passthrough
- [ ] Implement `scoreCardDrawDensity(count): { score, explanation }` — breakpoint mapping
- [ ] Implement `scoreWinConditionSpeed(deck, cardMap, combos): { score, explanation }` — CMC of combo pieces + efficient threats
- [ ] Implement `rawScoreToPowerLevel(rawScore): { powerLevel, bandLabel, bandDescription }` — maps 0-100 to 1-10
- [ ] Implement `computePowerLevel(deck, cardMap): PowerLevelResult` — orchestrates all sub-scorers, applies weights

### Phase 2: Unit Tests (`tests/unit/power-level.spec.ts`)

- [ ] `FAST_MANA_NAMES` contains expected cards (Sol Ring, Mana Crypt, etc.)
- [ ] `FAST_MANA_NAMES` excludes non-fast-mana (Forest, Lightning Bolt, Command Tower)
- [ ] `countFastMana` returns 0 for deck with no fast mana
- [ ] `countFastMana` returns correct count for Sol Ring + Mana Crypt
- [ ] `scoreTutorDensity` returns 0 for zero tutors, 100 for 7+, mid-range for 3-4
- [ ] `scoreFastMana` returns 0 for zero, 100 for 5+
- [ ] `scoreAverageCmc` returns 100 for 1.5, 0 for 4.5, mid-range for 2.5
- [ ] `scoreInteractionDensity` returns 0 for 0-2, 100 for 17+
- [ ] `scoreInfiniteCombos` returns 0 for no combos, 50 for 1, 100 for 3+; ignores value-type combos
- [ ] `rawScoreToPowerLevel` maps 0-9 → 1, 50-59 → 6, 90-100 → 10; clamps -5 → 1, 150 → 10
- [ ] `computePowerLevel` returns valid structure for empty deck (power level 1)
- [ ] `computePowerLevel` returns low power (1-3) for precon-style deck
- [ ] `computePowerLevel` returns mid power (4-6) for focused deck
- [ ] `computePowerLevel` returns high power (7-9) for optimized deck
- [ ] All factors have scores in 0-100 range
- [ ] All factors have non-empty explanation strings
- [ ] Factor weights sum to 1.0

### Phase 3: UI Component (`src/components/PowerLevelEstimator.tsx`)

- [ ] Create component receiving `PowerLevelResult` as props
- [ ] Large power level number (1-10) with color-coded styling: 1-3 green, 4-5 yellow, 6-7 orange, 8-9 red, 10 purple
- [ ] Band label badge ("Casual", "Focused", "Optimized", "High Power", "cEDH")
- [ ] Band description subtitle
- [ ] Raw score (0-100) as secondary metric with progress bar
- [ ] Factor rows: name, raw value, score (0-100) with progress bar, weight %, explanation
- [ ] `data-testid` attributes: `power-level-score`, `power-level-band`, `power-level-factor`, `power-level-raw-score`
- [ ] Styled consistently with `LandBaseEfficiency.tsx`
- [ ] `<section aria-labelledby="power-level-heading">` with proper ARIA structure

### Phase 4: Integration into DeckAnalysis

- [ ] Import `computePowerLevel` and `PowerLevelEstimator`
- [ ] Add `useMemo`: `const powerLevel = useMemo(() => computePowerLevel(deck, cardMap), [deck, cardMap])`
- [ ] Render as **first** section in Analysis tab (before Mana Curve) — power level is the highest-value summary metric

### Phase 5: E2E Tests (extend `e2e/deck-analysis.spec.ts`)

- [ ] "Power Level Estimator section appears on Analysis tab"
- [ ] "displays power level score between 1 and 10"
- [ ] "displays band label" (one of Casual/Focused/Optimized/High Power/cEDH)
- [ ] "displays factor breakdown rows"
- [ ] "section has accessible heading structure"
- [ ] "power level section appears before Mana Curve"

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/power-level.ts` | Create | Factor scorers, weight constants, `computePowerLevel()`, types |
| `src/components/PowerLevelEstimator.tsx` | Create | Power level display, factor breakdown, progress bars |
| `src/components/DeckAnalysis.tsx` | Modify | Import and render as first section |
| `tests/unit/power-level.spec.ts` | Create | Unit tests for all scoring functions |
| `e2e/deck-analysis.spec.ts` | Modify | E2E tests for power level UI |

No changes to: `types.ts`, API routes, `card-tags.ts`, `known-combos.ts`, `land-base-efficiency.ts`, `DeckViewTabs.tsx`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|------------------|
| Empty deck (0 cards) | Power level 1, all factors score 0 |
| No enriched cards (cardMap empty) | Power level 1, tags can't be generated |
| Deck with only lands | Avg CMC 0, CMC factor high but all others 0 → low power |
| 99 tutors | Tutor density maxes at 100, no crash |
| No commander (standard decklist) | Works fine — tags and combos don't require commanders |
| Partial enrichment | Missing cards skipped, score reflects known cards |
| Single-card deck | Valid scores, no div-by-zero |
| Multi-tag cards | Counted toward each relevant factor (interaction = Removal + Counterspell + Board Wipe) |
| Fast mana detection by name | Works even without enrichment data |
| Avg CMC at breakpoints | Continuous mapping avoids cliff effects |

## E2E User Scenarios

1. **Casual precon**: Paste Commander 2024 precon → Analysis → power level 2-3, "Casual", 0 tutors, 1 fast mana (Sol Ring), high CMC
2. **Optimized deck**: Import Korvold sacrifice via Archidekt → power level 6-7, "Optimized", 4 tutors, 2 fast mana, 1 combo
3. **cEDH deck**: Paste Turbo Naus Tymna/Thrasios → power level 9-10, 8+ tutors, 5+ fast mana, 3 combos
4. **Tab switching**: Check power level on Analysis → Deck List → Synergy → back to Analysis — score persists (useMemo cache)

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/power-level.spec.ts` — all pass
2. `npx playwright test e2e/deck-analysis.spec.ts` — all pass
3. `npm test` — full suite green
4. `npm run build` — no TypeScript errors
5. Manual: import precon → power 1-3; import optimized deck → power 6-8; verify factor explanations make sense
