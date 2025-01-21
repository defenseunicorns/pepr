import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
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

export async function cli(workdir: string, spec: Spec): Promise<Result> {
  const root = await projectRoot();
  const tgz = `file://${root}/pepr-0.0.0-development.tgz`;

  const _spec = clone(spec);
  _spec.cwd = workdir;

  const _cmd = _spec.cmd.trim().replace(/^pepr /, `npx --yes ${tgz} `);
  _spec.cmd = _cmd;
  _spec.env = { ..._spec.env, NPM_CONFIG_CACHE: `${root}/integration/testroot/.npm` };

  const cmd = new Cmd(_spec);
  const result = await cmd.runRaw();
  await new Promise(r => setTimeout(r, 5000));
  return result;
}
