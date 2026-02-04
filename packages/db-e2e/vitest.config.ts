import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 600000, // 10 minutes for scraping
    hookTimeout: 120000, // 2 minutes for setup/teardown
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
  },
});
