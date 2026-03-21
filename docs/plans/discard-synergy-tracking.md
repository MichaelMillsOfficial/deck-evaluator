# Discard Synergy Tracking

## Context

The deck evaluator currently has 32 card tags and 14 synergy axes, but **zero discard awareness**. A Liliana-themed mono-black deck with heavy discard themes (Waste Not, Liliana of the Veil, Geth's Grimoire, Syphon Mind, Painful Quandary, Pox, etc.) produces no discard-related tags and no discard synergy pairs. This is a significant blind spot for black-heavy and Rakdos strategies.

Discard in MTG is not monolithic — it comes in several distinct flavors that matter for deck evaluation:

- **Targeted discard** forces a specific opponent to discard (e.g., Liliana Vess's +1 "Target player discards a card"). This is hand attack / disruption.
- **Mass discard** forces all opponents (or all players) to discard (e.g., Syphon Mind "Each other player discards a card. You draw a card for each card discarded this way"). This scales with player count in Commander.
- **Discard as cost** — cards that require discarding as an activation cost or additional cost (e.g., Tomb Robber "{1}, {T}, Discard a card: ..."). In graveyard decks this is an *upside*, not a downside.
- **Discard payoffs** trigger when any player discards (e.g., Waste Not "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token"). These are the reward for running discard enablers.

The system should detect all four categories as card tags and unify them under a single **Discard** synergy axis so that enablers and payoffs are correctly identified as synergistic pairs (e.g., Liliana of the Veil + Waste Not).

### Scope

**In scope:**
- 4 new card tags: Targeted Discard, Mass Discard, Discard Cost, Discard Payoff
- 1 new synergy axis: Discard (with weighted detection across all four categories)
- Unit tests for tags and axis detection using real card oracle text
- Synergy engine integration test verifying pair generation

**Out of scope:**
- Madness keyword axis (could be added later; for now Madness cards naturally score on the discard axis via "discard a card" text and on the graveyard axis)
- UI changes (tags and axis already render via existing components)
- Interaction engine or reasoning engine changes (they already parse discard at a lower level)

## Design Decisions

### Tag Granularity

Four separate tags rather than a single "Discard" tag because the strategic implications differ:

| Tag | Strategic Meaning | Example Pattern |
|-----|-------------------|-----------------|
| Targeted Discard | 1-for-1 hand disruption | `target player discards`, `target opponent discards` |
| Mass Discard | Multiplayer-scaling disruption | `each player discards`, `each opponent discards` |
| Discard Cost | Self-discard as activation/additional cost | `discard a card:` (in cost position), `as an additional cost.*discard` |
| Discard Payoff | Rewards from any discard event | `whenever.*discards`, `whenever.*a card is discarded` |

### Regex Design

Discard oracle text has several tricky patterns to handle:

1. **Cost vs. effect position**: "Discard a card" before a colon is a cost; after a colon it's an effect. Planeswalker loyalty abilities use different formatting (e.g., "+1: Target player discards a card").
2. **"Each player" includes self**: Pox says "Each player...discards a card" — this is Mass Discard even though it hits you too.
3. **"May discard" / "unless they discard"**: Painful Quandary gives opponents a choice — still counts as Mass Discard since it forces the discard decision.
4. **"Discards a card, draws a card"** (looting): Cards like Faithless Looting are primarily Card Draw; the discard is secondary. We tag the discard cost, not the draw.
5. **Connive / Rummage**: Keywords that involve discard — detected via keyword set.

### Axis Scoring Weights

| Pattern | Weight | Rationale |
|---------|--------|-----------|
| Discard payoff trigger | 0.7 | Primary build-around; strongest signal |
| Mass discard effect | 0.6 | Enables multiple payoff triggers per activation |
| Targeted discard effect | 0.5 | Enables payoffs but only one trigger |
| Discard-as-cost | 0.3 | Feeds graveyard, but discard is incidental |
| Madness keyword | 0.4 | Directly benefits from discard enablers |
| Connive keyword | 0.3 | Involves discard but is primarily a draw/filter mechanic |

### Tag Colors

| Tag | Background | Text |
|-----|-----------|------|
| Targeted Discard | `bg-fuchsia-500/20` | `text-fuchsia-300` |
| Mass Discard | `bg-fuchsia-600/20` | `text-fuchsia-200` |
| Discard Cost | `bg-zinc-500/20` | `text-zinc-300` |
| Discard Payoff | `bg-fuchsia-400/20` | `text-fuchsia-300` |

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [ ] 1.1 Add discard tag tests to `tests/unit/card-tags.spec.ts`
  - Test: Liliana of the Veil (+1 forces each player to discard) → Targeted Discard
  - Test: Liliana Vess (+1 target player discards) → Targeted Discard
  - Test: Waste Not (whenever an opponent discards) → Discard Payoff
  - Test: Geth's Grimoire (whenever an opponent discards) → Discard Payoff
  - Test: Sangromancer (whenever a creature card is put into an opponent's graveyard from their hand) → Discard Payoff
  - Test: The Raven Man (whenever a player discards, create a token) → Discard Payoff
  - Test: Syphon Mind (each other player discards) → Mass Discard
  - Test: Pox (each player discards) → Mass Discard
  - Test: Painful Quandary (unless that player discards) → Mass Discard
  - Test: Tomb Robber (discard a card as activated ability cost) → Discard Cost
  - Test: Rotting Regisaur (discard a card at upkeep — forced self-discard) → Discard Cost
  - Test: Liliana, Dreadhorde General (no discard text) → no discard tags
  - Test: Professor Onyx (-3 opponent reveals, you choose, they discard) → Targeted Discard
  - Test: Lightning Bolt (no discard) → no discard tags

- [ ] 1.2 Add discard axis tests to `tests/unit/synergy-axes.spec.ts`
  - Test: Waste Not detects on discard axis with score > 0
  - Test: Liliana of the Veil detects on discard axis with score > 0
  - Test: Syphon Mind detects on discard axis with score > 0
  - Test: Tomb Robber detects on discard axis with score > 0
  - Test: Lightning Bolt scores 0 on discard axis
  - Test: Card with Madness keyword scores > 0 on discard axis

- [ ] 1.3 Add discard synergy pair test to `tests/unit/synergy-engine.spec.ts`
  - Test: Deck with Liliana of the Veil + Waste Not → synergy pair on discard axis
  - Test: Deck with discard enablers + payoffs → "Discard" appears in deckThemes

### Phase 2: Implement Card Tags

- [ ] 2.1 Add discard regex patterns to `src/lib/card-tags.ts`
  - `TARGETED_DISCARD_RE`: `/\btarget (?:player|opponent) discards/i`
  - `TARGETED_DISCARD_EACH_RE`: `/\beach (?:player|opponent)[^.]*(?:discard|choose[^.]*discard)/i` (for Liliana of the Veil style "each player discards")
  - `TARGETED_DISCARD_CHOOSE_RE`: `/\b(?:you choose|opponent reveals)[^.]*(?:discard|puts? .* into .* graveyard from .* hand)/i` (for Professor Onyx style targeted selection)
  - `MASS_DISCARD_RE`: `/\beach (?:other player|opponent)[^.]*discards/i`
  - `MASS_DISCARD_UNLESS_RE`: `/\bunless (?:that player|they|he or she) discards/i`
  - `MASS_DISCARD_ALL_RE`: `/\beach player[^.]*discards/i` (symmetric discard like Pox)
  - `DISCARD_COST_COLON_RE`: `/discard (?:a|two|three|x) cards?(?:\s*[,.]|\s*:)/i` (discard in cost position before colon)
  - `DISCARD_COST_ADDITIONAL_RE`: `/\bas an additional cost[^.]*discard/i`
  - `DISCARD_COST_UPKEEP_RE`: `/\b(?:at the beginning of|during) your upkeep[^.]*discard/i` (Rotting Regisaur style)
  - `DISCARD_PAYOFF_TRIGGER_RE`: `/\bwhenever[^.]*(?:a player |an opponent |a card is )?discards?\b/i`
  - `DISCARD_PAYOFF_GRAVEYARD_FROM_HAND_RE`: `/\bwhenever[^.]*(?:put into[^.]*graveyard from[^.]*hand|card is put into an opponent's graveyard from their hand)/i` (Sangromancer style)

- [ ] 2.2 Add tag color entries to `TAG_COLORS` in `src/lib/card-tags.ts`
  - `"Targeted Discard"`: `{ bg: "bg-fuchsia-500/20", text: "text-fuchsia-300" }`
  - `"Mass Discard"`: `{ bg: "bg-fuchsia-600/20", text: "text-fuchsia-200" }`
  - `"Discard Cost"`: `{ bg: "bg-zinc-500/20", text: "text-zinc-300" }`
  - `"Discard Payoff"`: `{ bg: "bg-fuchsia-400/20", text: "text-fuchsia-300" }`

- [ ] 2.3 Add tag detection logic to `generateTags()` function in `src/lib/card-tags.ts`
  - Targeted Discard: match targeted or each-player discard patterns (but NOT "each other player" which is Mass)
  - Mass Discard: match each-opponent / each-other-player / unless-discard patterns
  - Discard Cost: match cost-position discard, additional cost discard, or upkeep discard
  - Discard Payoff: match whenever-discard triggers or graveyard-from-hand triggers
  - Order: check Discard Payoff first (a card with "whenever an opponent discards" should be Payoff, not enabler)

### Phase 3: Implement Synergy Axis

- [ ] 3.1 Add discard regex patterns and axis definition to `src/lib/synergy-axes.ts`
  - Reuse tag-level regex concepts but combine into a single `detect()` function
  - `DISCARD_PAYOFF_RE`: `/\bwhenever[^.]*discards?\b/i`
  - `DISCARD_MASS_RE`: `/\beach (?:player|opponent|other player)[^.]*discards/i`
  - `DISCARD_TARGETED_RE`: `/\btarget (?:player|opponent) discards/i`
  - `DISCARD_COST_RE`: `/discard (?:a|two|three) cards?\s*[,:]/i`
  - `DISCARD_MADNESS_KEYWORDS`: Check for `Madness` in `card.keywords`
  - `DISCARD_CONNIVE_KEYWORDS`: Check for `Connive` in `card.keywords`
  - Axis definition:
    ```typescript
    {
      id: "discard",
      name: "Discard",
      description: "Hand disruption, discard triggers, madness",
      color: { bg: "bg-fuchsia-500/20", text: "text-fuchsia-300" },
      detect(card) { ... },
      conflictsWith: [],
    }
    ```
  - No `conflictsWith` — discard complements graveyard, sacrifice, and other axes

### Phase 4: Verify & Refine

- [ ] 4.1 Run `npm run test:unit` — all unit tests pass
- [ ] 4.2 Run `npm test` — full test suite passes (no regressions)
- [ ] 4.3 Run `npm run build` — production build succeeds
- [ ] 4.4 Manual smoke test: import the Liliana decklist, verify:
  - Waste Not shows "Discard Payoff" tag
  - Liliana of the Veil shows "Targeted Discard" tag
  - Syphon Mind shows "Mass Discard" tag
  - Tomb Robber shows "Discard Cost" tag
  - "Discard" appears as a deck theme
  - Synergy pairs exist between discard enablers and payoffs

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/card-tags.ts` | Modify | Add 4 discard tag regexes, TAG_COLORS entries, and generateTags() logic |
| `src/lib/synergy-axes.ts` | Modify | Add Discard axis definition with detect() function |
| `tests/unit/card-tags.spec.ts` | Modify | Add ~14 discard tag detection test cases |
| `tests/unit/synergy-axes.spec.ts` | Modify | Add ~6 discard axis detection test cases |
| `tests/unit/synergy-engine.spec.ts` | Modify | Add ~2 discard synergy pair/theme test cases |

No changes to: `src/lib/synergy-engine.ts` (axis scores and pair generation are automatic once the axis exists), `src/lib/types.ts`, `src/components/`, `src/app/api/`, `src/lib/interaction-engine/`, `src/lib/reasoning-engine/`.

## Verification

1. `npm run test:unit` — all unit tests pass including new discard tests
2. `npm test` — full e2e + unit test suite passes with 0 failures
3. `npm run build` — production build succeeds
4. Manual: paste the Liliana decklist into the Manual tab, submit, enrich cards, and verify discard tags and synergy theme appear correctly
