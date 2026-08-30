import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default defineConfig([
  ...compat.config(nextVitals),
  ...compat.config(nextTs),
  globalIgnores([".next/**", "next-env.d.ts", "tsconfig.tsbuildinfo"]),
  {
    // /keystatic is een client-side SPA achter één catch-all route; een gewone
    // <a> naar dat pad geeft daar bewust een volledige paginalaad in plaats van
    // een client-navigatie.
    files: ["src/components/beheer/**/*.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);
