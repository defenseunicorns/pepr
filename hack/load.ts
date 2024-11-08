// From within Pepr project dir / next to Pexex project dir:
//  npx ts-node hack/load.ts prep ./
//  npx ts-node hack/load.ts run ./pepr-0.0.0-development.tgz ./pepr-dev.tar ../pepr-excellent-examples/hello-pepr-soak-ci

import { Command } from "commander";
import { spawn } from "child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const PEPR_PKG = `pepr-0.0.0-development.tgz`;
const PEPR_IMG = `pepr-dev.tar`;
const PEPR_TAG = `pepr:dev`;

interface Spec {
  cmd: string;
  stdin?: string[];
  cwd?: string;
  env?: object; // object containing key-value pairs
}

interface Result {
  stdout: string[];
  stderr: string[];
  exitcode: number;
}

class Cmd {
  result?: Result;
  cmd: string;
  stdin: string[];
  cwd: string;
  env: object;

  constructor(spec: Spec) {
    this.cmd = spec.cmd;
    this.stdin = spec.stdin || [];
    this.cwd = spec.cwd || process.cwd();
    this.env = spec.env ? { ...process.env, ...spec.env } : process.env;
  }

  runRaw(): Promise<Result> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.cmd, [], {
        shell: true,
        cwd: this.cwd,
        env: this.env as NodeJS.ProcessEnv,
      });

      this.stdin.forEach(line => proc.stdin.write(`${line}\n`));
      proc.stdin.end();

      let bufout: Buffer = Buffer.from("");
      proc.stdout.on("data", buf => {
        bufout = Buffer.concat([bufout, buf]);
      });

      let buferr: Buffer = Buffer.from("");
      proc.stderr.on("data", buf => {
        buferr = Buffer.concat([buferr, buf]);
      });

      proc.on("close", exitcode => {
        let stdout = bufout.toString("utf8") === "" ? [] : bufout.toString("utf8").split(/[\r\n]+/);

        let stderr = buferr.toString("utf8") === "" ? [] : buferr.toString("utf8").split(/[\r\n]+/);

        this.result = { stdout, stderr, exitcode: exitcode || 0 };
        resolve(this.result);
      });

      proc.on("error", err => {
        reject(err);
      });
    });
  }

  run(): Promise<Result> {
    return this.runRaw().then(result => {
      if (result.exitcode > 0) {
        throw result;
      }
      return result;
    });
  }
}

type Loggable = string | object;

const log = (...items: Loggable[]) => {
  for (let item of items) {
    console.log(typeof item === "object" ? JSON.stringify(item, null, 2) : item);
  }
};

const fileAccessible = async (path: string) =>
  fs
    .access(path, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);

const fileInaccessible = async (path: string) => !(await fileAccessible(path));

const workdirPrefix = () => path.join(os.tmpdir(), `${path.basename(__filename)}-`);

const createWorkdir = async () => {
  const prefix = workdirPrefix();
  return await fs.mkdtemp(prefix);
};

const cleanWorkdirs = async () => {
  const prefix = workdirPrefix();
  const dir = path.dirname(prefix);
  const pre = path.basename(prefix);

  const workdirs = (await fs.readdir(dir))
    .filter(f => f.startsWith(pre))
    .map(m => path.join(dir, m));

  await Promise.all(workdirs.map(m => fs.rm(m, { recursive: true, force: true })));
};

const availableClusters = async () => {
  let result = await new Cmd({ cmd: `k3d cluster list --no-headers` }).run();
  return result.stdout.filter(f => f).map(m => m.split(/\s+/).at(0));
};

const program = new Command();

program
  .name("load")
  .description("Load test a Pepr controller and graph/report on resource usage.")
  .version("0.0.1");

program
  .command("prep")
  .description("Create testable artifacts")
  .argument("<src>", "path to Pepr project source")
  .action(async src => {
    //
    // sanitize / validate args
    //

    const args = { src: "" };

    const srcTrim = src.trim();
    if (srcTrim === "") {
      console.error(`Invalid "src" argument: "${src}". Cannot be empty / all whitespace.`);
      process.exit(1);
    }
    const srcAbs = path.resolve(srcTrim);
    if (await fileInaccessible(srcAbs)) {
      console.error(`Invalid "src" argument: "${srcAbs}". Cannot access (read).`);
      process.exit(1);
    }
    args.src = srcAbs;

    //
    // create artifacts
    //

    try {
      let cmd: Cmd;

      log(`Install Pepr build dependencies`);
      cmd = new Cmd({ cmd: `npm ci`, cwd: args.src });
      log({ cmd: cmd.cmd, cwd: cmd.cwd });
      log(await cmd.run(), "");

      log(`Build Pepr package artifact and controller image`);
      cmd = new Cmd({ cmd: `npm run build:image`, cwd: args.src });
      log({ cmd: cmd.cmd, cwd: cmd.cwd });
      log(await cmd.run(), "");

      log(`Export Pepr controller image artifact`);
      cmd = new Cmd({ cmd: `docker save --output ${PEPR_IMG} ${PEPR_TAG}`, cwd: args.src });
      log({ cmd: cmd.cmd, cwd: cmd.cwd });
      log(await cmd.run(), "");
    } catch (e) {
      console.error(e);
    }
  });

