# Export & Share Analysis Reports

## Context

The deck evaluator produces rich analysis output -- mana curve distributions, color distribution metrics, land base efficiency scores, synergy mappings, and known combo detections -- but none of this data can leave the browser session. Once the user closes the tab, the analysis is gone. Players frequently want to share their deck analysis with playgroups on Discord, save results for later reference, or screenshot analysis summaries for social media.

This feature adds three tiers of export capability:

1. **Text/JSON Export** -- Copy analysis results to clipboard in Markdown, Discord-compact, or JSON format for pasting into chat, documents, or programmatic tools.
2. **Shareable URL** -- Encode `DeckData` into a gzip + base64url URL parameter so any recipient can view the full deck + analysis without re-importing.
3. **Image Export** -- Capture a compact analysis summary card as a PNG for social media sharing.

### Intended Outcome

An **Export Toolbar** appears below the `DeckViewTabs` tab bar (visible on all three tabs) with three actions: a format-selectable "Copy Report" button, a "Share Link" button, and a "Save as Image" button. Each action produces output the user can immediately paste, share, or download. The shareable URL routes to `/shared?d=<encoded>`, which decodes and renders the full deck + analysis without requiring the user to re-paste and re-enrich.

## Why

1. **Social sharing is the #1 user retention loop** -- Players share deck analyses in Discord servers and Reddit. Making that effortless drives organic adoption.
2. **No existing MTG tool exports structured analysis** -- Moxfield exports decklists but not analysis. EDHREC provides no per-deck export. A Markdown report with mana curve, synergy themes, and efficiency scores is unique.
3. **Low implementation cost** -- All analysis modules are pure functions that already produce structured data. Export is a formatting layer on top of existing computation.
4. **URL sharing eliminates re-enrichment** -- Recipients see the deck list immediately; enrichment runs in the background. The DeckData payload is small (~2-4 KB gzipped for a 100-card Commander deck).

## Dependencies

| Dependency | Module | What It Provides |
|-----------|--------|------------------|
| Core types | `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard`, `DeckSynergyAnalysis` |
| Mana curve | `src/lib/mana-curve.ts` | `computeManaCurve()` -- curve data for text report |
| Color distribution | `src/lib/color-distribution.ts` | `computeColorDistribution()`, `computeManaBaseMetrics()` |
| Land base efficiency | `src/lib/land-base-efficiency.ts` | `computeLandBaseEfficiency()` -- score + factor breakdown |
| Synergy engine | `src/lib/synergy-engine.ts` | `analyzeDeckSynergy()` -- themes, combos, anti-synergies |
| Tab shell | `src/components/DeckViewTabs.tsx` | Container where export toolbar will be rendered |
| DeckImportSection | `src/components/DeckImportSection.tsx` | State owner for `deckData`, `cardMap` -- passes to DeckViewTabs |
| Stat card pattern | `src/components/ManaBaseStats.tsx` | UI pattern for the image export summary card |

**New dependency (Phase 3 only):** `html2canvas` npm package for DOM-to-canvas rendering. Phases 1 and 2 require no new dependencies.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation module signature | `src/lib/land-base-efficiency.ts` | `(deck, cardMap) => FormattedOutput` pattern for report formatters |
| `makeCard()` / `makeDeck()` test helpers | `tests/unit/mana-curve.spec.ts` | Reuse in unit tests for export formatting |
| Section heading + subtitle + content | `src/components/DeckAnalysis.tsx` | `<section aria-labelledby>` pattern |
| Stat card grid layout | `src/components/ManaBaseStats.tsx` | Layout for the `AnalysisSummaryCard` image export component |
| Score color functions | `src/components/LandBaseEfficiency.tsx` | `getScoreColor()`, `getBadgeClasses()` for summary card |
| `data-testid` attributes | `src/components/LandBaseEfficiency.tsx` | Testable DOM hooks for export toolbar |
| Tab bar button styling | `src/components/DeckViewTabs.tsx` | Button classes for toolbar buttons |
| Next.js App Router page | `src/app/page.tsx` | Pattern for new `/shared` page |
| Unit test structure | `tests/unit/mana-curve.spec.ts` | `test.describe`, direct imports from `../../src/lib/` |
| E2E test with mock enrichment | `e2e/deck-analysis.spec.ts` | `page.route()` mocking for export toolbar tests |

---

## Implementation Tasks

### Phase 1: Text/JSON Export

#### 1.1 Unit Tests for Export Report Formatting (`tests/unit/export-report.spec.ts`)

