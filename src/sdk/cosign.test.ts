// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import { promisify } from "node:util";
import * as child_process from "node:child_process";
const exec = promisify(child_process.exec);
import * as https from "node:https";
import { access, mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { chmodSync, createWriteStream, PathLike, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import * as crypto from "node:crypto";
import * as sut from "./cosign";

import type { Signature, Signer } from "@sigstore/sign/dist/signer";
import { DSSEBundleBuilder } from "@sigstore/sign";

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // GitHub API requires a UA (else 403)
    const opts = { headers: { "User-Agent": "node" } };

    https
      .get(url, opts, resp => {
        const { statusCode } = resp;
        const contentType = resp.headers["content-type"] || "";

        let error;
        if (!statusCode?.toString().startsWith("2")) {
          reject(new Error(`err: status code: ${statusCode}: expected 2xx`));
          error = true;
        } else if (!contentType.includes("application/json")) {
          reject(new Error(`err: content type: ${contentType}: expected application/json`));
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
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", e => reject(e));
  });
}

async function httpDownload(url: string, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // GitHub API requires a UA (else 403)
    const opts = { headers: { "User-Agent": "node" } };

    https
      .get(url, opts, async resp => {
        const { statusCode } = resp;

        if (statusCode?.toString().startsWith("3")) {
          const redirect = resp.headers.location as string;
          await httpDownload(redirect, path);
          resolve();
        }

        let error;
        if (!statusCode?.toString().startsWith("2")) {
          reject(new Error(`err: status code: ${statusCode}: expected 2xx`));
          error = true;
        }
        if (error) {
          resp.resume();
          return;
        }

        const ws = createWriteStream(path).on("finish", () => {
          ws.close(() => resolve());
        });

        resp.pipe(ws);
      })
      .on("error", async err => {
        await unlink(path);
        reject(err);
      });
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

async function downloadCosign() {
  let result;

  result = await cmdStdout("npm root");
  const local = `${result}/.bin/cosign`;

  if (await exists(local)) {
    return local;
  }

  result = await exec("uname -s");
  const os = result.stdout.trim().toLowerCase();

  result = await exec("uname -m");
  const arch = result.stdout.trim().replace("x86_64", "amd64");

  const got = await httpGet("https://api.github.com/repos/sigstore/cosign/releases/latest");
  const ver = got["tag_name"];

  const remote = `https://github.com/sigstore/cosign/releases/download/${ver}/cosign-${os}-${arch}`;
  await httpDownload(remote, local);
  chmodSync(local, 0o777);

  return local;
}

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

const indent = (msg: string) =>
  msg
    .split("\n")
    .map(m => `  ${m}`)
    .join("\n");

const secs = (s: number) => s * 1000;
const mins = (m: number) => m * secs(60);

describe("cosign CLI - pub/prv keys", () => {
  let cosign: string;
  let workdir: string;

  const passwd = "password";
  const prefix = "signing";
  const pubkey = `${prefix}.pub`;
  const prvkey = `${prefix}.key`;

  const iref = `ttl.sh/${crypto.randomUUID()}:2m`;

  beforeAll(async () => {
    cosign = await timed("getting cosign CLI binary", downloadCosign);
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

describe.only("sigstore-js - pub/prv keys", () => {
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
    cosign = await timed("getting cosign CLI binary", downloadCosign);
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
        keypair.privateKey
          // .export({ format: "pem", type: "pkcs8", cipher: "aes-256-cbc", passphrase: passwd})
          .export({ format: "pem", type: "pkcs8" })
          .toString("ascii"),
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

  // WIP: trying to run through the entire sigstore-js flow to:
  //  - prove that sigstore-js stuff works, and
  //  - know how to config sigstore-js calls so that they can verify cosign-gen'd data.
  it("can be verified via sigstore-js", async () => {
    // const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    //   modulusLength: 2048,
    // });
    // console.log("prv", privateKey);
    // console.log("pub", publicKey);

    // let prvKey = await readFile(`${workdir}/${prvkey}`, {encoding: "utf8"});
    // console.log(prvKey)
    // prvKey = prvKey.replace(/\\n/g, "\n");
    // console.log(prvKey)
    // prvKey = prvKey.replaceAll("ENCRYPTED SIGSTORE", "EC")
    // console.log(prvKey)
    // let prvKeyObj = createPrivateKey({
    //   key: prvKey,
    //   format: "pem",
    //   type: "pkcs8",
    //   passphrase: "password",
    //   encoding: "utf-8"
    // });
    // console.log("l-prv", prvKeyObj);
    // const localPub = createPublicKey(await readFile(`${workdir}/${pubkey}`, {encoding: "utf8"}));
    // console.log("l-pub", localPub);

    // remove passphrase from prvkey (so cosing import-key-pair can work with it!)
    // > openssl ec -inform pem -outform pem -passin pass:password -in signing.key -out signing3.pem.key

    // let pubKey = await readFile(`${workdir}/${pubkey}`, {encoding: "utf8"});
    // let pubKeyObj = createPublicKey({
    //   key: pubKey,
    //   format: "pem",
    //   encoding: "utf-8"
    // });
    // console.log("l-pub", pubKeyObj);

    // https://github.com/sigstore/sigstore-js/tree/main/packages/sign
    class KeyfileSigner implements Signer {
      private prv: crypto.KeyObject;
      private pub: crypto.KeyObject;

      constructor(prv: PathLike, pub: PathLike) {
        this.prv = crypto.createPrivateKey({
          key: readFileSync(prv, { encoding: "utf8" }),
          format: "pem",
          encoding: "utf-8",
        });
        this.pub = crypto.createPublicKey({
          key: readFileSync(pub, { encoding: "utf8" }),
          format: "pem",
          encoding: "utf-8",
        });
      }

      public async sign(data: Buffer): Promise<Signature> {
        const signature = crypto.sign(null, data, this.prv);
        const publicKey = this.pub.export({ format: "pem", type: "spki" }).toString("ascii");

        return {
          signature: signature,
          key: { $case: "publicKey", publicKey },
        };
      }
    }

    // https://github.com/sigstore/sigstore-js/tree/main/packages/sign#witness
    //  - The BundleBuilder may also be configured with zero-or-more Witness instances, and
    //  - RekorWitness - Adds an entry to the Rekor transparency log and returns a TransparencyLogEntry to be included in the Bundle
    //  - ...so, if we don't config a witness then we don't have to worry about it..?
    // https://www.npmjs.com/package/sigstore
    //  - I don't see the option to pass along a privatekey..?
    // let options = {
    //   tlogUpload: false
    // };

    // "The bytes of the artifact to be signed." //
    //  - how do I derive those bytes from the image..?
    const payload = Buffer.from("something to be signed");

    const signer = new KeyfileSigner(`${workdir}/${rawPrvkey}`, `${workdir}/${rawPubkey}`);
    const bundler = new DSSEBundleBuilder({ signer, witnesses: [] });

    const artifact = { type: "text/plain", data: payload };
    const bundle = await bundler.create(artifact);
    console.log(bundle);

    // expect(sign(payload, options)).toBe(false);
  });
});

describe.skip("verifyImage()", () => {
  let iref: string;
  let pubkeys: string[];

  it("can be verified via new helper", () => {
    //
    // TODO: come back once you figure out how to use sigstore-js!
    //
    expect(sut.verifyImage(iref, pubkeys)).toBe("???");
  });
});
