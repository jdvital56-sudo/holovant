import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/..." aliases the app imports with, so tests exercise the
    // same module graph the app does rather than a re-wired copy of it.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
