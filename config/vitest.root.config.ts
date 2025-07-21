import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "hack/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "pepr/**",
      "src/templates/**",
      "coverage",
      "src/build-artifact.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/build-artifact.test.ts",
        "node_modules",
        "dist",
        "src/build-artifact.test.ts",
        "pepr/**",
        "src/templates/**",
        "coverage",
      ],
    },

    hookTimeout: 10000,
  },
});