- [ ] **1.1.1** Create `tests/unit/export-report.spec.ts` with `makeCard()`, `makeDeck()`, and `makeEnrichedCard()` helpers
- [ ] **1.1.2** Test `formatMarkdownReport()`:
  - Returns a string starting with `# Deck Analysis:` and the deck name
  - Includes `## Mana Curve` section with CMC bucket lines
  - Includes `## Color Distribution` section
  - Includes `## Land Base Efficiency` section with overall score and factor rows
  - Includes `## Synergy Themes` section listing detected themes
  - Includes `## Known Combos` section when combos are present
  - Omits combos section when no combos detected
  - Includes card list sections (Commander, Mainboard, Sideboard) with `Nx CardName` format
  - Handles empty deck gracefully (no crash, minimal output)
  - Handles null cardMap (outputs deck list only, no analysis sections)
- [ ] **1.1.3** Test `formatDiscordReport()`:
  - Returns a compact single string under 2000 characters for a typical Commander deck
  - Uses Discord emoji indicators: land count, avg CMC, efficiency score
  - Includes deck name as bold text
  - Lists synergy themes as comma-separated inline text
  - Lists known combos with card names
  - Handles empty deck and null cardMap gracefully
- [ ] **1.1.4** Test `formatJsonReport()`:
  - Returns valid JSON string when parsed with `JSON.parse()`
  - Contains expected keys: `deckName`, `source`, `totalCards`, `manaCurve`, `colorDistribution`, `landBaseEfficiency`, `synergyThemes`, `knownCombos`
  - Handles null cardMap (analysis fields are null)

#### 1.2 Implement Export Report Module (`src/lib/export-report.ts`)

- [ ] **1.2.1** Create `src/lib/export-report.ts` with type definitions:

  ```typescript
  export type ExportFormat = "markdown" | "discord" | "json";

  export interface ExportReportInput {
    deck: DeckData;
    cardMap: Record<string, EnrichedCard> | null;
  }

  export interface ExportReportResult {
    format: ExportFormat;
    content: string;
    mimeType: string;
  }
  ```

- [ ] **1.2.2** Implement `formatMarkdownReport(input: ExportReportInput): string`
- [ ] **1.2.3** Implement `formatDiscordReport(input: ExportReportInput): string` -- compact, under 2000 chars
- [ ] **1.2.4** Implement `formatJsonReport(input: ExportReportInput): string` -- structured JSON with 2-space indent
- [ ] **1.2.5** Implement `exportReport(input: ExportReportInput, format: ExportFormat): ExportReportResult`

#### 1.3 Clipboard Utility (`src/lib/clipboard.ts`)

- [ ] **1.3.1** Create `tests/unit/clipboard.spec.ts` with tests for `copyToClipboard()`
- [ ] **1.3.2** Create `src/lib/clipboard.ts`:

  ```typescript
  export async function copyToClipboard(text: string): Promise<boolean>
  ```

  Primary: `navigator.clipboard.writeText(text)`. Fallback: `document.execCommand("copy")`. Never throws.

#### 1.4 Export Toolbar Component (`src/components/ExportToolbar.tsx`)

- [ ] **1.4.1** Create `"use client"` component with props `{ deck: DeckData; cardMap: Record<string, EnrichedCard> | null }`
- [ ] **1.4.2** State: `selectedFormat: ExportFormat` (default `"markdown"`), `copyStatus: "idle" | "copied" | "failed"`
- [ ] **1.4.3** Format selector: dropdown with "Markdown", "Discord", "JSON" options; `data-testid="export-format-select"`
- [ ] **1.4.4** "Copy Report" button with "Copied!" feedback; `data-testid="export-copy-button"`
- [ ] **1.4.5** Container styling: `flex items-center gap-3` row, `bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700`
- [ ] **1.4.6** Accessibility: `aria-label="Export toolbar"`, `aria-live="polite"` for copy feedback

#### 1.5 Integration into DeckViewTabs

- [ ] **1.5.1** Import `ExportToolbar` in `src/components/DeckViewTabs.tsx`
- [ ] **1.5.2** Render between the tab bar and the tab panels

#### 1.6 E2E Tests for Export Toolbar (`e2e/export-toolbar.spec.ts`)

- [ ] **1.6.1** Test: "Export toolbar visible after deck import"
- [ ] **1.6.2** Test: "Format selector defaults to Markdown"
- [ ] **1.6.3** Test: "Copy button shows Copied feedback on click"
- [ ] **1.6.4** Test: "Switching format to Discord and copying"
- [ ] **1.6.5** Test: "Switching format to JSON and copying"
- [ ] **1.6.6** Test: "Export toolbar accessible with proper ARIA attributes"

