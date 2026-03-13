# Interaction Presentation Enhancements

## Context

The interaction engine already detects pairwise interactions, chains, loops, enablers, and blockers across a Commander deck. The `InteractionAnalysis` result object (defined in `src/lib/interaction-engine/types.ts`) contains `interactions[]`, `chains[]`, `loops[]`, `blockers[]`, and `enablers[]`, plus the full `profiles` map with `rawOracleText` on each `CardProfile`.

Three presentation gaps remain:

1. **No per-card centrality metric.** The UI lists interactions but does not aggregate them per card. A player cannot quickly identify which cards are "engine pieces" (high interaction count/strength) vs "dead weight" (zero interactions). This is the inverse of Epic 1.1's weak card identification -- centrality operates on the interaction graph rather than the synergy score.

2. **RemovalImpact type exists but is never computed.** The `RemovalImpact` interface is defined in the types file but no function produces it. Players want to know: "If I remove Blood Artist, what breaks?"

3. **Mechanical descriptions lack oracle text grounding.** The `mechanical` field on `Interaction` is a generated English sentence. Players need to see which specific oracle text fragment on each card supports this claim, both for trust and for learning.

### Intended Outcome

The Interactions tab gains three new sub-panels: a centrality ranking table showing per-card interaction counts and scores, a removal impact inspector where selecting a card shows exactly what breaks, and inline oracle text citations on each interaction's mechanical description. All three features are computed client-side from the existing `InteractionAnalysis` result with no new API calls.

## Dependencies

| Dependency | Module | What It Provides | Status |
|-----------|--------|------------------|--------|
| Interaction engine | `src/lib/interaction-engine/` | `InteractionAnalysis`, `CardProfile`, `Interaction`, `InteractionChain`, `InteractionLoop` | Exists |
| Interaction rollup | `src/lib/interaction-rollup.ts` | `rollUpInteractions()`, `DisplayInteractionItem` | Exists |
| InteractionSection UI | `src/components/InteractionSection.tsx` | Current interaction rendering with filters, rollups, chains, loops, blockers | Exists |
| useInteractionAnalysis hook | `src/hooks/useInteractionAnalysis.ts` | Lazy interaction computation with progress, caching | Exists |
| CollapsiblePanel | `src/components/CollapsiblePanel.tsx` | Reusable expandable panel | Exists |
| OracleText component | `src/components/OracleText.tsx` | Oracle text rendering with inline mana symbols | Exists |

**No dependencies on unbuilt features.** No new API routes needed.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation in `src/lib/` | `src/lib/interaction-rollup.ts` | Centrality and removal impact are pure functions of `InteractionAnalysis` |
| Collapsible panel | `src/components/CollapsiblePanel.tsx` | Centrality ranking and removal impact panels |
| Score badge coloring | `src/components/CardSynergyTable.tsx` | Centrality score badges |
| Expandable card row | `src/components/EnrichedCardRow.tsx` | `aria-expanded`, `aria-controls`, chevron, Escape key |
| Sorted table with headers | `src/components/DeckList.tsx` | `table-auto` pattern for centrality ranking |
| Interaction type colors | `src/components/InteractionSection.tsx` | `INTERACTION_TYPE_COLORS` map |
| OracleText rendering | `src/components/OracleText.tsx` | Inline oracle text with mana symbol images |

---

## Design Decisions

### Centrality Scoring Weights (from MTG Rules Expert review)

Interaction types are NOT weighted equally. Weights reflect strategic importance:

| Type | Weight | Reasoning |
|------|--------|-----------|
| `loops_with` | 5.0 bonus per loop | Infinite loops are win conditions |
| `enables` | 0.9 | Enablers are prerequisites; removing cascades |
| `triggers` | 0.8 | Trigger chains create card advantage |
| `reduces_cost` | 0.7 | Cost reduction is multiplicative |
| `amplifies` | 0.7 | Force multipliers |
| `recurs` | 0.6 | Resilience, but reactive |
| `protects` | 0.5 | Defensive, doesn't advance game state |
| `tutors_for` | 0.5 | Consistency, but tutor isn't the payoff |
| `blocks` | -0.3 | Restrictions are negative centrality |
| `conflicts` | -0.5 | Actively hurts the deck |

