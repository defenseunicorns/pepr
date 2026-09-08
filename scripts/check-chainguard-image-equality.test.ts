// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026-Present The Pepr Authors

import { describe, expect, it } from "vitest";

import {
  assertMatchingChainguardImages,
  chainguardImageRoles,
} from "./check-chainguard-image-equality.js";

const buildImage =
  "cgr.dev/defenseunicorns.com/node:26-dev@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const runtimeImage =
  "cgr.dev/defenseunicorns.com/node:26-slim@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("chainguardImageRoles", () => {
  it("returns literal Chainguard image references keyed by stage alias", () => {
    expect(
      chainguardImageRoles(
        `FROM ${runtimeImage} AS runtime-image\nFROM ${buildImage} AS build-image\nFROM build-image AS test`,
      ),
    ).toEqual({ "build-image": buildImage, "runtime-image": runtimeImage });
  });

  it("does not treat an ARG-indirected image as a Dependabot-managed reference", () => {
    expect(
      chainguardImageRoles("ARG IMAGE=cgr.dev/defenseunicorns.com/node@sha256:abc\nFROM ${IMAGE}"),
    ).toEqual({});
  });
});

describe("assertMatchingChainguardImages", () => {
  it("accepts matching references regardless of declaration order", () => {
    expect(() =>
      assertMatchingChainguardImages(
        `FROM ${buildImage} AS build-image\nFROM ${runtimeImage} AS base-image`,
        `FROM ${runtimeImage} AS base-image\nFROM ${buildImage} AS build-image`,
      ),
    ).not.toThrow();
  });

  it("rejects a missing or changed Chainguard role", () => {
    expect(() =>
      assertMatchingChainguardImages(
        `FROM ${buildImage} AS build-image\nFROM ${runtimeImage} AS base-image`,
        `FROM ${buildImage} AS build-image`,
      ),
    ).toThrow("Chainguard image roles differ");
  });

  it("rejects swapped image roles", () => {
    expect(() =>
      assertMatchingChainguardImages(
        `FROM ${buildImage} AS build-image\nFROM ${runtimeImage} AS base-image`,
        `FROM ${runtimeImage} AS build-image\nFROM ${buildImage} AS base-image`,
      ),
    ).toThrow("Chainguard image roles differ");
  });
});