#### 1.7 Fixture Updates

- [ ] **1.7.1** Add `get exportToolbar()` locator to `DeckPage` in `e2e/fixtures.ts`
- [ ] **1.7.2** Add `get exportCopyButton()` locator
- [ ] **1.7.3** Add `get exportFormatSelect()` locator

---

### Phase 2: Shareable URL

#### 2.1 Unit Tests for Deck Codec (`tests/unit/deck-codec.spec.ts`)

- [ ] **2.1.1** Create `tests/unit/deck-codec.spec.ts`
- [ ] **2.1.2** Test `encodeDeckData()`:
  - Returns a non-empty string for a valid `DeckData`
  - Returned string is URL-safe (no `+`, `/`, or `=` characters)
  - Output length for a 100-card Commander deck is under 3000 characters
  - Encoding the same input twice produces the same output
- [ ] **2.1.3** Test `decodeDeckData()`:
  - Roundtrips: `decodeDeckData(encodeDeckData(deck))` deep-equals original `deck`
  - Returns `null` for empty string, invalid base64, valid base64 but invalid JSON, corrupted gzip data
  - Does not throw on any malformed input
- [ ] **2.1.4** Test `buildShareUrl()`:
  - Returns a URL with `?d=` query parameter
  - URL starts with origin + `/shared`
- [ ] **2.1.5** Test size characteristics:
  - Small deck (5 cards) encodes to < 200 chars
  - Medium deck (60 cards) encodes to < 2000 chars
  - Large deck (100 cards) encodes to < 4000 chars

#### 2.2 Implement Deck Codec (`src/lib/deck-codec.ts`)

- [ ] **2.2.1** Create `src/lib/deck-codec.ts`:

  ```typescript
  export function encodeDeckData(deck: DeckData): string
  export function decodeDeckData(encoded: string): DeckData | null
  export function buildShareUrl(deck: DeckData, origin: string): string
  ```

- [ ] **2.2.2** Use `CompressionStream` API for gzip with `pako` as fallback for SSR
- [ ] **2.2.3** Compact payload format using short keys and `[quantity, name]` tuples
- [ ] **2.2.4** Install `pako` as a dependency: `npm install pako && npm install -D @types/pako`

#### 2.3 Shared Page (`src/app/shared/page.tsx`)

- [ ] **2.3.1** Create `src/app/shared/page.tsx` that reads `searchParams.d`, decodes, displays deck
- [ ] **2.3.2** Reuse `DeckViewTabs` for consistent deck display; trigger enrichment automatically
- [ ] **2.3.3** Show a banner: "Shared deck -- Import your own deck" with a link back to `/`
- [ ] **2.3.4** Handle edge cases: no `d` parameter, URL too long, decode failure

#### 2.4 Share Button in Export Toolbar

- [ ] **2.4.1** Add "Share Link" button to `ExportToolbar`; `data-testid="export-share-button"`
- [ ] **2.4.2** Show generated URL length as a small text indicator

#### 2.5 E2E Tests for Shareable URL (`e2e/shared-page.spec.ts`)

- [ ] **2.5.1** Test: "Shared page renders deck from valid encoded URL parameter"
- [ ] **2.5.2** Test: "Shared page shows error for invalid d parameter"
- [ ] **2.5.3** Test: "Shared page shows error for missing d parameter"
- [ ] **2.5.4** Test: "Shared page triggers enrichment and shows analysis tabs"
- [ ] **2.5.5** Test: "Share button in export toolbar generates valid URL"
- [ ] **2.5.6** Test: "Shared page has link back to home page"

#### 2.6 Fixture Updates

- [ ] **2.6.1** Add `get shareButton()` locator to `DeckPage`
- [ ] **2.6.2** Add `gotoShared(encoded: string)` method

---

### Phase 3: Image Export

#### 3.1 Install `html2canvas`

- [ ] **3.1.1** `npm install html2canvas`
- [ ] **3.1.2** Verify `npm run build` passes

#### 3.2 Unit Tests for Export Image Utility (`tests/unit/export-image.spec.ts`)

- [ ] **3.2.1** Test `captureElementAsBlob()`: returns null for null element, does not throw
- [ ] **3.2.2** Test `downloadBlob()`: creates anchor with correct attributes
- [ ] **3.2.3** Test `sanitizeFilename()`: removes special characters, replaces spaces with hyphens, max 50 chars

