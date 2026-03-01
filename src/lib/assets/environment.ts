import { V1EnvVar } from "@kubernetes/client-node";
import { ModuleConfig } from "../types";

export function getLogLevel(config: ModuleConfig): string {
  const fromEnv = process.env.LOG_LEVEL;
  if (fromEnv) {
    return fromEnv;
  }
  return config.logLevel || "info";
}
export function genEnv(
  config: ModuleConfig,
  watchMode = false,
  ignoreWatchMode = false,
): V1EnvVar[] {
  const noWatchDef = {
    PEPR_PRETTY_LOG: "false",
    LOG_LEVEL: getLogLevel(config),
  };

  const def = {
    PEPR_WATCH_MODE: watchMode ? "true" : "false",
    ...noWatchDef,
  };

  // Clone config.env so we don't mutate the caller's object. The delete
  // prevents a user-supplied PEPR_WATCH_MODE from overriding the programmatic
  // value set via the watchMode parameter.
  const cfg = { ...(config.env || {}) };
  delete cfg["PEPR_WATCH_MODE"];
  return ignoreWatchMode
    ? Object.entries({ ...noWatchDef, ...cfg }).map(([name, value]) => ({ name, value }))
    : Object.entries({ ...def, ...cfg }).map(([name, value]) => ({ name, value }));
}
