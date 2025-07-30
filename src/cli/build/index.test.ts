// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import build from ".";
import { it, expect, beforeEach, describe, vi } from "vitest";
import { BuildContext, BuildOptions } from "esbuild";
import { BuildModuleReturn } from "./buildModule";

vi.mock("./buildModule", async () => {
  return {
    buildModule: vi.fn().mockResolvedValue({
      path: "some/path",
      uuid: "some-uuid",
      ctx: {} as BuildContext<BuildOptions>,
      cfg: {
        description: "some description",
        version: "some version",
        pepr: {
          uuid: "some-uuid",
          peprVersion: "some version",
          includedFiles: [],
          alwaysIgnore: {
            namespaces: [],
          },
          webhookTimeout: 30,
          rbacMode: "admin",
        },
      },
    }),
  } as unknown as BuildModuleReturn;
});

describe("build CLI command", () => {
  const program = new Command();

  beforeEach(() => {
    vi.clearAllMocks();
    build(program);
  });

  it("should call the Build command", async () => {
    program.parseAsync(["build"], { from: "user" });
    expect(build).toBeCalled();
  });
});

// --custom-image AND --registry
// --custom-image AND --registry-info
// --registry AND --registry-info
// -I is not in "registry/username" format, can we validate it in .option()?
// -M is not "admin" or "scoped"
// -P Can we validate in .option()? Or do earlier in the .action()?
// When image is not ""
// When timeout it less than 0 or more than 30 seconds (see src/lib/helpers:parseTimeout())
// When validImagePullSecret passes/fails
// With and without -n for embed flag (log or not)
// Needs package.json AND pepr.ts (entrypoint)

// Mock  buildModule()
// Mock Assets()
// Mock assignImage()
// Mock generateYamlAndWriteToDisk()
// Mock handleCustomImageBuild()
// Mock handleValidCapabilityNames()

// Entrypoint validation for non-file input? E.g., a directory -> Could have nicer error handling, not critical
// Probably don't want to use PEPR_CUSTOM_BUILD_NAME envar
// Use Log for logging instead of console
