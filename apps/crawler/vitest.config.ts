import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          globals: true,
          testTimeout: 120000,
          hookTimeout: 60000,
          include: ["src/**/*.test.ts"],
          setupFiles: ["./tests/unit-setup.ts"],
        },
      },
      {
        test: {
          name: "e2e",
          globals: true,
          testTimeout: 120000,
          hookTimeout: 180000,
          include: ["tests/**/*.test.ts"],
          setupFiles: ["./tests/setup.ts"],
          globalSetup: ["./tests/e2e/global-setup.ts"],
          fileParallelism: false,
          pool: "forks",
          maxWorkers: 1,
        },
      },
    ],
  },
});
