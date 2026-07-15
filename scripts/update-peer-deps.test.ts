// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect } from "vitest";

import {
  majorOf,
  applyRangePrefix,
  classifyBumps,
  reportToMatrixInclude,
  pickUpdates,
  pickBranchAndTitle,
  diffPeerDeps,
  renderPrBody,
} from "./update-peer-deps.mjs";

describe("majorOf", () => {
  it.each([
    { version: "1.2.3", expected: 1 },
    { version: "0.25.10", expected: 0 },
    { version: "2.0.0-beta.1", expected: 2 },
    { version: "^1.2.3", expected: 1 },
    { version: "~3.6.2", expected: 3 },
    { version: ">=4.0.0", expected: 4 },
  ])("returns $expected for $version", ({ version, expected }) => {
    expect(majorOf(version)).toBe(expected);
  });

  it.each(["", "not-a-version", "abc.def.ghi"])("throws for unparseable version %j", version => {
    expect(() => majorOf(version)).toThrow(/unparseable version/);
  });
});

describe("applyRangePrefix", () => {
  it.each([
    { currentSpec: "^1.0.0", newBare: "2.0.0", expected: "^2.0.0" },
    { currentSpec: "~1.0.0", newBare: "1.1.0", expected: "~1.1.0" },
    { currentSpec: ">=1.0.0", newBare: "2.0.0", expected: ">=2.0.0" },
    { currentSpec: "<=1.0.0", newBare: "0.9.0", expected: "<=0.9.0" },
    { currentSpec: "1.0.0", newBare: "2.0.0", expected: "2.0.0" },
  ])("$currentSpec + $newBare → $expected", ({ currentSpec, newBare, expected }) => {
    expect(applyRangePrefix(currentSpec, newBare)).toBe(expected);
  });
});

describe("classifyBumps", () => {
  it("classifies a minor bump", () => {
    const result = classifyBumps({ foo: "~1.0.0" }, { foo: "1.1.0" });
    expect(result.minor).toEqual({ foo: { from: "~1.0.0", to: "~1.1.0" } });
    expect(result.major).toEqual([]);
  });

  it("classifies a major bump", () => {
    const result = classifyBumps({ foo: "^1.0.0" }, { foo: "2.0.0" });
    expect(result.minor).toEqual({});
    expect(result.major).toEqual([{ name: "foo", from: "^1.0.0", to: "^2.0.0" }]);
  });

  it("skips a version already satisfied by the current range", () => {
    const result = classifyBumps({ foo: "^1.0.0" }, { foo: "1.0.5" });
    expect(result.minor).toEqual({});
    expect(result.major).toEqual([]);
  });

  it("skips a package absent from the latest map", () => {
    const result = classifyBumps({ foo: "^1.0.0" }, {});
    expect(result.minor).toEqual({});
    expect(result.major).toEqual([]);
  });

  it("handles a mix of minor and major bumps", () => {
    const peers = { foo: "~1.0.0", bar: "^2.0.0", baz: "^3.0.0" };
    const latest = { foo: "1.2.0", bar: "3.0.0", baz: "3.0.5" };
    const result = classifyBumps(peers, latest);
    expect(Object.keys(result.minor)).toContain("foo");
    expect(result.major.map(m => m.name)).toContain("bar");
    expect(Object.keys(result.minor)).not.toContain("baz");
    expect(result.major.map(m => m.name)).not.toContain("baz");
  });
});

describe("reportToMatrixInclude", () => {
  it("returns empty array when there are no bumps", () => {
    expect(reportToMatrixInclude({ minor: {}, major: [] })).toEqual([]);
  });

  it("returns a single minor entry when there are only minor bumps", () => {
    const report = { minor: { foo: { from: "^1.0.0", to: "^1.1.0" } }, major: [] };
    expect(reportToMatrixInclude(report)).toEqual([{ kind: "minor", pkg: "" }]);
  });

  it("returns one major entry per major bump", () => {
    const report = {
      minor: {},
      major: [
        { name: "foo", from: "^1.0.0", to: "^2.0.0" },
        { name: "bar", from: "^2.0.0", to: "^3.0.0" },
      ],
    };
    expect(reportToMatrixInclude(report)).toEqual([
      { kind: "major", pkg: "foo" },
      { kind: "major", pkg: "bar" },
    ]);
  });

  it("returns minor entry first when both minor and major bumps exist", () => {
    const report = {
      minor: { baz: { from: "^1.0.0", to: "^1.1.0" } },
      major: [{ name: "foo", from: "^1.0.0", to: "^2.0.0" }],
    };
    const include = reportToMatrixInclude(report);
    expect(include[0]).toEqual({ kind: "minor", pkg: "" });
    expect(include[1]).toEqual({ kind: "major", pkg: "foo" });
  });
});

