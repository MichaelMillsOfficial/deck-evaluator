# Scryfall Card Enrichment Pipeline

## Context

Currently, after importing a decklist (via manual paste, Moxfield export, or Archidekt URL), the app only stores card names and quantities (`DeckCard = { name, quantity }`). There is no metadata about what each card actually does — no mana cost, type line, oracle text, color identity, or imagery.

This plan introduces a **card enrichment pipeline** that fetches full card data from the Scryfall API after a deck is parsed, builds a `Record<string, EnrichedCard>` keyed by card name, and renders enriched metadata alongside the existing decklist in the UI.

### Goals

- Fetch card data from Scryfall for every unique card in a parsed deck
- Respect Scryfall rate limits (max 10 req/sec; use the `/collection` bulk endpoint)
- Store enriched data in a typed map: mana cost, colored pips, supertype, subtype, oracle text, CMC, color identity, image URIs, keywords, power/toughness, loyalty, rarity
- Render enriched card details in the deck display UI alongside the existing card list
- Keep the enrichment asynchronous — show the basic decklist immediately, then progressively load card details

### Non-Goals (out of scope for this plan)

- Card price data
- Deck statistics/analytics (mana curve charts, color distribution) — will be a follow-up
- Caching enriched data in a database or persistent store (see Technical Notes for rationale)
- Full double-faced card support (will use front face data, but must handle DFC normalization correctly — see Task 1.3)

---

## Review Feedback Incorporated

This plan has been reviewed by three specialist agents (frontend, Next.js, API design). The following changes were made based on their feedback:

1. **Removed `?enrich=true` on existing routes** (tasks 2.2/2.3) — all reviewers agreed enrichment should be a separate concern, not bolted onto parse/fetch endpoints
2. **Removed `EnrichedDeckData` type** — frontend state holds `deckData` and `cardMap` independently; no combined API response type needed
3. **Added `not_found` array to enrichment response** — threads Scryfall's not_found data to the client
4. **DFC handling in normalization** — falls back to `card_faces[0]` when top-level fields are undefined
5. **Scryfall 429 rate limit handling** — reads `Retry-After` header and retries
6. **Disclosure/expandable pattern** for card details instead of hover tooltips (accessible on touch/keyboard)
7. **`<table>` semantics** for enriched card display with proper `<th>`/`<td>` structure
8. **`aria-hidden` on individual mana pips** with full color names in container `aria-label`
9. **`images.remotePatterns`** for `cards.scryfall.io` in `next.config.ts`
10. **`next: { revalidate }` caching** on Scryfall fetch calls
11. **TDD phase ordering** — tests written before implementation in each phase
12. **Scryfall mocking** in E2E tests via `page.route()` intercepts
13. **Input validation details** — individual name trimming, length caps, empty string filtering

---

## Implementation Tasks

### Phase 1: Types & Data Layer

- [ ] **1.1 Define `EnrichedCard` and related types in `src/lib/types.ts`**
  - `ManaPips` type: `{ W: number; U: number; B: number; R: number; G: number; C: number }`
  - `EnrichedCard` type with fields: `name`, `manaCost` (string, e.g. `{2}{W}{U}`), `cmc` (number), `colorIdentity` (string[]), `colors` (string[]), `typeLine` (string), `supertypes` (string[], parsed from typeLine — e.g. "Legendary"), `subtypes` (string[], parsed from typeLine — e.g. "Human", "Wizard"), `oracleText` (string), `keywords` (string[]), `power` (string | null), `toughness` (string | null), `loyalty` (string | null), `rarity` (string), `imageUris` ({ small: string; normal: string; large: string } | null), `manaPips` (ManaPips)
  - No `EnrichedDeckData` type — frontend state holds `DeckData` and `Record<string, EnrichedCard>` independently

- [ ] **1.2 Write tests for `parseManaPips()` and `parseTypeLine()`, then implement in `src/lib/mana.ts`** (TDD)
  - **Write tests first** covering:
    - Mana cost strings: `{W}`, `{2}{B}{B}`, `{X}{R}{G}`, `{0}`, hybrid mana `{W/U}`, Phyrexian `{B/P}`, empty string `""`
    - Type line parsing: `"Legendary Creature — Human Wizard"`, `"Artifact"`, `"Enchantment — Aura"`, `"Basic Land — Island"`, `"Legendary Planeswalker — Jace"`
  - **Then implement:**
    - `parseManaPips(manaCost: string): ManaPips` — regex parses `{W}`, `{U}`, `{B}`, `{R}`, `{G}`, `{C}` symbols and returns counts. Must handle empty string without throwing.
    - `parseTypeLine(typeLine: string): { supertypes: string[]; cardType: string; subtypes: string[] }` — splits on ` — ` (em dash) and categorizes known supertypes (Legendary, Basic, Snow, World, Ongoing, Host)
  - Pure functions, no React dependency

