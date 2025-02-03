// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import { promisify } from "node:util";
import * as child_process from "node:child_process";
const exec = promisify(child_process.exec);
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { chmodSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import * as crypto from "node:crypto";
import { heredoc } from "./heredoc";

import * as sut from "./cosign";

const secs = (s: number) => s * 1000;
const mins = (m: number) => m * secs(60);

const cmd = async (command: string, opts = {}) => await exec(command, opts);
const cmdStdout = async (command: string, opts = {}) => (await cmd(command, opts)).stdout.trim();
const cmdStderr = async (command: string, opts = {}) => (await cmd(command, opts)).stderr.trim();
const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const workdirPrefix = () => join(tmpdir(), `${basename(__filename)}-`);

async function createWorkdir() {
  const prefix = workdirPrefix();
  return await mkdtemp(prefix);
}

async function cleanWorkdirs() {
  const prefix = workdirPrefix();
  const dir = dirname(prefix);
  const pre = basename(prefix);

  const workdirs = readdirSync(dir)
    .filter(f => f.startsWith(pre))
    .map(m => join(dir, m));

  await Promise.all(workdirs.map(m => rm(m, { recursive: true, force: true })));
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
const timed = async (msg: string, func: () => Promise<any>) => {
  console.time(msg);
  const result = await func();
  console.timeEnd(msg);
  return result;
};

async function builderExists(name: string) {
  const resultRaw = await cmdStdout(`docker buildx ls`);
  return resultRaw.includes(name);
}

enum OS {
  Linux = "Linux",
  Mac = "Darwin",
}

enum Arch {
  x86_64 = "x86_64",
  arm64 = "arm64",
}

const sniffOS = async () => await cmdStdout("uname -s");
const sniffArch = async () => await cmdStdout("uname -m");

async function downloadCosign(path: string, fname: string) {
  const local = join(path, fname);

  if (await exists(local)) {
    return local;
  }

  let os = await sniffOS();
  os = os === OS.Linux ? OS.Linux.toLowerCase() : os;
  os = os === OS.Mac ? OS.Mac.toLowerCase() : os;

  let arch = await sniffArch();
  arch = arch === Arch.x86_64 ? "amd64" : arch;

  const got = await sut.get(
    "https://api.github.com/repos/sigstore/cosign/releases/latest",
    "application/json",
  );
  const ver = JSON.parse(got.body)["tag_name"];

  const remote = `https://github.com/sigstore/cosign/releases/download/${ver}/cosign-${os}-${arch}`;
  await sut.download(remote, local);
  chmodSync(local, 0o777);

  return local;
}

/*
  Useful during dev but commented out for speed & network reasons
*/
// describe("downloadCosign()", () => {
//   let workdir: string;

//   beforeAll(async () => {
//     workdir = await createWorkdir();
//   });

//   afterAll(async () => {
//     await cleanWorkdirs();
//   });

//   it("works", async () => {
//     const cosign = await downloadCosign(workdir, "cosign");
//     const result = await cmdStdout(`${cosign} version`, { cwd: workdir });
//     expect(result).toMatch(/cosign: A tool/);
//   });
// });

async function downloadCrane(path: string, fname: string) {
  const local = join(path, fname);
  const localTgz = `${local}.tar.gz`;

  if (await exists(local)) {
    return local;
  }

  const os = await sniffOS();
  const arch = await sniffArch();

  const got = await sut.get(
    "https://api.github.com/repos/google/go-containerregistry/releases/latest",
    "application/json",
  );
  const ver = JSON.parse(got.body)["tag_name"];

  const remote = `https://github.com/google/go-containerregistry/releases/download/${ver}/go-containerregistry_${os}_${arch}.tar.gz`;
  await sut.download(remote, localTgz);

  await cmdStdout(`tar -zxvf ${localTgz} ${fname}`, { cwd: path });
  chmodSync(local, 0o777);

  return local;
}

/*
  Useful during dev but commented out for speed & network reasons
*/
// describe("downloadCrane()", () => {
//   let workdir: string;

//   beforeAll(async () => {
//     workdir = await createWorkdir();
//   });

//   afterAll(async () => {
//     await cleanWorkdirs();
//   });

//   it("works", async () => {
//     const crane = await downloadCrane(workdir, "crane");
//     const result = await cmdStdout(`${crane} --help`, { cwd: workdir });
//     expect(result).toMatch(/Crane is a tool/);
//   });
// });

async function genTlsCrt(workdir: string) {
  const tlsKey = `${workdir}/tls-key.pem`;
  const tlsCsr = `${workdir}/tls-csr.pem`;
  const tlsCrt = `${workdir}/tls-crt.pem`;

  let command = `openssl genrsa -out ${tlsKey} 1024`;
  await cmd(command);

  command =
    `openssl req -new -key ${tlsKey} -out ${tlsCsr}` +
    ` -subj "/C=US/ST=Colorado/L=Colorado Springs/O=Defense Unicorns/CN=localhost"` +
    ` -addext "subjectAltName = DNS:localhost"`;
  await cmd(command);

  command =
    `openssl x509 -req -in ${tlsCsr} -key ${tlsKey} -out ${tlsCrt}` + ` -copy_extensions copyall`;
  await cmd(command);

  return { key: tlsKey, crt: tlsCrt };
}

async function startZotRegistry(workdir: string, tlsKey: string, tlsCrt: string) {
  const innerKey = `/${basename(tlsKey)}`;
  const innerCrt = `/${basename(tlsCrt)}`;

  // https://images.chainguard.dev/directory/image/zot/overview
  const containerName = `${basename(__filename)}.zot`;

  const imageRef = "cgr.dev/chainguard/zot:latest";

  const outerData = `${workdir}/data`;
  const innerData = "/var/lib/zot/data";

  const outerPort = "50000";
  const innerPort = "5000";

  const outerConf = `${workdir}/zot-config.yaml`;
  const innerConf = "/zot-config.yaml";

  await mkdir(outerData);
  chmodSync(outerData, 0o777);

  const yaml = heredoc`
    distspecversion: 1.1.0-dev
    http:
      address: 0.0.0.0
      port: ${innerPort}
      tls:
        key: ${innerKey}
        cert: ${innerCrt}
    storage:
      rootdirectory: ${innerData}
  `;
  await writeFile(outerConf, yaml);

  const command = `
    docker run --rm --detach
      --name "${containerName}"
      --user $(id -u):$(id -g)
      --publish ${outerPort}:${innerPort}
      --volume ${tlsKey}:${innerKey}
      --volume ${tlsCrt}:${innerCrt}
      --volume "${outerConf}":${innerConf}
      --volume "${outerData}":${innerData}
      ${imageRef}
      serve ${innerConf}
  `
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  await cmdStdout(command, { cwd: workdir });
}

async function stopZotRegistry() {
  const containerName = `${basename(__filename)}.zot`;

  let cmd = `docker ps --filter name=${containerName} --quiet`;
  const containerId = await cmdStdout(cmd);

  cmd = `docker kill ${containerId}`;
  await cmdStdout(cmd);
}

/*
  Useful during dev but commented out for speed & network reasons
*/
// describe("Zot Registry", () => {
//   let workdir: string;
//   let tlsKey: string;
//   let tlsCrt: string;

//   beforeAll(async () => {
//     workdir = await createWorkdir();
//     ({ key: tlsKey, crt: tlsCrt } = await genTlsCrt(workdir));
//   });

//   afterAll(async () => {
//     await cleanWorkdirs();
//   });

//   it(
//     "works",
//     async () => {
//       await startZotRegistry(workdir, tlsKey, tlsCrt);

//       const containerName = `${basename(__filename)}.zot`;
//       const cmd = `docker ps --filter name=${containerName} --quiet`;
//       const containerId = await cmdStdout(cmd);

//       await stopZotRegistry();

//       expect(containerId).not.toBe("");
//     },
//     mins(1),
//   );
// });

async function startDockerRegistry(workdir: string, tlsKey: string, tlsCrt: string) {
  const innerKey = `/${basename(tlsKey)}`;
  const innerCrt = `/${basename(tlsCrt)}`;

  // https://distribution.github.io/distribution/about/configuration/
  const containerName = `${basename(__filename)}.dkr`;

  const imageRef = "docker.io/library/registry:latest";

  const outerData = `${workdir}/data`;
  const innerData = "/var/lib/registry";

  const outerPort = "50001";
  const innerPort = "443";

  const outerConf = `${workdir}/dkr-config.yaml`;
  const innerConf = "/etc/docker/registry/config.yml";

  await mkdir(outerData);
  chmodSync(outerData, 0o777);

  const yaml = heredoc`
    version: 0.1
    log:
      level: debug
      fields:
        service: registry
    storage:
      cache:
        blobdescriptor: inmemory
      filesystem:
        rootdirectory: ${innerData}
    http:
      relativeurls: true
      addr: :${innerPort}
      host: https://localhost:${outerPort}
      headers:
        X-Content-Type-Options: [nosniff]
      tls:
        certificate: ${innerCrt}
        key: ${innerKey}
    health:
      storagedriver:
        enabled: true
        interval: 10s
        threshold: 3
  `;
  await writeFile(outerConf, yaml);

  const command = `
    docker run --rm --detach
      --name "${containerName}"
      --user $(id -u):$(id -g)
      --publish ${outerPort}:${innerPort}
      --volume ${tlsKey}:${innerKey}
      --volume ${tlsCrt}:${innerCrt}
      --volume "${outerConf}":${innerConf}
      --volume "${outerData}":${innerData}
      ${imageRef}
  `
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  await cmdStdout(command, { cwd: workdir });
}

async function stopDockerRegistry() {
  const containerName = `${basename(__filename)}.dkr`;

  let cmd = `docker ps --filter name=${containerName} --quiet`;
  const containerId = await cmdStdout(cmd);

  cmd = `docker kill ${containerId}`;
  await cmdStdout(cmd);
}

/*
  Useful during dev but commented out for speed & network reasons
*/
// describe("Docker Registry", () => {
//   let workdir: string;
//   let tlsKey: string;
//   let tlsCrt: string;

//   beforeAll(async () => {
//     workdir = await createWorkdir();
//     ({ key: tlsKey, crt: tlsCrt } = await genTlsCrt(workdir));
//   });

//   afterAll(async () => {
//     await cleanWorkdirs();
//   });

//   it(
//     "works",
//     async () => {
//       await startDockerRegistry(workdir, tlsKey, tlsCrt);

//       const containerName = `${basename(__filename)}.dkr`;
//       const cmd = `docker ps --filter name=${containerName} --quiet`;
//       const containerId = await cmdStdout(cmd);

//       await stopDockerRegistry();

//       expect(containerId).not.toBe("");
//     },
//     mins(1),
//   );
// });

/*
  "Gold standard" -- uses cosign CLI to do what we want to do in JS
    useful during dev but commented out for speed & network reasons
*/
// describe("cosign CLI - ttl.sh - pub/prv keys", () => {
//   let cosign: string;
//   let workdir: string;

//   const passwd = "password";
//   const prefix = "signing";
//   const pubkey = `${prefix}.pub`;
//   const prvkey = `${prefix}.key`;

//   const iref = `ttl.sh/${crypto.randomUUID()}:2m`;

//   beforeAll(async () => {
//     workdir = await timed("creating workdir", createWorkdir);

//     cosign = await timed(
//       "getting cosign CLI binary",
//       async () => await downloadCosign(workdir, "cosign"),
//     );

//     await timed(`generating signing keypair: ${prefix}.*`, async () =>
//       cmdStderr(`${cosign} generate-key-pair --output-key-prefix=${prefix}`, {
//         cwd: workdir,
//         env: { COSIGN_PASSWORD: passwd },
//       }),
//     );

//     await writeFile(`${workdir}/Dockerfile`, "FROM docker.io/library/hello-world");
//     await timed(`uploading container image: ${iref}`, async () =>
//       cmdStderr(`docker build --tag ${iref} --push .`, { cwd: workdir }),
//     );

//     await timed(`signing image: ${iref}`, async () =>
//       cmdStderr(`${cosign} sign --tlog-upload=false --key=${prvkey} ${iref}`, {
//         cwd: workdir,
//         env: { COSIGN_PASSWORD: passwd },
//       }),
//     );
//   }, mins(1));

//   afterAll(async () => await cleanWorkdirs());

//   it("can be verified via CLI", async () => {
//     const result = await cmdStderr(
//       `${cosign} verify --insecure-ignore-tlog=true --key=${pubkey} ${iref}`,
//       { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
//     );

//     expect(result).not.toContain("no matching signatures");
//     expect(result).toContain("signatures were verified");
//   });
// });

describe("sigstore-js - zot (OCI) - pub/prv keys", () => {
  let workdir: string;
  let tlsKey: string;
  let tlsCrt: string;

  let cosign: string;
  let crane: string;

  const passwd = "password";
  const prefix = "signing";
  const rawPrvkey = `${prefix}-raw.key`;
  const rawPubkey = `${prefix}-raw.pub`;
  const cosPrvkey = `${prefix}-cos.key`;
  // const cosPubkey = `${prefix}-cos.pub`;

  const iref = `localhost:50000/${crypto.randomUUID()}:latest`;

  beforeAll(async () => {
    workdir = await timed("creating workdir", createWorkdir);

    await timed("generating TLS certificate", async () => {
      ({ key: tlsKey, crt: tlsCrt } = await genTlsCrt(workdir));
    });

    await timed("starting Zot container registry", async () => {
      await startZotRegistry(workdir, tlsKey, tlsCrt);
    });

    const npmBin = `${await cmdStdout("npm root")}/.bin`;
    cosign = await timed(
      "getting cosign CLI binary",
      async () => await downloadCosign(npmBin, "cosign"),
    );

    crane = await timed(
      "getting crane CLI binary",
      async () => await downloadCrane(npmBin, "crane"),
    );

    await timed(`generating keypair: ${prefix}.*`, async () => {
      const keypair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });

      await writeFile(
        `${workdir}/${rawPubkey}`,
        keypair.publicKey.export({ format: "pem", type: "spki" }).toString("ascii"),
      );
      chmodSync(`${workdir}/${rawPubkey}`, 0o644);

      await writeFile(
        `${workdir}/${rawPrvkey}`,
        keypair.privateKey.export({ format: "pem", type: "pkcs8" }).toString("ascii"),
      );
      chmodSync(`${workdir}/${rawPrvkey}`, 0o600);
    });

    await timed(
      `converting ${rawPrvkey} (node crypto) to ${cosPrvkey} (cosign native)`,
      async () =>
        await cmdStderr(
          `${cosign} import-key-pair --key=${rawPrvkey} --output-key-prefix=${basename(cosPrvkey, ".key")}`,
          {
            cwd: workdir,
            env: { COSIGN_PASSWORD: passwd },
          },
        ),
    );

    await timed(
      "generating test dockerfile",
      async () => await writeFile(`${workdir}/Dockerfile`, "FROM docker.io/library/hello-world"),
    );

    const builder = `${basename(__filename)}-oci`;
    await timed(`creating docker buildx oci builder (${builder})`, async () => {
      if (await builderExists(builder)) {
        return;
      }

      const cmd = `
        docker buildx create
          --driver docker-container
          --driver-opt image=moby/buildkit:master,network=host
          --name=${builder}
          --bootstrap
        `
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      await cmdStdout(cmd);
    });

    await timed(`uploading test container image: ${iref}`, async () => {
      const dir = `${workdir}/image.dir`;

      const command = `
      docker buildx build
        --platform linux/amd64
        --tag ${iref}
        --output type=oci,tar=false,dest=${dir}
        --builder=${builder}
        .
      `
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      await cmd(command, { cwd: workdir });
      await cmd(`${crane} --insecure push ${dir} ${iref}`);
    });

    await timed(`removing docker buildx oci builder (${builder})`, async () => {
      if (!(await builderExists(builder))) {
        return;
      }
      await cmdStdout(`docker buildx rm ${builder}`);
    });

    await timed(`cosign signing image: ${iref}`, async () =>
      cmdStderr(
        `${cosign} sign --allow-insecure-registry=true --tlog-upload=false --key=${cosPrvkey} ${iref}`,
        {
          cwd: workdir,
          env: { COSIGN_PASSWORD: passwd },
        },
      ),
    );
  }, mins(2));

  afterAll(async () => {
    await stopZotRegistry();
    await cleanWorkdirs();
  });

  it("verifies successfully", async () => {
    const tlsCrts = [await readFile(tlsCrt, { encoding: "utf-8" })];

    const verified = await sut.verifyImage(iref, [`${workdir}/${rawPubkey}`], tlsCrts);

    expect(verified).toBe(true);
  });
});

