// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { https } from "follow-redirects";
import { readFile, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as crypto from "node:crypto";
import { PublicKeyDetails, TrustedRoot } from "@sigstore/protobuf-specs";
import { bundleFromJSON } from "@sigstore/bundle";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";

export enum MediaTypeDockerV2 {
  Manifest = "application/vnd.docker.distribution.manifest.v2+json",
}

export enum MediaTypeOciV1 {
  Manifest = "application/vnd.oci.image.manifest.v1+json",
  Index = "application/vnd.oci.image.index.v1+json",
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function head(
  rawUrl: string,
  mediaType: string,
  optsParam: Record<string, any> = {},
): Promise<any> {
  const url = new URL(rawUrl);

  return new Promise((resolve, reject) => {
    const opts = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "HEAD",
      headers: { Accept: mediaType },
      ...optsParam,
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
export async function get(
  rawUrl: string,
  mediaType: string,
  optsParam: Record<string, any> = {},
): Promise<any> {
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
      ...optsParam,
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
export async function download(
  rawUrl: string,
  localPath: string,
  optsParam: Record<string, any> = {},
): Promise<void> {
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
      ...optsParam,
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

//
// TODO: should support using certs too
//

/**
 * Returns all containers in a pod
 * @param {string} iref image reference
 * @param {array} pubkeys list of paths to node crypto code signing pubkeys
 * @returns {boolean} whether the iref was signed by a key in the pubkeys
 */
export async function verifyImage(
  iref: string,
  pubkeys: string[],
  tlsCrts?: string[],
): Promise<boolean> {
  const X: Record<string, any> = {};

  // <host---> / <image----------------------->
  //           / <name---------------> : <tag->
  // docker.io / library / hello-world : latest
  //
  // <host> / <image------------------------------------->
  //        / <name------------------------------> : <tag>
  // ttl.sh / 5dad3c9b-7ccc-4115-be27-c9244e7c0e06 : 2000m

  X.iref = {};
  X.iref.raw = iref;
  X.iref.host = iref.split("/")[0];
  X.iref.image = iref.replace(`${X.iref.host}/`, "");
  X.iref.tag = X.iref.image.split(":").at(-1);
  X.iref.name = X.iref.image.replace(`:${X.iref.tag}`, "");

  X.manifest = {
    url: `https://${X.iref.host}/v2/${X.iref.name}/manifests/${X.iref.tag}`,
  };

  const supportsMediaType = async (url: string, mediaType: string): Promise<boolean> => {
    return (await head(url, mediaType, { ca: tlsCrts }))["content-type"] === mediaType;
  };

  const canOciV1Manifest = async (manifestUrl: string): Promise<boolean> => {
    return supportsMediaType(manifestUrl, MediaTypeOciV1.Manifest);
  };

  const canDockerV2Manifest = async (manifestUrl: string): Promise<boolean> => {
    return supportsMediaType(manifestUrl, MediaTypeDockerV2.Manifest);
  };

  // prettier-ignore
  const manifestResp =
    await canOciV1Manifest(X.manifest.url) ? await get(X.manifest.url, MediaTypeOciV1.Manifest, {ca: tlsCrts}) :
    await canDockerV2Manifest(X.manifest.url) ? await get(X.manifest.url, MediaTypeDockerV2.Manifest, {ca: tlsCrts}) :
    (():never => { throw "Can't pull image manifest with supported MediaType." })();
  X.manifest.content = manifestResp.body;

  X.manifest.digest = `sha256:${crypto
    .createHash("sha256")
    .update(X.manifest.content)
    .digest("hex")
    .toString()}`;

  X.sig = {};
  X.sig.tag = `${X.manifest.digest.replace(":", "-")}.sig`;
  X.sig.triangulated = `${X.iref.host}/${X.iref.name}:${X.sig.tag}`;
  X.sig.url = `https://${X.iref.host}/v2/${X.iref.name}/manifests/${X.sig.tag}`;

  const sigManifestResp = await get(X.sig.url, MediaTypeOciV1.Manifest, { ca: tlsCrts });
  X.sig.manifest = sigManifestResp.body;

  const cosignSigLayer = JSON.parse(X.sig.manifest).layers.filter((f: any) =>
    Object.hasOwn(f?.annotations, "dev.cosignproject.cosign/signature"),
  )[0];

  X.sig.blob = {};
  X.sig.blob.digest = cosignSigLayer.digest;
  X.sig.blob.signature = cosignSigLayer.annotations["dev.cosignproject.cosign/signature"];
  X.sig.blob.url = `https://${X.iref.host}/v2/${X.iref.name}/blobs/${X.sig.blob.digest}`;

  const sigBlobResp = await get(X.sig.blob.url, "application/octet-stream", { ca: tlsCrts });
  X.sig.blob.content = sigBlobResp.body;

  let verified = false;

  for (const pubkey of pubkeys) {
    // https://github.com/sigstore/sigstore-js/blob/main/packages/verify/src/__tests__/verifier.test.ts
    const pubKeyRaw = await readFile(`${pubkey}`, { encoding: "utf8" });
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
          digest: crypto.createHash("sha256").update(X.sig.blob.content).digest().toString(),
        },
        signature: X.sig.blob.signature,
      },
    });

    const signedEntity = toSignedEntity(bundle, Buffer.from(X.sig.blob.content));

    try {
      subject.verify(signedEntity);
      verified = true;
      break;
    } catch (e) {
      if (e.message.includes("signature verification failed")) {
        continue;
      }
      throw e;
    }
  }

  return verified;
}