- [ ] **1.3 Expand Scryfall client in `src/lib/scryfall.ts`**
  - Expand `ScryfallCard` interface to include: `keywords`, `power`, `toughness`, `loyalty`, `rarity`, `card_faces` (array of face objects for DFCs)
  - Add `fetchCardCollection(names: string[]): Promise<{ data: ScryfallCard[]; not_found: string[] }>`:
    - Uses Scryfall's `POST /cards/collection` endpoint (max 75 identifiers per request)
    - Batch card names into chunks of 75, send requests with 100ms delay between batches
    - Each batch request uses `AbortSignal.timeout(10_000)` (matches existing `fetchCardByName`)
    - Use `next: { revalidate: 86400 }` on fetch calls to leverage Next.js Data Cache for identical requests
    - **429 handling:** If Scryfall returns 429, read `Retry-After` header, wait the specified time, then retry the batch once
    - **Partial batch failure:** If a batch times out or returns 5xx, accumulate results from successful batches and report failed card names in `not_found`
  - Add `normalizeToEnrichedCard(card: ScryfallCard): EnrichedCard`:
    - Maps Scryfall response fields to `EnrichedCard` type
    - **DFC handling:** If `mana_cost` is undefined and `card_faces` exists, fall back to `card_faces[0].mana_cost`, `card_faces[0].oracle_text`, `card_faces[0].image_uris`
    - Calls `parseManaPips()` and `parseTypeLine()`

- [ ] **1.4 Add `images.remotePatterns` to `next.config.ts`**
  - Add `cards.scryfall.io` as an allowed remote image host for `next/image`:
    ```typescript
    images: {
      remotePatterns: [{ protocol: "https", hostname: "cards.scryfall.io" }],
    }
    ```

### Phase 2: API Endpoint

- [ ] **2.1 Write API contract tests for `POST /api/deck-enrich`, then implement** (TDD)
  - **Write tests first** in `e2e/api-deck-enrich.spec.ts`:
    - Valid input: returns enriched card data keyed by name
    - Empty array: returns 400
    - Oversized input (>250 unique names): returns 400
    - Invalid body (not JSON, missing `cardNames`): returns 400
  - **Then implement** in `src/app/api/deck-enrich/route.ts`:
    - Accepts `{ cardNames: string[] }` in the request body
    - **Input validation:**
      - Reject if body is not valid JSON or missing `cardNames`: 400
      - Trim each name, filter out empty/whitespace-only strings
      - Reject individual names longer than 200 characters: 400
      - Deduplicate card names (case-insensitive)
      - Reject if 0 names remain after filtering: 400
      - Reject if more than 250 unique names after dedup: 400 with message
    - Calls `fetchCardCollection()` to batch-fetch from Scryfall
    - Normalizes each result via `normalizeToEnrichedCard()`
    - **Response shape:**
      ```typescript
      {
        cards: Record<string, EnrichedCard>;  // keyed by card name
        not_found: string[];                   // card names Scryfall did not recognize
      }
      ```
    - **Error responses** follow existing pattern: `{ error: string }` with appropriate status codes (400, 502)
    - If all batches fail (Scryfall completely down): return 502 with `{ error: "Failed to fetch card data from Scryfall" }`
    - If some batches succeed: return 200 with partial `cards` and full `not_found` list

### Phase 3: Frontend Integration

- [ ] **3.1 Write E2E tests for enrichment UI flow, then implement** (TDD)
  - **Write tests first** in `e2e/deck-enrichment.spec.ts`:
    - **Mock Scryfall calls** via `page.route()` intercepts with fixture data (`MOCK_ENRICHED_RESPONSE` constant in `e2e/fixtures.ts`)
    - Test: import a decklist → basic decklist renders immediately
    - Test: "Loading card details..." indicator appears during enrichment
    - Test: enriched card details appear (mana cost symbols, type lines)
    - Test: enrichment failure gracefully falls back to basic display with dismissible warning
    - Test: form re-enables immediately after deck data loads (enrichment does not gate form interaction)