Chain bonus: 2.0 per chain membership. Enabler bonus: 1.5 per enabled interaction.

### Casual-Friendly Labels (from Casual User Advocate review)

- Category badges: "Engine" → "Makes Your Deck Tick", "Contributor" → "Solid Fit", "Peripheral" → "Light Connection", "Isolated" → "No Connections"
- Show "Works with 12 other cards" not raw scores
- Removal impact: "Hard to Replace" (red) vs "Safe to Swap" (green) badges
- Strength: Strong / Moderate / Weak instead of percentage bars
- Progressive disclosure: headline first, details on expand

### UX Placement (from UX Lead review)

- Centrality ranking: new `CollapsiblePanel` in InteractionSection, default collapsed
- Removal impact: below centrality, activated by selecting a card row
- Citations: inline in expanded interaction rows as `<blockquote>` styled snippets
- Lazy-compute citations only when toggle opened

### Citation Model (from MTG Rules Expert review)

Three tiers:
1. **Explicit ability**: link to oracle text sentence containing the keyword
2. **Type-line**: for implicit interactions (being a creature enables sacrifice)
3. **Rules reference**: for fundamental game rules (all creatures can attack/block)

---

## Implementation Tasks

### Phase 1: Core Types and Centrality Logic (`src/lib/interaction-centrality.ts`)

- [ ] **1.1** Create `src/lib/interaction-centrality.ts` with type definitions:
  - `CentralityScore` -- `{ cardName, interactionCount, weightedScore, asSource, asTarget, chainCount, loopCount, enablerOf, rank, category }`
  - `CentralityResult` -- `{ scores: CentralityScore[], maxScore, medianScore }`

- [ ] **1.2** Implement `computeCentrality(analysis: InteractionAnalysis): CentralityResult`:
  1. Initialize a map for every card name in `analysis.profiles`.
  2. For each interaction, increment counts and add `strength * typeWeight` to `weightedSum`.
  3. For each chain, add chain bonus (2.0) per card in chain.
  4. For each loop, add loop bonus (5.0) per card in loop.
  5. For each enabler, add enabler bonus (1.5) per enabled interaction.
  6. Sort descending by `weightedScore`, assign `rank` (1-indexed).
  7. Compute `maxScore` and `medianScore` for normalization.

- [ ] **1.3** Implement `categorizeCentrality(score, result): "engine" | "contributor" | "peripheral" | "isolated"`:
  - `engine`: `weightedScore >= maxScore * 0.6`
  - `contributor`: `weightedScore >= medianScore`
  - `peripheral`: `weightedScore > 0` but below median
  - `isolated`: `weightedScore === 0`

### Phase 2: Removal Impact Logic (`src/lib/interaction-removal-impact.ts`)

- [ ] **2.1** Create `src/lib/interaction-removal-impact.ts`.

- [ ] **2.2** Implement `computeRemovalImpact(cardName, analysis): RemovalImpact`:
  1. `interactionsLost`: filter interactions where card is a participant.
  2. `interactionsUnblocked`: filter blockers where card is the blocker.
  3. `chainsDisrupted`: filter chains containing the card.
  4. `loopsDisrupted`: filter loops containing the card.
  5. Build `description` string.

- [ ] **2.3** Implement `computeAllRemovalImpacts(analysis): Map<string, RemovalImpact>`:
  - Pre-build index maps for O(1) lookups.
  - Iterate card names once.

### Phase 3: Oracle Text Citation Logic (`src/lib/interaction-citations.ts`)

- [ ] **3.1** Create `src/lib/interaction-citations.ts` with types:
  - `OracleTextCitation` -- `{ cardName, snippet, startIndex, endIndex, tier: "ability" | "typeline" | "rule" }`
  - `InteractionCitation` -- `{ interaction, citations[] }`

- [ ] **3.2** Implement `extractCitations(interaction, profiles): OracleTextCitation[]`:
  1. For each card, get `rawOracleText` from profile.
  2. Extract mechanical keywords from `interaction.mechanical`.
  3. Search oracle text sentences for keyword matches.
  4. For implicit interactions (type-based), create type-line tier citations.
  5. Deduplicate by snippet.

