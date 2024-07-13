// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, beforeAll, expect, it } from "@jest/globals";
import { execSync, spawnSync, spawn } from "child_process";
import { K8s, kind } from "kubernetes-fluent-client";
import { resolve } from "path";
import pointer from "json-pointer";
import { destroyModule } from "../src/lib/assets/destroy";
import { cwd } from "./entrypoint.test";
import {
  deleteConfigMap,
  waitForConfigMap,
  waitForDeploymentReady,
  waitForNamespace,
  waitForPeprStoreKey,
  waitForSecret,
} from "./k8s";



export function peprDeploy() {
  // Purge the Pepr module from the cluster before running the tests
  destroyModule("pepr-static-test");

  it("should deploy the Pepr controller into the test cluster", async () => {
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd, stdio: "inherit" });

    // Wait for the deployments to be ready
    await Promise.all([waitForDeploymentReady("pepr-system", "pepr-static-test"), waitForDeploymentReady("pepr-system", "pepr-static-test-watcher")]);
  });

  cleanupSamples();

  describe("should ignore resources not defined in the capability namespace", testIgnore);

  it("should perform validation of resources applied to the test cluster", testValidate);

  describe("should perform mutation of resources applied to the test cluster", testMutate);

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

      const cmd = ['pepr', 'monitor', 'static-test']

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

  describe("should display the UUIDs of the deployed modules", testUUID);

  describe("should store data in the PeprStore", testStore);

  cleanupSamples();
}

export function cleanupSamples() {
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

function testUUID() {

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
      "static-test\t",
    ].join("\n");
    expect(stdout).toMatch(expected);
  });

  it("should display the UUIDs of the deployed modules with a specific UUID", async () => {
    const uuidOut = spawnSync("npx pepr uuid static-test", {
      shell: true, // Run command in a shell
      encoding: "utf-8", // Encode result as string
    });

    const { stdout } = uuidOut;

    // Check if the expected lines are in the output
    const expected = [
      "UUID\t\tDescription",
      "--------------------------------------------",
      "static-test\t",
    ].join("\n");
    expect(stdout).toMatch(expected);
  });
};

