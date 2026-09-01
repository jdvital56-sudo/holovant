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
    /**
     * One file at a time.
     *
     * Several suites point the app at a temporary vault by setting an
     * environment variable and clearing it afterwards. Vitest runs files in
     * parallel worker threads, and threads of one process share `process.env`
     * — so one suite's cleanup wiped the path another was in the middle of
     * using, and its writes went to a different file than its reads. Every one
     * of those files passes alone and five of them failed together, which is
     * the worst way for a test to be wrong.
     */
    fileParallelism: false,
  },
});
