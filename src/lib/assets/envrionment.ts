import { V1EnvVar } from "@kubernetes/client-node";
import { ModuleConfig } from "../types";

export function genEnv(
  config: ModuleConfig,
  watchMode = false,
  ignoreWatchMode = false,
): V1EnvVar[] {
  const noWatchDef = {
    PEPR_PRETTY_LOG: "false",
    LOG_LEVEL: config.logLevel || "info",
  };

  const def = {
    PEPR_WATCH_MODE: watchMode ? "true" : "false",
    ...noWatchDef,
  };

  if (config.env && config.env["PEPR_WATCH_MODE"]) {
    delete config.env["PEPR_WATCH_MODE"];
  }
  const cfg = config.env || {};
  return ignoreWatchMode
    ? Object.entries({ ...noWatchDef, ...cfg }).map(([name, value]) => ({ name, value }))
    : Object.entries({ ...def, ...cfg }).map(([name, value]) => ({ name, value }));
}
