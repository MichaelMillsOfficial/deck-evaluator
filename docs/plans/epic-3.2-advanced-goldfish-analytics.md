# Epic 3.2: Advanced Goldfish Analytics

## Context

Extend the goldfish simulator with combo assembly tracking, board state milestones, commander tax visibility, and in-section comparison mode. Builds on the Monte Carlo simulator shipped in Phase 2.

**Dependencies**: Goldfish Simulator (Phase 2, shipped). Known Combos (shipped).

## Implementation Tasks

### Combo Assembly Tracker
- [ ] Create `src/lib/combo-assembly-tracker.ts` with ComboAssemblyTracker class
- [ ] Define interfaces: ComboPieceStatus, ComboAssemblySnapshot, ComboAssemblyStats
- [ ] Track combo piece zone locations per turn (hand, battlefield, graveyard, command zone)
- [ ] Add `zoneRequirements?: Record<string, Zone[]>` to KnownCombo for graveyard combos (Worldgorger Dragon + Animate Dead)
- [ ] Default assembly = all pieces in hand or battlefield; override for zone-specific combos
- [ ] Write `tests/unit/combo-assembly-tracker.spec.ts` — piece tracking, assembly detection, no-combo deck, graveyard combo

### Goldfish Simulator Integration
- [ ] Add comboTracker parameter to `runGoldfishSimulation()` in `goldfish-simulator.ts`
- [ ] Call `tracker.update(state, turn)` at end of each `executeTurn()`
- [ ] Add `commanderTaxTotal: number` to GoldfishTurnLog
- [ ] Add commander recast stats to GoldfishAggregateStats: avgCommanderRecasts, avgCommanderTaxTotal, commanderRecastDistribution
- [ ] Group identical tokens in PermanentSnapshot: `{ name, category, count }` instead of individual entries
- [ ] Add `id` field to KnownCombo if not present (for tracker initialization)
- [ ] Cache GoldfishResult in sessionStorage keyed by deck+config hash

### Board State Milestones
- [ ] Create `src/lib/goldfish-milestones.ts` with milestone detection
- [ ] Define BoardMilestone interface: turn, type (first_spell, commander_cast, combo_assembled, critical_mass), description
- [ ] Post-processing pass over GoldfishTurnLog[] — not embedded in simulation loop
- [ ] Detect notable turns: first spell cast, commander first cast, combo assembled, board wipe recovery
- [ ] Write `tests/unit/goldfish-milestones.spec.ts` — milestone detection at T3/T5/T8, empty game

### Goldfish Comparison
- [ ] Create `src/lib/goldfish-comparison.ts` with `compareGoldfishResults()`
- [ ] Define GoldfishComparison interface: deckA/deckB stats, deltas per metric, advantages array
- [ ] Pure arithmetic on two GoldfishResult objects — no re-simulation
- [ ] Stash baseline result when toggling comparison mode
- [ ] Write `tests/unit/goldfish-comparison.spec.ts` — delta computation, advantage detection, tie handling

### UI Components
- [ ] Create `src/components/ComboAssemblyChart.tsx` — sparkline bar chart per combo (Recharts BarChart in ChartContainer, height 120)
- [ ] Combo pill selector (SectionNav pattern) when multiple combos detected
- [ ] Expandable piece-by-piece breakdown below chart
- [ ] Create `src/components/BoardMilestones.tsx` — T3/T5/T8 milestone pills with snapshot cards
- [ ] Snapshot card: permanent count, land count, mana available, most common board pieces as CardPills
- [ ] Create `src/components/GoldfishComparison.tsx` — toggle button (aria-pressed), side-by-side layout
- [ ] Reuse MetricComparisonTable and ManaCurveOverlay for comparison display
- [ ] 4 advanced stat cards: combo assembly %, avg board T5, stall rate, T:first win con
- [ ] Add "assumes optimal solitaire play with no interaction" disclaimer

### Accessibility
- [ ] sr-only table for combo assembly chart data
- [ ] aria-describedby on advanced stat cards linking to metric descriptions
- [ ] All new controls meet 44px touch target minimum

### E2E Tests
- [ ] P0: Commander tax reflected in re-cast turns (find game with recast, verify tax annotation)
- [ ] P1: Board state snapshots at milestone turns
- [ ] P1: Combo assembly tracking visible for combo decks
- [ ] P2: Goldfish comparison side-by-side with metric deltas
- [ ] Add page object methods: goldfishComboTracking, goldfishBoardSnapshots, goldfishComparisonPanel

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `src/lib/combo-assembly-tracker.ts` | Combo tracking |
| Create | `src/lib/goldfish-milestones.ts` | Milestone detection |
| Create | `src/lib/goldfish-comparison.ts` | Result comparison |
| Create | `src/components/ComboAssemblyChart.tsx` | Combo chart |
| Create | `src/components/GoldfishComparison.tsx` | Comparison UI |
| Create | `src/components/BoardMilestones.tsx` | Milestone display |
| Create | `tests/unit/combo-assembly-tracker.spec.ts` | Unit tests |
| Create | `tests/unit/goldfish-milestones.spec.ts` | Unit tests |
| Create | `tests/unit/goldfish-comparison.spec.ts` | Unit tests |
| Modify | `src/lib/goldfish-simulator.ts` | Tracker integration, token grouping |
| Modify | `src/components/GoldfishSection.tsx` | Advanced UI elements |
| Modify | `src/lib/known-combos.ts` | Add id field |

## Verification

1. `npm run test:unit` — all goldfish unit tests pass
2. `npm run test:e2e` — goldfish tab tests pass
3. Manual: Import combo deck → Goldfish tab → run simulation → see combo assembly chart, milestone snapshots, toggle comparison