- [ ] **3.3** Implement `extractMechanicalKeywords(mechanical: string): string[]`.

- [ ] **3.4** Implement `findOracleSnippet(oracleText, keywords): OracleTextCitation | null`.

### Phase 4: Unit Tests

- [ ] **4.1** Create `tests/unit/interaction-centrality.spec.ts` (10 tests):
  - Zero interactions → all isolated
  - Card in 5 interactions > card in 2
  - Loop bonus applied correctly
  - Chain bonus applied correctly
  - Enabler bonus applied correctly
  - Ranks are 1-indexed and unique
  - maxScore and medianScore computed correctly
  - categorizeCentrality returns correct categories
  - Empty analysis returns empty scores
  - Conflicts produce negative weight contribution

- [ ] **4.2** Create `tests/unit/interaction-removal-impact.spec.ts` (8 tests):
  - Card with 3 interactions → 3 interactionsLost
  - Blocker card → populates interactionsUnblocked
  - Card in 2 chains → 2 chainsDisrupted
  - Card in 1 loop → 1 loopsDisrupted
  - No interactions → empty arrays
  - Description format matches expected pattern
  - computeAllRemovalImpacts covers every profiled card
  - Card not in chains/loops → empty arrays

- [ ] **4.3** Create `tests/unit/interaction-citations.spec.ts` (7 tests):
  - extractMechanicalKeywords extracts "sacrifice"
  - extractMechanicalKeywords extracts "enters the battlefield"
  - findOracleSnippet finds matching sentence
  - findOracleSnippet returns null on no match
  - extractCitations produces citations from both cards
  - extractCitations handles missing rawOracleText
  - extractCitations deduplicates identical snippets

### Phase 5: UI Components

- [ ] **5.1** Create `src/components/CentralityRanking.tsx`:
  - Sortable table: Rank, Card Name, Connections count, Category badge
  - Category badges: Engine (purple), Contributor (blue), Peripheral (slate), Isolated (red)
  - Row selection emits `onSelectCard(cardName)`
  - Empty state: "No interactions detected."
  - `data-testid="centrality-ranking"`, `data-testid="centrality-row"`

- [ ] **5.2** Create `src/components/RemovalImpactInspector.tsx`:
  - Shows prompt when no card selected
  - Summary line: "Removing {card} loses {N} interactions, disrupts {M} chains, breaks {K} loops"
  - "Hard to Replace" / "Safe to Swap" badges
  - Expandable detail sections for lost interactions, disrupted chains, broken loops
  - `data-testid="removal-impact-inspector"`, `data-testid="removal-impact-summary"`

- [ ] **5.3** Create `src/components/InteractionCitation.tsx`:
  - Blockquote-styled oracle text snippets with card name attribution
  - Uses `OracleText` component for inline mana symbols
  - Styled: `bg-slate-900/50 border-l-2 border-purple-500 pl-3 py-1`
  - `data-testid="interaction-citation"`

- [ ] **5.4** Modify interaction rows in `InteractionSection.tsx` to add citation toggles:
  - "Show rules text" toggle below mechanical description
  - Lazy-compute citations on expand
  - `data-testid="show-citations-toggle"`

### Phase 6: Integration into InteractionSection

- [ ] **6.1** Add "Card Centrality & Removal Impact" `CollapsiblePanel` above interaction list:
  - Compute via `useMemo` from `analysis` prop
  - Add `selectedCard` state for removal impact inspector
  - Default collapsed

- [ ] **6.2** Ensure proper memoization of computations.

- [ ] **6.3** Pass `analysis.profiles` to citation components for `rawOracleText`.

### Phase 7: E2E Tests

- [ ] **7.1** Update `e2e/fixtures.ts` with centrality/removal/citation locators.

- [ ] **7.2** Create `e2e/interaction-centrality.spec.ts` (8 tests):
  - Centrality ranking panel appears
  - Cards sorted by score descending
  - Clicking card shows removal impact
  - Removal impact shows correct counts
  - Isolated cards show warning badge
  - Citation toggle shows oracle text
  - Empty analysis shows empty state
  - Proper ARIA structure

