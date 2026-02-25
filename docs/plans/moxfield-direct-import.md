# Moxfield Direct Import

## Context

The deck evaluator has three import tabs -- Manual, Moxfield, and Archidekt. Archidekt URL import works end-to-end: the user pastes a URL, the `/api/deck` route fetches from the Archidekt API, normalizes to `DeckData`, and returns it. Moxfield, despite being the most popular MTG deck builder, currently has no direct URL import. The Moxfield tab exists in the UI but routes all input through the text parser (`onSubmitText`), meaning users must manually export their decklist as text and paste it.

The foundation is partially built: `src/lib/moxfield.ts` exports `isMoxfieldUrl`, `extractMoxfieldDeckId`, `normalizeMoxfieldSection`, and `fetchMoxfieldDeck`. `DeckData.source` already includes `"moxfield"` as a valid value. The implementation needs to: (1) extend the API route to handle Moxfield URLs, and (2) update `DeckInput` so the Moxfield tab calls `onSubmitUrl` instead of `onSubmitText`.

### Intended Outcome

Users paste a Moxfield deck URL and click Import -- the deck loads automatically with correct commander/mainboard/sideboard sections, exactly like Archidekt import.

## Why

- Moxfield is the most popular MTG deck building platform
- Requiring manual text export/paste is a poor experience when Archidekt already supports URL import
- Brings Moxfield to parity with Archidekt

## Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| `src/lib/moxfield.ts` | Exists | URL parsing + API fetch utilities (may need v2→v3 update) |
| `src/app/api/deck/route.ts` | Exists | API route to extend |
| `src/components/DeckInput.tsx` | Exists | Component to modify |
| `src/lib/types.ts` | Exists | `MoxfieldApiResponse` types (may need updates) |

No new npm packages needed. No dependencies on unbuilt features.

## Existing Patterns to Reuse

The Archidekt import pipeline is the exact pattern to replicate:

| Step | Archidekt | Moxfield (to build) |
|------|-----------|---------------------|
| URL validation | `isArchidektUrl(url)` | `isMoxfieldUrl(url)` (exists) |
| ID extraction | `extractArchidektDeckId(url)` | `extractMoxfieldDeckId(url)` (exists) |
| API fetch | `fetchArchidektDeck(deckId)` | `fetchMoxfieldDeck(deckId)` (exists) |
| Normalization | `normalizeArchidektCards(raw)` | `normalizeMoxfieldDeck(raw)` (to create) |
| Route branch | `if (isArchidektUrl)` | `else if (isMoxfieldUrl)` (to add) |

---

## Implementation Tasks

### Phase 1: Fix and verify `moxfield.ts`

- [ ] Update `fetchMoxfieldDeck` API endpoint URL from `/v2/` to `/v3/` (current code may use older version)
- [ ] Add `normalizeMoxfieldDeck(raw: MoxfieldApiResponse)` function returning `{ commanders: DeckCard[], mainboard: DeckCard[], sideboard: DeckCard[] }`
- [ ] Verify `MoxfieldApiResponse` type matches real Moxfield v3 API response structure; update if needed
- [ ] Ensure `normalizeMoxfieldSection` handles edge cases: empty sections, `quantity: 0`, missing quantity

### Phase 2: Unit Tests (`tests/unit/moxfield.spec.ts`)

- [ ] `isMoxfieldUrl` returns true for valid URLs (`https://www.moxfield.com/decks/abc123`, with/without www, http/https)
- [ ] `isMoxfieldUrl` returns false for non-Moxfield URLs, empty strings, wrong paths
- [ ] `extractMoxfieldDeckId` extracts correct ID, returns null for invalid
- [ ] `normalizeMoxfieldSection` converts section to sorted `DeckCard[]`, respects quantity, handles empty
- [ ] `normalizeMoxfieldDeck` produces correct `{ commanders, mainboard, sideboard }`, handles no commanders, empty sideboard

### Phase 3: Extend `/api/deck/route.ts`

- [ ] Import Moxfield utilities from `@/lib/moxfield`
- [ ] Add `else if (isMoxfieldUrl(trimmedUrl))` branch after Archidekt check:
  - Extract deck ID → 400 if fails
  - `fetchMoxfieldDeck(deckId)` → normalize → construct `DeckData` with `source: "moxfield"`
  - Return JSON
- [ ] Update fallback 422 message: "Only Archidekt and Moxfield URLs are supported"
- [ ] Ensure catch block handles Moxfield errors identically to Archidekt (502)

### Phase 4: Update `DeckInput.tsx`

