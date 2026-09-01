import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Ver src/test/server-only-stub.ts: a proteção vale no build, não aqui.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