function testIgnore() {
  it("should ignore resources not in the capability namespaces during mutation", async () => {
    const cm = await K8s(kind.ConfigMap).Apply({
      metadata: {
        name: "example-1",
        namespace: "default",
      },
    });
    expect(cm.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBeUndefined();
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
    expect(cm.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBeUndefined();
    expect(cm.metadata?.annotations?.["pepr.dev"]).toBeUndefined();
    expect(cm.metadata?.labels?.["pepr"]).toBeUndefined();
  });
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
    `admission webhook "pepr-static-test.pepr.dev" denied the request: `,
    `No evil CM annotations allowed.\n`,
  ].join("");
  expect(stderr).toMatch(expected);

}

function testMutate() {
  it("should mutate the namespace", async () => {
    // Wait for the namespace to be created
    const ns = await waitForNamespace("pepr-demo");

    // Check if the namespace has the correct labels and annotations
    expect(ns.metadata?.labels).toEqual({
      "keep-me": "please",
      "kubernetes.io/metadata.name": "pepr-demo",
    });
    expect(ns.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
  });

  it("should mutate example-1", async () => {
    const cm1 = await waitForConfigMap("pepr-demo", "example-1");
    expect(cm1.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm1.metadata?.annotations?.["pepr.dev"]).toBe("annotations-work-too");
    expect(cm1.metadata?.labels?.["pepr"]).toBe("was-here");
  });

  it("should mutate example-2", async () => {
    const cm2 = await waitForConfigMap("pepr-demo", "example-2");
    expect(cm2.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm2.metadata?.annotations?.["pepr.dev"]).toBe("annotations-work-too");
    expect(cm2.metadata?.labels?.["pepr"]).toBe("was-here");
  });

  it("should mutate example-3", async () => {
    const cm3 = await waitForConfigMap("pepr-demo", "example-3");

    expect(cm3.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm3.metadata?.annotations?.["pepr.dev"]).toBe("making-waves");
    expect(cm3.data).toEqual({ key: "ex-3-val", username: "system:admin" });
  });

  it("should mutate example-4", async () => {
    const cm4 = await waitForConfigMap("pepr-demo", "example-4");
    expect(cm4.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm4.metadata?.labels?.["pepr.dev/first"]).toBe("true");
    expect(cm4.metadata?.labels?.["pepr.dev/second"]).toBe("true");
    expect(cm4.metadata?.labels?.["pepr.dev/third"]).toBe("true");
  });

  it("should mutate example-4a", async () => {
    const cm4a = await waitForConfigMap("pepr-demo-2", "example-4a");
    expect(cm4a.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm4a.metadata?.labels?.["pepr.dev/first"]).toBe("true");
    expect(cm4a.metadata?.labels?.["pepr.dev/second"]).toBe("true");
    expect(cm4a.metadata?.labels?.["pepr.dev/third"]).toBe("true");
  });

  it("should mutate example-5", async () => {
    const cm5 = await waitForConfigMap("pepr-demo", "example-5");

    expect(cm5.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(cm5.data?.["chuck-says"]).toBeTruthy();
  });

  it("should mutate secret-1", async () => {
    const s1 = await waitForSecret("pepr-demo", "secret-1");

    expect(s1.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"]).toBe("succeeded");
    expect(s1.data?.["example"]).toBe("dW5pY29ybiBtYWdpYyAtIG1vZGlmaWVkIGJ5IFBlcHI=");
    expect(s1.data?.["magic"]).toBe("Y2hhbmdlLXdpdGhvdXQtZW5jb2Rpbmc=");
    expect(s1.data?.["binary-data"]).toBe(
      "iCZQUg8xYucNUqD+8lyl2YcKjYYygvTtiDSEV9b9WKUkxSSLFJTgIWMJ9GcFFYs4T9JCdda51u74jfq8yHzRuEASl60EdTS/NfWgIIFTGqcNRfqMw+vgpyTMmCyJVaJEDFq6AA==",
    );
    expect(s1.data?.["ascii-with-white-space"]).toBe(
      "VGhpcyBpcyBzb21lIHJhbmRvbSB0ZXh0OgoKICAgIC0gd2l0aCBsaW5lIGJyZWFrcwogICAgLSBhbmQgdGFicw==",
    );
  });
}


export function testStore() {
  it("should create the PeprStore", async () => {
    const resp = await waitForPeprStoreKey("pepr-static-test-store", "__pepr_do_not_delete__");
    expect(resp).toBe("k-thx-bye");
  });

  it("should write the correct data to the PeprStore", async () => {
    const key1 = await waitForPeprStoreKey("pepr-static-test-store", `hello-pepr-v2-${pointer.escape("example-1")}`);
    expect(key1).toBe("was-here");

    const nullKey1 = await waitForPeprStoreKey("pepr-static-test-store", `hello-pepr-${pointer.escape("example-1")}`);
    expect(nullKey1).toBe(null);

    const key2 = await waitForPeprStoreKey("pepr-static-test-store", `hello-pepr-v2-${pointer.escape("example-1-data")}`);
    expect(key2).toBe(JSON.stringify({ key: "ex-1-val" }));

    const nullKey2 = await waitForPeprStoreKey("pepr-static-test-store", `hello-pepr-${pointer.escape("example-1-data")}`);
    expect(nullKey2).toBe(null);
  });

  it("should write the correct data to the PeprStore from a Watch Action", async () => {
    const key = await waitForPeprStoreKey("pepr-static-test-store", `hello-pepr-v2-${pointer.escape("watch-data")}`);
    expect(key).toBe("This data was stored by a Watch Action.");
  });
}


export function peprStoreMigrate() {

  // Purge the Pepr module from the cluster before running the tests
  destroyModule("pepr-static-test");

  beforeAll(async () => {
    try {
      const peprAlias = "file:pepr-0.0.0-development.tgz";
      execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
    } catch (e) {
      // ignore, just to run this test in isolation
    }

    // Apply the store crd
    await applyStoreCRD();

    // Apply the store
    await applyLegacyStoreResource();

  })

  it("should deploy the Pepr controller into the test cluster", async () => {
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd, stdio: "inherit" })
    await Promise.all([waitForDeploymentReady("pepr-system", "pepr-static-test"), waitForDeploymentReady("pepr-system", "pepr-static-test-watcher")]);
  });

  // This asserts that the keys are v2
  describe("should upgrade the PeprStore", testStore);
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
  // Apply the store
  const appliedStore = spawnSync("kubectl apply -f journey/resources/non-migrated-peprstore.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(cwd, ".."),
  });
  const { stdout } = appliedStore;

  expect(stdout).toContain("peprstore.pepr.dev/pepr-static-test-store");
}
