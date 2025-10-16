import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    include: ["docs/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "pepr/**",
      "src/templates/**",
      "coverage",
      "src/build-artifact.test.ts",
    ],
    hookTimeout: 30000,
  },
});
