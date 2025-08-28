// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { featureFlagStore } from "../../lib/features/store";
import Log from "../../lib/telemetry/logger";
import { FeatureFlags } from "../../lib/features/FeatureFlags";

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
      const referenceFlag = featureFlagStore.get<string>(FeatureFlags.REFERENCE_FLAG.key);

      Log.info(`Feature flags status (${JSON.stringify(featureFlagStore.getAll())}) :`);
      Log.info(`- reference flag : ${referenceFlag}`);

      if (referenceFlag) {
        Log.info("A feature flag is set!");
      }
    });
}
