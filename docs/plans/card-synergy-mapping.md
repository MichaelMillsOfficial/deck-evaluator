# Card Synergy Mapping

## Context

The deck evaluator currently enriches cards via Scryfall and tags them with 8 functional categories (Ramp, Removal, etc.). The Analysis tab shows mana curve and color distribution. The next feature is a **synergy mapping system** that identifies high-synergy pairs/groups, anti-synergy conflicts, and per-card confidence scores -- all computed client-side from existing `EnrichedCard` data.

The goal is to help players understand how well each card fits their deck's strategy, surface powerful combos they may not have noticed, and warn about cards that work against each other.

---

## Algorithm Design

### Synergy Axes

Cards are evaluated against **synergy axes** -- thematic strategies a deck can pursue. Each axis has a `detect(card) -> relevance (0-1)` function using regex on oracle text, keywords, subtypes, and type lines.

| Axis | Detects | Conflicts With |
|------|---------|----------------|
| `counters` | +1/+1 counters, proliferate, Doubling Season | -- |
| `tokens` | Token creation, token doublers, go-wide | `boardWipe` |
| `graveyard` | Reanimate, flashback, delve, unearth | `graveyardHate` |
| `graveyardHate` | Exile graveyard, Rest in Peace | `graveyard` |
| `sacrifice` | Sacrifice outlets, death triggers, aristocrats | -- |
| `tribal` | Creature type lords, tribal payoffs | -- |
| `landfall` | Landfall triggers, extra land plays, fetchlands | -- |
| `spellslinger` | Spell-cast triggers, instants/sorceries matter | -- |
| `artifacts` | Artifact synergies, affinity, metalcraft | -- |
| `enchantments` | Constellation, enchantress effects | -- |
| `lifegain` | Life gain triggers, soul sisters | -- |
| `evasion` | Flying, unblockable, combat damage triggers | -- |

### Two Detection Layers

