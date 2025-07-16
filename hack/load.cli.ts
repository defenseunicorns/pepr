// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command, Option } from "commander";
import { spawn } from "child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as R from "ramda";
import { heredoc } from "../src/sdk/heredoc";
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

const nap = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fileReadable = async (path: string) =>
  fs
    .access(path, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);

const fileUnreadable = async (path: string) => !(await fileReadable(path));

const fileWriteable = async (path: string) =>
  fs
    .access(path, fs.constants.W_OK)
    .then(() => true)
    .catch(() => false);

const fileUnwriteable = async (path: string) => !(await fileWriteable(path));

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
    if (await fileUnreadable(srcAbs)) {
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

      log(`Delete all test K3D clusters`);
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
    if (await fileUnreadable(tgzAbs)) {
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
    if (await fileUnreadable(imgAbs)) {
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
    if (await fileUnreadable(modAbs)) {
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
    // run deploy
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

    try {
      log(`Get test cluster credential`);
      cmd = new Cmd({ cmd: `k3d kubeconfig write ${clusterName}` });
      log({ cmd: cmd.cmd });
      let result = await cmd.run();
      let KUBECONFIG = result.stdout.join("").trim();
      log(result, "");

      log(`Deploy Pepr controller into test cluster`);
      let env = { KUBECONFIG };
      cmd = new Cmd({
        cmd: `npx --yes ${path.basename(worktgz)} deploy --image ${PEPR_TAG} --yes`,
        cwd: workdir,
        env,
      });
      log({ cmd: cmd.cmd, cwd: cmd.cwd, env });
      log(await cmd.run(), "");

      log(`Wait for metrics on the Pepr controller to become available`);
      const start = Date.now();
      const max = lib.toMs("2m");
      while (true) {
        const now = Date.now();
        const dur = now - start;
        if (dur > max) {
          console.error(`Timeout waiting for metrics-server to be ready.`);
          process.exit(1);
        }

        cmd = new Cmd({ cmd: `kubectl top --namespace pepr-system pod --no-headers`, env });
        let res = await cmd.runRaw();
        if (res.exitcode === 0) {
          log({ max: lib.toHuman(max), actual: lib.toHuman(dur) }, "");
          break;
        }

        await nap(lib.toMs("5s"));
      }
    } catch (e) {
      console.error(`Failed to deploy image:`, e);
    }
  });

program
  .command("run")
  .description("run a load test")
  .argument("<module>", "path to Pepr module under test")
  .argument("<manifest>", "sub-path to resource manifest to apply as load")
  .option("--act-interval [duration]", "how often load is applied to cluster", "1m")
  .option("--act-intensity [number]", "how many resources are applied during an interval", "1000")
  .option("--aud-interval [duration]", "how often resources are scraped from cluster", "1s")
  .option("-n, --cluster-name [name]", "name of cluster to run within", TEST_CLUSTER_NAME_DEFAULT)
  .option("-d, --duration [duration]", "duration of load test", "1h")
  .option("-o, --output-dir [path]", "path to folder to place result files", "./load")
  .option("--settle [duration]", "how long to aud after load stops", "2h")
  .option("--stagger [duration]", "how long to pause between starting act and aud", "5s")
  .action(async (module, manifest, rawOpts) => {
    //
    // sanitize / validate args
    //
    const args = { module: "", manifest: "" };

    const modTrim = module.trim();
    if (modTrim === "") {
      console.error(`Invalid "module" argument: "${module}".  Cannot be empty / all whitespace.`);
      process.exit(1);
    }
    const modAbs = path.resolve(modTrim);
    if (await fileUnreadable(modAbs)) {
      console.error(`Invalid "module" argument: "${modAbs}". Cannot access (read).`);
      process.exit(1);
    }
    args.module = modAbs;

    const maniTrim = manifest.trim();
    if (maniTrim === "") {
      console.error(
        `Invalid "manifest" argument: "${manifest}".  Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const maniAbs = path.resolve(`${args.module}/${maniTrim}`);
    if (await fileUnreadable(maniAbs)) {
      console.error(
        `Invalid "manifest" argument: (${args.module}) "${maniTrim}". Cannot access (read).`,
      );
      process.exit(1);
    }
    args.manifest = maniAbs;

    const opts: Record<string, any> = {
      actInterval: 0,
      actIntensity: 0,
      audInterval: 0,
      clusterName: "",
      duration: 0,
      outputDir: "",
      settle: 0,
      stagger: 0,
    };

    const actIntvTrim = rawOpts.actInterval.trim();
    if (actIntvTrim === "") {
      console.error(
        `Invalid "--act-interval" option: "${rawOpts.actInterval}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.actInterval = lib.toMs(actIntvTrim);
    } catch (e) {
      console.error(`Invalid "--act-interval" option: "${actIntvTrim}". ${e}.`);
      process.exit(1);
    }

    const actIntyTrim = rawOpts.actIntensity.trim();
    if (actIntyTrim === "") {
      console.error(
        `Invalid "--act-intensity" option: "${rawOpts.actIntensity}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const actIntyNum = Number(actIntyTrim);
    if (isNaN(actIntyNum)) {
      console.error(`Invalid "--act-intensity" option: "${actIntyTrim}". Must be a number.`);
      process.exit(1);
    }
    opts.actIntensity = actIntyNum;

    const audIntTrim = rawOpts.audInterval.trim();
    if (audIntTrim === "") {
      console.error(
        `Invalid "--aud-interval" option: "${rawOpts.actInterval}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.audInterval = lib.toMs(audIntTrim);
    } catch (e) {
      console.error(`Invalid "--aud-interval" option: "${audIntTrim}". ${e}.`);
      process.exit(1);
    }

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
    opts.clusterName = clusterName;

    const durTrim = rawOpts.duration.trim();
    if (durTrim === "") {
      console.error(
        `Invalid "--duration" option: "${rawOpts.duration}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.duration = lib.toMs(durTrim);
    } catch (e) {
      console.error(`Invalid "--duration" option: "${durTrim}". ${e}.`);
      process.exit(1);
    }

    const outTrim = rawOpts.outputDir.trim();
    if (outTrim === "") {
      console.error(
        `Invalid "--output-dir" option: "${rawOpts.outputDir}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const outAbs = path.resolve(outTrim);
    const outBase = path.dirname(outAbs);
    if (await fileUnreadable(outBase)) {
      await fs.mkdir(outBase);
    }
    if (await fileUnwriteable(outAbs)) {
      if (await fileUnwriteable(outBase)) {
        console.error(
          `Invalid "--output-dir" option: "${outAbs} (or parent)". Cannot access (write).`,
        );
        process.exit(1);
      }
    }
    opts.outputDir = path.resolve(outAbs);

    const setTrim = rawOpts.settle?.trim();
    if (setTrim === "") {
      console.error(
        `Invalid "--settle" option: "${rawOpts.settle}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.settle = lib.toMs(setTrim);
    } catch (e) {
      console.error(`Invalid "--settle" argument: "${setTrim}". ${e}.`);
      process.exit(1);
    }

    const stagTrim = rawOpts.stagger.trim();
    if (stagTrim === "") {
      console.error(
        `Invalid "--stagger" option: "${rawOpts.stagger}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.stagger = lib.toMs(stagTrim);
    } catch (e) {
      console.error(`Invalid "--stagger" option: "${stagTrim}". ${e}.`);
      process.exit(1);
    }

    //
    // run
    //
    try {
      if (await fileUnreadable(opts.outputDir)) {
        log(`Create output directory`);
        await fs.mkdir(opts.outputDir);
        log(`  outdir: ${opts.outputDir}`, "");
      }

      log(`Get test cluster credential`);
      let cmd = new Cmd({ cmd: `k3d kubeconfig write ${opts.clusterName}` });
      log({ cmd: cmd.cmd });
      let result = await cmd.run();
      let KUBECONFIG = result.stdout.join("").trim();
      log(result, "");

      const alpha = Date.now();

      log(`Load test start: ${new Date(alpha).toISOString()}`);
      log(args);
      const prettyOpts = Object.keys(opts).reduce(
        (acc, key) => {
          switch (key) {
            case "actInterval":
            case "audInterval":
            case "duration":
            case "settle":
            case "stagger":
              acc[key] = lib.toHuman(opts[key]);
              break;
            default:
              acc[key] = opts[key];
              break;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      log(prettyOpts, "");

      const scenario = await fs.readFile(`${args.module}/capabilities/scenario.yaml`, {
        encoding: "utf-8",
      });
      let stdin = scenario.split("\n");
      let env = { KUBECONFIG };

      cmd = new Cmd({ cmd: `kubectl apply -f -`, stdin, env });
      let req = { cmd: cmd.cmd, stdin, env };
      let res = await cmd.run();

      const loadTmpl = await fs.readFile(args.manifest, { encoding: "utf-8" });
      let actFile = `${opts.outputDir}/${alpha}-actress.log`;
      await fs.appendFile(actFile, loadTmpl.replace(/\n/g, "\\\\n") + "\n");

      let audFile = `${opts.outputDir}/${alpha}-audience.log`;

      const audience = async () => {
        process.stdout.write("↓");

        let env = { KUBECONFIG };

        cmd = new Cmd({ cmd: `kubectl top --namespace pepr-system pod --no-headers`, env });
        let req = { cmd: cmd.cmd, env };
        let res = await cmd.run();

        let outlines = res.stdout
          .filter(f => f)
          .map(m => `${Date.now()}\t${m}`)
          .join("\n")
          .concat("\n");
        await fs.appendFile(audFile, outlines);
      };
      await audience(); // run immediately, then on schedule
      const ticket = setInterval(async () => {
        try {
          await audience();
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      }, opts.audInterval);

      await nap(opts.stagger); // stagger interval starts

      const abort = new AbortController();

      const actress = async (abort?: AbortController) => {
        process.stdout.write("↑");

        for (let i = 0; i < opts.actIntensity; i++) {
          if (abort?.signal.aborted) {
            return;
          }

          let load = loadTmpl.replace("UNIQUIFY-ME", `${Date.now().toString()}-${i}`);

          let stdin = load.split("\n");
          let env = { KUBECONFIG };

          cmd = new Cmd({ cmd: `kubectl apply -f -`, env, stdin });
          let req = { cmd: cmd.cmd, stdin, env };
          let res = await cmd.run();

          await fs.appendFile(actFile, Date.now().toString() + "\n");
        }
      };
      await actress(); // run immediately, then on schedule
      const backstagePass = setInterval(async () => {
        try {
          await actress(abort);
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      }, opts.actInterval);
      // wait until total duration has elapsed
      const startWait = Date.now();
      await nap(opts.duration - (startWait - alpha));
      const endWait = Date.now();

      // stop adding load
      abort.abort();
      clearInterval(backstagePass);

      // let cluster settle after load stops
      await nap(opts.settle);
      clearInterval(ticket);

      log("", "");
      log(`Load test complete: ${new Date(endWait).toISOString()}`, "");

      log("  Waiting for final actions to complete...", "");
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

program
  .command("post")
  .description("post-process load test log")
  .option("-o, --output-dir [path]", "path to folder containing result files", "./load")
  .option("-c, --act-file [name]", "name of result act log to process", "<latest>-actress.log")
  .option("-d, --aud-file [name]", "name of result aud log to process", "<latest>-audience.log")
  .action(async rawOpts => {
    //
    // sanitize / validate args
    //
    const opts = { outputDir: "", actFile: "", audFile: "" };

    const outTrim = rawOpts.outputDir.trim();
    if (outTrim === "") {
      console.error(
        `Invalid "--output-dir" option: "${rawOpts.outputDir}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const outAbs = path.resolve(outTrim);
    if (await fileUnreadable(outAbs)) {
      console.error(`Invalid "--output-dir" option: "${outAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.outputDir = path.resolve(outAbs);

    let actTrim = rawOpts.actFile.trim();
    if (actTrim === "") {
      console.error(
        `Invalid "--act-file" option: "${rawOpts.actFile}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    let actAbs = path.resolve(`${opts.outputDir}/${actTrim}`);
    if (path.basename(actAbs).endsWith("<latest>-actress.log")) {
      const files = await fs.readdir(path.dirname(actAbs));
      const log = files
        .filter(f => f.endsWith("-actress.log"))
        .sort()
        .at(-1)!;
      actTrim = log;
      actAbs = `${path.dirname(actAbs)}/${actTrim}`;
    }
    if (await fileUnreadable(actAbs)) {
      console.error(`Invalid "--act-file" option: "${actAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.actFile = actAbs;

    let audTrim = rawOpts.audFile.trim();
    if (audTrim === "") {
      console.error(
        `Invalid "--aud-file" option: "${rawOpts.audFile}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    let audAbs = path.resolve(`${opts.outputDir}/${audTrim}`);
    if (path.basename(audAbs).endsWith("<latest>-audience.log")) {
      const files = await fs.readdir(path.dirname(audAbs));
      const log = files
        .filter(f => f.endsWith("-audience.log"))
        .sort()
        .at(-1)!;
      audTrim = log;
      audAbs = `${path.dirname(audAbs)}/${audTrim}`;
    }
    if (await fileUnreadable(audAbs)) {
      console.error(`Invalid "--aud-file" option: "${audAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.audFile = audAbs;

    //
    // run
    //
    const actLogs = await fs.readFile(opts.actFile, { encoding: "utf-8" });
    const actJson = lib.parseActressData(actLogs);
    const actFile = `${opts.actFile.replace(".log", ".json")}`;
    await fs.writeFile(actFile, JSON.stringify(actJson, null, 2));

    const audLogs = await fs.readFile(opts.audFile, { encoding: "utf-8" });
    const audJson = lib.parseAudienceData(audLogs);
    const audFile = `${opts.audFile.replace(".log", ".json")}`;
    await fs.writeFile(audFile, JSON.stringify(audJson, null, 2));

    const actAnalysis: lib.Analysis.Actress = {
      load: actJson.load,
      injects: actJson.injects.length,
    };

    const getTime = (row: [number, number, string, number, string]) => row[0];
    const getCpuN = (row: [number, number, string, number, string]) => row[1];
    const getCpuU = (row: [number, number, string, number, string]) => row[2];
    const getMemN = (row: [number, number, string, number, string]) => row[3];
    const getMemU = (row: [number, number, string, number, string]) => row[4];

    const audAnalysis: lib.Analysis.Audience = { targets: [] };
    Object.entries(audJson).forEach(([key, val]) => {
      const name = key;
      const samples = val.length;
      const cpu: lib.Analysis.Measureable = {
        start: getCpuN(val.at(0)!),
        min: val.map(m => getCpuN(m)).reduce((acc, cur) => (cur < acc ? cur : acc), Infinity),
        max: val.map(m => getCpuN(m)).reduce((acc, cur) => (cur > acc ? cur : acc), -Infinity),
        end: getCpuN(val.at(-1)!),
      };
      const mem: lib.Analysis.Measureable = {
        start: getMemN(val.at(0)!),
        min: val.map(m => getMemN(m)).reduce((acc, cur) => (cur < acc ? cur : acc), Infinity),
        max: val.map(m => getMemN(m)).reduce((acc, cur) => (cur > acc ? cur : acc), -Infinity),
        end: getMemN(val.at(-1)!),
      };

      const target: lib.Analysis.Target = { name, samples, cpu, mem };
      audAnalysis.targets.push(target);
    });

    const summary: lib.Analysis.Summary = {
      actress: actAnalysis,
      audience: audAnalysis,
    };

    const ts = path.basename(audFile).split("-").at(0)!;
    const outfile = `${opts.outputDir}/${ts}-summary.json`;
    await fs.writeFile(outfile, JSON.stringify(summary, null, 2));
  });

program
  .command("graph")
  .description("generate a graph of load test results")
  .option(
    "-b, --bucket [duration]",
    "group events into time buckets given length before graphing",
    "5m",
  )
  .option("-c, --act-json [name]", "name of inject act json to process", "<latest>-actress.json")
  .option("-d, --aud-json [name]", "name of result aud json to process", "<latest>-audience.json")
  .option("-o, --output-dir [path]", "path to folder containing result files", "./load")
  .action(async rawOpts => {
    //
    // sanitize / validate args
    //
    const opts = { bucket: 0, actJson: "", audJson: "", outputDir: "" };

    const bukTrim = rawOpts.bucket.trim();
    if (bukTrim === "") {
      console.error(
        `Invalid "--bucket" option: "${rawOpts.bucket}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    try {
      opts.bucket = lib.toMs(bukTrim);
    } catch (e) {
      console.error(`Invalid "--bucket" option: "${bukTrim}". ${e}.`);
      process.exit(1);
    }

    const outTrim = rawOpts.outputDir.trim();
    if (outTrim === "") {
      console.error(
        `Invalid "--output-dir" option: "${rawOpts.outputDir}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    const outAbs = path.resolve(outTrim);
    if (await fileUnreadable(outAbs)) {
      console.error(`Invalid "--output-dir" option: "${outAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.outputDir = path.resolve(outAbs);

    let actTrim = rawOpts.actJson.trim();
    if (actTrim === "") {
      console.error(
        `Invalid "--act-json" option: "${rawOpts.actJson}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    let actAbs = path.resolve(`${opts.outputDir}/${actTrim}`);
    if (path.basename(actAbs).endsWith("<latest>-actress.json")) {
      const files = await fs.readdir(path.dirname(actAbs));
      const log = files
        .filter(f => f.endsWith("-actress.json"))
        .sort()
        .at(-1)!;
      actTrim = log;
      actAbs = `${path.dirname(actAbs)}/${actTrim}`;
    }
    if (await fileUnreadable(actAbs)) {
      console.error(`Invalid "--act-json" option: "${actAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.actJson = actAbs;

    let audTrim = rawOpts.audJson.trim();
    if (audTrim === "") {
      console.error(
        `Invalid "--aud-json" option: "${rawOpts.audJson}". Cannot be empty / all whitespace.`,
      );
      process.exit(1);
    }
    let audAbs = path.resolve(`${opts.outputDir}/${audTrim}`);
    if (path.basename(audAbs).endsWith("<latest>-audience.json")) {
      const files = await fs.readdir(path.dirname(audAbs));
      const log = files
        .filter(f => f.endsWith("-audience.json"))
        .sort()
        .at(-1)!;
      audTrim = log;
      audAbs = `${path.dirname(audAbs)}/${audTrim}`;
    }
    if (await fileUnreadable(audAbs)) {
      console.error(`Invalid "--aud-json" option: "${audAbs}". Cannot access (read).`);
      process.exit(1);
    }
    opts.audJson = audAbs;

    //
    // run
    //
    const audJson = JSON.parse(await fs.readFile(opts.audJson, { encoding: "utf-8" }));

    log(`Determine current system user`);
    let cmd = new Cmd({ cmd: `echo "$(id -u):$(id -g)"` });
    log({ cmd: cmd.cmd });
    let result = await cmd.run();
    log(result, "");
    const user = result.stdout.join("").trim();

    let audAll = JSON.parse(await fs.readFile(opts.audJson, { encoding: "utf8" }));
    let watcherName = Object.keys(audAll)
      .filter(f => f.includes("watcher"))
      .at(0)!;
    let watcher: [number, number, string, number, string][] = audAll[watcherName];

    let mem: [number, number][] = watcher.map(m => [m[0], m[3]]);
    mem = mem.map(([ts, b]) => [ts, b / 1024 / 1024]);

    let actAll = JSON.parse(await fs.readFile(opts.actJson, { encoding: "utf8" }));
    let rps = lib.injectsToRps(actAll.injects);

    let memLimits = watcher.reduce(
      (acc, cur) => {
        return [cur[0] < acc[0] ? cur[0] : acc[0], cur[0] > acc[1] ? cur[0] : acc[1]];
      },
      [Infinity, -Infinity],
    );

    let rpsLimits = rps.reduce(
      (acc, cur) => {
        return [cur[0] < acc[0] ? cur[0] : acc[0], cur[0] > acc[1] ? cur[0] : acc[1]];
      },
      [Infinity, -Infinity],
    );

    let xMin = Math.min(memLimits[0], rpsLimits[0]);
    xMin = xMin - (xMin % opts.bucket);

    let xMax = Math.max(memLimits[1], rpsLimits[1]);
    xMax = xMax - (xMax % opts.bucket) + (opts.bucket - 1);

    let unifiedX: number[] = [];
    for (let x = xMin; x <= xMax; x = x + opts.bucket) {
      unifiedX.push(x);
    }

    let memY: [number, number][] = [];
    unifiedX.forEach((val, idx, arr) => {
      const nextVal = arr[idx + 1];
      const min = val;
      const max = nextVal ? nextVal - 1 : xMax;

      const group = mem.filter(([t, y]) => t >= min && t <= max);
      const ys = group.map<number>(([t, y]) => y);
      const avg = Math.round(R.sum(ys) / ys.length);

      memY.push([val, avg]);
    });

    let rpsY: [number, number][] = [];
    unifiedX.forEach((val, idx, arr) => {
      const nextVal = arr[idx + 1];
      const min = val;
      const max = nextVal ? nextVal - 1 : xMax;

      const group = rps.filter(([t, y]) => t >= min && t <= max);
      const ys = group.map<number>(([t, y]) => y);
      const avg = Math.round(R.sum(ys) / ys.length);

      rpsY.push([val, avg]);
    });

    let graph = path.basename(opts.audJson).replace("audience.json", watcherName);

    interface Plottable {
      mem: {
        y: number[];
        label: string;
      };
      rps: {
        y: number[];
        label: string;
      };
      title: string;
      x: number[];
      label: string;
      fname: string;
    }

    let plottable: Plottable = {
      mem: {
        y: memY.map(m => m[1]),
        label: "MiB",
      },
      rps: {
        y: rpsY.map(m => m[1]),
        label: "injects/sec",
      },
      title: watcherName,
      x: unifiedX.map((val, idx, arr) => (val - arr[0]) / 1000 / 60),
      label: `runtime (minutes) - buckets (${lib.toHuman(opts.bucket)})`,
      fname: graph,
    };

    log(`Write graphing script output dir`);
    const octaveScript = heredoc`
      StrData = fread(stdin, 'char') ;
      StrData = char( StrData.' ) ;
      JsonData = jsondecode(StrData) ;

      ax = plotyy (JsonData.x, JsonData.mem.y, JsonData.x, JsonData.rps.y) ;

      xlabel (JsonData.label) ;

      ylim (ax(1), "padded") ;
      ylabel (ax(1), JsonData.mem.label) ;

      ylim (ax(2), "padded") ;
      ylabel (ax(2), JsonData.rps.label) ;

      title (JsonData.title) ;
      fname = [ JsonData.fname ".png" ] ;
      print ("-dpng", fname) ;
    `;
    let octaveFile = `${opts.outputDir}/graph.m`;
    await fs.writeFile(octaveFile, octaveScript);
    log(`  script: ${octaveFile}`, "");

    log(`Generate graph`);
    let strCmd = [
      `docker run `,
      `--interactive `,
      `--user ${user} `,
      `--volume ${opts.outputDir}:/workdir `,
      `--platform linux/amd64 `,
      `gnuoctave/octave:9.2.0 `,
      `bash -c 'octave ${path.basename(octaveFile)}'`,
    ].join(" ");
    let stdin = [JSON.stringify(plottable)];
    cmd = new Cmd({ cmd: strCmd, stdin });
    log({ cmd: cmd.cmd });
    try {
      result = await cmd.run();
    } catch (e) {
      console.error(e);
    }
    log(result, "");
  });

program.parse(process.argv);
