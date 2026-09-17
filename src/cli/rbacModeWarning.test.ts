// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, vi } from "vitest";
import Log from "../lib/telemetry/logger";
import { ADMIN_RBAC_WARNING, warnIfAdminRbac } from "./rbacModeWarning";

vi.mock("../lib/telemetry/logger", () => ({
  default: { warn: vi.fn() },
}));

describe("warnIfAdminRbac", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, "admin", "unknown"])("warns for non-scoped RBAC mode %s", rbacMode => {
    warnIfAdminRbac(rbacMode);

    expect(Log.warn).toHaveBeenCalledExactlyOnceWith(ADMIN_RBAC_WARNING);
  });

  it("does not warn for scoped RBAC mode", () => {
    warnIfAdminRbac("scoped");

    expect(Log.warn).not.toHaveBeenCalled();
  });

  it("describes the risk, production restriction, scoped alternative, and documentation", () => {
    expect(ADMIN_RBAC_WARNING).toContain("broad cluster-wide permissions");
    expect(ADMIN_RBAC_WARNING).toContain("should NOT be used in production");
    expect(ADMIN_RBAC_WARNING).toContain("Use scoped RBAC mode");
    expect(ADMIN_RBAC_WARNING).toContain("https://docs.pepr.dev/user-guide/rbac/");
  });
});