**Layer 1 -- Known Combos**: Hardcoded registry of ~15-20 specific card-name pairs (e.g., Thassa's Oracle + Demonic Consultation). Always high confidence when both pieces present.

**Layer 2 -- Heuristic Synergies**: Axis-based. Cards sharing an axis have positive synergy proportional to their relevance scores. Cards on conflicting axes (e.g., `graveyard` vs `graveyardHate`) have anti-synergy.

### Scoring Algorithm (0-100 per card)

```
cardScore = clamp(0, 100,
  50 (base)
  + sum(cardRelevance * deckAxisStrength * AXIS_WEIGHT) per axis
  + 20 per known combo partner present
  - antiSynergyPenalty per conflicting card
)
```

- `deckAxisStrength` = sum of all *other* cards' relevance on that axis
- Anti-synergy penalty = card's relevance on conflicting axis * count of conflicting cards * penalty weight
- Score bands: 80-100 Excellent, 60-79 Good, 40-59 Neutral, 20-39 Questionable, 0-19 Poor

---

## Implementation Tasks

### 1. Write Tests for Axis Detectors (TDD)

- [ ] Create `e2e/synergy-axes.spec.ts` with unit tests for each axis detector
  - Counters axis detects "proliferate", "+1/+1 counter", Doubling Season
  - Tokens axis detects "create" + "token" patterns
  - Graveyard axis detects flashback, delve, reanimate keywords
  - GraveyardHate axis detects "exile.*graveyard", Rest in Peace patterns
  - Sacrifice axis detects "sacrifice a creature" patterns
  - Tribal axis detects lord patterns ("other \[Type\] creatures get")
  - Landfall axis detects landfall keyword and fetch-land patterns
  - Each detector returns 0 for irrelevant cards

### 2. Write Tests for Known Combos (TDD)

- [ ] Create `e2e/known-combos.spec.ts` with unit tests
  - Finds Thassa's Oracle + Demonic Consultation when both present
  - Returns empty when only one combo piece present
  - Handles multiple combos in the same deck

### 3. Write Tests for Synergy Engine (TDD)

- [ ] Create `e2e/synergy-engine.spec.ts` with integration tests
  - Empty deck returns neutral scores
  - Counters-heavy deck scores Doubling Season highly
  - Rest in Peace gets anti-synergy penalty in reanimator deck
  - Known combo cards get bonus scores
  - Board wipes get anti-synergy in token-heavy decks
  - All per-card scores within 0-100 range
  - `deckThemes` sorted by strength, `topSynergies` sorted by strength

### 4. Define Synergy Types

- [ ] Add to `src/lib/types.ts`:

```typescript
export interface CardAxisScore {
  axisId: string;
  axisName: string;
  relevance: number; // 0-1
}

export interface SynergyPair {
  cards: string[];
  axisId: string | null; // null for known combos
  type: "synergy" | "anti-synergy" | "combo";
  strength: number; // 0-1
  description: string;
}

export interface CardSynergyScore {
  cardName: string;
  score: number; // 0-100
  axes: CardAxisScore[];
  pairs: SynergyPair[];
}

export interface DeckTheme {
  axisId: string;
  axisName: string;
  strength: number;
  cardCount: number;
}

export interface DeckSynergyAnalysis {
  cardScores: Record<string, CardSynergyScore>;
  topSynergies: SynergyPair[];
  antiSynergies: SynergyPair[];
  knownCombos: SynergyPair[];
  deckThemes: DeckTheme[];
}
```

### 5. Implement Synergy Axes

- [ ] Create `src/lib/synergy-axes.ts`
  - Define `SynergyAxisDefinition` interface: `{ id, name, description, color, detect(card): number, conflictsWith? }`
  - Implement 12 axis detectors using regex on `oracleText`, `keywords`, `subtypes`, `typeLine`
  - Follow the pattern established in `src/lib/card-tags.ts` for regex-based detection
  - Export `SYNERGY_AXES` array

### 6. Implement Known Combos Registry

- [ ] Create `src/lib/known-combos.ts`
  - Define `KnownCombo` interface: `{ cards: string[], description, type: "infinite"|"wincon"|"lock"|"value" }`
  - Add 15-20 well-known combos (Thoracle+Consultation, Dramatic Reversal+Isochron Scepter, Mikaeus+Triskelion, etc.)
  - Export `KNOWN_COMBOS` array

### 7. Implement Synergy Engine

- [ ] Create `src/lib/synergy-engine.ts`
  - Export `analyzeDeckSynergy(deck: DeckData, cardMap: Record<string, EnrichedCard>): DeckSynergyAnalysis`
  - Step 1: Score every card against every axis -> `Map<cardName, CardAxisScore[]>`
  - Step 2: Compute deck-level axis strengths (sum of relevance per axis)
  - Step 3: Detect known combos via `Set<string>` membership
  - Step 4: Generate heuristic synergy pairs (cards sharing axes with relevance > threshold)
  - Step 5: Generate anti-synergy pairs (cards on conflicting axes)
  - Step 6: Compute per-card confidence score using the formula above
  - Step 7: Identify deck themes (axes with significant card counts)
  - Step 8: Sort and return `DeckSynergyAnalysis`

### 8. Write E2E Tests for Synergy UI (TDD)

- [ ] Create `e2e/synergy-ui.spec.ts`
  - "Card Synergy" heading visible on Analysis tab after enrichment
  - Deck theme pills render for a themed deck
  - Synergy stat cards show values (avg score, combo count, anti-synergy count)
  - Top synergy pairs list is visible
  - Anti-synergy warnings render with amber/warning styling
  - Per-card synergy table is visible with score badges
- [ ] Update `e2e/fixtures.ts` -- add `synergySection` locator, `waitForSynergySection()` helper

### 9. Build UI Components

- [ ] Create `src/components/DeckThemes.tsx` -- horizontal pill bar of detected deck themes with card counts (reuse `CardTags` pill pattern with axis-specific colors)
- [ ] Create `src/components/SynergyStats.tsx` -- 3-column stat grid (avg synergy score, known combos count, anti-synergy count) matching `ManaBaseStats.tsx` pattern
- [ ] Create `src/components/SynergyPairList.tsx` -- list of synergy/anti-synergy pairs with card names, strength indicator, description; `variant` prop for synergy (purple) vs anti-synergy (amber) styling
- [ ] Create `src/components/CardSynergyTable.tsx` -- sortable table of cards with color-coded score badges (green/yellow/red), expandable rows showing axis participation; follow `EnrichedCardRow` expand/collapse pattern
- [ ] Create `src/components/SynergySection.tsx` -- orchestrator composing all synergy sub-components

### 10. Integrate into Analysis Tab

- [ ] Update `src/components/DeckAnalysis.tsx`
  - Import `analyzeDeckSynergy` and wrap in `useMemo` with `[deck, cardMap]` deps
  - Add `<section aria-labelledby="synergy-heading">` below color distribution
  - Render `<SynergySection analysis={synergyAnalysis} />`

### 11. Verification

- [ ] Run `npx playwright test e2e/synergy-axes.spec.ts` -- all pass
- [ ] Run `npx playwright test e2e/known-combos.spec.ts` -- all pass
- [ ] Run `npx playwright test e2e/synergy-engine.spec.ts` -- all pass
- [ ] Run `npx playwright test e2e/synergy-ui.spec.ts` -- all pass
- [ ] Run `npm test` -- full suite green
- [ ] Run `npm run build` -- no TypeScript errors

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add synergy interfaces (CardAxisScore, SynergyPair, CardSynergyScore, DeckTheme, DeckSynergyAnalysis) |
| `src/lib/synergy-axes.ts` | Create | 12 synergy axis definitions with regex detectors |
| `src/lib/known-combos.ts` | Create | Registry of 15-20 known MTG combos |
| `src/lib/synergy-engine.ts` | Create | Main `analyzeDeckSynergy()` orchestrator |
| `src/components/DeckThemes.tsx` | Create | Theme pill bar |
| `src/components/SynergyStats.tsx` | Create | Summary stat cards |
| `src/components/SynergyPairList.tsx` | Create | Synergy/anti-synergy pair lists |
| `src/components/CardSynergyTable.tsx` | Create | Per-card score table with expandable rows |
| `src/components/SynergySection.tsx` | Create | Orchestrator for all synergy UI |
| `src/components/DeckAnalysis.tsx` | Modify | Wire in synergy analysis section |
| `e2e/synergy-axes.spec.ts` | Create | Unit tests for axis detectors |
| `e2e/known-combos.spec.ts` | Create | Unit tests for combo detection |
| `e2e/synergy-engine.spec.ts` | Create | Integration tests for synergy engine |
| `e2e/synergy-ui.spec.ts` | Create | E2E tests for synergy UI |
| `e2e/fixtures.ts` | Modify | Add synergy page-object helpers |
| `docs/plans/card-synergy-mapping.md` | Create | This plan document |

**No changes to**: `package.json`, API routes, `DeckList.tsx`, `scryfall.ts`, `card-tags.ts`

---

## Key Patterns to Reuse

- **`src/lib/card-tags.ts`**: Regex-based oracle text detection pattern -- axis detectors follow same approach
- **`src/components/ManaBaseStats.tsx`**: Stat card grid layout -- reuse for `SynergyStats.tsx`
- **`src/components/EnrichedCardRow.tsx`**: Expand/collapse disclosure pattern -- reuse for `CardSynergyTable.tsx`
- **`src/components/CardTags.tsx`**: Color-coded pill rendering -- reuse for `DeckThemes.tsx`
- **`src/components/DeckAnalysis.tsx`**: `useMemo` pattern for expensive computations, section layout with `aria-labelledby`

## Performance

For a 100-card deck: ~1,200 regex evaluations for axis detection (<5ms), O(n) combo detection, filtered pair generation (not full N^2). Total <50ms, wrapped in `useMemo`.
