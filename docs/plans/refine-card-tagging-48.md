# Refine Card Tagging Logic — Issue #48

## Context

The card tagging engine (`src/lib/card-tags.ts`) and synergy axis detection (`src/lib/synergy-axes.ts`) have several false negatives and one false positive identified in GitHub Issue #48. Eight specific cards are called out:

| Card | Current Behavior | Expected Behavior | Root Cause |
|------|-----------------|-------------------|------------|
| Crucible of Worlds | No Recursion tag | Recursion | `RECURSION_RE` only matches "return...from...graveyard", misses "play...from...graveyard" |
| Escape to the Wilds | No Ramp or Card Advantage | Ramp + Card Advantage | No pattern for "additional land" (ramp) or impulse draw / exile-and-play (card advantage) |
| Arid Mesa | Lifegain synergy detected | No lifegain synergy | `LIFEGAIN_PAYOFF_RE` matches "pay...life" broadly — paying life is not lifegain |
| Tribal Unity | No tribal synergy | Tribal synergy | Already detected by existing regexes — needs verification test |
| Whispersilk Cloak | No Protection tag | Protection | `PROTECTION_ORACLE_RE` only matches "gains" — misses "has shroud" |
| Ward Sliver | No Protection tag | Protection | Same regex issue — "have protection" not matched |
| Two Headed Sliver | No evasion synergy | Evasion synergy | Grants menace via "have menace" — not detected by keyword check or oracle regex |
| The First Sliver | No tags | Card Advantage | Cascade keyword generates free spells but has no tag detection |

The fixes span two files: `card-tags.ts` for tag generation and `synergy-axes.ts` for synergy detection. The lifegain axis fix follows a design decision to only detect cards that are *intrinsically about* gaining life (triggers, enablers, direct gain), not cards that merely spend life as a resource — those are generically strong and don't indicate a lifegain theme.

## Design Decisions

### Lifegain axis — drop "pay life" entirely

The previous `LIFEGAIN_PAYOFF_RE` matched both `pay.+?life` and `you gain.+?life`. The `pay.+?life` branch creates false positives on fetch lands, shock lands, and generically strong cards like Bolas's Citadel and Necropotence. Even life-as-resource cards (where more life = more value) don't indicate a lifegain *theme* — they're powerful staples in any deck with 40 starting life. The fix: `LIFEGAIN_PAYOFF_RE = /\byou gain.+?\blife\b/i` — only match actual life gain effects. If deck-level "pay-life + lifegain-enabler" synergy pairs are wanted later, that belongs in the synergy engine's pair detection, not the per-card axis score.

### Protection oracle regex — expand verb coverage

The current `PROTECTION_ORACLE_RE` uses `gains?` which misses static/blanket grant effects like "has shroud" (Whispersilk Cloak) and "have protection" (Ward Sliver). Expanding to `(?:gains?|ha[sv]e?)` covers the full verb range for granting protective abilities.

### Recursion — "play/cast from graveyard" is recursion

Cards like Crucible of Worlds ("You may play lands from your graveyard") and Muldrotha ("You may cast permanent spells from your graveyard") are recursion effects even though they don't use the word "return". Adding a second regex pattern for `play|cast...from...graveyard` alongside the existing `return...from...graveyard`.

### Ramp — "additional land" is ramp

Playing additional lands per turn is a form of mana acceleration. Cards like Exploration, Azusa, and Escape to the Wilds enable ramp by letting you deploy more lands. This pattern is distinct from existing ramp detection (tap-for-mana, land search). Non-land cards with "additional land" get the Ramp tag. Lands are excluded since they already handle this via the land-specific tag system.

### Card Advantage — impulse draw and cascade

Two new patterns:
1. **Impulse draw**: Exile cards from library and play/cast them (Escape to the Wilds, Light Up the Stage, Prosper). Pattern: `exile...from...library` combined with `play|cast...exiled`.
2. **Cascade**: The Cascade keyword generates free spells, which is card advantage. Detection: check `card.keywords.includes("Cascade")`.

### Evasion synergy — grants-evasion via "has/have"

Cards that grant evasion keywords to other creatures ("All Slivers have menace", "Creatures you control have flying") should score on the evasion axis. Adding a regex for `(?:ha[sv]e?|gains?)\s+(?:flying|menace|trample|...)` to complement the existing keyword check.

## Implementation Tasks

### Phase 1: Write Failing Tests (TDD)

- [x] 1.1 Add card-tag tests to `tests/unit/card-tags.spec.ts`
  - Test: Crucible of Worlds ("You may play lands from your graveyard.") → Recursion
  - Test: Muldrotha, the Gravetide ("You may cast permanent spells from your graveyard.") → Recursion
  - Test: Escape to the Wilds → Ramp (additional land) + Card Advantage (impulse draw)
  - Test: Light Up the Stage ("Exile the top two cards...You may play them this turn.") → Card Advantage
  - Test: Whispersilk Cloak ("has shroud and can't be blocked") → Protection
  - Test: Ward Sliver ("have protection from the chosen color") → Protection
  - Test: The First Sliver (Cascade keyword) → Card Advantage
  - Test: Exploration ("You may play an additional land on each of your turns.") → Ramp
  - Test: Azusa, Lost but Seeking ("You may play two additional lands on each of your turns.") → Ramp
  - Test: Prosper, Tome-Bound (impulse draw) → Card Advantage
  - Test: Llanowar Elves (tap-for-mana, no "additional land") → still Ramp (no regression)
  - Test: basic land with no additional-land text → still no Ramp (no regression)