- [ ] **3.2 Update `DeckImportSection.tsx` to request enrichment**
  - After receiving `DeckData` from the parse/fetch API, make a second call to `POST /api/deck-enrich` with all unique card names from commanders + mainboard + sideboard
  - New state: `const [cardMap, setCardMap] = useState<Record<string, EnrichedCard> | null>(null)`
  - New state: `const [enrichLoading, setEnrichLoading] = useState(false)`
  - **Important:** The form re-enables as soon as `deckData` is received and `loading` becomes false. `enrichLoading` only controls the card details indicator, not the import form.
  - Pass `cardMap` down to `DeckList` as an optional prop
  - Show "Loading card details..." status while `enrichLoading` is true
  - If enrichment fails, show a dismissible warning: "Could not load card details" — do not block the basic deck display

- [ ] **3.3 Create `ManaCost` component in `src/components/ManaCost.tsx`**
  - Renders a mana cost string like `{2}{W}{U}` as a row of small mana symbols (16×16 or 20×20 circles)
  - Color mapping: {W} = amber/gold, {U} = blue, {B} = gray-900/black, {R} = red, {G} = green, {C} = gray
  - Generic mana (numbers) rendered as gray circles with the number inside
  - **Accessibility:** Container has `aria-label` with full color names (e.g. `"Mana cost: 2 generic, white, blue"` — NOT abbreviations)
  - **All individual pip elements are `aria-hidden="true"`** — the container `aria-label` carries the full semantic meaning
  - Structure:
    ```tsx
    <span aria-label="Mana cost: 2 generic, white, blue" className="inline-flex gap-0.5">
      <span aria-hidden="true" className="pip pip-generic">2</span>
      <span aria-hidden="true" className="pip pip-white" />
      <span aria-hidden="true" className="pip pip-blue" />
    </span>
    ```

- [ ] **3.4 Create `EnrichedCardRow` component in `src/components/EnrichedCardRow.tsx`**
  - Renders as a `<tr>` with `<td>` cells (used inside a `<table>` — see Task 3.5)
  - Columns: quantity | ManaCost | card name | type line
  - **Expandable disclosure pattern** (not hover tooltip) for detailed info:
    ```tsx
    <tr>
      <td>{quantity}</td>
      <td><ManaCost cost={card.manaCost} /></td>
      <td>
        <button aria-expanded={open} aria-controls={`card-detail-${card.name}`}>
          {card.name}
        </button>
      </td>
      <td>{card.typeLine}</td>
    </tr>
    {open && (
      <tr id={`card-detail-${card.name}`}>
        <td colSpan={4}>
          oracle text, power/toughness, loyalty, keywords, rarity
        </td>
      </tr>
    )}
    ```
  - Works on touch, keyboard navigable, screen reader accessible
  - Follow existing design system: slate backgrounds, purple accents, `text-sm`

- [ ] **3.5 Update `DeckList.tsx` to use enriched data**
  - Accept optional `cardMap: Record<string, EnrichedCard> | null` prop
  - In `DeckSection`, when `cardMap` is available, render as a `<table>` with proper `<thead>` / `<th scope="col">` / `<tbody>` structure:
    - Column headers: "Qty", "Cost", "Name", "Type"
    - Each card renders via `EnrichedCardRow`
  - When `cardMap` is null/loading, fall back to existing `<ul>` simple display (no layout thrash)
  - Use `card.name` as the React key (not `${card.name}-${index}`) — the parser guarantees uniqueness within a section

- [ ] **3.6 Add enrichment loading states**
  - In `DeckImportSection`, show "Loading card details..." with subtle pulse animation while `enrichLoading` is true
  - This renders below the already-visible basic decklist
  - If enrichment fails, show a dismissible warning banner: "Could not load card details. The basic decklist is still available."

### Phase 4: Verification & Polish

- [ ] **4.1 Full E2E test pass**
  - Run `npm test` — all existing and new tests must pass
  - Run `npm run build` — production build must succeed

