// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import { promisify } from "node:util";
import * as child_process from "node:child_process";
const exec = promisify(child_process.exec);
import { https } from "follow-redirects";
import { access, mkdir, mkdtemp, readFile, rm, writeFile, unlink } from "node:fs/promises";
import { chmodSync, createWriteStream, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import * as crypto from "node:crypto";
import { toTrustMaterial, Verifier } from "@sigstore/verify";
import { PublicKeyDetails, TrustedRoot } from "@sigstore/protobuf-specs";
import { bundleFromJSON } from "@sigstore/bundle";
import { toSignedEntity } from "@sigstore/verify";
import { heredoc } from "./heredoc";

// import * as sut from "./cosign";

const secs = (s: number) => s * 1000;
const mins = (m: number) => m * secs(60);

enum MediaTypeDockerV2 {
  Manifest = "application/vnd.docker.distribution.manifest.v2+json",
}

enum MediaTypeOciV1 {
  Manifest = "application/vnd.oci.image.manifest.v1+json",
  Index = "application/vnd.oci.image.index.v1+json",
  Package = "application/vnd.zarf.config.v1+json",
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function head(rawUrl: string, mediaType: string): Promise<any> {
  const url = new URL(rawUrl);

  return new Promise((resolve, reject) => {
    const opts = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "HEAD",
      headers: { Accept: mediaType },
    };

    https
      .request(opts, resp => {
        const { statusCode } = resp;

        let error;
        if (!statusCode?.toString().startsWith("2") && !statusCode?.toString().startsWith("3")) {
          reject(new Error(`err: status code: ${statusCode}: expected 2xx|3xx`));
          error = true;
        }

        if (error) {
          resp.resume();
          return;
        }

        resp.setEncoding("utf8");

        resp.on("data", () => {});

        resp.on("end", () => {
          resolve(resp.headers);
        });
      })
      .on("error", e => reject(e))
      .end();
  });
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function get(rawUrl: string, mediaType: string): Promise<any> {
  const url = new URL(rawUrl);

  return new Promise((resolve, reject) => {
    const opts = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "GET",
      headers: {
        "User-Agent": "node",
        Accept: mediaType,
      },
    };

    https
      .request(opts, resp => {
        const { statusCode } = resp;

        let error;

        if (!statusCode?.toString().startsWith("2") && !statusCode?.toString().startsWith("3")) {
          console.log(resp.headers);
          reject(new Error(`err: status code: ${statusCode}: expected 2xx`));
          error = true;
        }

        if (error) {
          resp.resume();
          return;
        }

        resp.setEncoding("utf8");

        let raw = "";
        resp.on("data", chunk => {
          raw += chunk;
        });
        resp.on("end", () => {
          try {
            resolve({ head: resp.headers, body: raw });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", e => reject(e))
      .end();
  });
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function download(rawUrl: string, localPath: string): Promise<void> {
  const url = new URL(rawUrl);

  return new Promise((resolve, reject) => {
    const opts = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "GET",
      headers: {
        "User-Agent": "node",
        Accept: "application/octet-stream",
      },
    };

    https
      .request(opts, resp => {
        const { statusCode } = resp;

        let error;

        if (!statusCode?.toString().startsWith("2") && !statusCode?.toString().startsWith("3")) {
          console.log(resp.headers);
          reject(new Error(`err: status code: ${statusCode}: expected 2xx`));
          error = true;
        }

        if (error) {
          resp.resume();
          return;
        }

        const ws = createWriteStream(localPath).on("finish", () => {
          ws.close(() => resolve());
        });

        resp.pipe(ws);
      })
      .on("error", async err => {
        await unlink(localPath);
        reject(err);
      })
      .end();
  });
}

const cmd = async (command: string, opts = {}) => await exec(command, opts);
const cmdStdout = async (command: string, opts = {}) => (await cmd(command, opts)).stdout.trim();
const cmdStderr = async (command: string, opts = {}) => (await cmd(command, opts)).stderr.trim();
const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch (e) {
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

  const got = await get(
    "https://api.github.com/repos/sigstore/cosign/releases/latest",
    "application/json",
  );
  const ver = JSON.parse(got.body)["tag_name"];

  const remote = `https://github.com/sigstore/cosign/releases/download/${ver}/cosign-${os}-${arch}`;
  await download(remote, local);
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

  const got = await get(
    "https://api.github.com/repos/google/go-containerregistry/releases/latest",
    "application/json",
  );
  const ver = JSON.parse(got.body)["tag_name"];

  const remote = `https://github.com/google/go-containerregistry/releases/download/${ver}/go-containerregistry_${os}_${arch}.tar.gz`;
  await download(remote, localTgz);

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

async function startZotRegistry(workdir: string) {
  // https://images.chainguard.dev/directory/image/zot/overview
  const containerName = `${basename(__filename)}.zot`;

  const imageRef = "cgr.dev/chainguard/zot:latest";

  const outerData = `${workdir}/data`;
  const innerData = "/var/lib/zot/data";

  const outerPort = "54321";
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
    storage:
      rootdirectory: ${innerData}
  `;
  await writeFile(outerConf, yaml);

  const cmd = `
    docker run --rm --detach
      --name "${containerName}"
      --user $(id -u):$(id -g)
      --publish ${outerPort}:${innerPort}
      --volume "${outerConf}":${innerConf}
      --volume "${outerData}":${innerData}
      ${imageRef}
      serve ${innerConf}
  `
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  await cmdStdout(cmd, { cwd: workdir });
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

//   beforeAll(async () => {
//     workdir = await createWorkdir();
//   });

//   afterAll(async () => {
//     await cleanWorkdirs();
//   });

//   it(
//     "works",
//     async () => {
//       await startZotRegistry(workdir);

//       const containerName = `${basename(__filename)}.zot`;
//       const cmd = `docker ps --filter name=${containerName} --quiet`;
//       const containerId = await cmdStdout(cmd);

//       await stopZotRegistry();

//       expect(containerId).not.toBe("");
//     },
//     mins(1),
//   );
// });

/* eslint-disable  @typescript-eslint/no-explicit-any */
const timed = async (msg: string, func: () => Promise<any>) => {
  console.time(msg);
  const result = await func();
  console.timeEnd(msg);
  return result;
};

const indent = (msg: string) =>
  msg
    .split("\n")
    .map(m => `  ${m}`)
    .join("\n");

describe("cosign CLI - pub/prv keys", () => {
  let cosign: string;
  let workdir: string;

  const passwd = "password";
  const prefix = "signing";
  const pubkey = `${prefix}.pub`;
  const prvkey = `${prefix}.key`;

  const iref = `ttl.sh/${crypto.randomUUID()}:2m`;

  beforeAll(async () => {
    // result = await cmdStdout("npm root");
    // const local = `${result}/.bin/cosign`;
    cosign = await timed(
      "getting cosign CLI binary",
      async () => await downloadCosign(workdir, "cosign"),
    );
    console.log(`  cosign: ${cosign}`);

    workdir = await timed("creating workdir", createWorkdir);
    console.log(`  workdir: ${workdir}`);

    let result;
    result = await timed(`generating keypair: ${prefix}.*`, async () =>
      cmdStderr(`${cosign} generate-key-pair --output-key-prefix=${prefix}`, {
        cwd: workdir,
        env: { COSIGN_PASSWORD: passwd },
      }),
    );
    console.log(indent(result));

    await writeFile(`${workdir}/Dockerfile`, "FROM docker.io/library/hello-world");
    result = await timed(`uploading container image: ${iref}`, async () =>
      cmdStderr(`docker build --tag ${iref} --push .`, { cwd: workdir }),
    );
    console.log(indent(result));

    result = await timed(`signing image: ${iref}`, async () =>
      cmdStderr(`${cosign} sign --tlog-upload=false --key=${prvkey} ${iref}`, {
        cwd: workdir,
        env: { COSIGN_PASSWORD: passwd },
      }),
    );
  }, mins(1));

  afterAll(async () => await cleanWorkdirs());

  it("can be verified via CLI", async () => {
    const result = await cmdStderr(
      `${cosign} verify --insecure-ignore-tlog=true --key=${pubkey} ${iref}`,
      { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    );

    expect(result).not.toContain("no matching signatures");
    expect(result).toContain("signatures were verified");
  });
});

describe("sigstore-js - pub/prv keys", () => {
  let cosign: string;
  let workdir: string;

  const passwd = "password";
  const prefix = "signing";
  const rawPrvkey = `${prefix}-raw.key`;
  const rawPubkey = `${prefix}-raw.pub`;
  const cosPrvkey = `${prefix}-cos.key`;
  // const cosPubkey = `${prefix}-cos.pub`;

  const iref = `ttl.sh/${crypto.randomUUID()}:2m`;

  beforeAll(async () => {
    // result = await cmdStdout("npm root");
    // const local = `${result}/.bin/cosign`;
    cosign = await timed(
      "getting cosign CLI binary",
      async () => await downloadCosign(workdir, "cosign"),
    );
    console.log(`  cosign: ${cosign}`);

    workdir = await timed("creating workdir", createWorkdir);
    console.log(`  workdir: ${workdir}`);

    let result;
    result = await timed(`generating keypair: ${prefix}.*`, async () => {
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
    console.log(indent(`Public key written to ${rawPubkey}`));
    console.log(indent(`Private key written to ${rawPrvkey}`));

    result = await timed(`converting ${rawPrvkey} to ${cosPrvkey}`, async () =>
      cmdStderr(
        `${cosign} import-key-pair --key=${rawPrvkey} --output-key-prefix=${basename(cosPrvkey, ".key")}`,
        {
          cwd: workdir,
          env: { COSIGN_PASSWORD: passwd },
        },
      ),
    );

    await writeFile(`${workdir}/Dockerfile`, "FROM docker.io/library/hello-world");
    result = await timed(`uploading container image: ${iref}`, async () =>
      cmdStderr(`docker build --tag ${iref} --push .`, { cwd: workdir }),
    );
    console.log(indent(result));

    result = await timed(`signing image: ${iref}`, async () =>
      cmdStderr(`${cosign} sign --tlog-upload=false --key=${cosPrvkey} ${iref}`, {
        cwd: workdir,
        env: { COSIGN_PASSWORD: passwd },
      }),
    );
  }, mins(1));

  afterAll(async () => await cleanWorkdirs());

  it("can be verified via sigstore-js", async () => {
    const imgDigest = await cmdStdout(`crane digest ${iref}`, {
      cwd: workdir,
      env: { COSIGN_PASSWORD: passwd },
    });
    console.log("crane digest:", imgDigest);

    const imgManifest = await cmdStdout(`crane manifest ${iref}`, {
      cwd: workdir,
      env: { COSIGN_PASSWORD: passwd },
    });
    console.log("crane manifest:", imgManifest);

    const dotSig = await cmdStdout(`${cosign} triangulate ${iref}`, {
      cwd: workdir,
      env: { COSIGN_PASSWORD: passwd },
    });
    console.log("cosign triangulate:", dotSig);

    const sigManifest = await cmdStdout(`crane manifest ${dotSig}`, {
      cwd: workdir,
      env: { COSIGN_PASSWORD: passwd },
    });
    console.log("crane manifest (dotSig):", JSON.stringify(JSON.parse(sigManifest), null, 2));

    // https://github.com/sigstore/sigstore-js/blob/main/packages/verify/src/__tests__/verifier.test.ts
    const pubKeyRaw = await readFile(`${workdir}/${rawPubkey}`, { encoding: "utf8" });
    const pubKey = crypto.createPublicKey({
      key: pubKeyRaw,
      format: "pem",
      encoding: "utf-8",
    });

    const trustedRoot = {
      tlogs: [],
      ctlogs: [],
      timestampAuthorities: [],
      certificateAuthorities: [],
    } as unknown as TrustedRoot;

    const keys = {
      hint: {
        rawBytes: pubKey.export({ type: "spki", format: "der" }),
        keyDetails: PublicKeyDetails.PKIX_ECDSA_P256_SHA_256,
      },
    };
    const trustMaterial = toTrustMaterial(trustedRoot, keys);

    const subject = new Verifier(trustMaterial, {
      ctlogThreshold: 0,
      tlogThreshold: 0,
      tsaThreshold: 0,
    });

    const sig = JSON.parse(sigManifest).layers[0].annotations["dev.cosignproject.cosign/signature"];
    console.log("sig (enc):", sig);
    console.log("sig (dec):", Buffer.from(sig, "base64").toString("utf8"));

    // host     /name               :tag
    // docker.io/library/hello-world:latest

    // host  /name                                :tag
    // ttl.sh/5dad3c9b-7ccc-4115-be27-c9244e7c0e06:2m

    const irefHost = iref.split("/")[0];
    const irefImage = iref.replace(`${irefHost}/`, "");
    const irefTag = irefImage.split(":").at(-1);
    const irefName = irefImage.replace(`:${irefTag}`, "");

    const manifestUrl = `https://${irefHost}/v2/${irefName}/manifests/${irefTag}`;
    console.log("manifestUrl", manifestUrl);

    const supportsMediaType = async (url: string, mediaType: string) => {
      return (await head(url, mediaType))["content-type"] === mediaType;
    };

    const canOciV1Manifest = async (manifestUrl: string) => {
      return supportsMediaType(manifestUrl, MediaTypeOciV1.Manifest);
    };

    const canDockerV2Manifest = async (manifestUrl: string) => {
      return supportsMediaType(manifestUrl, MediaTypeDockerV2.Manifest);
    };

    // { head: {}, body: "" }
    // prettier-ignore
    const imageManifest = 
      await canOciV1Manifest(manifestUrl) ? await get(manifestUrl, MediaTypeOciV1.Manifest) :
      await canDockerV2Manifest(manifestUrl) ? await get(manifestUrl, MediaTypeDockerV2.Manifest) :
      (() => { throw "Can't pull image manifest with supported MediaType." })();
    console.log("imageManifest", imageManifest);

    const imageDigest = `sha256:${crypto
      .createHash("sha256")
      .update(imageManifest.body)
      .digest("hex")
      .toString()}`;
    console.log("imageDigest", imageDigest);

    const sigTag = `${imageDigest.replace(":", "-")}.sig`;
    console.log("sigTag", sigTag);

    const triangulated = `${irefHost}/${irefName}:${sigTag}`;
    console.log("triangulated", triangulated);

    const sigImageUrl = `https://${irefHost}/v2/${irefName}/manifests/${sigTag}`;
    console.log("sigImageUrl", sigImageUrl);

    const sigImageManifestResp = await get(sigImageUrl, MediaTypeOciV1.Manifest);
    const sigImageManifest = JSON.parse(sigImageManifestResp.body);
    console.log("sigImageManifest", sigImageManifest);

    const sigBlobDigest = sigImageManifest.layers.at(0).digest;
    console.log("sigBlobDigest", sigBlobDigest);

    const sigBlobUrl = `https://${irefHost}/v2/${irefName}/blobs/${sigBlobDigest}`;
    console.log("sigBlobUrl", sigBlobUrl);

    const sigBlobResp = await get(sigBlobUrl, "application/octet-stream");
    const sigBlob = sigBlobResp.body;
    console.log("sigBlob", sigBlob);

    console.log("iref", iref);

    const bundle = bundleFromJSON({
      mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.1",
      verificationMaterial: {
        publicKey: {
          hint: "hint",
        },
        tlogEntries: [],
        timestampVerificationData: {
          rfc3161Timestamps: [],
        },
      },
      messageSignature: {
        messageDigest: {
          algorithm: "SHA2_256",
          digest: crypto.createHash("sha256").update(sigBlob).digest().toString(),
        },
        signature: sig,
      },
    });

    // const signedEntity = toSignedEntity(bundle, Buffer.from(sigBlob + "nope!"));
    const signedEntity = toSignedEntity(bundle, Buffer.from(sigBlob));

    subject.verify(signedEntity);
  }, 10000);
});

async function builderExists(name: string) {
  const resultRaw = await cmdStdout(`docker buildx ls --format json`);
  const result = resultRaw.split("\n").map(m => JSON.parse(m));
  const found = result.filter(f => f.Name === name).length;

  return !!found;
}

// TODO
// describe("sigstore-js - registry (Docker) - pub/prv keys", () => {

// }

describe.only("sigstore-js - zot (OCI) - pub/prv keys", () => {
  let workdir: string;
  let cosign: string;
  let crane: string;

  const passwd = "password";
  const prefix = "signing";
  const rawPrvkey = `${prefix}-raw.key`;
  const rawPubkey = `${prefix}-raw.pub`;
  const cosPrvkey = `${prefix}-cos.key`;
  // const cosPubkey = `${prefix}-cos.pub`;

  const iref = `localhost:54321/${crypto.randomUUID()}:latest`;

  beforeAll(async () => {
    workdir = await timed("creating workdir", createWorkdir);

    await timed("starting Zot container registry", async () => await startZotRegistry(workdir));

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

    await timed(`converting ${rawPrvkey} to ${cosPrvkey}`, async () =>
      cmdStderr(
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
      await cmd(`${crane} push ${dir} ${iref}`);
    });

    await timed(`removing docker buildx oci builder (${builder})`, async () => {
      if (!(await builderExists(builder))) {
        return;
      }
      await cmdStdout(`docker buildx rm ${builder}`);
    });

    await timed(`cosign signing image: ${iref}`, async () =>
      cmdStderr(`${cosign} sign --tlog-upload=false --key=${cosPrvkey} ${iref}`, {
        cwd: workdir,
        env: { COSIGN_PASSWORD: passwd },
      }),
    );
  }, mins(2));

  afterAll(async () => {
    await stopZotRegistry();
    await cleanWorkdirs();
  });

  it("can be verified via sigstore-js", async () => {
    console.log("yep");

    // const imgDigest = await cmdStdout(`crane digest ${iref}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // });
    // console.log("crane digest:", imgDigest);

    // const imgManifest = await cmdStdout(`crane manifest ${iref}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // });
    // console.log("crane manifest:", imgManifest);

    // const dotSig = await cmdStdout(`${cosign} triangulate ${iref}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // });
    // console.log("cosign triangulate:", dotSig);

    // const sigManifest = await cmdStdout(`crane manifest ${dotSig}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // });
    // console.log("crane manifest (dotSig):", JSON.stringify(JSON.parse(sigManifest), null, 2));

    // // https://github.com/sigstore/sigstore-js/blob/main/packages/verify/src/__tests__/verifier.test.ts
    // const pubKeyRaw = await readFile(`${workdir}/${rawPubkey}`, { encoding: "utf8" });
    // const pubKey = crypto.createPublicKey({
    //   key: pubKeyRaw,
    //   format: "pem",
    //   encoding: "utf-8",
    // });

    // const trustedRoot = {
    //   tlogs: [],
    //   ctlogs: [],
    //   timestampAuthorities: [],
    //   certificateAuthorities: [],
    // } as unknown as TrustedRoot;

    // const keys = {
    //   hint: {
    //     rawBytes: pubKey.export({ type: "spki", format: "der" }),
    //     keyDetails: PublicKeyDetails.PKIX_ECDSA_P256_SHA_256,
    //   },
    // };
    // const trustMaterial = toTrustMaterial(trustedRoot, keys);

    // const subject = new Verifier(trustMaterial, {
    //   ctlogThreshold: 0,
    //   tlogThreshold: 0,
    //   tsaThreshold: 0,
    // });

    // const sig = JSON.parse(sigManifest).layers[0].annotations["dev.cosignproject.cosign/signature"];
    // console.log("sig (enc):", sig);
    // console.log("sig (dec):", Buffer.from(sig, "base64").toString("utf8"));

    // // host     /name               :tag
    // // docker.io/library/hello-world:latest

    // // host  /name                                :tag
    // // ttl.sh/5dad3c9b-7ccc-4115-be27-c9244e7c0e06:2m

    // const irefHost = iref.split("/")[0];
    // const irefImage = iref.replace(`${irefHost}/`, "");
    // const irefTag = irefImage.split(":").at(-1);
    // const irefName = irefImage.replace(`:${irefTag}`, "");

    // const manifestUrl = `https://${irefHost}/v2/${irefName}/manifests/${irefTag}`;
    // console.log("manifestUrl", manifestUrl);

    // const supportsMediaType = async (url: string, mediaType: string) => {
    //   return (await head(url, mediaType))["content-type"] === mediaType;
    // };

    // const canOciV1Manifest = async (manifestUrl: string) => {
    //   return supportsMediaType(manifestUrl, MediaTypeOciV1.Manifest);
    // };

    // const canDockerV2Manifest = async (manifestUrl: string) => {
    //   return supportsMediaType(manifestUrl, MediaTypeDockerV2.Manifest);
    // };

    // // { head: {}, body: "" }
    // // prettier-ignore
    // const imageManifest =
    //   await canOciV1Manifest(manifestUrl) ? await get(manifestUrl, MediaTypeOciV1.Manifest) :
    //   await canDockerV2Manifest(manifestUrl) ? await get(manifestUrl, MediaTypeDockerV2.Manifest) :
    //   (() => { throw "Can't pull image manifest with supported MediaType." })();
    // console.log("imageManifest", imageManifest);

    // const imageDigest = `sha256:${crypto
    //   .createHash("sha256")
    //   .update(imageManifest.body)
    //   .digest("hex")
    //   .toString()}`;
    // console.log("imageDigest", imageDigest);

    // const sigTag = `${imageDigest.replace(":", "-")}.sig`;
    // console.log("sigTag", sigTag);

    // const triangulated = `${irefHost}/${irefName}:${sigTag}`;
    // console.log("triangulated", triangulated);

    // const sigImageUrl = `https://${irefHost}/v2/${irefName}/manifests/${sigTag}`;
    // console.log("sigImageUrl", sigImageUrl);

    // const sigImageManifestResp = await get(sigImageUrl, MediaTypeOciV1.Manifest);
    // const sigImageManifest = JSON.parse(sigImageManifestResp.body);
    // console.log("sigImageManifest", sigImageManifest);

    // const sigBlobDigest = sigImageManifest.layers.at(0).digest;
    // console.log("sigBlobDigest", sigBlobDigest);

    // const sigBlobUrl = `https://${irefHost}/v2/${irefName}/blobs/${sigBlobDigest}`;
    // console.log("sigBlobUrl", sigBlobUrl);

    // const sigBlobResp = await get(sigBlobUrl, "application/octet-stream");
    // const sigBlob = sigBlobResp.body;
    // console.log("sigBlob", sigBlob);

    // console.log("iref", iref);

    // const bundle = bundleFromJSON({
    //   mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.1",
    //   verificationMaterial: {
    //     publicKey: {
    //       hint: "hint",
    //     },
    //     tlogEntries: [],
    //     timestampVerificationData: {
    //       rfc3161Timestamps: [],
    //     },
    //   },
    //   messageSignature: {
    //     messageDigest: {
    //       algorithm: "SHA2_256",
    //       digest: crypto.createHash("sha256").update(sigBlob).digest().toString(),
    //     },
    //     signature: sig,
    //   },
    // });

    // // const signedEntity = toSignedEntity(bundle, Buffer.from(sigBlob + "nope!"));
    // const signedEntity = toSignedEntity(bundle, Buffer.from(sigBlob));

    // subject.verify(signedEntity);
  });
});

// describe.skip("verifyImage()", () => {
//   let iref: string;
//   let pubkeys: string[];

//   it("can be verified via new helper", () => {
//     //
//     // TODO: come back once you figure out how to use sigstore-js!
//     //
//     expect(sut.verifyImage(iref, pubkeys)).toBe("???");
//   });
// });
