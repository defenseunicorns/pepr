import { describe, expect, it } from "@jest/globals";
import { Cmd } from "./cmd";

describe("runRaw()", () => {
  it("returns stdout", async () => {
    const expected = "pong";
    const { stdout } = await new Cmd({ cmd: `echo "${expected}"` }).runRaw();
    expect(stdout.join("")).toBe(expected);
  });

  it("returns exit code", async () => {
    const expected = 83;
    const { exitcode } = await new Cmd({ cmd: `exit ${expected}` }).runRaw();
    expect(exitcode).toBe(expected);
  });

  it("returns stderr", async () => {
    const expected = "oof";
    const { stderr } = await new Cmd({ cmd: `>&2 echo "${expected}" ` }).runRaw();
    expect(stderr.join("")).toBe(expected);
  });

  it("caches last result", async () => {
    const cmd = new Cmd({ cmd: `echo "whatever"` });
    const result = await cmd.runRaw();
    expect(result).toBe(cmd.result);
  });

  it("accepts working directory", async () => {
    const expected = "/tmp";
    const { stdout } = await new Cmd({ cwd: expected, cmd: `pwd` }).runRaw();
    expect(stdout.join("")).toBe(expected);
  });

  it("accepts env var overrides", async () => {
    const [key, val] = ["TESTVAR", "testcontent"];
    const { stdout } = await new Cmd({ env: { [key]: val }, cmd: `echo $${key}` }).runRaw();
    expect(stdout.join("")).toBe(val);
  });
});

describe("run()", () => {
  it("on success, returns result", async () => {
    const expected = "pong";
    const result = await new Cmd({ cmd: `echo "${expected}"` }).run();
    expect(result.stdout.join("")).toBe(expected);
    expect(result.stderr.join("")).toBe("");
    expect(result.exitcode).toBe(0);
  });

  it("on failure, throws result", async () => {
    const expected = { exitcode: 1, stderr: [], stdout: [] };
    const promise = new Cmd({ cmd: `exit ${expected.exitcode}` }).run();
    return expect(promise).rejects.toEqual(expected);
  });
});
