import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default defineConfig([
  ...compat.config(nextVitals),
  ...compat.config(nextTs),
  globalIgnores([".next/**", "next-env.d.ts", "tsconfig.tsbuildinfo"]),
]);
