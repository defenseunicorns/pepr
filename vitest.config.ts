import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [
      "node_modules", 
      "dist", 
      "src/cli/docs/**", 
      "pepr/**", 
      "src/templates/**",
      "coverage"
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
        "src/cli/docs/**", 
        "pepr/**", 
        "src/templates/**",
        "coverage"
      ]
    },

    hookTimeout: 10000,
  },
});
