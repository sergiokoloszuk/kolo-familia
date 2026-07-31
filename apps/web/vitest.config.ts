import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      // Os scripts da BIA vivem fora de apps/web (são CLI, não app), mas o
      // chunker classifica o acervo inteiro — errar ali é errar em silêncio.
      // Rodam com `npm test` junto do resto.
      "../../scripts/**/*.test.mjs",
    ],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
