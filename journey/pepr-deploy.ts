// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { execSync, spawnSync, spawn } from "child_process";
import { K8s, kind } from "kubernetes-fluent-client";
import { resolve } from "path";
import { destroyModule } from "../src/lib/assets/destroy";
import { cwd } from "./entrypoint.test";
import { promises as fs } from "fs"
import {
  deleteConfigMap,
  noWaitPeprStoreKey,
  sleep,
  waitForConfigMap,
  waitForConfigMapKey,
  waitForDeploymentReady,
  waitForNamespace,
  waitForPeprStoreKey,
  waitForSecret,
} from "./k8s";

async function getMagicString(): Promise<string> {
  const files = fs.readdir(`${cwd}/dist`)
  const yamlFile = (await files).find(file => /.*pepr-module.*\.yaml/.test(file))
  const distSHA = yamlFile?.split('.')[0].split('-').slice(-5).join("-") as string; //TODO: Type coercion
  const magicString = "pepr-".concat(distSHA)
  console.log(`MAGIC STRING: ${magicString}`)
  return Promise.resolve(magicString);
}

let magicString = "unset";

export function peprDeploy() {

  beforeAll(async ()=>{
    console.info("!!!STARTING PEPR-DEPLOY TESTS!!!")
    execSync(`jq '.dependencies.pepr = "file:../0.0.0-development"' package.json > temp.json && mv temp.json package.json`, {cwd: 'pepr-test-module'})
    execSync('npm install', {cwd: 'pepr-test-module'})

    magicString = await getMagicString();
    // Purge the Pepr module from the cluster before running the tests
    await destroyModule(`${magicString}`);
  })

  afterAll(()=>{
    console.info("!!!FINISHED PEPR-DEPLOY TESTS!!!!")
  })

  //TODO This causes the pepr-system namespace to terminate upon completion
  it("should deploy the Pepr controller into the test cluster", async () => {

    // Apply the store crd and pepr-system ns
    await applyStoreCRD();

    // Apply the store
    await applyLegacyStoreResource();

    /*
     * when controller starts up, it will migrate the store
     * and later on the keys will be tested to validate the migration
     */
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd, stdio: "inherit" });

    // Wait for the deployments to be ready
    await Promise.all([waitForDeploymentReady("pepr-system", `${magicString}`), waitForDeploymentReady("pepr-system", `${magicString}-watcher`)]);
  });

  it("should perform validation of resources applied to the test cluster", async () => {
    cleanupSamples();
    await new Promise((r) => setTimeout(r, 2000));
    // Apply the sample yaml for the HelloPepr capability
    const applyOut = spawnSync("kubectl apply -f hello-pepr.samples.yaml", {
      shell: true, // Run command in a shell
      encoding: "utf-8", // Encode result as string
      cwd: resolve(cwd, "capabilities"),
    });

    const { stderr, status } = applyOut;

    // Validation should return an error
    expect(status).toBe(1);

    // Check if the expected lines are in the output
    const expected = [
      `Error from server: error when creating "hello-pepr.samples.yaml": `,
      `admission webhook "${magicString}.pepr.dev" denied the request: `,
      `No evil CM annotations allowed.\n`,
    ].join("");
    expect(stderr).toMatch(expected);
  });

  describe("should ignore resources not defined in the capability namespace", () => {
    it("should ignore resources not in the capability namespaces during mutation", async () => {
      const cm = await K8s(kind.ConfigMap).Apply({
        metadata: {
          name: "example-1",
          namespace: "default",
        },
      });
      expect(cm.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBeUndefined();
      expect(cm.metadata?.annotations?.["pepr.dev"]).toBeUndefined();
      expect(cm.metadata?.labels?.["pepr"]).toBeUndefined();
    });

    it("should ignore resources not in the capability namespaces during validation", async () => {
      const cm = await K8s(kind.ConfigMap).Apply({
        metadata: {
          name: "example-evil-cm",
          namespace: "default",
          annotations: {
            evil: "true",
          },
        },
      });
      expect(cm.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBeUndefined();
      expect(cm.metadata?.annotations?.["pepr.dev"]).toBeUndefined();
      expect(cm.metadata?.labels?.["pepr"]).toBeUndefined();
    });
  });


  describe("should perform mutation of resources applied to the test cluster", 
    () => {

  it("should mutate the namespace", async () => {
    // Wait for the namespace to be created
    const ns = await waitForNamespace("pepr-demo");

    // Check if the namespace has the correct labels and annotations
    expect(ns.metadata?.labels).toEqual({
      "keep-me": "please",
      "kubernetes.io/metadata.name": "pepr-demo",
    });
    expect(ns.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
  });

  it("should mutate example-1", async () => {
    const cm1 = await waitForConfigMap("pepr-demo", "example-1");
    expect(cm1.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(cm1.metadata?.annotations?.["pepr.dev"]).toBe("annotations-work-too");
    expect(cm1.metadata?.labels?.["pepr"]).toBe("was-here");
  });

  it("should mutate example-2", async () => {
    const cm2 = await waitForConfigMap("pepr-demo", "example-2");
    expect(cm2.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(cm2.metadata?.annotations?.["pepr.dev"]).toBe("annotations-work-too");
    expect(cm2.metadata?.labels?.["pepr"]).toBe("was-here");
  });

  it("should mutate example-3", async () => {
    const cm3 = await waitForConfigMap("pepr-demo", "example-3");

    expect(cm3.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(cm3.metadata?.annotations?.["pepr.dev"]).toBe("making-waves");
    expect(cm3.data).toEqual({ key: "ex-3-val", username: "system:admin" });
  });

  it("should mutate example-4", async () => {
    const cm4 = await waitForConfigMap("pepr-demo", "example-4");
    expect(cm4.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(cm4.metadata?.labels?.["pepr.dev/first"]).toBe("true");
    expect(cm4.metadata?.labels?.["pepr.dev/second"]).toBe("true");
    expect(cm4.metadata?.labels?.["pepr.dev/third"]).toBe("true");
  });

  it("should mutate example-4a", async () => {
    const cm4a = await waitForConfigMap("pepr-demo-2", "example-4a");
    expect(cm4a.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(cm4a.metadata?.labels?.["pepr.dev/first"]).toBe("true");
    expect(cm4a.metadata?.labels?.["pepr.dev/second"]).toBe("true");
    expect(cm4a.metadata?.labels?.["pepr.dev/third"]).toBe("true");
  });

  it("should mutate example-5", async () => {

    const cm5 = await waitForConfigMap("pepr-demo", "example-5");

    expect(cm5.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
  });

  it("should mutate secret-1", async () => {
    const s1 = await waitForSecret("pepr-demo", "secret-1");

    expect(s1.metadata?.annotations?.[`${magicString.split('-').slice(1).join('-')}.pepr.dev/hello-pepr`]).toBe("succeeded");
    expect(s1.data?.["example"]).toBe("dW5pY29ybiBtYWdpYyAtIG1vZGlmaWVkIGJ5IFBlcHI=");
    expect(s1.data?.["magic"]).toBe("Y2hhbmdlLXdpdGhvdXQtZW5jb2Rpbmc=");
    expect(s1.data?.["binary-data"]).toBe(
      "iCZQUg8xYucNUqD+8lyl2YcKjYYygvTtiDSEV9b9WKUkxSSLFJTgIWMJ9GcFFYs4T9JCdda51u74jfq8yHzRuEASl60EdTS/NfWgIIFTGqcNRfqMw+vgpyTMmCyJVaJEDFq6AA==",
    );
    expect(s1.data?.["ascii-with-white-space"]).toBe(
      "VGhpcyBpcyBzb21lIHJhbmRvbSB0ZXh0OgoKICAgIC0gd2l0aCBsaW5lIGJyZWFrcwogICAgLSBhbmQgdGFicw==",
    );
  });
    });

  describe("should monitor the cluster for admission changes", () => {

    const until = (predicate: () => boolean): Promise<void> => {
      const poll = (resolve: () => void) => {
        if (predicate()) { resolve() }
        else { setTimeout(_ => poll(resolve), 250) }
      }
      return new Promise(poll);
    }

    it("npx pepr monitor should display validation results to console", async () => {
      await testValidate();

      const cmd = ['pepr', 'monitor', `${magicString.split('-').slice(1).join('-')}`]

      const proc = spawn('npx', cmd, { shell: true })

      const state = { accept: false, reject: false, done: false }
      proc.stdout.on('data', (data) => {
        const stdout: String = data.toString()
        state.accept = stdout.includes("✅") ? true : state.accept
        state.reject = stdout.includes("❌") ? true : state.reject
        expect(stdout.includes("IGNORED")).toBe(false)
        if (state.accept && state.reject) {
          proc.kill()
          proc.stdin.destroy()
          proc.stdout.destroy()
          proc.stderr.destroy()
        }
      })

      proc.on('exit', () => state.done = true);

      await until(() => state.done)

      // completes only if conditions are met, so... getting here means success!
    }, 10000);
  });

  describe("should display the UUIDs of the deployed modules", () => {

    it("should display the UUIDs of the deployed modules", async () => {
      const uuidOut = spawnSync("npx pepr uuid", {
        shell: true, // Run command in a shell
        encoding: "utf-8", // Encode result as string
      });

      const { stdout } = uuidOut;

      // Check if the expected lines are in the output
      const expected = [
        "UUID\t\tDescription",
        "--------------------------------------------",
        `${magicString.split('-').slice(1).join('-')}\t`,
      ].join("\n");
      expect(stdout).toMatch(expected);
    });

    it("should display the UUIDs of the deployed modules with a specific UUID", async () => {
      const uuidOut = spawnSync(`npx pepr uuid ${magicString.split('-').slice(1).join('-')}`, {
        shell: true, // Run command in a shell
        encoding: "utf-8", // Encode result as string
      });

      const { stdout } = uuidOut;

      // Check if the expected lines are in the output
      const expected = [
        "UUID\t\tDescription",
        "--------------------------------------------",
        `${magicString.split('-').slice(1).join('-')}\t`,
      ].join("\n");
      expect(stdout).toMatch(expected);
    });
  });

  describe("should store data in the PeprStore", ()=>{

  it("should create the PeprStore", async () => {
    const resp = await waitForPeprStoreKey(`${magicString}-store`, "__pepr_do_not_delete__");
    expect(resp).toBe("k-thx-bye");
  });

  it("should write the correct data to the PeprStore", async () => {
    const key1 = await waitForPeprStoreKey(`${magicString}-store`, `hello-pepr-v2-example-1`);
    expect(key1).toBe("was-here");

    // Should have been migrated and removed
    const nullKey1 = await noWaitPeprStoreKey(`${magicString}-store`, `hello-pepr-example-1`);
    expect(nullKey1).toBeUndefined();

    const key2 = await waitForPeprStoreKey(`${magicString}-store`, `hello-pepr-v2-example-1-data`);
    expect(key2).toBe(JSON.stringify({ key: "ex-1-val" }));

    // Should have been migrated and removed
    const nullKey2 = await noWaitPeprStoreKey(`${magicString}-store`, `hello-pepr-example-1-data`);
    expect(nullKey2).toBeUndefined();

    // Should have a key from the joke url and getItem should have worked
    const key3 = await waitForPeprStoreKey(`${magicString}-store`, `hello-pepr-v2-https://icanhazdadjoke.com/`);
    expect(key3).toBeTruthy();

    // // TODO: CM update from calling URL seems to time out or not work?
    // const cm = await waitForConfigMapKey("pepr-demo", "example-5", "chuck-says");
    // expect(cm.data?.["chuck-says"]).toBeTruthy();
  });

  it("should write the correct data to the PeprStore from a Watch Action", async () => {
    const key = await waitForPeprStoreKey(`${magicString}-store`, `hello-pepr-v2-watch-data`);
    expect(key).toBe("This data was stored by a Watch Action.");
  });

  cleanupSamples();
});

function cleanupSamples() {
  try {
    // Remove the sample yaml for the HelloPepr capability
    execSync("kubectl delete -f hello-pepr.samples.yaml --ignore-not-found", {
      cwd: resolve(cwd, "capabilities"),
      stdio: "inherit",
    });

    deleteConfigMap("default", "example-1");
    deleteConfigMap("default", "example-evil-cm");
  } catch (e) {
    // Ignore errors
  }
}

async function testValidate() {
  
  // Apply the sample yaml for the HelloPepr capability
  const applyOut = spawnSync("kubectl apply -f hello-pepr.samples.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(cwd, "capabilities"),
  });

  const { stderr, status } = applyOut;

  // Validation should return an error
  expect(status).toBe(1);

  // Check if the expected lines are in the output
  const expected = [
    `Error from server: error when creating "hello-pepr.samples.yaml": `,
    `admission webhook "${magicString}.pepr.dev" denied the request: `,
    `No evil CM annotations allowed.\n`,
  ].join("");
  expect(stderr).toMatch(expected);

}

async function applyStoreCRD() {
  // Apply the store crd
  const appliedStoreCRD = spawnSync("kubectl apply -f journey/resources/pepr-store-crd.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(cwd, ".."),
  });
  const { stdout } = appliedStoreCRD;

  expect(stdout).toContain("customresourcedefinition.apiextensions.k8s.io/peprstores.pepr.dev");
}

async function applyLegacyStoreResource() {

  // Prepare the store definition to match the pepr-test-module
  execSync(`yq eval '.metadata.name = "${magicString}-store"' journey/resources/non-migrated-peprstore.yaml > temp.yaml`)
  execSync(`cp journey/resources/non-migrated-peprstore.yaml journey/resources/non-migrated-peprstore.yaml.bak`)
  execSync(`mv temp.yaml journey/resources/non-migrated-peprstore.yaml`)
  // Apply the store
  const appliedStore = spawnSync("kubectl apply -f journey/resources/non-migrated-peprstore.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(cwd, ".."),
  });
  const { stdout } = appliedStore;


  execSync(`cp journey/resources/non-migrated-peprstore.yaml.bak journey/resources/non-migrated-peprstore.yaml`)
  expect(stdout).toContain(`peprstore.pepr.dev/${magicString}-store`);
}
}