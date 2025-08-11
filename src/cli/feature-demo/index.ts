// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { featureStore } from "../../lib/features/store";
import Log from "../../lib/telemetry/logger";

/**
 * Demonstrates how to use feature flags in Pepr CLI commands
 *
 * @param program The Commander program instance
 */
export default function (program: Command): void {
  program
    .command("feature-demo")
    .description("Demonstrates how to use feature flags in Pepr")
    .action(async () => {
      // Access global feature flags
      const experimentalMode = featureStore.get<boolean>("experimental", false);
      const debugLevel = featureStore.get<number>("debugLevel", 0);
      const mode = featureStore.get<string>("mode", "standard");
      const demo = featureStore.get<string>("demo", "standard");

      // Use the feature flags to control behavior
      Log.info(`Feature flags status ():`);
      Log.info(`- experimental mode: ${experimentalMode}`);
      Log.info(`- debug level: ${debugLevel}`);
      Log.info(`- mode: ${mode}`);
      Log.info(`- demo: ${demo}`);

      // Conditional logic based on feature flags
      if (experimentalMode) {
        Log.info("🧪 Experimental mode is enabled! Showing experimental features...");
        // Implementation of experimental features would go here
      }

      if (debugLevel > 0) {
        Log.info(`🐛 Debug level ${debugLevel} activated. Showing debug information...`);
        // Log additional debug information based on debug level
        Log.info(`All active features: ${featureStore.debug()}`);
      }

      // Demonstrate different behaviors based on mode
      switch (mode) {
        case "advanced":
          Log.info("🚀 Advanced mode activated with additional capabilities");
          break;
        case "safe":
          Log.info("🔒 Safe mode activated with restricted operations");
          break;
        case "compatibility":
          Log.info("🔄 Compatibility mode enabled for older systems");
          break;
        default:
          Log.info("📊 Standard mode active");
      }
    });
}
