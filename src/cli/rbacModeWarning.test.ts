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

  it.each([
    { rbacMode: undefined, expectedWarnings: [ADMIN_RBAC_WARNING] },
    { rbacMode: "admin", expectedWarnings: [ADMIN_RBAC_WARNING] },
    { rbacMode: "unknown", expectedWarnings: [ADMIN_RBAC_WARNING] },
    { rbacMode: "scoped", expectedWarnings: [] },
  ])("warns appropriately for RBAC mode $rbacMode", ({ rbacMode, expectedWarnings }) => {
    warnIfAdminRbac(rbacMode);

    expect(vi.mocked(Log.warn).mock.calls.flat()).toEqual(expectedWarnings);
  });

  it.each([
    "broad cluster-wide permissions",
    "should NOT be used in production",
    "Use scoped RBAC mode",
    "https://docs.pepr.dev/user-guide/rbac/",
  ])("includes %s", expectedText => expect(ADMIN_RBAC_WARNING).toContain(expectedText));
});
