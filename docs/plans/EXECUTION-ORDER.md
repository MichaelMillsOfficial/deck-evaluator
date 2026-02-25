# Feature Execution Order & Dependency Graph

This document defines the parallel execution strategy for all 10 planned features. Features are grouped into waves based on dependency relationships. All features within a wave can be built concurrently by independent agents.

## Dependency Graph

```
Wave 1 (all independent, no dependencies on unbuilt features):
┌──────────────────────────────┐
│  Deck Composition Scorecard  │──┐
│  Power Level Estimator       │  │
│  Opening Hand Simulator      │  │  All 7 features can run
│  Hypergeometric Calculator   │  │  in parallel as separate
│  Moxfield Direct Import      │  │  agents simultaneously
│  Commander Spellbook Integ.  │  │
│  Budget Analysis             │  │
└──────────────────────────────┘  │
                                  │
                                  │ hard dependency
                                  ▼
Wave 2 (depends on Wave 1 completions):
┌──────────────────────────────┐
│  Card Swap Suggestions       │◀── requires Deck Composition Scorecard
│  Deck Comparison             │◀── soft dep: richer with more analysis modules
│  Export/Share Reports        │◀── soft dep: richer with more analysis modules
└──────────────────────────────┘
```

## Wave 1: Independent Features (7 parallel agents)

All Wave 1 features depend only on existing, shipped code. They can be implemented simultaneously with zero coordination between agents.

| # | Feature | Plan File | New Files | Modified Files | Estimated Complexity |
|---|---------|-----------|-----------|----------------|---------------------|
| 1 | Deck Composition Scorecard | `deck-composition-scorecard.md` | 3 (lib, component, unit test) | 2 (DeckAnalysis, e2e) | Medium |
| 2 | Power Level Estimator | `power-level-estimator.md` | 3 (lib, component, unit test) | 2 (DeckAnalysis, e2e) | Medium |
| 3 | Opening Hand Simulator | `opening-hand-simulator.md` | 5 (lib, 3 components, unit test) | 3 (DeckViewTabs, e2e, fixtures) | High |
| 4 | Hypergeometric Calculator | `hypergeometric-calculator.md` | 3 (lib, component, unit test) | 2 (DeckAnalysis, e2e) | Medium |
| 5 | Moxfield Direct Import | `moxfield-direct-import.md` | 2 (unit test, e2e test) | 4 (moxfield.ts, types.ts, route.ts, DeckInput) | Medium |
| 6 | Commander Spellbook Integration | `commander-spellbook-integration.md` | 4 (lib, route, component, unit test) | 5 (DeckImportSection, DeckViewTabs, SynergySection, SynergyStats, fixtures) | High |
| 7 | Budget Analysis | `budget-analysis.md` | 5 (lib, 4 components) | 12+ (types.ts, scryfall.ts, EnrichedCardRow, DeckAnalysis, all test mocks) | High (mock update blast radius) |

### Wave 1 Conflict Analysis

These files are modified by multiple Wave 1 features. Agents must coordinate merge order:

