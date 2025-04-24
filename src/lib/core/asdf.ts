import { resolveIgnoreNamespaces } from "../assets/webhooks";
import { ControllerHooks } from "../controller";
import { setupWatch } from "../processors/watch-processor";
import Log from "../telemetry/logger";
import { PeprModuleOptions } from "../types";
import { Capability } from "./capability";
import { isWatchMode, isDevMode } from "./envChecks";

/**
 * Creates controller hooks with proper handling of watch setup
 * Extracted to a separate method for better testability
 *
 * @param opts Module options including hooks
 * @param capabilities List of capabilities
 * @param ignoreNamespaces Namespaces to ignore
 * @returns Controller hooks configuration
 */
export function createControllerHooks(
  opts: PeprModuleOptions,
  capabilities: Capability[],
  ignoreNamespaces: string[] = [],
): ControllerHooks {
  return {
    beforeHook: opts.beforeHook,
    afterHook: opts.afterHook,
    onReady: async (): Promise<void> => {
      // Wait for the controller to be ready before setting up watches
      if (isWatchMode() || isDevMode()) {
        try {
          setupWatch(capabilities, resolveIgnoreNamespaces(ignoreNamespaces));
        } catch (e) {
          Log.error(e, "Error setting up watch");
          // Throw error instead of exiting process for better testability
          throw new Error(`Failed to set up watch: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    },
  };
}
