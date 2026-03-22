# Discard Synergy Tracking

## Context

The deck evaluator currently has 32 card tags and 14 synergy axes, but **zero discard awareness**. A Liliana-themed mono-black deck with heavy discard themes (Waste Not, Liliana of the Veil, Geth's Grimoire, Syphon Mind, Painful Quandary, Pox, etc.) produces no discard-related tags and no discard synergy pairs. This is a significant blind spot for black-heavy and Rakdos strategies.

Discard in MTG is not monolithic — it comes in several distinct flavors that matter for deck evaluation:

- **Targeted discard** forces a specific opponent to discard via targeting (e.g., Liliana Vess's +1 "Target player discards a card", Thoughtseize "Target player reveals their hand. You choose a nonland card from it. That player discards that card."). This is 1-for-1 hand attack / disruption.
- **Mass discard** forces all opponents (or all players) to discard, including symmetric effects (e.g., Syphon Mind "Each other player discards a card", Liliana of the Veil "+1: Each player discards a card", Wheel of Fortune "Each player discards their hand, then draws seven cards", Pox "Each player...discards a card"). This scales with player count in Commander. **Note**: "each player discards" is Mass, not Targeted — the effect hits all players symmetrically with no targeting.
- **Self-discard** — cards that require discarding as an activation cost, additional cost, or forced self-discard trigger (e.g., Tomb Robber "{1}, {T}, Discard a card: ...", Rotting Regisaur "At the beginning of your upkeep, discard a card", Zombie Infestation "Discard two cards: Create a 2/2 black Zombie creature token"). In graveyard decks this is an *upside*, not a downside. Cycling also counts — per CR 702.29a, Cycling literally discards the card as a cost.
- **Discard payoffs** trigger when any player discards (e.g., Waste Not "Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token"). These are the reward for running discard enablers.

The system should detect all four categories as card tags and unify them under a single **Discard** synergy axis so that enablers and payoffs are correctly identified as synergistic pairs (e.g., Liliana of the Veil + Waste Not).

### Scope

**In scope:**
- 4 new card tags: Targeted Discard, Mass Discard, Self-Discard, Discard Payoff
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
| Targeted Discard | 1-for-1 hand disruption via targeting | `target player discards`, `target opponent reveals.*you choose.*discards` |
| Mass Discard | Multiplayer-scaling disruption (symmetric or asymmetric) | `each player discards`, `each opponent discards`, `each other player discards` |
| Self-Discard | Self-discard as cost, triggered effect, or keyword (enables graveyard) | `discard a card:` (cost position), `as an additional cost.*discard`, upkeep discard triggers, Cycling/Connive keywords |
| Discard Payoff | Rewards from any discard event | `whenever.*discards`, `whenever.*a card is discarded` |

**Key classification rules:**
- "Each player discards" = **Mass Discard** (symmetric, no targeting). NOT Targeted Discard.
- "Target player/opponent discards" = **Targeted Discard** (requires a target, 1-for-1).
- "Unless they discard" (Painful Quandary) = **Mass Discard** — opponent chooses, but still creates discard events for payoffs. Note: these are conditional discards (opponent may choose to lose life instead).
- Cycling keyword = **Self-Discard** — per CR 702.29a, Cycling discards the card as a cost, triggering Waste Not etc.
- Connive keyword = **Self-Discard** — per CR 702.162, Connive draws then discards, reliably producing discard events.
- Rotting Regisaur upkeep trigger = **Self-Discard** — mechanically a triggered effect (not a cost), but strategically functions identically to self-discard for graveyard decks.
- Cards can receive multiple discard tags (e.g., The Raven Man: both Discard Payoff AND Mass Discard).

### Regex Design

Discard oracle text has several tricky patterns to handle:

1. **Cost vs. effect position**: "Discard a card" before a colon is a cost; after a colon it's an effect. Planeswalker loyalty abilities use different formatting (e.g., "+1: Target player discards a card"). The cost regex must match only colon-delimited patterns (NOT period-terminated sentences, which indicate effects).
2. **"Each player" is Mass, not Targeted**: Pox/Liliana of the Veil say "Each player...discards a card" — this is Mass Discard (symmetric, no targeting). Never classify "each player discards" as Targeted.
3. **"Unless they discard"**: Painful Quandary gives opponents a choice — counts as Mass Discard since it creates discard events for payoffs. Note: these are conditional (opponent may choose the alternative).
4. **"Discards a card, draws a card"** (looting): Cards like Faithless Looting are primarily Card Draw; the discard is secondary. We tag the self-discard, not the draw. **Important**: Faithless Looting's "Then discard two cards." is an effect (period-terminated), NOT a cost — the Self-Discard cost regex must NOT match it.
5. **Connive / Cycling / Rummage**: Keywords that involve discard — detected via `card.keywords` array, not oracle text regex. Cycling (CR 702.29a) and Connive (CR 702.162) both mechanically discard cards.
6. **Wheel effects**: "Each player discards their hand" (Wheel of Fortune, Windfall) — caught by Mass Discard regex. These are among the most explosive discard enablers in Commander.
7. **"Discard your hand"** as a cost (Zombie Infestation-style): Must be caught by the Self-Discard cost regex.
8. **Double-faced cards**: Oracle text from all faces is concatenated (see `scryfall.ts` lines 339-344). Liliana, Heretical Healer's back face "+2: Each player discards a card" must be detected.
9. **Payoff trigger false positives**: The payoff regex `/whenever[^.]*discards/` must NOT match "unless they discard" patterns (Painful Quandary). Add a negative exclusion for "unless" in the payoff trigger regex.

### Axis Scoring Weights

| Pattern | Weight | Rationale |
|---------|--------|-----------|
| Discard payoff trigger | 0.7 | Primary build-around; strongest signal |
| Mass discard effect | 0.6 | Enables multiple payoff triggers per activation |
| Targeted discard effect | 0.5 | Enables payoffs but only one trigger |
| Self-discard (cost/trigger) | 0.3 | Feeds graveyard, but discard is incidental |
| Cycling keyword | 0.3 | Discards as a cost (CR 702.29a), feeds payoffs |
| Madness keyword | 0.4 | Directly benefits from discard enablers |
| Connive keyword | 0.3 | Involves discard but is primarily a draw/filter mechanic |

### Tag Colors

Chosen to avoid conflicts with existing TAG_COLORS (`bg-fuchsia-500/20` is taken by "Mana Accel Land", `bg-zinc-500/20` by "Cycling"):

| Tag | Background | Text |
|-----|-----------|------|
| Targeted Discard | `bg-neutral-500/20` | `text-neutral-300` |
| Mass Discard | `bg-neutral-600/20` | `text-neutral-200` |
| Self-Discard | `bg-gray-500/20` | `text-gray-300` |
| Discard Payoff | `bg-slate-500/20` | `text-slate-300` |

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Add discard tag tests to `tests/unit/card-tags.spec.ts`
  - **Targeted Discard:**
    - Test: Liliana Vess (+1 "Target player discards a card") → Targeted Discard
    - Test: Thoughtseize ("Target player reveals their hand. You choose a nonland card from it. That player discards that card.") → Targeted Discard
  - **Mass Discard:**
    - Test: Liliana of the Veil (+1 "Each player discards a card") → Mass Discard (**NOT** Targeted — symmetric, no targeting)
    - Test: Syphon Mind ("Each other player discards a card") → Mass Discard
    - Test: Pox ("Each player...discards a card") → Mass Discard
    - Test: Painful Quandary ("unless that player discards a card") → Mass Discard (conditional, but creates discard events)
    - Test: Wheel of Fortune ("Each player discards their hand, then draws seven cards") → Mass Discard
    - Test: Professor Onyx (-8 "Each opponent may discard a card. If they don't, they lose 3 life.") → Mass Discard (**NOT** Targeted — optional mass discard)
  - **Self-Discard:**
    - Test: Tomb Robber ("{1}, Discard a card: This creature explores") → Self-Discard
    - Test: Rotting Regisaur ("At the beginning of your upkeep, discard a card") → Self-Discard (triggered effect, not a cost, but strategically equivalent)
    - Test: Card with Cycling keyword → Self-Discard (CR 702.29a: Cycling discards as a cost)
    - Test: Card with Connive keyword → Self-Discard (CR 702.162: Connive draws then discards)
    - Test: Faithless Looting ("Then discard two cards." — period-terminated effect) → should NOT get Self-Discard (this is an effect, not a cost)
  - **Discard Payoff:**
    - Test: Waste Not ("Whenever an opponent discards a creature card...") → Discard Payoff
    - Test: Geth's Grimoire ("Whenever an opponent discards a card, you may draw a card") → Discard Payoff
    - Test: Sangromancer ("Whenever an opponent discards a card, you may gain 3 life") → Discard Payoff
    - Test: The Raven Man → **both** Discard Payoff ("if a player discarded a card this turn, create a token") AND Mass Discard ("{3}{B}, {T}: Each opponent discards a card") — validates dual-tagging
  - **Dual-tag / DFC:**
    - Test: Liliana, Heretical Healer // Liliana, Defiant Necromancer (back face "+2: Each player discards a card") → Mass Discard (validates DFC oracle text concatenation)
  - **Negative cases:**
    - Test: Liliana, Dreadhorde General (no discard text) → no discard tags
    - Test: Lightning Bolt (no discard) → no discard tags
    - Test: Painful Quandary should NOT get Discard Payoff (the "unless they discard" is a choice, not a "whenever...discards" trigger)

- [x] 1.2 Add discard axis tests to `tests/unit/synergy-axes.spec.ts`
  - Test: Waste Not detects on discard axis with score > 0
  - Test: Liliana of the Veil detects on discard axis with score > 0
  - Test: Syphon Mind detects on discard axis with score > 0
  - Test: Tomb Robber detects on discard axis with score > 0
  - Test: Wheel of Fortune detects on discard axis with score > 0
  - Test: Card with Cycling keyword detects on discard axis with score > 0
  - Test: Lightning Bolt scores 0 on discard axis
  - Test: Card with Madness keyword scores > 0 on discard axis
  - Test: Card with Connive keyword scores > 0 on discard axis

- [x] 1.3 Add discard synergy pair test to `tests/unit/synergy-engine.spec.ts`
  - Test: Deck with Liliana of the Veil + Waste Not → synergy pair on discard axis
  - Test: Deck with discard enablers + payoffs → "Discard" appears in deckThemes

### Phase 2: Implement Card Tags

- [x] 2.1 Add discard regex patterns to `src/lib/card-tags.ts`
  - **Targeted Discard** (requires "target" word — 1-for-1 disruption):
    - `TARGETED_DISCARD_RE`: `/\btarget (?:player|opponent) discards/i`
    - `TARGETED_DISCARD_CHOOSE_RE`: `/\btarget (?:player|opponent) reveals[^.]*(?:you choose|discard)/i` (Thoughtseize/Agonizing Remorse style)
  - **Mass Discard** (affects multiple players, no targeting):
    - `MASS_DISCARD_EACH_RE`: `/\beach (?:player|opponent|other player)[^.]*discards?\b/i` (covers Liliana of the Veil, Syphon Mind, Pox, Wheel of Fortune, Professor Onyx)
    - `MASS_DISCARD_UNLESS_RE`: `/\bunless (?:that player|they|he or she) discards?\b/i` (Painful Quandary style)
  - **Self-Discard** (self-discard as cost or forced trigger + keywords):
    - `SELF_DISCARD_COST_RE`: `/discard (?:a|two|three|x|your) (?:cards?|hand)\s*:/i` (discard in cost position before colon ONLY — period-terminated effects like Faithless Looting must NOT match)
    - `SELF_DISCARD_ADDITIONAL_RE`: `/\bas an additional cost[^.]*discard/i`
    - `SELF_DISCARD_UPKEEP_RE`: `/\b(?:at the beginning of|during) your upkeep[^.]*discard/i` (Rotting Regisaur)
    - Also check `card.keywords` for `"Cycling"` and `"Connive"` — both mechanically discard
  - **Discard Payoff** (triggers on discard events):
    - `DISCARD_PAYOFF_TRIGGER_RE`: `/\bwhenever[^.]*(?:a player |an opponent |a card is )?discards?\b/i` — but must add negative lookahead or exclusion for "unless" patterns to avoid false-positive on Painful Quandary
    - `DISCARD_PAYOFF_CONDITION_RE`: `/\bif a player discarded a card this turn\b/i` (The Raven Man style conditional trigger)
  - **Removed regexes from original plan:**
    - ~~`TARGETED_DISCARD_EACH_RE`~~ — "each player discards" is Mass, not Targeted
    - ~~`DISCARD_PAYOFF_GRAVEYARD_FROM_HAND_RE`~~ — Sangromancer's actual text uses "discards", not "put into graveyard from hand"; the primary payoff regex catches it

- [x] 2.2 Add tag color entries to `TAG_COLORS` in `src/lib/card-tags.ts`
  - `"Targeted Discard"`: `{ bg: "bg-neutral-500/20", text: "text-neutral-300" }`
  - `"Mass Discard"`: `{ bg: "bg-neutral-600/20", text: "text-neutral-200" }`
  - `"Self-Discard"`: `{ bg: "bg-gray-500/20", text: "text-gray-300" }`
  - `"Discard Payoff"`: `{ bg: "bg-slate-500/20", text: "text-slate-300" }`

- [x] 2.3 Add tag detection logic to `generateTags()` function in `src/lib/card-tags.ts`
  - **Targeted Discard**: match ONLY patterns with "target" word — `TARGETED_DISCARD_RE` or `TARGETED_DISCARD_CHOOSE_RE`. Never match "each player" patterns.
  - **Mass Discard**: match `MASS_DISCARD_EACH_RE` (covers "each player/opponent/other player discards") or `MASS_DISCARD_UNLESS_RE` (Painful Quandary style)
  - **Self-Discard**: match `SELF_DISCARD_COST_RE` (colon-delimited costs only), `SELF_DISCARD_ADDITIONAL_RE`, `SELF_DISCARD_UPKEEP_RE`, OR check `card.keywords` for "Cycling"/"Connive"
  - **Discard Payoff**: match `DISCARD_PAYOFF_TRIGGER_RE` or `DISCARD_PAYOFF_CONDITION_RE`, but exclude "unless" patterns (Painful Quandary is Mass Discard, not Payoff)
  - **Ordering**: check all four independently — a card can receive multiple discard tags (e.g., The Raven Man gets both Mass Discard + Discard Payoff)
  - **Important edge cases**: Faithless Looting "Then discard two cards." must NOT match Self-Discard (period-terminated = effect, not cost)

### Phase 3: Implement Synergy Axis

- [x] 3.1 Add discard regex patterns and axis definition to `src/lib/synergy-axes.ts`
  - Reuse tag-level regex concepts but combine into a single `detect()` function
  - `DISCARD_PAYOFF_RE`: `/\bwhenever[^.]*discards?\b/i` (plus condition variant for The Raven Man)
  - `DISCARD_MASS_RE`: `/\beach (?:player|opponent|other player)[^.]*discards/i`
  - `DISCARD_TARGETED_RE`: `/\btarget (?:player|opponent) discards/i`
  - `DISCARD_COST_RE`: `/discard (?:a|two|three|your) (?:cards?|hand)\s*:/i` (colon only, NOT period)
  - `DISCARD_UNLESS_RE`: `/\bunless (?:that player|they) discards?\b/i`
  - Keyword checks: `Madness`, `Connive`, `Cycling` in `card.keywords`
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

- [x] 4.1 Run `npm run test:unit` — all unit tests pass
- [ ] 4.2 Run `npm test` — full test suite passes (no regressions)
- [ ] 4.3 Run `npm run build` — production build succeeds
- [ ] 4.4 Manual smoke test: import the Liliana decklist, verify:
  - Waste Not shows "Discard Payoff" tag
  - Liliana of the Veil shows "Mass Discard" tag (NOT Targeted — symmetric discard)
  - Liliana Vess shows "Targeted Discard" tag
  - Syphon Mind shows "Mass Discard" tag
  - Tomb Robber shows "Self-Discard" tag
  - The Raven Man shows BOTH "Discard Payoff" AND "Mass Discard" tags
  - "Discard" appears as a deck theme
  - Synergy pairs exist between discard enablers and payoffs

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/card-tags.ts` | Modify | Add 4 discard tag regexes (+ Cycling/Connive keyword checks), TAG_COLORS entries, and generateTags() logic |
| `src/lib/synergy-axes.ts` | Modify | Add Discard axis definition with detect() function |
| `tests/unit/card-tags.spec.ts` | Modify | Add ~22 discard tag detection test cases (including DFC, dual-tag, negative, and keyword cases) |
| `tests/unit/synergy-axes.spec.ts` | Modify | Add ~9 discard axis detection test cases (including Cycling and Connive keywords) |
| `tests/unit/synergy-engine.spec.ts` | Modify | Add ~2 discard synergy pair/theme test cases |

No changes to: `src/lib/synergy-engine.ts` (axis scores and pair generation are automatic once the axis exists), `src/lib/types.ts`, `src/components/`, `src/app/api/`, `src/lib/interaction-engine/`, `src/lib/reasoning-engine/`.

## Verification

1. `npm run test:unit` — all unit tests pass including new discard tests
2. `npm test` — full e2e + unit test suite passes with 0 failures
3. `npm run build` — production build succeeds
4. Manual: paste the Liliana decklist into the Manual tab, submit, enrich cards, and verify discard tags and synergy theme appear correctly

## Review Notes

This plan was revised after L3 Judge rules review and architecture review. Key changes from the original:

### Critical Fixes Applied
1. **Liliana of the Veil reclassified**: "Each player discards a card" is **Mass Discard**, not Targeted Discard. There is no "target" word; the effect is symmetric.
2. **Professor Onyx reclassified**: Her -8 is "Each opponent may discard a card. If they don't, they lose 3 life." — optional mass discard, not targeted selection. The original plan fabricated oracle text for this card.
3. **Sangromancer oracle text corrected**: Actual text is "Whenever an opponent discards a card, you may gain 3 life" (standard payoff trigger), not "whenever a creature card is put into an opponent's graveyard from their hand." Removed `DISCARD_PAYOFF_GRAVEYARD_FROM_HAND_RE` regex.

### Important Changes
4. **"Discard Cost" renamed to "Self-Discard"**: Covers both true costs (Tomb Robber) and forced self-discard triggers (Rotting Regisaur). The original name was misleading for triggered effects that are not rules-costs.
5. **Cycling keyword added**: Per CR 702.29a, Cycling discards the card as a cost. Detected via `card.keywords`, not regex.
6. **Connive keyword added to tags**: Was in axis weights but missing from tag detection.
7. **Wheel effects tested**: Wheel of Fortune / Windfall are the most explosive discard enablers; now explicitly tested.
8. **The Raven Man dual-tagged**: Both Discard Payoff (trigger) AND Mass Discard (activated ability).
9. **TAG_COLORS conflicts resolved**: `bg-fuchsia-500/20` and `bg-zinc-500/20` were already taken by "Mana Accel Land" and "Cycling" respectively.
10. **Cost regex restricted to colon-only**: Original included `.` (period) which would false-positive on effect text like Faithless Looting's "Then discard two cards."
11. **Payoff regex excludes "unless" patterns**: Prevents Painful Quandary from false-positive matching as Discard Payoff.
12. **DFC test case added**: Liliana, Heretical Healer's back face validates the oracle text concatenation pipeline.

### Known Limitations (documented, not fixed)
- **Optional vs. mandatory discard** not differentiated (e.g., "may discard" vs. forced discard)
- **"Unless they discard"** effects (Painful Quandary) are conditional — opponent may choose the alternative. Tagged as Mass Discard for heuristic purposes.
- **Madness** remains out of scope as a separate axis (Madness cards score on the discard axis via keyword check)
