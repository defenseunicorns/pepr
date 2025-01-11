import { resolve } from "node:path";
import { cp, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { Spec, Cmd, Result } from "./cmd";
import { clone } from "ramda";

const HERE = __dirname;

export async function projectRoot(): Promise<string> {
  const cmd = new Cmd({ cmd: `npm root`, cwd: HERE });
  const res = await cmd.run();
  const npmroot = res.stdout.join("").trim();
  return resolve(npmroot, "..");
}

export async function tgzifyModule(modulePath: string): Promise<void> {
  const packagePath = `${modulePath}/package.json`;
  const packageJson = JSON.parse(await readFile(packagePath, { encoding: "utf8" }));

  const root = await projectRoot();
  packageJson.dependencies.pepr = `file://${root}/pepr-0.0.0-development.tgz`;
  await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
}

export async function copyModule(src: string, dst: string): Promise<void> {
  await cp(src, dst, { recursive: true });

  // jest fails to run if given a file hierarchy that includes more than one
  //  module with the same name -- this copies-then-rename is to avoid that
  const packagePath = `${dst}/package.json`;
  const packageJson = JSON.parse(await readFile(packagePath, { encoding: "utf8" }));
  packageJson.name = basename(dst);

  await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
}

export async function cli(workdir: string, spec: Spec): Promise<Result> {
  const root = await projectRoot();
  const tgz = `file://${root}/pepr-0.0.0-development.tgz`;

  const _spec = clone(spec);
  _spec.cwd = workdir;

  const _cmd = _spec.cmd.trim().replace(/^pepr /, `npx --yes ${tgz} `);
  _spec.cmd = _cmd;
  _spec.env = { ..._spec.env, NPM_CONFIG_CACHE: `${root}/integration/testroot/.npm` };

  const cmd = new Cmd(_spec);
  return await cmd.runRaw();
}