#### 3.3 Implement Export Image Utility (`src/lib/export-image.ts`)

- [ ] **3.3.1** Create `src/lib/export-image.ts`:

  ```typescript
  export async function captureElementAsBlob(
    element: HTMLElement,
    options?: { backgroundColor?: string; scale?: number }
  ): Promise<Blob | null>

  export function downloadBlob(blob: Blob, filename: string): void

  export function sanitizeFilename(name: string): string
  ```

- [ ] **3.3.2** `captureElementAsBlob`: wrap `html2canvas()`, `canvas.toBlob()`
- [ ] **3.3.3** `downloadBlob`: create `<a>` with `URL.createObjectURL()`, click, revoke
- [ ] **3.3.4** `sanitizeFilename`: lowercase, replace special chars, max 50 chars

#### 3.4 Analysis Summary Card Component (`src/components/AnalysisSummaryCard.tsx`)

- [ ] **3.4.1** Create `"use client"` component designed for image export (fixed width 600px):
  - Header: Deck name, source, total cards, branding
  - Row 1: Mana curve as text-based mini bars (pure CSS, no Recharts)
  - Row 2: Color distribution as colored dots/bars with counts
  - Row 3: Land base efficiency score with color-coded badge
  - Row 4: Top synergy themes as pills
  - Row 5: Known combos (if any)
  - Footer: branding, export timestamp
- [ ] **3.4.2** Self-contained styling, dark background `bg-slate-900`, no external images
- [ ] **3.4.3** `data-testid="analysis-summary-card"`
- [ ] **3.4.4** Visually hidden by default, rendered off-screen for capture

#### 3.5 Save as Image Button in Export Toolbar

- [ ] **3.5.1** Add "Save as Image" button, disabled when `cardMap` is null; `data-testid="export-image-button"`
- [ ] **3.5.2** On click: capture `AnalysisSummaryCard` as PNG, download
- [ ] **3.5.3** Handle failure: show "Could not generate image" feedback

#### 3.6 E2E Tests for Image Export (`e2e/export-image.spec.ts`)

- [ ] **3.6.1** Test: "Save as Image button visible in export toolbar"
- [ ] **3.6.2** Test: "Save as Image button disabled without card enrichment"
- [ ] **3.6.3** Test: "Save as Image button enabled after enrichment"
- [ ] **3.6.4** Test: "Analysis summary card is rendered in DOM"
- [ ] **3.6.5** Test: "Clicking Save as Image triggers download"

#### 3.7 Fixture Updates

- [ ] **3.7.1** Add `get imageExportButton()` locator to `DeckPage`
- [ ] **3.7.2** Add `get analysisSummaryCard()` locator

---

## Files to Create/Modify

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `src/lib/export-report.ts` | Create | 1 | Markdown, Discord, and JSON report formatters |
| `src/lib/clipboard.ts` | Create | 1 | Clipboard copy utility with fallback |
| `src/components/ExportToolbar.tsx` | Create | 1 | Export toolbar with format selector, copy button |
| `src/components/DeckViewTabs.tsx` | Modify | 1 | Render ExportToolbar below tab bar |
| `tests/unit/export-report.spec.ts` | Create | 1 | Unit tests for all three report formatters |
| `tests/unit/clipboard.spec.ts` | Create | 1 | Unit tests for clipboard utility |
| `e2e/export-toolbar.spec.ts` | Create | 1 | E2E tests for export toolbar UI |
| `e2e/fixtures.ts` | Modify | 1, 2, 3 | Add export-related locators and helpers |
| `src/lib/deck-codec.ts` | Create | 2 | gzip + base64url encode/decode of DeckData |
| `src/app/shared/page.tsx` | Create | 2 | Shared deck viewer page |
| `tests/unit/deck-codec.spec.ts` | Create | 2 | Unit tests for codec roundtrip, size, URL safety |
| `e2e/shared-page.spec.ts` | Create | 2 | E2E tests for /shared page |
| `package.json` | Modify | 2, 3 | Add `pako`, `@types/pako` (Phase 2), `html2canvas` (Phase 3) |
| `src/lib/export-image.ts` | Create | 3 | html2canvas wrapper, download utility |
| `src/components/AnalysisSummaryCard.tsx` | Create | 3 | Compact visual summary for PNG export |
| `tests/unit/export-image.spec.ts` | Create | 3 | Unit tests for image export utilities |
| `e2e/export-image.spec.ts` | Create | 3 | E2E tests for image export flow |

