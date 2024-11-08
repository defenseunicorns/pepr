// npx ts-node hack/load.ts prep ./
// npx ts-node hack/load.ts run ./pepr-0.0.0-development.tgz ./pepr-dev.tar ../pepr-excellent-examples/hello-pepr-soak-ci

import { Command } from "commander";
import { spawn } from "child_process";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as util from "node:util";

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

const createCluster = async (name: string) =>
  await new Cmd({ cmd: `k3d cluster create ${name}` }).run();

const deleteCluster = async (name: string) =>
  await new Cmd({ cmd: `k3d cluster delete ${name}` }).run();

const getKubeconfig = async (name: string) =>
  await new Cmd({ cmd: `k3d kubeconfig write ${name}` }).run();

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

    const pkg = `pepr-0.0.0-development.tgz`;
    const tag = `pepr:dev`;
    const img = `pepr-dev.tar`;

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
      cmd = new Cmd({ cmd: `docker save --output ${img} ${tag}`, cwd: args.src });
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

    await cleanWorkdirs();

    console.log(`Setup working directory:`);
    let workdir = await createWorkdir();

    process.stdout.write(`  copy module (${args.module}) into workdir (${workdir})...`);
    await fs.cp(args.module, workdir, { recursive: true });
    await Promise.all(
      (await fs.readdir(args.module, { recursive: true }))
        .filter(f => /\.test\./.test(f))
        .map(f => fs.rm(`${workdir}/${f}`)),
    );
    console.log(` done!\n`);

    let worktgz = `${workdir}/${path.basename(args.tgz)}`;
    process.stdout.write(`  copy tgz (${args.tgz}) into workdir (${worktgz})...`);
    await fs.cp(args.tgz, worktgz);
    console.log(` done!\n`);

    process.stdout.write(
      `  install tgz (${args.tgz}) into workdir package.json (${workdir}/package.json)...`,
    );
    await new Cmd({ cmd: `npm install ${path.basename(worktgz)}`, cwd: workdir }).run();
    console.log(" done!\n");

    //
    // run test
    //

    let result = await new Cmd({
      cmd: `npx --yes ${path.basename(worktgz)} --version`,
      cwd: workdir,
    }).run();
    let peprVer = result.stdout.join("\n");
    console.log(`Pepr CLI version ${peprVer} (${worktgz})\n`);

    result = await new Cmd({ cmd: `k3d --version` }).run();
    console.log(result.stdout.join("\n"));

    try {
      if (opts.clusterAuto) {
        let clusters = await availableClusters();
        if (clusters.includes(opts.clusterName)) {
          console.log(
            `Cluster "${opts.clusterName}" found in ` +
              `available clusters: ${JSON.stringify(clusters)}. Continuing!\n`,
          );
        } else {
          process.stdout.write(
            `Cluster "${opts.clusterName}" not in ` +
              `available clusters: ${JSON.stringify(clusters)}. Creating...`,
          );
          await createCluster(opts.clusterName);
          console.log(" done!\n");
        }
      }

      let clusters = await availableClusters();
      console.log(`Available clusters: ${JSON.stringify(clusters)}\n`);

      if (!clusters.includes(opts.clusterName)) {
        console.error(
          `Cluster "${opts.clusterName}" not in ` +
            `available clusters: ${JSON.stringify(clusters)}. Quitting!`,
        );
        process.exit(1);
      }

      process.stdout.write(`Load "${args.img}" into "${opts.clusterName}" cluster...`);
      await new Cmd({ cmd: `k3d image import "${img}" --cluster "${opts.clusterName}"` }).run();
      console.log(" done!\n");

      // let kubeConfig = (await getKubeconfig(opts.clusterName)).stdout.join("").trim();
      // result = await new Cmd({
      //   cmd: `kubectl get namespaces --all-namespaces --output=json`,
      //   env: { KUBECONFIG: kubeConfig }
      // }).run();
      // console.log(JSON.parse(result.stdout.join("")));

      // KUBECONFIG=$(k3d kubeconfig write pepr-load) npx --yes pepr-0.0.0-development.tgz deploy --image pepr:dev --confirm

      // Just log Result objs..?
      // console.log intention message
      // console.log cmd
      // console.log Result
    } finally {
      await cleanWorkdirs();
      if (opts.clusterAuto) {
        let clusters = await availableClusters();
        process.stdout.write(
          `Cluster "${opts.clusterName}" found in ` +
            `available clusters: ${JSON.stringify(clusters)}. Cleaning up...`,
        );
        await deleteCluster(opts.clusterName);
        console.log(" done!\n");
      }
    }
  });

program.parse(process.argv);