### Phase 8: Polish

- [ ] **8.1** `motion-reduce:transition-none` on citation expand/collapse
- [ ] **8.2** 44px min touch targets on centrality rows and citation toggles
- [ ] **8.3** `aria-label` on category badges
- [ ] **8.4** `aria-expanded` and `aria-controls` on citation toggles
- [ ] **8.5** Verify centrality computation is sub-millisecond for 100-card decks

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/interaction-centrality.ts` | Create | CentralityScore/Result types, computeCentrality(), categorizeCentrality() |
| `src/lib/interaction-removal-impact.ts` | Create | computeRemovalImpact(), computeAllRemovalImpacts() |
| `src/lib/interaction-citations.ts` | Create | OracleTextCitation types, extractCitations(), extractMechanicalKeywords(), findOracleSnippet() |
| `src/components/CentralityRanking.tsx` | Create | Sortable centrality table with category badges, row selection |
| `src/components/RemovalImpactInspector.tsx` | Create | Selected card's removal impact display |
| `src/components/InteractionCitation.tsx` | Create | Oracle text citation blockquote component |
| `src/components/InteractionSection.tsx` | Modify | Add centrality panel, removal impact, citation toggles |
| `tests/unit/interaction-centrality.spec.ts` | Create | 10 unit tests |
| `tests/unit/interaction-removal-impact.spec.ts` | Create | 8 unit tests |
| `tests/unit/interaction-citations.spec.ts` | Create | 7 unit tests |
| `e2e/interaction-centrality.spec.ts` | Create | 8 E2E tests |
| `e2e/fixtures.ts` | Modify | Add centrality/removal/citation helpers |

**No changes to**: `src/lib/interaction-engine/types.ts`, `src/lib/interaction-engine/interaction-detector.ts`, `src/hooks/useInteractionAnalysis.ts`, `src/lib/interaction-rollup.ts`, `src/lib/view-tabs.ts`, `src/components/DeckViewTabs.tsx`, `package.json`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Deck with 0 interactions | All cards "Isolated", removal impact shows "No interactions to lose" |
| Card in profiles but not in any interaction | Score 0, rank last, "Isolated" category |
| Card in a loop AND a chain | Both bonuses stack |
| Card is both enabler and blocker | Centrality includes enabler bonus; removal shows both lost and unblocked |
| Same card pair has multiple interaction types | Each counted separately |
| Card with no rawOracleText | Citation returns empty, shows "No rules text available" |
| Mechanical description has no recognizable keywords | Citation shows nothing (graceful degradation) |
| Very long oracle text (split cards, sagas) | Sentence splitting handles newlines; returns first match |
| Rolled-up interactions | Citations computed per sub-interaction when expanded |
| 100-card deck with 500+ interactions | Centrality O(n+m) < 1ms, removal impact with index maps < 5ms |
| Conflicts interactions | Produce negative weight contribution to centrality |

---

## Performance Analysis

All three features are post-processing of existing `InteractionAnalysis` data:
- **Centrality**: O(I + C + L + E) ≈ sub-1ms for typical Commander decks
- **Removal Impact (all cards)**: O(I + C + L + B) for index build + O(n) for iteration ≈ sub-5ms
- **Citations**: Lazy per-interaction, O(sentences × keywords) ≈ sub-microsecond per call

No web worker, API calls, or pipeline changes needed.

---

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-centrality.spec.ts` -- all 10 pass
2. `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-removal-impact.spec.ts` -- all 8 pass
3. `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-citations.spec.ts` -- all 7 pass
4. `npx playwright test --config playwright.config.ts e2e/interaction-centrality.spec.ts` -- all 8 pass
5. `npm test` -- full suite green
6. `npm run build` -- no TypeScript errors
7. Manual: import Aristocrats deck → Interactions tab → expand "Card Centrality" → verify Blood Artist/Viscera Seer rank as "Engine" → click Blood Artist → verify removal impact → expand an interaction → click "Show rules text" → verify oracle text citation
