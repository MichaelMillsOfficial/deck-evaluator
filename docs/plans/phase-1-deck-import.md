# Plan: Phase 1 — Next.js Boilerplate + Deck Import UI

## Context
Bootstrap a Next.js (App Router) + TypeScript + Tailwind CSS application for Magic: The Gathering deck analysis. Phase 1 scope: a URL input that accepts a public Moxfield or Archidekt deck URL, proxies the fetch server-side, normalizes the response, and renders a clean text decklist grouped by zone (Commander / Mainboard / Sideboard).

---

## Step 1: Bootstrap the App

Run from the repo root:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm \
  --disable-git
```

`--disable-git` prevents re-initializing git (repo already exists). After running, verify with `npm run dev`.

---

## Step 2: File Structure to Create

```
src/
  app/
    layout.tsx           # Update metadata title/description
    page.tsx             # Main client page — owns all state
    globals.css          # Left as generated (Tailwind v4: @import "tailwindcss")
    api/
      deck/
        route.ts         # Server-side proxy: parse URL → fetch → normalize
  components/
    DeckInput.tsx        # URL input form (controlled, disabled during load)
    DeckList.tsx         # Grouped decklist display
  lib/
    types.ts             # Shared TypeScript interfaces
    moxfield.ts          # Moxfield URL parser + API client + normalizer
    archidekt.ts         # Archidekt API client + URL parser + normalizer
    scryfall.ts          # Scryfall client (stubbed for Phase 2)
```

---

## Step 3: Core Types (`src/lib/types.ts`)

```ts
export interface DeckCard {
  name: string;
  quantity: number;
}

export interface DeckData {
  name: string;
  source: 'moxfield' | 'archidekt';
  url: string;
  commanders: DeckCard[];
  mainboard: DeckCard[];
  sideboard: DeckCard[];
}

// Raw Moxfield API types
export interface MoxfieldCardEntry {
  quantity: number;
  card: { name: string };
}
export interface MoxfieldDeckSection {
  [cardName: string]: MoxfieldCardEntry;
}
export interface MoxfieldApiResponse {
  name: string;
  mainboard: MoxfieldDeckSection;
  commanders: MoxfieldDeckSection;
  sideboard: MoxfieldDeckSection;
}

// Raw Archidekt API types
export interface ArchidektCard {
  quantity: number;
  card: { oracleCard: { name: string } };
  categories: string[];
}
export interface ArchidektApiResponse {
  name: string;
  cards: ArchidektCard[];
}
```

---

## Step 4: Platform Clients

### `src/lib/moxfield.ts`
- URL pattern: `/^https?:\/\/(?:www\.)?moxfield\.com\/decks\/([A-Za-z0-9_-]+)/`
- API: `https://api2.moxfield.com/v2/decks/all/{deckId}`
- `normalizeMoxfieldSection(section, defaultQty=1)`: `Object.entries()` → map to `DeckCard[]`, sort by name
- Include `User-Agent: Mozilla/5.0 (compatible; deck-evaluator/1.0)` header (avoids bot rejection)
- `cache: 'no-store'` on all fetches

### `src/lib/archidekt.ts`
- URL pattern: `/^https?:\/\/(?:www\.)?archidekt\.com\/decks\/(\d+)/`
- API: `https://archidekt.com/api/decks/{deckId}/`
- `normalizeArchidektCards(raw)`: iterate `raw.cards[]`, classify by `categories`:
  - `COMMANDER_CATEGORIES = new Set(['Commander', 'Oathbreaker', 'Signature Spell'])`
  - `SIDEBOARD_CATEGORIES = new Set(['Sideboard', 'Maybeboard', 'Considering'])`
  - Commander check runs first; unmatched cards fall into mainboard
  - Returns `{ commanders, mainboard, sideboard }`, each sorted by name

### `src/lib/scryfall.ts`
- Stubbed: export `fetchCardByName(name): Promise<ScryfallCard | null>` with `ScryfallCard` interface
- Include rate-limit comment: max 10 req/sec, 50–100ms between requests

---

## Step 5: API Route (`src/app/api/deck/route.ts`)

```
export const dynamic = 'force-dynamic'

GET /api/deck?url={encodedUrl}

1. Validate `url` param present → 400 if missing
2. new URL(deckUrl) → 400 "Invalid URL format" if throws
3. isMoxfieldUrl() → fetchMoxfieldDeck() → normalizeMoxfieldSection() → return DeckData JSON
4. isArchidektUrl() → fetchArchidektDeck() → normalizeArchidektCards() → return DeckData JSON
5. Neither → 422 "Unsupported deck URL"
6. Catch upstream errors → 502 with error message

Defensive: use raw.commanders ?? {} etc. for missing sections
```

HTTP status codes: 400 bad input, 422 unsupported URL, 502 upstream failure.

---

## Step 6: Components

### `src/components/DeckInput.tsx`
- `'use client'`
- Props: `onSubmit: (url: string) => void`, `loading: boolean`
- `<input type="url">` with placeholder showing both URL formats
- Button text: "Analyze Deck" / "Loading..."
- Both input and button disabled while `loading`

### `src/components/DeckList.tsx`
- `'use client'`
- `DeckSection` sub-component: skips render if `cards.length === 0`
- Section header: zone name + total quantity count
- Card row: monospace fixed-width quantity (`w-6 font-mono`) + card name
- Render order: Commander → Mainboard → Sideboard
- Deck header: name, source link (back to original URL), total mainboard count

### `src/app/page.tsx`
- `'use client'`
- State: `deckUrl`, `deckData: DeckData | null`, `loading`, `error`
- On submit: clear stale state, fetch `/api/deck?url=encodeURIComponent(url)`, set result or error
- Renders: header → `<DeckInput>` → loading pulse → error banner → `<DeckList>`

---

## Step 7: `src/app/layout.tsx`

Update the generated layout with:
```ts
export const metadata: Metadata = {
  title: 'Deck Evaluator',
  description: 'Magic: The Gathering deck analysis tool',
};
```
Add `bg-gray-50` to the `<body>` className.

---

## Verification

```bash
# Start dev server
npm run dev

# Test API route directly
curl "http://localhost:3000/api/deck?url=https://www.moxfield.com/decks/DECK_ID"
curl "http://localhost:3000/api/deck?url=https://archidekt.com/decks/DECK_ID"

# Error cases
curl "http://localhost:3000/api/deck"                               # 400
curl "http://localhost:3000/api/deck?url=not-a-url"                 # 400
curl "http://localhost:3000/api/deck?url=https://tappedout.net/x"   # 422

# Build check
npm run build   # must pass with no TS errors
npm run lint    # must pass clean
```

Browser flow:
1. Paste a Moxfield URL → click Analyze Deck → decklist renders grouped by zone
2. Paste an Archidekt URL → same result
3. Paste an unsupported URL → red error banner appears

---

## Notes
- Moxfield's `api2.moxfield.com` API is unofficial but widely used by community tools
- Tailwind v4 (installed by `create-next-app@latest`) uses `@import "tailwindcss"` in globals.css — do not replace with v3 directives
- All `lib/` files and `route.ts` are server-side only; never import client-only APIs there
- `'use client'` is required on: `page.tsx`, `DeckInput.tsx`, `DeckList.tsx`