program
  .command("run")
  .description("Run a load test")
  .argument("<tgz>", "path to Pepr package tgz")
  .argument("<img>", "path to Pepr controller img tar")
  .argument("<module>", "path to Pepr module under test")
  .option("-a, --no-cluster-auto", "create k3d cluster before test, cleanup after")
  .option("-n, --cluster-name [name]", "name of cluster to run within", "pepr-load")
  .action(async (tgz, img, module, opts) => {
    //
    // sanitize / validate args
    //

    const args = { tgz: "", img: "", module: "" };

    const tgzTrim = tgz.trim();
    if (tgzTrim === "") {
      console.error(`Invalid "tgz" argument: "${tgz}". Cannot be empty / all whitespace.`);
      process.exit(1);
    }
    const tgzAbs = path.resolve(tgzTrim);
    if (await fileInaccessible(tgzAbs)) {
      console.error(`Invalid "tgz" argument: "${tgzAbs}". Cannot access (read).`);
      process.exit(1);
    }
    args.tgz = tgzAbs;

    const imgTrim = img.trim();
    if (imgTrim === "") {
      console.error(`Invalid "img" argument: "${img}". Cannot be empty / all whitespace.`);
      process.exit(1);
    }
    const imgAbs = path.resolve(imgTrim);
    if (await fileInaccessible(imgAbs)) {
      console.error(`Invalid "img" argument: "${imgAbs}". Cannot access (read).`);
      process.exit(1);
    }
    args.img = imgAbs;

    const modTrim = module.trim();
    if (modTrim === "") {
      console.error(`Invalid "module" argument: "${module}"`);
      process.exit(1);
    }
    const modAbs = path.resolve(modTrim);
    if (await fileInaccessible(modAbs)) {
      console.error(`Invalid "module" argument: "${modAbs}". Cannot access (read).`);
      process.exit(1);
    }
    args.module = path.resolve(modAbs);

    //
    // setup testable module
    //

    log(`Remove old working directories (if there are any)`);
    await cleanWorkdirs();
    log("");

    log(`Create working directory`);
    let workdir = await createWorkdir();
    log(`  workdir: ${workdir}`, "");

    log(`Copy module content into working directory`);
    await fs.cp(args.module, workdir, { recursive: true });
    let tests = (await fs.readdir(args.module, { recursive: true })).filter(f =>
      /\.test\./.test(f),
    );
    await Promise.all(tests.map(f => fs.rm(`${workdir}/${f}`)));

    let cmd = new Cmd({ cmd: `ls -lahR`, cwd: workdir });
    log({ cmd: cmd.cmd, cwd: cmd.cwd });
    log(await cmd.run(), "");

    log(`Copy package artifact into working directory`);
    let worktgz = `${workdir}/${path.basename(args.tgz)}`;
    await fs.cp(args.tgz, worktgz);
    cmd = new Cmd({ cmd: `ls -lah ${worktgz}` });
    log({ cmd: cmd.cmd });
    log(await cmd.run(), "");

    log(`Install package artifact into working directory module`);
    cmd = new Cmd({ cmd: `npm install ${path.basename(worktgz)}`, cwd: workdir });
    log({ cmd: cmd.cmd, cwd: cmd.cwd });
    log(await cmd.run(), "");

    //
    // run test
    //

    log(`Pepr CLI version`);
    cmd = new Cmd({ cmd: `npx --yes ${path.basename(worktgz)} --version`, cwd: workdir });
    log({ cmd: cmd.cmd, cwd: cmd.cwd });
    log(await cmd.run(), "");

    log(`K3D CLI version`);
    cmd = new Cmd({ cmd: `k3d --version` });
    log({ cmd: cmd.cmd });
    log(await cmd.run(), "");

    try {
      let clusters = await availableClusters();
      let found = clusters.includes(opts.clusterName);
      let missing = !found;
      log(
        `Test K3D cluster:`,
        `  desired:   ${opts.clusterName}`,
        `  available: ${JSON.stringify(clusters)}`,
        `  found:     ${found}`,
        `  create?:   ${opts.clusterAuto}`,
        "",
      );

      if (missing) {
        if (opts.clusterAuto) {
          log(`Create test K3D cluster "${opts.clusterName}"`);
          cmd = new Cmd({ cmd: `k3d cluster create ${opts.clusterName}` });
          log({ cmd: cmd.cmd });
          log(await cmd.run(), "");
        } else {
          console.error(`Can't find test K3D cluster. Quitting!`);
          process.exit(1);
        }
      }

      log(`Load Pepr controller image artifact into test cluster`);
      cmd = new Cmd({ cmd: `k3d image import '${args.img}' --cluster '${opts.clusterName}'` });
      log({ cmd: cmd.cmd });
      log(await cmd.run(), "");

      log(`Get test cluster credential`);
      cmd = new Cmd({ cmd: `k3d kubeconfig write ${opts.clusterName}` });
      log({ cmd: cmd.cmd });
      let result = await cmd.run();
      let KUBECONFIG = result.stdout.join("").trim();
      log(result, "");

      log(`Deploy Pepr controller into test cluster`);
      let env = { KUBECONFIG };
      cmd = new Cmd({
        cmd: `npx --yes ${path.basename(worktgz)} deploy --image ${PEPR_TAG} --confirm`,
        cwd: workdir,
        env,
      });
      log({ cmd: cmd.cmd, cwd: cmd.cwd, env });
      log(await cmd.run(), "");
    } finally {
      await cleanWorkdirs();

      let clusters = await availableClusters();
      let found = clusters.includes(opts.clusterName);
      log(
        `Test K3D cluster:`,
        `  desired:   ${opts.clusterName}`,
        `  available: ${JSON.stringify(clusters)}`,
        `  found:     ${found}`,
        `  remove?:   ${opts.clusterAuto}`,
        "",
      );

      if (found) {
        if (opts.clusterAuto) {
          log(`Delete test K3D cluster "${opts.clusterName}"`);
          cmd = new Cmd({ cmd: `k3d cluster delete ${opts.clusterName}` });
          log({ cmd: cmd.cmd });
          log(await cmd.run(), "");
        }
      }
    }
  });

program.parse(process.argv);