| Shared File | Features That Modify It |
|-------------|------------------------|
| `src/components/DeckAnalysis.tsx` | Composition Scorecard (#1), Power Level (#2), Hypergeometric (#4), Budget (#7) |
| `src/components/DeckViewTabs.tsx` | Opening Hand (#3), Commander Spellbook (#6) |
| `src/components/DeckImportSection.tsx` | Commander Spellbook (#6) |
| `src/lib/types.ts` | Budget Analysis (#7) |
| `e2e/fixtures.ts` | Opening Hand (#3), Moxfield (#5), Commander Spellbook (#6) |

**Recommended merge order for `DeckAnalysis.tsx` modifications:**
1. Composition Scorecard (adds after CommanderSection)
2. Power Level Estimator (adds before Mana Curve)
3. Hypergeometric Calculator (adds after LandBaseEfficiency)
4. Budget Analysis (adds as last section)

**Recommended merge order for `DeckViewTabs.tsx` modifications:**
1. Opening Hand Simulator (adds "Hands" tab)
2. Commander Spellbook Integration (adds props threading)

### Wave 1 Special Notes

- **Budget Analysis** has the largest blast radius because it adds a `prices` field to `EnrichedCard`, requiring updates to ~12 test files. Consider merging this last in Wave 1 to minimize rebase conflicts for other agents.
- **Moxfield Direct Import** also modifies `DeckInput.tsx` to change the Moxfield tab from textarea to URL input. This is isolated from other Wave 1 features.
- **Commander Spellbook Integration** modifies `DeckImportSection.tsx` to add concurrent API fetching. No other Wave 1 feature touches this file.

---

## Wave 2: Dependent Features (3 agents, after Wave 1)

| # | Feature | Plan File | Hard Dependencies | Soft Dependencies |
|---|---------|-----------|-------------------|-------------------|
| 8 | Card Swap Suggestions | `card-swap-suggestions.md` | Deck Composition Scorecard (#1) | Synergy engine (exists) |
| 9 | Deck Comparison | `deck-comparison.md` | None | All analysis modules (exist + new from Wave 1) |
| 10 | Export/Share Reports | `export-share-reports.md` | None | All analysis modules (exist + new from Wave 1) |

### Wave 2 Dependency Details

**Card Swap Suggestions (#8)** -- **BLOCKED until Composition Scorecard (#1) is merged.**
- Requires `computeCompositionScorecard()` to identify category gaps
- Requires `CategoryResult.status` for gap-driven recommendations
- Requires `CompositionScorecardResult.categories[].cards` for sole-provider protection
- Also adds a new "Suggestions" tab to `DeckViewTabs.tsx`

**Deck Comparison (#9)** -- Can start after Wave 1 completes (no hard dependency).
- Benefits from more analysis modules being available (Composition Scorecard, Power Level, etc.) for richer comparison metrics
- Creates an entirely new `/compare` page route -- minimal merge conflict risk
- Can technically start during Wave 1 since it only depends on existing shipped modules, but waiting ensures the comparison includes all new metrics

**Export/Share Reports (#10)** -- Can start after Wave 1 completes (no hard dependency).
- Richer exports with more analysis modules available
- Phases are internally sequential (Text -> URL -> Image) but independent of other features
- Modifies `DeckViewTabs.tsx` to add ExportToolbar -- coordinate with other DeckViewTabs changes

### Wave 2 Parallelism

All three Wave 2 features can run in parallel once their dependencies are satisfied:
- Card Swap Suggestions starts as soon as Composition Scorecard (#1) is merged
- Deck Comparison and Export/Share can start as soon as Wave 1 is fully merged (or earlier if partial results are acceptable)

---

## Execution Summary

```
Timeline:
─────────────────────────────────────────────────────────
Wave 1:  [═══════ 7 agents in parallel ═══════════════]
Wave 2:                                    [══ 3 agents ══]
─────────────────────────────────────────────────────────

Agent allocation:
  Wave 1: 7 concurrent agents (one per feature)
  Wave 2: 3 concurrent agents (one per feature)
  Total: 10 agents, 2 waves
```

## Plan File Index

| Feature | Plan File | Wave |
|---------|-----------|------|
| Deck Composition Scorecard | `docs/plans/deck-composition-scorecard.md` | 1 |
| Power Level Estimator | `docs/plans/power-level-estimator.md` | 1 |
| Opening Hand Simulator | `docs/plans/opening-hand-simulator.md` | 1 |
| Hypergeometric Calculator | `docs/plans/hypergeometric-calculator.md` | 1 |
| Moxfield Direct Import | `docs/plans/moxfield-direct-import.md` | 1 |
| Commander Spellbook Integration | `docs/plans/commander-spellbook-integration.md` | 1 |
| Budget Analysis | `docs/plans/budget-analysis.md` | 1 |
| Card Swap Suggestions | `docs/plans/card-swap-suggestions.md` | 2 |
| Deck Comparison | `docs/plans/deck-comparison.md` | 2 |
| Export/Share Reports | `docs/plans/export-share-reports.md` | 2 |

## Already Implemented (No Work Needed)

These features from the original research plan are already fully shipped:

- Mana Curve Analysis (`docs/plans/mana-curve-analysis.md`)
- Color Distribution Analysis (`docs/plans/color-distribution-analysis.md`)
- Land Base Efficiency (`docs/plans/land-base-efficiency.md`)
- Card Synergy Mapping (`docs/plans/card-synergy-mapping.md`)
- Improved Card Tags (`docs/plans/improve-card-tags.md`)
