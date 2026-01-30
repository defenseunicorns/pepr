import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: {
    include: ["integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "dist", "coverage", "integration/cluster/**"],
    environment: "node",
    testTimeout: 1200000,
    hookTimeout: 900000,
    teardownTimeout: 120000,
    typecheck: {
      tsconfig: path.resolve(__dirname, "./tsconfig.integration.json"),
    },
  },
});
