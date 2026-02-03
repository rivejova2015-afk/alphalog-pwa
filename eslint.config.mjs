import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated assets / reports
    "public/**",
    "playwright-report/**",
    "test-results/**",
    // Ignore Supabase Edge Functions (Deno runtime, not Node/Next lint target)
    "supabase/functions/**",
    // Ignore legacy reference exports not part of active app
    "reference/**",
  ]),
  // Allow CommonJS require in config and JS runtime files
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Disable react rules in test fixtures
  {
    files: ["tests/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Legacy-heavy areas: allow explicit any to reduce migration lint noise
  {
    files: [
      "src/app/api/**",
      "src/lib/alphacore/**",
      "src/lib/business/**",
      "src/lib/dashboard/**",
      "src/lib/treasury/**",
      "src/components/**",
      "src/hooks/**",
      "tests/e2e/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // UI layers: relax hook dependency linting and unused vars for legacy components
  {
    files: ["src/app/**", "src/components/**", "src/hooks/**"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Allow require in specific TS server utility files
  {
    files: ["src/lib/supabaseServer.ts", "src/lib/supabase/server.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