describe("pickUpdates", () => {
  const report = {
    minor: {
      foo: { from: "^1.0.0", to: "^1.1.0" },
      bar: { from: "~2.0.0", to: "~2.1.0" },
    },
    major: [{ name: "baz", from: "^1.0.0", to: "^2.0.0" }],
  };

  it("returns all minor updates when kind is minor", () => {
    const updates = pickUpdates(report, { kind: "minor" });
    expect(updates).toHaveLength(2);
    expect(updates.map(u => u.name)).toContain("foo");
    expect(updates.map(u => u.name)).toContain("bar");
  });

  it("returns the single named package when kind is major and pkg exists", () => {
    const updates = pickUpdates(report, { kind: "major", pkg: "baz" });
    expect(updates).toEqual([{ name: "baz", from: "^1.0.0", to: "^2.0.0" }]);
  });

  it("returns empty array when kind is major and pkg is not in report", () => {
    const updates = pickUpdates(report, { kind: "major", pkg: "unknown" });
    expect(updates).toEqual([]);
  });
});

describe("pickBranchAndTitle", () => {
  it("returns fixed branch and title for kind=minor", () => {
    const result = pickBranchAndTitle({ kind: "minor" }, {});
    expect(result.branch).toBe("chore/peer-deps/minor");
    expect(result.title).toBe("chore: bump peerDependencies (minor/patch)");
  });

  it("constructs branch and title for a simple package name", () => {
    const result = pickBranchAndTitle(
      { kind: "major", pkg: "typescript" },
      { typescript: "6.0.0" },
    );
    expect(result.branch).toBe("chore/peer-deps/major-typescript");
    expect(result.title).toBe("chore: bump peerDependency typescript to 6.0.0 (major)");
  });

  it("slugifies scoped package names to avoid slash in git refs", () => {
    const result = pickBranchAndTitle(
      { kind: "major", pkg: "@types/prompts" },
      { "@types/prompts": "3.0.0" },
    );
    expect(result.branch).toBe("chore/peer-deps/major-types-prompts");
    expect(result.branch).not.toContain("@");
    // The slug suffix must not contain a slash, which would break git ref namespacing.
    const slug = result.branch.slice("chore/peer-deps/major-".length);
    expect(slug).not.toContain("/");
  });
});

describe("diffPeerDeps", () => {
  it("captures a changed peerDependency", () => {
    const before = { peerDependencies: { foo: "^1.0.0" } };
    const after = { peerDependencies: { foo: "^2.0.0" } };
    expect(diffPeerDeps(before, after)).toEqual([{ name: "foo", from: "^1.0.0", to: "^2.0.0" }]);
  });

  it("ignores unchanged peerDependencies", () => {
    const before = { peerDependencies: { foo: "^1.0.0" } };
    const after = { peerDependencies: { foo: "^1.0.0" } };
    expect(diffPeerDeps(before, after)).toEqual([]);
  });

  it("ignores packages added in after but absent in before", () => {
    const before = { peerDependencies: {} };
    const after = { peerDependencies: { foo: "^1.0.0" } };
    expect(diffPeerDeps(before, after)).toEqual([]);
  });

  it("handles missing peerDependencies block in before", () => {
    const before = {};
    const after = { peerDependencies: { foo: "^1.0.0" } };
    expect(diffPeerDeps(before, after)).toEqual([]);
  });

  it("handles missing peerDependencies block in after", () => {
    const before = { peerDependencies: { foo: "^1.0.0" } };
    const after = {};
    expect(diffPeerDeps(before, after)).toEqual([]);
  });
});

describe("renderPrBody", () => {
  const bumps = [{ name: "foo", from: "^1.0.0", to: "^2.0.0" }];

  it("mentions minor and patch in the scope for kind=minor", () => {
    const body = renderPrBody({ kind: "minor" }, bumps);
    expect(body).toContain("minor and patch");
  });

  it("mentions the package name in the scope for kind=major", () => {
    const body = renderPrBody({ kind: "major", pkg: "foo" }, bumps);
    expect(body).toContain("major-version bump");
    expect(body).toContain("`foo`");
  });

  it("includes each bump in the package list", () => {
    const body = renderPrBody({ kind: "minor" }, bumps);
    expect(body).toContain("`foo`");
    expect(body).toContain("^1.0.0");
    expect(body).toContain("^2.0.0");
  });

  it("links to the workflow run URL when runUrl is provided", () => {
    const body = renderPrBody({ kind: "minor", runUrl: "https://example.com/runs/1" }, bumps);
    expect(body).toContain("[workflow run](https://example.com/runs/1)");
    expect(body).not.toContain("passed");
  });

  it("falls back to static verification text when runUrl is absent", () => {
    const body = renderPrBody({ kind: "minor" }, bumps);
    expect(body).toContain("passed");
    expect(body).not.toContain("workflow run");
  });
});
