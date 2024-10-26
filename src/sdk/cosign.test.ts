// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import { promisify } from "node:util";
import * as child_process from "node:child_process";
const exec = promisify(child_process.exec);
// import * as https from "node:https";
import { https } from "follow-redirects";
import { access, mkdtemp, readFile, rm, writeFile, unlink } from "node:fs/promises";
// import { chmodSync, createWriteStream, PathLike, readdirSync, readFileSync } from "node:fs";
import { chmodSync, createWriteStream, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import * as crypto from "node:crypto";
// import { crypto } from '@sigstore/core'; // Is this neccessary?
// import { toTrustMaterial, TrustMaterial, Verifier } from "@sigstore/verify";
import { toTrustMaterial, Verifier } from "@sigstore/verify";
import { PublicKeyDetails, TrustedRoot } from "@sigstore/protobuf-specs";
import { bundleFromJSON } from "@sigstore/bundle";
import { toSignedEntity } from "@sigstore/verify";

import * as sut from "./cosign";

// import type { Signature, Signer } from "@sigstore/sign/dist/signer";
// import { DSSEBundleBuilder } from "@sigstore/sign";

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

// enum MediaTypeDockerV1 {
//   Manifest = "application/vnd.docker.distribution.manifest.v1+prettyjws",
// }

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
      headers: { Accept: mediaType },
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

async function downloadCosign(path: string, binName: string) {
  // result = await cmdStdout("npm root");
  // const local = `${result}/.bin/cosign`;
  const local = join(path, binName);

  if (await exists(local)) {
    return local;
  }

  let os = await sniffOS();
  os = os === OS.Linux ? OS.Linux.toLowerCase() : os;
  os = os === OS.Mac ? OS.Mac.toLowerCase() : os;

  let arch = await sniffArch();
  arch = arch === Arch.x86_64 ? "amd64" : arch;

  const got = await httpGet("https://api.github.com/repos/sigstore/cosign/releases/latest");
  const ver = got["tag_name"];

  const remote = `https://github.com/sigstore/cosign/releases/download/${ver}/cosign-${os}-${arch}`;
  await httpDownload(remote, local);
  chmodSync(local, 0o777);

  return local;
}

describe.skip("downloadCosign()", () => {
  let workdir: string;

  beforeAll(async () => {
    workdir = await createWorkdir();
  });

  afterAll(async () => {
    await cleanWorkdirs();
  });

  it("works", async () => {
    const cosign = await downloadCosign(workdir, "cosign");
    const result = await cmdStdout(`${cosign} version`, { cwd: workdir });
    expect(result).toMatch(/cosign: A tool/);
  });
});

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
        // cmdStderr(`${cosign} sign --output-payload=payload.txt --tlog-upload=false --key=${cosPrvkey} ${iref}`, {
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

    // // https://github.com/sigstore/sigstore-js/tree/main/packages/sign
    // class KeyfileSigner implements Signer {
    //   private prv: crypto.KeyObject;
    //   private pub: crypto.KeyObject;

    //   constructor(prv: PathLike, pub: PathLike) {
    //     this.prv = crypto.createPrivateKey({
    //       key: readFileSync(prv, { encoding: "utf8" }),
    //       format: "pem",
    //       encoding: "utf-8",
    //     });
    //     this.pub = crypto.createPublicKey({
    //       key: readFileSync(pub, { encoding: "utf8" }),
    //       format: "pem",
    //       encoding: "utf-8",
    //     });
    //   }

    //   public async sign(data: Buffer): Promise<Signature> {
    //     const signature = crypto.sign(null, data, this.prv);
    //     const publicKey = this.pub.export({ format: "pem", type: "spki" }).toString("ascii");

    //     return {
    //       signature: signature,
    //       key: { $case: "publicKey", publicKey },
    //     };
    //   }
    // }

    // https://github.com/sigstore/sigstore-js/tree/main/packages/sign#witness
    //  - The BundleBuilder may also be configured with zero-or-more Witness instances, and
    //  - RekorWitness - Adds an entry to the Rekor transparency log and returns a TransparencyLogEntry to be included in the Bundle
    //  - ...so, if we don't config a witness then we don't have to worry about it..?
    // https://www.npmjs.com/package/sigstore
    //  - I don't see the option to pass along a privatekey..?
    // let options = {
    //   tlogUpload: false
    // };

    // const signer = new KeyfileSigner(`${workdir}/${rawPrvkey}`, `${workdir}/${rawPubkey}`);
    // const bundler = new DSSEBundleBuilder({ signer, witnesses: [] });

    // "The bytes of the artifact to be signed."
    //  - how do I derive those bytes from the image's .sig?
    // > crane manifest $(cosign triangulate ttl.sh/777ac082-afc2-4db3-83aa-97199998943b:2m) | jq .
    // {
    //   "schemaVersion": 2,
    //   "mediaType": "application/vnd.oci.image.manifest.v1+json",
    //   "config": {
    //     "mediaType": "application/vnd.oci.image.config.v1+json",
    //     "size": 233,
    //     "digest": "sha256:9b79fe7132ddc3150ee3fe6a7839a1865afa0b7f86dcfe71493774b7c68e9fc3"
    //   },
    //   "layers": [
    //     {
    //       "mediaType": "application/vnd.dev.cosign.simplesigning.v1+json",
    //       "size": 259,
    //       "digest": "sha256:4bfa764756f08768b73685a840922d5124f109b4522fb146922ff290a49c1898",
    //       "annotations": {
    //         "dev.cosignproject.cosign/signature": "MEYCIQCeZwnvT94cZ/SaMaBHAKvy6D/K5AJROcP9sdEzdGljxgIhAMzRydB2Wppkdj/hd4erFgXbvVuNn8UFdBHXc8SYfr95"
    //       }
    //     }
    //   ]
    // }
    // > crane digest ttl.sh/777ac082-afc2-4db3-83aa-97199998943b:2m
    // sha256:cb1a3c1190265153e7b50ccfde70e3683eba5326cfae8ac68632e1a6b9985573
    // > crane manifest ttl.sh/777ac082-afc2-4db3-83aa-97199998943b:2m | jq .
    // {
    //   "schemaVersion": 2,
    //   "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
    //   "config": {
    //     "mediaType": "application/vnd.docker.container.image.v1+json",
    //     "size": 566,
    //     "digest": "sha256:d8b02de37449f92e6b735b204ace6c1af1259aadb47c3f5f5a9865479b4e79ac"
    //   },
    //   "layers": [
    //     {
    //       "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
    //       "size": 2459,
    //       "digest": "sha256:c1ec31eb59444d78df06a974d155e597c894ab4cda84f08294145e845394988e"
    //     }
    //   ]
    // }
    // const payload = Buffer.from("sha256:6d9dcd1dde16b24a1d14010cc88b7735bbda8ab13b203f44075049e3fee554e4");

    // const artifact = { type: "text/plain", data: payload };
    // const bundle = await bundler.create(artifact);
    // const bPayload = bundle.content.dsseEnvelope.payload.toString();
    // const bSig = bundle.content.dsseEnvelope.signatures[0].sig.toString('base64');
    // console.log("payload:", bPayload);
    // console.log("signature:", bSig);
    // console.log(JSON.stringify(bundle));
    // console.log(bundle);
    // {
    //   mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    //   content: {
    //     '$case': 'dsseEnvelope',
    //     dsseEnvelope: {
    //       payloadType: 'text/plain',
    //       payload: <Buffer 73 6f 6d 65 74 68 69 6e 67 20 74 6f 20 62 65 20 73 69 67 6e 65 64>,
    //       signatures: [Array]
    //     }
    //   },
    //   verificationMaterial: {
    //     content: { '$case': 'publicKey', publicKey: [Object] },
    //     tlogEntries: [],
    //     timestampVerificationData: { rfc3161Timestamps: [] }
    //   }
    // }

    // expect(sign(payload, options)).toBe(false);

    // let result;
    // result = await cmdStderr(`${cosign} sign --tlog-upload=false --key=${rawPrvkey} ${iref}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // })
    // result = await cmdStderr(
    //   `${cosign} verify --insecure-ignore-tlog=true --key=${pubkey} ${iref}`,
    //   { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    // );
    // result = await cmdStderr(`${cosign} sign --tlog-upload=false --key=${rawPrvkey} ${iref}`, {
    //   cwd: workdir,
    //   env: { COSIGN_PASSWORD: passwd },
    // })

    // let dotSig = await cmdStdout(
    //   `${cosign} triangulate ${iref}`,
    //   { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    // );
    // console.log("cosign triangulate:", dotSig);

    // let result = await cmdStdout(
    //   `crane manifest ${dotSig}`,
    //   { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    // );
    // console.log("crane manifest (dotSig):", JSON.stringify(JSON.parse(result), null, 2));

    // result = await cmdStdout(
    //   `crane manifest ${iref}`,
    //   { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    // );
    // console.log("crane manifest:", result);

    // result = await cmdStdout(
    //   `crane digest ${iref}`,
    //   { cwd: workdir, env: { COSIGN_PASSWORD: passwd } },
    // );
    // console.log("crane digest:", result);

    // const payload = Buffer.from(result);
    // const artifact = { type: "text/plain", data: payload };
    // const bundle = await bundler.create(artifact);
    // const bPayload = bundle.content.dsseEnvelope.payload.toString();
    // const bSig = bundle.content.dsseEnvelope.signatures[0].sig.toString('base64');
    // console.log("payload:", bPayload);
    // console.log("signature:", bSig);
    // console.log(JSON.stringify(bundle, null, 2));

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
    //     validFor: { start: new Date(0) },
    //   },
    // };
    // const trustMaterial = toTrustMaterial(trustedRoot, keys);

    // const subject = new Verifier(trustMaterial, {
    //   ctlogThreshold: 0,
    //   tlogThreshold: 0,
    //   tsaThreshold: 0,
    // });

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
    //   // how do I derive digest/signature from a signed image..?
    //   messageSignature: {
    //     messageDigest: {
    //       algorithm: "SHA2_256",
    //       digest: "aOZWslHmfoNYvvhIOrDVHGYZ8+ehqfDnWDjUH/No9yg=",
    //     },
    //     signature:
    //       "MEQCIHs5aUulq1HpR+fwmSKpLk/oAwq5O9CDNFHhZAKfG5GmAiBwcVnf2obzsCGVlf0AIvbvHr21NXt7tpLBl4+Brh6OKA==",
    //   },
    // });

    // const signedEntity = toSignedEntity(bundle, Buffer.from("hello, world!"));

    // subject.verify(signedEntity);

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

    // decrypted sig payload... somehow!
    //{"critical":{"identity":{"docker-reference":"ttl.sh/f2ce2df1-bf5a-4f50-9554-3d7717d138ad"},"image":{"docker-manifest-digest":"sha256:cb1a3c1190265153e7b50ccfde70e3683eba5326cfae8ac68632e1a6b9985573"},"type":"cosign container image signature"},"optional":null}
    // No, wait!  it's in the blob content!
    // --> change tag ref to digest ref:
    //      - from: ttl.sh/7503ca0a-2deb-4b17-8b33-4740d9f7292c:2m
    //      - to: ttl.sh/7503ca0a-2deb-4b17-8b33-4740d9f7292c@sha256:b12f22a18ebe7206b579d4834f258833f2fbf92c754ca6cc10f48093d87ebf74
    // --> then pull blob content
    // crane blob ttl.sh/7503ca0a-2deb-4b17-8b33-4740d9f7292c@sha256:b12f22a18ebe7206b579d4834f258833f2fbf92c754ca6cc10f48093d87ebf74

    // const payload = (await readFile(`${workdir}/payload.txt`)).toString("utf8");
    // console.log("payload:", payload);

    // host     / name              : tag
    // docker.io/library/hello-world:latest
    // host  / name                               : tag
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

// TODO: figure out how to test against Docker Registry & Zot Registry (for boty docker & OCI mediatypes )

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
