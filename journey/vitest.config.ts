import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["journey/**/*.test.ts"],
    exclude: ["node_modules", "dist", "coverage"],
    environment: "node",
  },
});
