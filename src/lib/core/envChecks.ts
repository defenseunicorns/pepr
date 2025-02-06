export const isWatchMode = (): boolean => process.env.PEPR_WATCH_MODE === "true";
// Track if Pepr is running in build mode

export const isBuildMode = (): boolean => process.env.PEPR_MODE === "build";

export const isDevMode = (): boolean => process.env.PEPR_MODE === "dev";
