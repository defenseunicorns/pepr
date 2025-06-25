// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Workdir } from "../helpers/workdir";

describe("Workdir", () => {
  const ROOT_DEFAULT = new Workdir("").root;

  describe("path", () => {
    it.each([
      ["a", `/tmp`, `/tmp/a`],
      ["b", `/tmp/c`, `/tmp/c/b`],
      ["d", undefined, `${ROOT_DEFAULT}/d`],
      ["e/f", undefined, `${ROOT_DEFAULT}/e/f`],
    ])(`leaf "%s" and root "%s" gives "%s"`, async (leaf, root, expected) => {
      const sut = new Workdir(leaf, root);
      expect(sut.path()).toBe(expected);
    });
  });

  describe("create", () => {
    const sut = new Workdir("create");

    beforeEach(async () => {
      await fs.rm(sut.path(), { recursive: true, force: true });
    });

    it("creating a non-existant workdir succeeds", async () => {
      const path = await sut.create();

      expect(path).toBe(sut.path());
      await fs.access(path);
    });

    it("creating a pre-existing workdir also succeeds (idempotency, yay!)", async () => {
      await sut.create();
      const path = await sut.create();

      expect(path).toBe(sut.path());
      await fs.access(path);
    });
  });

  describe("exists", () => {
    const sut = new Workdir("exists");

    beforeEach(async () => {
      await fs.rm(sut.path(), { recursive: true, force: true });
    });

    it("returns false when workdir doesn't exist", async () => {
      const exists = await sut.exists();
      expect(exists).toBe(false);
    });

    it("returns true when workdir does exist", async () => {
      await sut.create();
      const exists = await sut.exists();
      expect(exists).toBe(true);
    });
  });

  describe("delete", () => {
    const sut = new Workdir("delete");

    beforeEach(async () => {
      await fs.rm(sut.path(), { recursive: true, force: true });
    });

    it("deleting a pre-existing workdir succeeds", async () => {
      await sut.create();
      await sut.delete();
      expect(await sut.exists()).toBe(false);
    });

    it("deleting a non-existant workdir also succeeds (idempotency, yay!)", async () => {
      await sut.delete();
      expect(await sut.exists()).toBe(false);
    });
  });

  describe("isEmpty", () => {
    const sut = new Workdir("isEmpty");

    beforeEach(async () => {
      await fs.rm(sut.path(), { recursive: true, force: true });
    });

    it("returns true when workdir is empty", async () => {
      await sut.create();
      expect(await sut.isEmpty()).toBe(true);
    });

    it("returns false when workdir has content", async () => {
      await sut.create();
      await fs.writeFile(path.join(sut.path(), "file.txt"), "exists");
      expect(await sut.isEmpty()).toBe(false);
    });
  });

  describe("recreate", () => {
    const sut = new Workdir("recreate");

    beforeEach(async () => {
      await fs.rm(sut.path(), { recursive: true, force: true });
    });

    it("recreating a pre-existing workdir succeeds", async () => {
      const path = await sut.create();
      const stat = await fs.stat(path, { bigint: true });

      const repath = await sut.recreate();
      const restat = await fs.stat(path, { bigint: true });

      expect(path).toBe(repath);
      expect(stat.birthtimeNs).toBeLessThan(restat.birthtimeNs);
    });

    it("recreating a non-existant workdir also succeeds (idempotency, yay!)", async () => {
      await sut.recreate();
      expect(await sut.exists()).toBe(true);
    });
  });
});
