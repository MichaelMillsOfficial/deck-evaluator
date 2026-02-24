# Run tests and report results

Run the project test suite and report results. Scope: $ARGUMENTS

## Test commands

Based on the scope requested:

- **"all"** or empty → `npm test` (runs both unit and e2e)
- **"unit"** → `npm run test:unit` (fast, no dev server needed)
- **"e2e"** → `npm run test:e2e` (requires dev server, runs browser tests)
- **A specific file** → use the appropriate config:
  - Unit: `npx playwright test --config playwright.unit.config.ts tests/unit/<file>.spec.ts`
  - E2e: `npx playwright test --config playwright.config.ts e2e/<file>.spec.ts`

## After running

1. Report the total pass/fail counts
2. For any failures, show the test name and the assertion that failed
3. If tests fail, read the relevant source file and test file to diagnose the root cause
4. Suggest specific fixes for each failure

## Important notes

- Unit tests (`tests/unit/`) import from `@playwright/test` and use `../../src/lib/` paths
- E2e tests (`e2e/`) import `test`/`expect` from `./fixtures` and use the `deckPage` fixture
- E2e tests require the dev server (started automatically by playwright config)
- Never modify test files to make them pass — fix the source code instead
