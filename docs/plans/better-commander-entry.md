# Better Commander Entry

## Context

When importing a deck via the Manual Entry tab, users must include a `COMMANDER:` header line or rely on a heuristic that detects a trailing group of 1-2 cards separated by a blank line. Neither method is discoverable — there is no UI guidance explaining the required format, and copy/pasting from external sources rarely includes the `COMMANDER:` header. This makes commander detection feel broken for most users (issue #29).

The current parser (`src/lib/decklist-parser.ts`) has two detection modes: explicit `COMMANDER:` zone headers and a backwards-scan heuristic (`inferCommanders`). Neither validates that the detected card is actually a legal commander (Legendary creature, planeswalker with "can be your commander", etc.). The `DeckInput.tsx` component has no commander-related state or UI — it's a single textarea with a submit button.

The goal is to add an **optional commander lookup field** with Scryfall-powered autocomplete that lets users explicitly specify their commander(s) without memorizing text formatting rules. The field must validate that the selected card exists in the decklist, is a legal commander, and supports partner/companion pairs (up to 2 entries). For decks that are not commander decks, the field is simply left empty.

**In scope:** Commander input field with autocomplete, validation (legal commander + present in decklist), parser override when commanders are specified via UI.

### Out of Scope

The following are explicitly deferred to a separate "Commander Deck Validation" issue:

- **Color-identity enforcement on the 99** — validating that all cards in the deck match the commander's color identity
- **Ban-list checking at import time** — the `/api/commander-rules` endpoint exists but wiring it into the import flow is a separate concern
- **Partner-specific rule validation** — e.g., enforcing "Partner with" restrictions, Background pairing rules, Friends Forever
- **Singleton rule enforcement** — verifying no card (other than basic lands) appears more than once
- **Deck size validation** — checking that the deck is exactly 100 cards for Commander format
- **Moxfield direct API integration** — using Moxfield's native `commanders` section instead of text parsing
- **Companion rule validation** — verifying companion deck-building restrictions are met

## Design Decisions

### Commander Input Placement

The commander input sits **between the tab bar and the decklist textarea**, visually grouped with the form but clearly optional. A subtle help hint below the field explains the alternative `COMMANDER:` header format for power users.

### Autocomplete Strategy

Use Scryfall's `/cards/autocomplete` endpoint (returns up to 20 suggestions, ~50ms response time, no rate limit concerns). Filter client-side to only show names that also appear in the current decklist textarea — this prevents selecting a commander not in the deck. The autocomplete fires after 2+ characters with a 300ms debounce.

### Commander Validation

Validation happens in two phases:
1. **Immediate (client-side):** The selected name must appear in the parsed decklist text. Show inline error if not.
2. **Post-enrichment (after Scryfall data loads):** Check that the card has `Legendary` supertype or contains "can be your commander" in oracle text. Show a warning (not a hard block) if validation fails — this allows unknown/new cards through.

### UI Styling

| Element | Tailwind Classes |
|---------|-----------------|
| Commander label | `text-sm font-medium text-slate-300` (matches "Decklist" label) |
| Commander input | `w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50` |
| Autocomplete dropdown | `absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 shadow-lg` |
| Dropdown item | `px-4 py-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-700` |
| Dropdown item (active) | `bg-slate-700 text-white` |
| Help hint | `text-xs text-slate-500 mt-1` |
| Validation error | `text-xs text-red-400 mt-1` |
| Validation warning | `text-xs text-amber-400 mt-1` |
| Commander tag pill | `inline-flex items-center gap-1 rounded-full bg-purple-600/20 border border-purple-500/30 px-2.5 py-0.5 text-sm text-purple-300` |
| Remove button (×) | `ml-1 text-purple-400 hover:text-purple-200 focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm` |

### Data Flow Changes

```
DeckInput (new: commanders state)
  └─> onSubmitText(text, commanders?)        ← updated callback signature
        └─> DeckImportSection.handleParseDeck(text, commanders?)
              └─> POST /api/deck-parse { text, commanders? }
                    └─> parseDecklist(text, { commanders? })
                          └─> if commanders provided, skip heuristic, use override
```

### API for Autocomplete

New API route `GET /api/card-autocomplete?q=<query>` that proxies to Scryfall's autocomplete endpoint. This avoids CORS issues and lets us add server-side caching later. Returns `{ suggestions: string[] }`.

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Create `tests/unit/commander-validation.spec.ts` with tests for commander validation logic
  - Test case: legendary creature is a valid commander
  - Test case: non-legendary creature is not a valid commander
  - Test case: planeswalker with "can be your commander" is valid
  - Test case: card not in decklist fails validation
  - Test case: up to 2 commanders allowed (partner support)
  - Test case: more than 2 commanders rejected

- [x] 1.2 Create `tests/unit/decklist-parser-commander-override.spec.ts` with tests for parser commander override
  - Test case: `parseDecklist(text, { commanders: ["Atraxa, Praetors' Voice"] })` puts Atraxa in commanders, removes from mainboard
  - Test case: override skips heuristic inference even when trailing group exists
  - Test case: override with card not in list leaves commanders array as-is (card not found to move)
  - Test case: no override falls back to existing behavior (explicit header and heuristic)

- [x] 1.3 Create `e2e/commander-entry.spec.ts` with e2e tests for the commander input UI
  - **All autocomplete tests must use Playwright `page.route()` to mock `/api/card-autocomplete`** — this ensures CI tests never hit Scryfall and are deterministic/fast
  - Mock should return a fixed `{ suggestions: [...] }` payload matching the test's expected card names
  - Test case: commander input field is visible and optional
  - Test case: typing in commander input shows autocomplete dropdown (mocked response)
  - Test case: selecting a commander adds it as a tag pill
  - Test case: removing a commander tag clears it
  - Test case: submitting with commander override places card in Commander section
  - Test case: submitting without commander input preserves existing parser behavior

- [x] 1.4 Create `e2e/api-card-autocomplete.spec.ts` with API tests for the autocomplete endpoint
  - **These tests hit the real `/api/card-autocomplete` route but the route itself proxies to Scryfall — mark these with `test.describe` annotation `{ tag: '@external' }` so they can be skipped in CI if needed**
  - Test case: `GET /api/card-autocomplete?q=Atraxa` returns suggestions array
  - Test case: `GET /api/card-autocomplete?q=` (empty) returns 400
  - Test case: `GET /api/card-autocomplete?q=x` (too short) returns 400

### Phase 2: Implement Autocomplete API

- [x] 2.1 Create `src/app/api/card-autocomplete/route.ts`
  - `GET` handler that reads `q` search param
  - Validates minimum 2 characters
  - Proxies to `https://api.scryfall.com/cards/autocomplete?q={query}`
  - Returns `{ suggestions: string[] }` from Scryfall's `data` array
  - 10s timeout, error handling for Scryfall failures

### Phase 3: Implement Commander Validation Logic

- [x] 3.1 Create `src/lib/commander-validation.ts`
  - `isLegalCommander(card: EnrichedCard): boolean` — checks `supertypes.includes("Legendary")` AND type line contains "Creature" or "Planeswalker", OR oracle text contains "can be your commander"
  - `validateCommanderSelection(names: string[], deckCardNames: string[]): { valid: boolean; errors: string[] }` — checks: max 2 commanders, each name exists in deck card list
  - `validateCommanderLegality(names: string[], cardMap: Record<string, EnrichedCard>): { warnings: string[] }` — post-enrichment check, returns warnings for non-legal commanders

### Phase 4: Update Parser to Accept Commander Override

- [x] 4.1 Modify `src/lib/decklist-parser.ts`
  - Add optional second parameter: `parseDecklist(text: string, options?: { commanders?: string[] }): DeckData`
  - When `options.commanders` is provided and non-empty, skip `inferCommanders` and skip the `COMMANDER:` zone header detection
  - Move matching cards from mainboard/sideboard into `commanders` array by name
  - Existing behavior unchanged when no override provided

- [x] 4.2 Modify `src/app/api/deck-parse/route.ts`
  - Accept optional `commanders?: string[]` in request body
  - Pass through to `parseDecklist(text, { commanders })`
  - Validate: if provided, must be an array of strings with length <= 2

### Phase 5: Build Commander Input Component

- [x] 5.1 Create `src/components/CommanderInput.tsx`
  - Props: `{ value: string[]; onChange: (commanders: string[]) => void; decklistText: string; disabled?: boolean }`
  - Text input with Scryfall autocomplete (debounced 300ms, min 2 chars)
  - Fetches from `/api/card-autocomplete?q=...`
  - Selected commanders displayed as removable tag pills below the input
  - Max 2 commanders enforced (input disabled when 2 are selected)
  - Keyboard navigation: arrow keys for dropdown, Enter to select, Escape to close
  - ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"` for dropdown

- [x] 5.2 Modify `src/components/DeckInput.tsx`
  - Add `commanders` state (`string[]`, initially empty)
  - Render `<CommanderInput>` between tab bar and textarea
  - Update `onSubmitText` callback type to `(text: string, commanders?: string[]) => void | Promise<void>`
  - Pass commanders to `onSubmitText` on form submit
  - Add help hint: `"Or include a COMMANDER: header in your decklist"` below the input
  - Clear commanders state when switching tabs or loading example
  - Update example decklist to not include `COMMANDER:` header when commanders are specified via input

- [x] 5.3 Modify `src/components/DeckImportSection.tsx`
  - Update `handleParseDeck` to accept `(text: string, commanders?: string[])`
  - Pass commanders through to the `/api/deck-parse` POST body

### Phase 6: Post-Enrichment Validation

- [x] 6.1 Modify `src/components/DeckImportSection.tsx`
  - After enrichment completes (`cardMap` is set), if deck has commanders, run `validateCommanderLegality`
  - Display warning banner (amber, matching existing `enrichError` style) if any commander fails legality check
  - Warning is dismissible, does not block analysis

### Phase 7: Update Fixtures and Existing Tests

- [x] 7.1 Update `e2e/fixtures.ts`
  - Add `DeckPage.fillCommander(name: string)` method — types in commander input, waits for and clicks autocomplete suggestion
  - Add `DeckPage.removeCommander(name: string)` method — clicks the × on a commander tag
  - Add `DeckPage.commanderInput` getter — locator for the commander input field
  - Add `DeckPage.commanderTags` getter — locator for commander tag pills

- [x] 7.2 Verify existing tests still pass
  - `deck-import.spec.ts` tests use `SAMPLE_DECKLIST` which has explicit `COMMANDER:` header — should be unaffected
  - Run full suite to confirm no regressions

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/commander-validation.ts` | Create | Commander legality and selection validation |
| `src/app/api/card-autocomplete/route.ts` | Create | Scryfall autocomplete proxy endpoint |
| `src/components/CommanderInput.tsx` | Create | Autocomplete commander input with tag pills |
| `tests/unit/commander-validation.spec.ts` | Create | Unit tests for validation logic |
| `tests/unit/decklist-parser-commander-override.spec.ts` | Create | Unit tests for parser override |
| `e2e/commander-entry.spec.ts` | Create | E2E tests for commander input UI |
| `e2e/api-card-autocomplete.spec.ts` | Create | API tests for autocomplete endpoint |
| `src/lib/decklist-parser.ts` | Modify | Add optional `commanders` override parameter |
| `src/app/api/deck-parse/route.ts` | Modify | Accept optional `commanders` in request body |
| `src/components/DeckInput.tsx` | Modify | Add CommanderInput, update callback signature |
| `src/components/DeckImportSection.tsx` | Modify | Pass commanders through, post-enrichment validation |
| `e2e/fixtures.ts` | Modify | Add commander-related page-object methods |

No changes to: `src/lib/types.ts`, `src/lib/scryfall.ts`, `src/lib/archidekt.ts`, `src/lib/moxfield.ts`, `src/components/DeckList.tsx`, `src/components/EnrichedCardRow.tsx`, `src/app/api/deck-enrich/route.ts`, `src/app/api/deck/route.ts`.

## Verification

1. `npm run test:unit` — all unit tests pass (including new commander validation and parser override tests)
2. `npm run test:e2e` — all e2e tests pass (including new commander entry tests and all existing tests)
3. `npm run build` — production build succeeds with no type errors
4. Manual smoke test:
   - Go to Manual Import tab
   - Paste a decklist without a `COMMANDER:` header
   - Type a commander name in the commander input, see autocomplete suggestions
   - Select a commander, see it appear as a tag pill
   - Click Import Deck — commander appears in the Commander section
   - Remove the commander tag, re-import — heuristic detection kicks in as before
   - Import a non-commander deck (60-card) with the commander field empty — no commander section shown
