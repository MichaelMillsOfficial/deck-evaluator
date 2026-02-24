# Review Deck Analysis

Perform a holistic review of a deck's analysis results, tying together all analysis modules into a coherent evaluation. The deck or focus area: $ARGUMENTS

## Purpose

This skill combines the output of all analysis engines — mana curve, color distribution, land base efficiency, synergy scoring, card tags, and known combos — into a unified deck evaluation. Use it to validate that the analysis modules are producing sensible, consistent results for a given decklist.

## Analysis Modules to Review

The evaluator runs these independent analysis pipelines (all in `src/lib/`):

| Module | File | Key Function | Output |
|--------|------|-------------|--------|
| Mana Curve | `mana-curve.ts` | `computeManaCurve()` | 8 CMC buckets with permanent/non-permanent split |
| Color Distribution | `color-distribution.ts` | `computeColorDistribution()` | Pips demanded vs sources available per color |
| Mana Base Metrics | `color-distribution.ts` | `computeManaBaseMetrics()` | Land %, avg CMC, source-to-demand ratios |
| Land Base Efficiency | `land-base-efficiency.ts` | `computeLandBaseEfficiency()` | 0-100 score across 5 weighted factors |
| Card Tags | `card-tags.ts` | `generateTags()` | Per-card functional role tags |
| Synergy Axes | `synergy-axes.ts` | `SYNERGY_AXES[].detect()` | Per-card 0-1 relevance on 12 strategic axes |
| Synergy Engine | `synergy-engine.ts` | `analyzeDeckSynergy()` | Card scores, synergy pairs, themes, anti-synergies |
| Known Combos | `known-combos.ts` | `findCombosInDeck()` | Matched combo entries |
| Commander Validation | `commander-validation.ts` | `validateDeck()` | Rule violations |

## Review Process

### 1. Validate Deck Composition

Check the basics:
- **Card count**: Should be exactly 100 (commanders + mainboard) for Commander
- **Commander legality**: Colors, legendary creature/planeswalker status
- **Singleton rule**: No duplicates (except basic lands and exempt cards)
- **Color identity**: All cards within commander's color identity

### 2. Assess Mana Base Health

Cross-reference multiple modules:

**Land count** (from mana curve/color distribution):
- Typical range: 33-38 lands for Commander
- Below 33: Risky unless heavy on mana rocks and low curve
- Above 40: Likely too many unless landfall-focused

**Color balance** (from color distribution):
- Source-to-demand ratio per color should be >= 0.8 for consistency
- 5-color producers (Command Tower, Mana Confluence) scoped to commander identity
- Watch for colors with high pip demand but few sources

**Land quality** (from land base efficiency):
- Untapped ratio: >70% is good, <50% is sluggish
- Fixing ratio: Depends on color count (mono needs ~0%, 3+ colors needs >30%)
- Conditional lands: Count as 0.5 untapped — check if conditions are easy to meet

### 3. Evaluate Curve

From mana curve analysis:
- **Ideal Commander curve**: Peak at CMC 2-3, tapering off sharply after 5
- **Average CMC**: 2.5-3.5 is typical; above 4.0 signals a slow deck
- **Low-end density**: At least 8-10 cards at CMC 0-2 for early plays
- **High-end bombs**: 3-6 cards at CMC 6+ is normal; more needs ramp support

Cross-check: If average CMC is high, does the deck have enough ramp tags?

### 4. Assess Functional Role Distribution

From card tags, check that the deck has adequate coverage:

| Role | Recommended Count | Notes |
|------|------------------|-------|
| Ramp | 10-15 | Essential in Commander; more if high CMC |
| Card Draw | 8-12 | Keeps the engine running |
| Removal | 8-12 | Mix of targeted and board wipes |
| Board Wipe | 3-5 | Too many hurts your own board |
| Counterspell | 2-6 (blue) | Optional; more in control builds |
| Tutor | 2-5 | More in combo builds |
| Protection | 3-6 | Especially for commander |
| Recursion | 2-4 | Graveyard recovery |

Flag imbalances: "This deck has 3 Ramp cards but an average CMC of 4.2 — it will struggle to deploy threats on time."

### 5. Evaluate Synergy Coherence

From synergy engine output:

**Theme consistency**:
- A focused deck should have 1-2 dominant themes with 15+ cards each
- 3+ strong themes with <10 cards each suggests unfocused strategy
- Check that the commander aligns with the detected themes

**Card synergy scores**:
- Average score 50-60: Baseline (minimal synergy bonus)
- Average score 65-75: Good synergy density
- Average score 80+: Very focused / combo-oriented
- Cards scoring <30: Potential cuts (anti-synergistic or off-theme)

**Anti-synergies**:
- Graveyard + Graveyard Hate in same deck: Internal conflict
- Board Wipes + Tokens strategy: Self-destructive
- Flag specific card pairs that work against each other

**Known combos**:
- Do detected combos align with the deck's strategy?
- Are all combo pieces present (partial combos are liabilities)?
- Does the deck have tutors to assemble combos consistently?

### 6. Cross-Module Consistency Checks

Look for contradictions between modules:

- **High Ramp tag count + low average CMC**: Overinvested in ramp
- **Landfall theme detected + below-average land count**: Theme won't fire consistently
- **Sacrifice theme + no low-CMC creatures**: Nothing to sacrifice early
- **Spellslinger theme + heavy creature count**: Strategy mismatch
- **Combo detected + no tutors/card draw**: Can't find the pieces
- **High land base efficiency score + poor color coverage**: Efficient but wrong colors

### 7. Produce Evaluation Summary

Structure the output as:

```
## Deck Evaluation: [Deck Name]
Commander: [Name(s)]
Colors: [Identity]

### Strengths
- [What the deck does well, with specific evidence]

### Weaknesses
- [What needs improvement, with specific evidence]

### Mana Base: [Score]/100
- Lands: X/99 (Y%)
- Average CMC: Z
- Color coverage: [per-color summary]
- Key concern: [if any]

### Synergy: [Average Score]
- Primary theme(s): [themes with card counts]
- Notable combos: [if any]
- Anti-synergies: [if any]

### Role Coverage
| Role | Count | Status |
|------|-------|--------|
| Ramp | X | OK / Low / High |
...

### Recommended Changes
1. [Specific, actionable suggestion with reasoning]
2. [Another suggestion]
```

## Important Notes

- All analysis should be data-driven — cite specific cards, scores, and counts
- Recommendations should reference the commander's strategy and color identity
- Don't recommend cards outside the commander's color identity
- Consider budget when making card suggestions (note if a suggestion is expensive)
- A "bad" score in one area might be intentional (e.g., stax decks want low creature count)
- Always consider the deck's apparent archetype before flagging issues
