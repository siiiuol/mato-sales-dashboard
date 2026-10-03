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
    // Build output of `vercel deploy` from this machine. Het staat vol
    // gegenereerde CommonJS-launchers, dus wie lokaal deployt en daarna lint
    // kreeg fouten over code die hij niet geschreven heeft.
    ".vercel/**",
  ]),
]);

export default eslintConfig;
