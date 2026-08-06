import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // e2e/*.spec.ts are Playwright specs (run via `npm run test:e2e`), not
    // Vitest tests — they import from @playwright/test, which Vitest can't
    // execute, so they must be excluded from Vitest's own discovery.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
