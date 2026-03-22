# Epic 3.3: Full Export & Share Suite

## Context

Complete the export story with PNG summary card generation (server-side via Satori + resvg), enhanced share URLs with analysis summary, and JSON export with interaction/goldfish data. Builds on existing Discord export and share URL infrastructure.

**Dependencies**: Epic 3.1 (interaction data for export), Epic 3.2 (goldfish data for export). Existing: export-report.ts, deck-codec.ts.

## Implementation Tasks

### Share Analysis Summary
- [ ] Create `src/lib/share-analysis-summary.ts` with `buildShareSummary()` function
- [ ] Define ShareAnalysisSummary: pl, br, avg, kr, themes[], combos, budget
- [ ] Compact encoding (~200 bytes pre-compression)
- [ ] Write `tests/unit/share-analysis-summary.spec.ts` — round-trip encoding/decoding, edge cases

### Share URL v3 Payload
- [ ] Add CompactDeckPayloadV3 to `src/lib/deck-codec.ts` extending v2 with optional `a?: ShareAnalysisSummary`
- [ ] Add `encodeSharePayloadV3()` and backward-compatible decode in `deserializePayload()`
- [ ] Verify URL length stays under 2000 chars (current v2 is 1000-1500, adding ~200 bytes)
- [ ] Fallback: omit summary if URL exceeds 1800 chars

### JSON Export Enhancement
- [ ] Extend `formatJsonReport()` in `src/lib/export-report.ts` with interactions and goldfish sections
- [ ] Interactions: totalCount, byType, chains, loops, topCards with centrality
- [ ] Goldfish: avgManaByTurn, commanderCastRate, avgCommanderTurn, rampAcceleration
- [ ] Exclude prices from default export (opt-in only)

### Server-Side PNG Generation
- [ ] Create `src/app/api/export-image/route.ts` — POST accepting analysis JSON, returns PNG blob
- [ ] Use Satori (JSX → SVG) + @resvg/resvg-wasm (SVG → PNG) server-side
- [ ] Initialize WASM module once, keep in module-scope variable
- [ ] LRU cache (Map, max 50 entries) keyed by analysis summary hash
- [ ] Bundle single woff2 font file for Satori text rendering

### Summary Card Component
- [ ] Create `src/components/AnalysisSummaryCard.tsx` — Satori-compatible JSX (flexbox only, no grid/transforms)
- [ ] Layout (600x450px): deck name + commander, mana curve as CSS bars, color pie, key stats, synergy themes, known combos, export timestamp
- [ ] Use inline hex colors (not Tailwind classes) for Satori compatibility
- [ ] No external images (Scryfall CDN has CORS issues in Satori context)
- [ ] System font stack for guaranteed rendering

### Client-Side Integration
- [ ] Create `src/lib/export-image.ts` — client API call to /api/export-image
- [ ] Add "Save as Image" button to ExportToolbar with state transitions: idle → generating → saved/failed
- [ ] aria-live="assertive" for status announcements
- [ ] Update `src/app/shared/page.tsx` to detect v3 payload and display summary immediately

### Accessibility
- [ ] Export format pills: role="group" with aria-label="Export format", aria-pressed per pill
- [ ] PNG download: announce "Deck analysis image downloaded" via aria-live region
- [ ] Keyboard: Tab order flows format pills → Copy Report → Share Link → Save as Image
- [ ] All buttons are <button type="button">, never <a> anchors

### E2E Tests
- [ ] Create `e2e/export-full.spec.ts`
- [ ] P0: PNG export triggers download with valid .png file
- [ ] P0: Share URL encodes analysis data (clipboard contains URL with payload)
- [ ] P0: Share URL recipient sees analysis without re-enriching (block /api/deck-enrich)
- [ ] P1: JSON export produces valid structure with required keys
- [ ] P2: PNG has valid dimensions (>= 600x400)
- [ ] Add page object methods: pngExportButton, jsonExportButton, shareUrlButton

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `src/lib/share-analysis-summary.ts` | Summary builder |
| Create | `src/lib/export-image.ts` | Client API call |
| Create | `src/components/AnalysisSummaryCard.tsx` | Summary card JSX |
| Create | `src/app/api/export-image/route.ts` | Server-side PNG route |
| Create | `tests/unit/share-analysis-summary.spec.ts` | Unit tests |
| Create | `e2e/export-full.spec.ts` | E2E tests |
| Modify | `src/lib/deck-codec.ts` | v3 payload |
| Modify | `src/lib/export-report.ts` | JSON enhancement |
| Modify | `src/components/ExportToolbar.tsx` | Save as Image button |
| Modify | `src/app/shared/page.tsx` | v3 payload display |
| Modify | `package.json` | satori, @resvg/resvg-wasm |

## Verification

1. `npm run test:unit` — share summary tests pass
2. `npm run test:e2e` — export tests pass
3. Manual: Import deck → enrichment complete → "Save as Image" → PNG downloads → "Share Link" → open in new tab → summary shows immediately
