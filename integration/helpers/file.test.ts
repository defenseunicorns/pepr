import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as sut from "./file";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("exists", () => {
  const workdir = new Workdir(`${FILE}-exists`, `${HERE}/../testroot/helpers`);
  const real = `${workdir.path()}/exists.txt`;

  beforeAll(async () => {
    await workdir.recreate();
    await fs.writeFile(real, "I exist!");
  });

  it("returns true when exists", async () => {
    const result = await sut.exists(real);
    expect(result).toBe(true);
  });

  it("returns false when missing", async () => {
    const result = await sut.exists(`${real}.nope`);
    expect(result).toBe(false);
  });
});
