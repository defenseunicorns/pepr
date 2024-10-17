// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, expect } from "@jest/globals";
import { describe, it } from "@jest/globals";
import { promisify } from "node:util";
import * as child_process from "node:child_process";
const exec = promisify(child_process.exec);
import * as https from "node:https";
import { access, mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { createWriteStream, chmodSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import * as sut from "./cosign";

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

describe("verifyImage()", () => {
  let cosign: string;
  let workdir: string;

  const passwd = "password";
  const prefix = "signing";
  const pubkey = `${prefix}.pub`;
  const prvkey = `${prefix}.key`;

  let iref = `ttl.sh/${randomUUID()}:2m`;
  let cscs: string[];

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

  it("can be verified via sigstore-js", () => {
    iref = "???";
    cscs = ["???", "???", "??"];

    expect(sut.verifyImage(iref, cscs)).toBe(false);
  });
});