- [x]1.2 Add synergy-axes tests to `tests/unit/synergy-axes.spec.ts`
  - Test: Arid Mesa (fetch land, "Pay 1 life") → lifegain score = 0
  - Test: Breeding Pool (shock land, "pay 2 life") → lifegain score = 0
  - Test: Ajani's Pridemate ("Whenever you gain life") → lifegain score > 0
  - Test: Soul Warden ("you gain 1 life") → lifegain score > 0
  - Test: Bolas's Citadel ("paying life rather than paying their mana costs") → lifegain score = 0
  - Test: Necropotence ("Pay 1 life:") → lifegain score = 0
  - Test: Tribal Unity ("Choose a creature type. Creatures of the chosen type get +X/+X") → tribal score > 0
  - Test: Two Headed Sliver ("All Sliver creatures have menace.") → evasion score > 0
  - Test: Ward Sliver grants-protection oracle → evasion score remains 0 (protection ≠ evasion axis)
  - Test: Flying keyword → still evasion > 0 (no regression)

- [x]1.3 Run `npm run test:unit` — confirm new tests fail, existing tests pass

### Phase 2: Implement Card Tag Fixes

- [x]2.1 Modify `src/lib/card-tags.ts` — add recursion pattern
  - Add `RECURSION_PLAY_GY_RE = /\b(?:play|cast)\b.+?\bfrom\b.+?\bgraveyard\b/i`
  - Add to Recursion detection block: `if (RECURSION_PLAY_GY_RE.test(text)) tags.add("Recursion")`

- [x]2.2 Modify `src/lib/card-tags.ts` — add ramp "additional land" pattern
  - Add `RAMP_ADDITIONAL_LAND_RE = /\badditional land\b/i`
  - Add to Ramp detection block (non-basic, non-land): `if (RAMP_ADDITIONAL_LAND_RE.test(text)) tags.add("Ramp")`

- [x]2.3 Modify `src/lib/card-tags.ts` — add impulse draw card advantage pattern
  - Add `CARD_ADVANTAGE_IMPULSE_RE = /\byou may (?:play|cast)\b.+?\bexiled\b/i`
  - Add Cascade keyword detection: `if (card.keywords.includes("Cascade")) tags.add("Card Advantage")`
  - Add to Card Advantage detection block (after Card Draw check)

- [x]2.4 Modify `src/lib/card-tags.ts` — expand protection oracle regex
  - Change `PROTECTION_ORACLE_RE` from `/\bgains?\b.+?\b(?:hexproof|indestructible|protection|shroud)\b/i`
    to `/\b(?:gains?|ha[sv]e?)\b.+?\b(?:hexproof|indestructible|protection|shroud)\b/i`

### Phase 3: Implement Synergy Axis Fixes

- [x]3.1 Modify `src/lib/synergy-axes.ts` — fix lifegain false positive
  - Change `LIFEGAIN_PAYOFF_RE` from `/pay.+?life|you gain.+?life/i`
    to `/\byou gain.+?\blife\b/i`

- [x]3.2 Modify `src/lib/synergy-axes.ts` — add grants-evasion detection
  - Add `EVASION_GRANTS_RE = /\b(?:ha[sv]e?|gains?)\s+(?:flying|menace|trample|shadow|fear|intimidate|skulk)\b/i`
  - Add to evasion axis detect function: `if (EVASION_GRANTS_RE.test(text)) score += 0.5`

### Phase 4: Verify

- [x]4.1 Run `npm run test:unit` — all unit tests pass (new + existing)
- [x]4.2 Run `npm run test:e2e` — all e2e tests pass (no regressions)
- [x]4.3 Run `npm run build` — production build succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/card-tags.spec.ts` | Modify | Add test cases for recursion, ramp, card advantage, protection fixes |
| `tests/unit/synergy-axes.spec.ts` | Modify | Add test cases for lifegain fix, tribal verification, evasion grants |
| `src/lib/card-tags.ts` | Modify | Add recursion, ramp, card advantage patterns; expand protection regex |
| `src/lib/synergy-axes.ts` | Modify | Fix lifegain payoff regex; add grants-evasion regex |

No changes to: `src/lib/types.ts`, `src/components/CardTags.tsx`, `src/lib/synergy-engine.ts`, API routes, or any e2e test files.

## Verification

1. `npm run test:unit` — all unit tests pass including new test cases
2. `npm run test:e2e` — all e2e tests pass (no regressions)
3. `npm run build` — production build succeeds
4. Manual: verify each of the 8 cards from the issue produces correct tags/synergy scores by reviewing test output
