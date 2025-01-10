import { resolve, join } from "node:path";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
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

export async function tgzifyModule(modulePath: string): Promise<void> {
  const packagePath = `${modulePath}/package.json`;
  const packageJson = JSON.parse(await readFile(packagePath, { encoding: "utf8" }));
  packageJson.dependencies.pepr = `file://${modulePath}/../pepr-0.0.0-development.tgz`;
  await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
}

export async function cli(workdir: string, spec: Spec): Promise<Result> {
  const tgz = "pepr-0.0.0-development.tgz";

  const _spec = clone(spec);
  _spec.cwd = workdir;

  let tgzRef = "";

  // if .tgz exists in workdir, use that (e.g. when `pepr init`-ing)
  try {
    await access(`${workdir}/${tgz}`);
    tgzRef = `file://${workdir}/${tgz}`;
  } catch {
    /* do nothing */
  }

  // if .tgz exists one level above workdir, use that (e.g. when `pepr build`-ing)
  try {
    await access(`${workdir}/../${tgz}`);
    tgzRef = `file://${workdir}/../${tgz}`;
  } catch {
    /* do nothing */
  }

  // else bomb out
  if (tgzRef === "") {
    throw "can't find pepr .tgz";
  }

  const _cmd = _spec.cmd.trim().replace(/^pepr /, `npx --yes ${tgzRef} `);
  _spec.cmd = _cmd;

  // install .tgz before calling so stdout doesn't spew install text on first run
  const inst = new Cmd({ ..._spec, cmd: `npm install ${tgzRef}` });
  await inst.run();

  const cmd = new Cmd(_spec);
  return await cmd.runRaw();
}
