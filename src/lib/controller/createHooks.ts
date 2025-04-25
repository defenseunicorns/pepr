import { ControllerHooks } from ".";
import { resolveIgnoreNamespaces } from "../assets/webhooks";
import { Capability } from "../core/capability";
import { isWatchMode, isDevMode } from "../core/envChecks";
import { setupWatch } from "../processors/watch-processor";
import { PeprModuleOptions } from "../types";

/**
 * Creates controller hooks with proper handling of watch setup
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
      if (isWatchMode() || isDevMode()) {
        try {
          setupWatch(capabilities, resolveIgnoreNamespaces(ignoreNamespaces));
        } catch (error) {
          throw new Error(`WatchError: Could not set up watch.`, { cause: error });
        }
      }
    },
  };
}
