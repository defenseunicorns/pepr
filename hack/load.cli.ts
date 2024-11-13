// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// From within Pepr project dir / next to Pexex project dir:
//  npx ts-node hack/load.ts prep ./
//  npx ts-node hack/load.ts cluster up
//  npx ts-node hack/load.ts deploy ./pepr-0.0.0-development.tgz ./pepr-dev.tar ../pepr-excellent-examples/hello-pepr-soak-ci

//  npx ts-node hack/load.ts run --prefix "now" (defaults to `${Date.now()}`)
//    `${--prefix}.load.json` --> { injects: [], measures: [] }

//  npx ts-node hack/load.ts graph ./now.load.json ./now.load.graph
//  npx ts-node hack/load.ts cluster down

import { Command, Option } from "commander";
import { spawn } from "child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as lib from "./load.lib";

const TEST_CLUSTER_NAME_PREFIX = "pepr-load";
const TEST_CLUSTER_NAME_DEFAULT = "cluster";
const TEST_CLUSTER_NAME_MAX_LENGTH = 32;

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

const testClusters = async () => {
  let result = await new Cmd({ cmd: `k3d cluster list --no-headers` }).run();
  return result.stdout
    .filter(f => f)
    .map(m => m.split(/\s+/).at(0))
    .filter(f => f?.startsWith(TEST_CLUSTER_NAME_PREFIX));
};

const fullClusterName = (name: string) => `${TEST_CLUSTER_NAME_PREFIX}-${name}`;

export function toMs(human: string) {
  return 0;
}

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

const cluster = new Command();
cluster.name("cluster").description("test cluster controls");

