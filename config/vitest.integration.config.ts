import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: {
    include: ["integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "dist", "coverage", "integration/cluster/**"],
    environment: "node",
    typecheck: {
      tsconfig: path.resolve(__dirname, "./tsconfig.integration.json"),
    },
  },
});
