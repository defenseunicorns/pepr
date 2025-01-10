import { resolve, join } from "node:path";
import { copyFile } from "node:fs/promises";
import { Spec, Cmd, Result } from "./cmd";
import { clone } from "ramda";

const HERE = __dirname;

export async function projectRoot(): Promise<string> {
  const cmd = new Cmd({ cmd: `npm root`, cwd: HERE });
  const res = await cmd.run();
  const npmroot = res.stdout.join("").trim();
  return resolve(npmroot, "..");
}

export async function prepWorkdir(workdir: string): Promise<void> {
  const rootdir = await projectRoot();
  const tgz = "pepr-0.0.0-development.tgz";
  const src = join(rootdir, tgz);
  const dst = join(workdir, tgz);
  await copyFile(src, dst);
}

export async function cli(workdir: string, spec: Spec): Promise<Result> {
  const tgz = "pepr-0.0.0-development.tgz";

  const _spec = clone(spec);
  _spec.cwd = workdir;

  const _cmd = _spec.cmd.trim().replace(/^pepr /, `npx --yes file://./${tgz} `);
  _spec.cmd = _cmd;

  const cmd = new Cmd(_spec);
  return await cmd.runRaw();
}