describe("sigstore-js - registry (Docker) - pub/prv keys", () => {
  let workdir: string;
  let tlsKey: string;
  let tlsCrt: string;

  let cosign: string;
  let crane: string;

  const passwd = "password";
  const prefix = "signing";
  const rawPrvkey = `${prefix}-raw.key`;
  const rawPubkey = `${prefix}-raw.pub`;
  const cosPrvkey = `${prefix}-cos.key`;
  // const cosPubkey = `${prefix}-cos.pub`;

  const iref = `localhost:50001/${crypto.randomUUID()}:latest`;

  beforeAll(async () => {
    workdir = await timed("creating workdir", createWorkdir);

    await timed("generating TLS certificate", async () => {
      ({ key: tlsKey, crt: tlsCrt } = await genTlsCrt(workdir));
    });

    await timed("starting Docker container registry", async () => {
      await startDockerRegistry(workdir, tlsKey, tlsCrt);
    });

    const npmBin = `${await cmdStdout("npm root")}/.bin`;
    cosign = await timed(
      "getting cosign CLI binary",
      async () => await downloadCosign(npmBin, "cosign"),
    );

    crane = await timed(
      "getting crane CLI binary",
      async () => await downloadCrane(npmBin, "crane"),
    );

    await timed(`generating signing keypair: ${prefix}.*`, async () => {
      const keypair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });

      await writeFile(
        `${workdir}/${rawPubkey}`,
        keypair.publicKey.export({ format: "pem", type: "spki" }).toString("ascii"),
      );
      chmodSync(`${workdir}/${rawPubkey}`, 0o644);

      await writeFile(
        `${workdir}/${rawPrvkey}`,
        keypair.privateKey.export({ format: "pem", type: "pkcs8" }).toString("ascii"),
      );
      chmodSync(`${workdir}/${rawPrvkey}`, 0o600);
    });

    await timed(
      `converting ${rawPrvkey} (node crypto) to ${cosPrvkey} (cosign native)`,
      async () =>
        await cmdStderr(
          `${cosign} import-key-pair --key=${rawPrvkey} --output-key-prefix=${basename(cosPrvkey, ".key")}`,
          {
            cwd: workdir,
            env: { COSIGN_PASSWORD: passwd },
          },
        ),
    );

    await timed(
      "generating test dockerfile",
      async () => await writeFile(`${workdir}/Dockerfile`, "FROM docker.io/library/hello-world"),
    );

    await timed(`uploading test container image: ${iref}`, async () => {
      let command = `docker build --tag ${iref} --output type=docker .`;
      await cmd(command, { cwd: workdir });

      const tar = `${workdir}/image.tar`;
      command = `docker save --output ${tar} ${iref}`;
      await cmd(command);

      await cmd(`${crane} push --insecure ${tar} ${iref}`);
    });

    await timed(`cosign signing image: ${iref}`, async () =>
      cmdStderr(
        `${cosign} sign --allow-insecure-registry=true --tlog-upload=false --key=${cosPrvkey} ${iref}`,
        {
          cwd: workdir,
          env: { COSIGN_PASSWORD: passwd },
        },
      ),
    );
  }, mins(2));

  afterAll(async () => {
    await stopDockerRegistry();
    await cleanWorkdirs();
  });

  it("verifies successfully", async () => {
    const tlsCrts = [await readFile(tlsCrt, { encoding: "utf-8" })];

    const verified = await sut.verifyImage(iref, [`${workdir}/${rawPubkey}`], tlsCrts);

    expect(verified).toBe(true);
  });
});