cluster
  .command("up")
  .description("bring up a test cluster")
  .option("-n, --name [name]", "name of test cluster", TEST_CLUSTER_NAME_DEFAULT)
  .action(async rawOpts => {
    //
    // sanitize & validate opts / args
    //
    const opts = { name: "" };

    const nameTrim = rawOpts.name.trim();
    if (nameTrim === "") {
      console.error(
        `Invalid "--name" option: "${rawOpts.name}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }

    const clusterName = fullClusterName(nameTrim);
    // https://github.com/rancher/rancher/issues/37535
    if (nameTrim.length > TEST_CLUSTER_NAME_MAX_LENGTH) {
      console.error(
        `Invalid "--name" option: "${nameTrim}".` +
          ` Resulting cluster name "${clusterName}" must not be longer than ${TEST_CLUSTER_NAME_MAX_LENGTH} characters.`,
      );
      process.exit(1);
    }
    opts.name = nameTrim;

    //
    // do
    //

    const clusters = await testClusters();
    const found = clusters.includes(clusterName);
    if (found) {
      console.error(`K3D test cluster "${clusterName}" already exists. Quitting!`);
      process.exit(1);
    }

    log(`Create test K3D cluster "${clusterName}"`);
    let cmd = new Cmd({ cmd: `k3d cluster create ${clusterName}` });
    log({ cmd: cmd.cmd });
    log(await cmd.run(), "");
  });

cluster
  .command("down")
  .description("bring down a test cluster")
  .option("-n, --name [name]", "name of test cluster", TEST_CLUSTER_NAME_DEFAULT)
  .addOption(
    new Option("-a, --all", "bring down all test clusters").default(false).conflicts("name"),
  )
  .action(async rawOpts => {
    //
    // sanitize & validate opts / args
    //
    const opts = { name: "", all: rawOpts.all };

    const nameTrim = rawOpts.name.trim();
    if (nameTrim === "") {
      console.error(
        `Invalid "--name" option: "${rawOpts.name}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }

    const clusterName = fullClusterName(nameTrim);
    // https://github.com/rancher/rancher/issues/37535
    if (nameTrim.length > TEST_CLUSTER_NAME_MAX_LENGTH) {
      console.error(
        `Invalid "--name" option: "${nameTrim}".` +
          ` Resulting cluster name "${clusterName}" must not be longer than ${TEST_CLUSTER_NAME_MAX_LENGTH} characters.`,
      );
      process.exit(1);
    }
    opts.name = nameTrim;

    //
    // do
    //
    const clusters = await testClusters();

    if (opts.all) {
      const list = clusters.join(" ").trim();

      if (list === "") {
        log(`No test clusters found`, "");
        return;
      }

      log(`Delete ALL test K3D clusters (all of them!)`);
      let cmd = new Cmd({ cmd: `k3d cluster delete ${list}` });
      log({ cmd: cmd.cmd });
      log(await cmd.run(), "");
      return;
    }

    const missing = !clusters.includes(clusterName);
    if (missing) {
      console.error(`K3D test cluster "${clusterName}" not found. Quitting!`);
      process.exit(1);
    }

    log(`Delete test K3D cluster "${clusterName}"`);
    let cmd = new Cmd({ cmd: `k3d cluster delete ${clusterName}` });
    log({ cmd: cmd.cmd });
    log(await cmd.run(), "");
  });

cluster
  .command("list")
  .description("list test clusters")
  .action(async () => {
    log(`List K3D test clusters`);
    let cmd = new Cmd({ cmd: `k3d cluster list --output json` });
    log({ cmd: cmd.cmd });

    let result = await cmd.run();
    let clusters = JSON.parse(result.stdout.join("").trim())
      .filter((f: any) => f.name.startsWith(TEST_CLUSTER_NAME_PREFIX))
      .map((m: any) => ({ name: m.name }));

    log(clusters, "");
  });

program.addCommand(cluster);

program
  .command("deploy")
  .description("deploy a Pepr module for testing")
  .argument("<tgz>", "path to Pepr package tgz")
  .argument("<img>", "path to Pepr controller img tar")
  .argument("<module>", "path to Pepr module under test")
  .option("-n, --cluster-name [name]", "name of cluster to run within", TEST_CLUSTER_NAME_DEFAULT)
  .action(async (tgz, img, module, rawOpts) => {
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

    const opts = { clusterName: "" };
    const nameTrim = rawOpts.clusterName.trim();
    if (nameTrim === "") {
      console.error(
        `Invalid "--name" option: "${rawOpts.clusterName}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }

    const clusterName = fullClusterName(nameTrim);
    // https://github.com/rancher/rancher/issues/37535
    if (nameTrim.length > TEST_CLUSTER_NAME_MAX_LENGTH) {
      console.error(
        `Invalid "--cluster-name" option: "${nameTrim}".` +
          ` Resulting cluster name "${clusterName}" must not be longer than ${TEST_CLUSTER_NAME_MAX_LENGTH} characters.`,
      );
      process.exit(1);
    }
    opts.clusterName = nameTrim;

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

    let clusters = await testClusters();
    let missing = !clusters.includes(clusterName);
    if (missing) {
      console.error(`Can't find test cluster "${clusterName}". Quitting!`);
      process.exit(1);
    }

    log(`Load Pepr controller image artifact into test cluster`);
    cmd = new Cmd({ cmd: `k3d image import '${args.img}' --cluster '${clusterName}'` });
    log({ cmd: cmd.cmd });
    log(await cmd.run(), "");

    log(`Get test cluster credential`);
    cmd = new Cmd({ cmd: `k3d kubeconfig write ${clusterName}` });
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
  });

program
  .command("run")
  .description("run a load test")
  .option("-n, --cluster-name [name]", "name of cluster to run within", TEST_CLUSTER_NAME_DEFAULT)
  .option("-d, --duration [minutes]", "duration of load test", "30")
  .action(async rawOpts => {
    //
    // sanitize / validate args
    //
    const opts = { clusterName: "", duration: 0 };

    const durTrim = rawOpts.duration.trim();
    if (durTrim === "") {
      console.error(
        `Invalid "duration" argument: "${rawOpts.duration}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const durNum = +durTrim;
    if (isNaN(durNum)) {
      console.error(`Invalid "duration" argument: "${durTrim}". Must be a valid number.`);
      process.exit(1);
    }
    opts.duration = durNum;

    const nameTrim = rawOpts.clusterName.trim();
    if (nameTrim === "") {
      console.error(
        `Invalid "--name" option: "${rawOpts.clusterName}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }

    const clusterName = fullClusterName(nameTrim);
    // https://github.com/rancher/rancher/issues/37535
    if (nameTrim.length > TEST_CLUSTER_NAME_MAX_LENGTH) {
      console.error(
        `Invalid "--cluster-name" option: "${nameTrim}".` +
          ` Resulting cluster name "${clusterName}" must not be longer than ${TEST_CLUSTER_NAME_MAX_LENGTH} characters.`,
      );
      process.exit(1);
    }
    opts.clusterName = nameTrim;

    //
    // run
    //

    const alpha = Date.now();
    const omega = alpha + opts.duration * 60 * 1000;

    console.log(alpha, omega);

    // kick-off interval to grab measurements:
    // KUBECONFIG=$(k3d kubeconfig write pepr-load) kubectl top --namespace pepr-system pod --no-headers
    //
    // pepr-soak-ci-76ccb8fb69-4x66n          2m    105Mi
    // pepr-soak-ci-76ccb8fb69-lqkpd          3m    104Mi
    // pepr-soak-ci-watcher-6b777c6cc-wtsh9   3m    122Mi

    // kick-off interval to inject activity:
    // ...

    // aggregate measurements (for a while)
    // ...

    // clear intervals
    // ...

    // and then...

    // TODO:
    //  - add "run" cmd (to start injecting activity / scraping measurements / writing to file)
    //  - add "graph" cmd (to convert metrics file into graph image)
  });

program.parse(process.argv);