- [ ] **4.2 Manual verification**
  - Import example Atraxa decklist → basic list renders immediately → enriched data appears within 1-2 seconds
  - Verify Sol Ring: `{1}` mana cost, "Artifact" type line
  - Verify Atraxa: `{G}{W}{U}{B}` mana cost, "Legendary Creature — Phyrexian Angel Horror"
  - Click a card name → details expand with oracle text
  - Test with Scryfall mock failure → basic decklist shows, warning displayed
  - Test on mobile viewport → disclosure buttons work on touch

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add `EnrichedCard`, `ManaPips` types |
| `src/lib/mana.ts` | Create | Mana pip parser and type line parser utilities |
| `src/lib/scryfall.ts` | Modify | Add collection fetch, expand `ScryfallCard`, add normalization, DFC handling |
| `next.config.ts` | Modify | Add `images.remotePatterns` for `cards.scryfall.io` |
| `src/app/api/deck-enrich/route.ts` | Create | New enrichment API endpoint |
| `src/components/DeckImportSection.tsx` | Modify | Add enrichment fetch + state management |
| `src/components/DeckList.tsx` | Modify | Accept `cardMap` prop, render `<table>` when enriched |
| `src/components/EnrichedCardRow.tsx` | Create | Enriched card table row with expandable details |
| `src/components/ManaCost.tsx` | Create | Mana cost symbol renderer with accessible markup |
| `e2e/fixtures.ts` | Modify | Add `MOCK_ENRICHED_RESPONSE` fixture data |
| `e2e/deck-enrichment.spec.ts` | Create | E2E tests for enrichment UI flow |
| `e2e/api-deck-enrich.spec.ts` | Create | API contract tests for enrichment endpoint |

---

## Verification

1. Import the example Atraxa decklist via "Load Example" → basic card list renders immediately
2. After 1-2 seconds, enriched data appears: mana cost symbols, type lines visible for each card
3. Verify Sol Ring shows `{1}` mana cost, "Artifact" type line
4. Verify Atraxa shows `{G}{W}{U}{B}` mana cost, "Legendary Creature — Phyrexian Angel Horror"
5. Click card name → oracle text and metadata expand
6. Verify all E2E tests pass: `npm test`
7. Verify build succeeds: `npm run build`
8. Test with a large deck (99-card Commander deck) to verify batching and rate limiting work correctly
9. Test enrichment failure scenario: mock Scryfall down → basic decklist shows with warning

---

## Technical Notes

### Scryfall `/cards/collection` Endpoint
- `POST https://api.scryfall.com/cards/collection`
- Body: `{ identifiers: [{ name: "Sol Ring" }, { name: "Command Tower" }, ...] }`
- Max 75 identifiers per request
- Returns `{ data: ScryfallCard[], not_found: [{ name: string }] }`
- Rate limit: be polite, 50-100ms between requests
- **Note:** The collection endpoint with `{ name: ... }` identifiers does fuzzy matching — verify during implementation. If exact-match only, add a name normalization step.

### Rate Limiting
- Use 100ms delay between batch requests within a single API handler
- On 429 response: read `Retry-After` header, wait, retry the batch once
- **Known limitation:** The per-handler delay is not globally coordinated across concurrent requests. Two simultaneous enrichment calls each run their own batch loops independently. For this phase, this is acceptable. A server-side rate limit queue would be needed for production scale.

### DFC (Double-Faced Card) Handling
- When a DFC is returned from Scryfall, `mana_cost`, `oracle_text`, and `image_uris` are `undefined` at the top level — they exist only inside `card_faces[0]`
- `normalizeToEnrichedCard` must check for this and fall back to `card_faces[0]` fields
- Examples: Delver of Secrets, Valki God of Lies, many modern commanders

### Mana Cost String Format
- Scryfall returns mana costs like `{2}{W}{U}`, `{X}{R}{G}`, `{B/P}` (Phyrexian)
- Hybrid mana: `{W/U}`, `{2/B}` — count toward both colors
- Generic mana: `{0}`, `{1}`, `{2}`, ..., `{X}`
- Empty string for cards with no mana cost (e.g. basic lands) — `parseManaPips` must handle gracefully

### Type Line Parsing
- Format: `[Supertypes] <Card Type> [— Subtypes]`
- Supertypes: Legendary, Basic, Snow, World, Ongoing, Host
- Card types: Creature, Artifact, Enchantment, Land, Instant, Sorcery, Planeswalker, Battle, Kindred
- Em dash (`—`) separates types from subtypes

### Caching Strategy
- Use `next: { revalidate: 86400 }` on Scryfall `fetch()` calls to leverage Next.js Data Cache
- **Note:** POST request caching in Next.js keys on the full body. Only identical card sets will cache-hit. For better per-card granularity, consider `unstable_cache` per card name in a future iteration.
- No in-memory `Map` cache for this phase. The Docker deployment uses a long-lived Node process where module-level caching would work, but defer this to avoid complexity. HTTP-level caching via Next.js is sufficient for now.

### Accessibility Summary
- `ManaCost` container: `aria-label` with full color names; all pip elements `aria-hidden="true"`
- `EnrichedCardRow`: disclosure button with `aria-expanded` and `aria-controls` for card details
- `DeckSection` (enriched): `<table>` with `<th scope="col">` column headers
- Form re-enables immediately after parse; enrichment loading does not gate user interaction
