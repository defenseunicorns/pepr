// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "../lib/telemetry/logger";

export const ADMIN_RBAC_WARNING =
  "Admin RBAC mode grants broad cluster-wide permissions. It is intended for demo/POC purposes " +
  "only and should NOT be used in production. Use scoped RBAC mode for production workloads. " +
  "See https://docs.pepr.dev/user-guide/rbac/ for more details.";

export function warnIfAdminRbac(rbacMode?: string): void {
  if (rbacMode !== "scoped") {
    Log.warn(ADMIN_RBAC_WARNING);
  }
}
