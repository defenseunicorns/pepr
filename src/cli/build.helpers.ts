/**
 * Determine the RBAC mode based on the CLI options and the module's config
 * @param opts CLI options
 * @param cfg Module's config
 * @returns The determined RBAC mode
 * @example
 * const opts = { rbacMode: "admin" };
 * const cfg = { pepr: { rbacMode: "scoped" } };
 * const result = determineRbacMode(opts, cfg);
 * console.log(result); // "admin"
 */
export function determineRbacMode(
  opts: { rbacMode?: string },
  cfg: { pepr: { rbacMode?: string } },
): string {
  // CLI overrides the module's config
  if (opts.rbacMode) {
    return opts.rbacMode;
  }

  // if rbacMode is defined and not scoped, return admin
  if (cfg.pepr.rbacMode && cfg.pepr.rbacMode !== "scoped") {
    return "admin";
  }

  // if nothing is defined return admin, else return scoped
  return cfg.pepr.rbacMode || "admin";
}
