# Land Base Efficiency Scoring

## Context

Commander decks rely heavily on a well-constructed mana base to function. A deck's land base must balance multiple concerns: entering untapped for tempo, producing the right colors to cast spells on curve, and containing enough lands to make consistent land drops. This feature adds a **Land Base Efficiency** section to the Analysis tab that provides a confidence score (0–100) with detailed factor breakdowns, helping players identify weaknesses in their mana base.

### Available Data

From Scryfall-enriched cards we have:
- `typeLine` — identifies lands (contains "Land"), basic lands ("Basic" supertype), land subtypes
- `supertypes` / `subtypes` — e.g. `["Basic"]`, `["Forest", "Plains"]`
- `producedMana` — array of colors the card produces (e.g. `["G"]`, `["W", "U"]`)
- `oracleText` — full rules text; used to detect "enters the battlefield tapped" and conditional untap clauses
- `colorIdentity` — for commander identity scoping
- `manaPips` — pip demand per color across non-land cards

### Scoring Factors

1. **Untapped Ratio** (weight: 25%) — Percentage of lands that can enter the battlefield untapped. Basic lands, shocks (with life payment), fetches, and lands with no ETB-tapped text count as untapped. Conditional untap lands (e.g. check lands, fast lands) count as partially untapped.
2. **Color Coverage** (weight: 25%) — How well the mana base covers the deck's color pip demand. Compares produced mana sources per color against pip demand ratios. Penalizes colors with poor source-to-demand ratios.
3. **Land Drop Consistency** (weight: 20%) — Statistical probability of making land drops on turns 1–4 using hypergeometric distribution based on land count in a 99-card deck (Commander). Targets: T1 ≥95%, T2 ≥90%, T3 ≥85%, T4 ≥75%.
4. **Mana Fixing Quality** (weight: 15%) — Proportion of lands that produce 2+ colors. Dual lands, triomes, fetch lands, and "any color" lands contribute. More multi-color sources = better fixing.
5. **Basic Land Ratio** (weight: 15%) — Checks that the deck has enough basics to support fetch lands and land-search effects, while not being over-reliant on basics in multi-color decks. Sweet spot varies by color count.

### Score Interpretation

- **90–100**: Excellent — highly optimized mana base
- **75–89**: Good — solid base with minor gaps
- **60–74**: Fair — functional but has notable weaknesses
- **40–59**: Needs Work — significant mana issues likely
- **0–39**: Poor — major mana base problems

## Implementation Tasks

### Phase 1: Core Logic (`src/lib/land-base-efficiency.ts`)

- [x] Create `src/lib/land-base-efficiency.ts` with types and main computation function
- [x] Implement `classifyLandEntry` — categorize each land as untapped / conditional / tapped based on oracle text patterns:
  - Untapped: basic lands, no ETB-tapped text
  - Conditional: "enters the battlefield tapped unless", shock lands ("you may pay 2 life"), fast lands ("if you control two or fewer other lands")
  - Tapped: "enters the battlefield tapped" with no conditional clause
- [x] Implement `computeUntappedRatio` — returns score 0–100 based on (untapped + 0.5×conditional) / totalLands
- [x] Implement `computeColorCoverage` — compare source counts per color against pip demand; return weighted score based on how well each color is covered
- [x] Implement `computeLandDropConsistency` — hypergeometric probability of drawing N lands in opening 7 + N-1 draws for turns 1–4; score based on hitting target thresholds
- [x] Implement `computeManaFixingQuality` — ratio of multi-color-producing lands to total lands; scale 0–100
- [x] Implement `computeBasicLandRatio` — evaluate basic count relative to deck color count and fetch/search effects
- [x] Implement `computeLandBaseEfficiency` — aggregate all factors with weights into a single 0–100 score; return score + individual factor results
- [x] Export types: `LandClassification`, `LandBaseEfficiencyResult`, `EfficiencyFactor`

### Phase 2: Tests (`e2e/land-base-efficiency.spec.ts`)

- [x] Write unit tests for `classifyLandEntry`:
  - Basic lands → untapped
  - Lands with "enters the battlefield tapped" → tapped
  - Shock lands → conditional (untapped)
  - Check lands → conditional
  - Lands with no ETB text → untapped
- [x] Write unit tests for `computeUntappedRatio` with known land sets
- [x] Write unit tests for `computeColorCoverage` with balanced and imbalanced mana bases
- [x] Write unit tests for `computeLandDropConsistency` with various land counts (30, 35, 37, 40)
- [x] Write unit tests for `computeManaFixingQuality` — all basics vs. all duals
- [x] Write unit tests for `computeBasicLandRatio`
- [x] Write unit tests for `computeLandBaseEfficiency` — verify weighted aggregation and score ranges

### Phase 3: UI Component (`src/components/LandBaseEfficiency.tsx`)

- [x] Create `LandBaseEfficiency` component that receives `LandBaseEfficiencyResult` as props
- [x] Render overall confidence score with color-coded badge (green/yellow/orange/red based on score range)
- [x] Render circular or bar progress indicator for overall score
- [x] Render each factor as a row with: factor name, individual score (0–100), a small progress bar, and a brief description/tooltip
- [x] Add a summary sentence describing the overall mana base quality
- [x] Style consistently with existing Analysis tab sections (slate theme, purple accents)
- [x] Ensure accessibility: proper ARIA labels, semantic HTML, keyboard navigable

### Phase 4: UI Integration Tests (`e2e/land-base-efficiency-ui.spec.ts`)

- [x] Write test: "Land Base Efficiency section appears in Analysis tab"
- [x] Write test: "displays overall efficiency score"
- [x] Write test: "displays all five factor rows with scores"
- [x] Write test: "score badge has correct color for score range"
- [x] Write test: "section is accessible with proper ARIA structure"

### Phase 5: Integration into DeckAnalysis

- [x] Import and call `computeLandBaseEfficiency` in `DeckAnalysis.tsx`
- [x] Add `LandBaseEfficiency` component as a new section after Color Distribution
- [x] Pass computed result and any needed props

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/land-base-efficiency.ts` | Create | Core scoring logic and types |
| `src/components/LandBaseEfficiency.tsx` | Create | UI component for score display |
| `src/components/DeckAnalysis.tsx` | Modify | Add land base efficiency section |
| `e2e/land-base-efficiency.spec.ts` | Create | Unit tests for scoring logic |
| `e2e/land-base-efficiency-ui.spec.ts` | Create | Integration tests for UI |
| `e2e/fixtures.ts` | Modify | Add land-focused sample data if needed |

## Verification

1. Run `npm test` — all existing + new tests pass
2. Import a Commander deck with a mix of basic lands, dual lands, tapped lands, and fetch lands
3. Navigate to Analysis tab → Land Base Efficiency section visible
4. Verify score and factor breakdown are displayed correctly
5. Test with different deck archetypes:
   - Mono-color deck → high score (easy mana base)
   - 4-5 color deck with all basics → low score (poor fixing)
   - Optimized 3-color deck → high score
