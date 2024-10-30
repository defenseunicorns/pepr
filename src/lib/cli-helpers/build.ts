// determineRbacMode determines the RBAC mode to use based on the cli and the module's config
export function determineRbacMode(opts: { rbacMode?: string }, cfg: { pepr: { rbacMode?: string } }): string {
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