- [ ] Destructure `onSubmitUrl` in component props (currently ignored)
- [ ] Add `urlValue` state for URL input
- [ ] Moxfield and Archidekt tabs: render URL text input instead of textarea, with appropriate placeholder
- [ ] Update `handleSubmit`: call `onSubmitUrl(urlValue.trim())` for URL tabs, `onSubmitText(textValue.trim())` for manual
- [ ] Disable submit when URL input empty (for URL tabs)
- [ ] Basic client-side URL validation with inline feedback

### Phase 5: API E2E Tests (`e2e/api-deck-moxfield.spec.ts`)

- [ ] `GET /api/deck?url=https://moxfield.com/decks/abc123` -- returns 200 or 502 (validate shape)
- [ ] `GET /api/deck?url=https://moxfield.com/not-a-deck-path` -- returns 400
- [ ] `GET /api/deck?url=https://example.com/decks/123` -- returns 422
- [ ] `GET /api/deck` (no URL) -- returns 400 (regression)
- [ ] `GET /api/deck?url=not-a-url` -- returns 400 (regression)

### Phase 6: Browser E2E Tests (`e2e/moxfield-import.spec.ts`)

Mock `/api/deck*` via `page.route()` to avoid real API calls:

- [ ] "Moxfield tab shows URL input" (not textarea)
- [ ] "Submit disabled for empty URL"
- [ ] "Successful Moxfield import" -- mock returns valid DeckData, verify deck display
- [ ] "Error state for invalid URL format"
- [ ] "Error state for API failure" (mock 502)
- [ ] "Source label shows moxfield"
- [ ] "Tab switching preserves URL"

### Phase 7: Update existing tests

- [ ] Update `e2e/tab-navigation.spec.ts` -- Moxfield tab assertion: URL input instead of textarea
- [ ] Verify Archidekt tab tests still pass

### Phase 8: Fixture Updates (`e2e/fixtures.ts`)

- [ ] Add `fillDeckUrl(url: string)` method to `DeckPage`
- [ ] Add `get deckUrlInput` locator

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/moxfield.ts` | Modify | Fix API URL, add `normalizeMoxfieldDeck` |
| `src/lib/types.ts` | Modify | Verify/update `MoxfieldApiResponse` if needed |
| `src/app/api/deck/route.ts` | Modify | Add Moxfield URL branch |
| `src/components/DeckInput.tsx` | Modify | Use `onSubmitUrl`, URL input for Moxfield/Archidekt tabs |
| `tests/unit/moxfield.spec.ts` | Create | Unit tests for URL parsing, normalization |
| `e2e/api-deck-moxfield.spec.ts` | Create | API E2E tests |
| `e2e/moxfield-import.spec.ts` | Create | Browser E2E tests with mocked API |
| `e2e/tab-navigation.spec.ts` | Modify | Update Moxfield tab assertion |
| `e2e/fixtures.ts` | Modify | Add URL input helpers |

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Private/unlisted decks | API returns 404/403 → user-friendly error: "Deck is private or does not exist" |
| Deleted decks | 404 → same handling as private |
| Rate limiting | 429 → 502 with "Moxfield is rate-limiting requests. Try again shortly." |
| Invalid deck IDs | Valid-looking ID, no real deck → 404 → descriptive error |
| API version changes | v3 endpoint may change; `MoxfieldApiResponse` type catches mismatches at build time |
| URL variations | Trailing paths (`/primer`, `/playtest`), query params, fragments → regex captures only deck ID |
| Empty decks | Zero cards → returns empty DeckData sections, display handles gracefully |
| Commander detection | Moxfield has dedicated `commanders` section in API → no special detection needed |
| Network timeouts | `AbortSignal.timeout(10_000)` → bubbles to catch → 502 |

## E2E User Scenarios

1. **Happy path**: Click Moxfield tab → paste URL → Import → deck displays with commander + mainboard + sideboard
2. **Private deck**: Paste private deck URL → Import → error about deck being private
3. **Invalid URL**: Paste `https://google.com/something` → error about unsupported URL
4. **Bad format**: Type random text → client-side validation feedback
5. **Network failure**: Moxfield down → "Failed to fetch deck" error
6. **Tab switching**: Enter URL in Moxfield → switch to Manual → switch back → URL persists

## Verification

1. `npm run test:unit` — all `tests/unit/moxfield.spec.ts` pass
2. `npm run test:e2e` — all new e2e tests pass, existing tests pass
3. `npm test` — full suite green
4. `npm run build` — no TypeScript errors
5. Manual: paste real public Moxfield URL → deck loads correctly; paste private URL → clear error; verify Archidekt + Manual tabs still work
