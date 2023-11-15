// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it } from "@jest/globals";
import { execSync, spawnSync } from "child_process";
import { K8s, kind } from "kubernetes-fluent-client";
import { resolve } from "path";
import { jest } from "@jest/globals";

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

    // Wait for the deployment to be ready
    await waitForDeploymentReady("pepr-system", "pepr-static-test");
  });

  cleanupSamples();

  describe("should ignore resources not defined in the capability namespace", testIgnore);

  it("should perform validation of resources applied to the test cluster", testValidate);

  describe("should perform mutation of resources applied to the test cluster", testMutate);

  describe("should store data in the PeprStore", testStore);

  cleanupSamples();
}

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

function testStore() {
  it("should create the PeprStore", async () => {
    jest.useFakeTimers();

    const resp = await waitForPeprStoreKey("pepr-static-test-store", "__pepr_do_not_delete__");
    expect(resp).toBe("k-thx-bye");
    jest.useRealTimers();
  });

  it("should write the correct data to the PeprStore", async () => {
    jest.useFakeTimers();

    const key1 = await waitForPeprStoreKey("pepr-static-test-store", "hello-pepr-example-1");
    expect(key1).toBe("was-here");

    const key2 = await waitForPeprStoreKey("pepr-static-test-store", "hello-pepr-example-1-data");
    expect(key2).toBe(JSON.stringify({ key: "ex-1-val" }));
    jest.useRealTimers();
  });

  it("should write the correct data to the PeprStore from a Watch Action", async () => {
    jest.useFakeTimers();

    const key = await waitForPeprStoreKey("pepr-static-test-store", "hello-pepr-watch-data");
    expect(key).toBe("This data was stored by a Watch Action.");
    jest.useRealTimers();
  });
}
