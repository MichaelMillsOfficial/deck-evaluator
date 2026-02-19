# Setup Playwright E2E Tests

## Context

The project currently has no test framework. We need to establish a Playwright-based E2E testing foundation that supports TDD workflows for future feature development. The focus is on functional user flow tests — verifying that the application works correctly from a user's perspective — not asserting styling or visual appearance.

The test suite should cover the core user flows: importing decklists via text input, tab navigation, loading/error states, and deck display. It should also provide patterns that are easy to extend as new features are added.

## Implementation Tasks

- [x] Install Playwright and required dependencies
- [x] Create `playwright.config.ts` with Next.js webServer integration
- [x] Add npm scripts for running tests (`test`, `test:ui`, `test:headed`)
- [x] Create test fixtures/helpers for common operations (e.g. navigating to page, submitting a decklist)
- [x] Write E2E tests for deck import via manual text input (happy path)
- [x] Write E2E tests for tab switching between Manual/Moxfield/Archidekt
- [x] Write E2E tests for "Load Example" button functionality
- [x] Write E2E tests for error states (empty submit, invalid decklist)
- [x] Write E2E tests for deck display after successful parse
- [x] Write API route tests for POST /api/deck-parse
- [x] Update .gitignore for Playwright artifacts
- [x] Verify all tests pass

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Modify — add Playwright dev dependency + test scripts |
| `playwright.config.ts` | Create — Playwright configuration with Next.js webServer |
| `e2e/fixtures.ts` | Create — shared test fixtures and helpers |
| `e2e/deck-import.spec.ts` | Create — manual decklist import user flow tests |
| `e2e/tab-navigation.spec.ts` | Create — tab switching and form state tests |
| `e2e/deck-display.spec.ts` | Create — deck rendering after successful import |
| `e2e/api-deck-parse.spec.ts` | Create — API route functional tests |
| `.gitignore` | Modify — add Playwright artifacts |

## Verification

1. Run `npx playwright test` — all tests should pass
2. Run `npx playwright test --ui` — interactive UI should launch
3. Tests should start the Next.js dev server automatically via webServer config
4. Adding a new test file to `e2e/` should be picked up automatically
