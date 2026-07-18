import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next (widened to any depth so that
    // nested checkouts, e.g. agent worktrees, are covered too):
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // Generated test output:
    "**/test-results/**",
    "**/playwright-report/**",
    "**/blob-report/**",
    "**/coverage/**",
    // Tooling state and nested agent worktrees:
    ".claude/**",
    ".claire/**",
  ]),
]);

export default eslintConfig;