**No changes to**: `src/lib/types.ts`, `src/lib/mana-curve.ts`, `src/lib/color-distribution.ts`, `src/lib/land-base-efficiency.ts`, `src/lib/synergy-engine.ts`, existing API routes, `DeckAnalysis.tsx`, `DeckList.tsx`, `next.config.ts`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Deck with no cardMap (enrichment failed) | Text export includes deck list only, analysis sections omitted; Share URL works (DeckData only); Image export disabled |
| Empty deck (0 cards) | All formatters produce minimal output without crashing; shareable URL is very short; image export shows empty summary |
| Deck name with special characters (`"Jodah's Brew / v2"`) | Markdown escapes correctly; Discord format uses bold; filename sanitized to `jodahs-brew-v2-analysis.png` |
| Clipboard API unavailable (older browser, non-HTTPS) | Fallback to `execCommand("copy")`; if both fail, show "Could not copy" feedback |
| URL exceeds browser limits (~8000 chars) | Show warning "Deck too large to share via URL" instead of generating broken link |
| Corrupted or truncated share URL | `/shared` page shows clear error message, not a crash |
| Share URL from older schema version | `decodeDeckData()` returns null; error page suggests re-importing |
| Discord message > 2000 chars | `formatDiscordReport()` truncates with `...and N more cards` to stay under limit |
| html2canvas fails (CORS, memory, etc.) | `captureElementAsBlob()` returns null; UI shows "Could not generate image" |
| DFC/split cards with `//` in name | All formatters handle correctly; filename sanitizer strips `//` |
| Very long deck name (100+ chars) | Markdown uses full name; Discord truncates at 50 chars; filename truncated at 50 chars |
| User clicks Copy rapidly | Copy button disabled during "Copied!" feedback period |
| `CompressionStream` not available (Node.js SSR) | `pako` fallback used for gzip |
| Shared page without enrichment API available | Deck list displays immediately; analysis tabs disabled until enrichment succeeds |

## E2E User Scenarios

1. **Markdown export flow**: User imports deck -> enrichment completes -> clicks "Copy Report" with Markdown selected -> pastes into Discord -> sees formatted analysis with headers, mana curve, efficiency score
2. **Discord-friendly export**: User selects "Discord" format -> clicks "Copy Report" -> pastes into Discord channel -> compact message under 2000 chars with emoji indicators and bold deck name
3. **JSON export for tooling**: User selects "JSON" -> copies -> pastes into a script -> parses successfully -> accesses mana curve array, efficiency score, theme list
4. **Share URL roundtrip**: User clicks "Share Link" -> "Link Copied!" feedback -> sends URL to friend -> friend opens URL -> sees same deck with full analysis (after enrichment)
5. **Invalid share URL**: User modifies the `d=` parameter -> opens URL -> sees "Invalid or corrupted share link" error
6. **Image download**: User clicks "Save as Image" -> brief "Generating..." state -> PNG downloads -> opens PNG -> sees dark-themed analysis summary card
7. **Export without enrichment**: User imports deck but enrichment is slow -> export toolbar is visible -> "Copy Report" works but outputs deck list only -> "Save as Image" is disabled -> Share Link works
8. **Tab switching preserves export state**: User switches between tabs -> export toolbar remains visible and functional -> format selection persists

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/export-report.spec.ts` -- all unit tests pass
2. `npx playwright test --config playwright.unit.config.ts tests/unit/clipboard.spec.ts` -- all unit tests pass
3. `npx playwright test --config playwright.unit.config.ts tests/unit/deck-codec.spec.ts` -- all unit tests pass
4. `npx playwright test --config playwright.unit.config.ts tests/unit/export-image.spec.ts` -- all unit tests pass
5. `npx playwright test e2e/export-toolbar.spec.ts` -- all E2E tests pass
6. `npx playwright test e2e/shared-page.spec.ts` -- all E2E tests pass
7. `npx playwright test e2e/export-image.spec.ts` -- all E2E tests pass
8. `npm test` -- full suite green
9. `npm run build` -- no TypeScript errors
10. Manual Phase 1: Import deck -> export as Markdown -> paste in editor -> verify formatting -> export as Discord -> paste -> verify compact format -> export as JSON -> validate with `JSON.parse()`
11. Manual Phase 2: Click "Share Link" -> open URL in incognito -> deck loads -> enrichment runs -> analysis tabs work
12. Manual Phase 3: Click "Save as Image" -> PNG downloads -> open -> verify dark-themed summary with all key metrics visible
