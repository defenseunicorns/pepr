// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ExecutionContext } from "ava";
import { execSync, spawnSync } from "child_process";
import { resolve } from "path";

import { cwd } from "./entrypoint.test";
import {
    getPodLogs,
    waitForConfigMap,
    waitForDeploymentReady,
    waitForNamespace,
    waitForSecret,
} from "./k8s";

export async function peprDeploy(t: ExecutionContext) {
  try {
    // Deploy the module
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd, stdio: "inherit" });

    // Wait for the deployment to be ready
    await waitForDeploymentReady("pepr-system", "pepr-static-test");

    t.log("Deployment ready");
  } catch (e) {
    t.fail(e.message);
    return;
  }

  // Cleanup existing resources from previous runs, if any
  execSync("kubectl delete -f hello-pepr.samples.yaml --ignore-not-found=true", {
    cwd: resolve(cwd, "capabilities"),
    stdio: "inherit",
  });

  // Apply the sample yaml for the HelloPepr capability
  const applyOut = spawnSync("kubectl apply -f hello-pepr.samples.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(cwd, "capabilities"),
  });

  const { stderr, status } = applyOut;

  if (status === 0) {
    t.fail("Kubectl apply was not rejected by the admission controller");
    return;
  }

  // Check if the expected lines are in the output
  const expected = [
    `Error from server: error when creating "hello-pepr.samples.yaml": `,
    `admission webhook "pepr-static-test.pepr.dev" denied the request: `,
    `No evil CM annotations allowed.\n`,
  ].join("");
  t.is(stderr, expected, "Kubectl apply was not rejected by the admission controller");

  try {
    t.log("Sample yaml applied");

    // Wait for the namespace to be created
    const ns = await waitForNamespace("pepr-demo");

    t.log("Namespace created");

    // Check if the namespace has the correct labels and annotations
    t.deepEqual(ns.metadata?.labels, {
      "keep-me": "please",
      "kubernetes.io/metadata.name": "pepr-demo",
    });
    t.is(ns.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");

    t.log("Namespace validated");

    const cm1 = await waitForConfigMap("pepr-demo", "example-1");
    const cm2 = await waitForConfigMap("pepr-demo", "example-2");
    const cm3 = await waitForConfigMap("pepr-demo", "example-3");
    const cm4 = await waitForConfigMap("pepr-demo", "example-4");
    const cm4a = await waitForConfigMap("pepr-demo-2", "example-4a");
    const cm5 = await waitForConfigMap("pepr-demo", "example-5");
    const s1 = await waitForSecret("pepr-demo", "secret-1");

    t.log("ConfigMaps and secret created");

    // Validate the example-1 CM
    t.is(cm1.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm1.metadata?.annotations?.["pepr.dev"], "annotations-work-too");
    t.is(cm1.metadata?.labels?.["pepr"], "was-here");
    t.log("Validated example-1 ConfigMap data");

    // Validate the example-2 CM
    t.is(cm2.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm2.metadata?.annotations?.["pepr.dev"], "annotations-work-too");
    t.is(cm2.metadata?.labels?.["pepr"], "was-here");
    t.log("Validated example-2 ConfigMap data");

    // Validate the example-3 CM
    t.is(cm3.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm3.metadata?.annotations?.["pepr.dev"], "making-waves");
    t.deepEqual(cm3.data, { key: "ex-3-val", username: "system:admin" });
    t.log("Validated example-3 ConfigMap data");

    // Validate the example-4 CM
    t.is(cm4.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm4.metadata?.labels?.["pepr.dev/first"], "true");
    t.is(cm4.metadata?.labels?.["pepr.dev/second"], "true");
    t.is(cm4.metadata?.labels?.["pepr.dev/third"], "true");
    t.log("Validated example-4 ConfigMap data");

    // Validate the example-4a CM
    t.is(cm4a.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm4a.metadata?.labels?.["pepr.dev/first"], "true");
    t.is(cm4a.metadata?.labels?.["pepr.dev/second"], "true");
    t.is(cm4a.metadata?.labels?.["pepr.dev/third"], "true");
    t.log("Validated example-4a ConfigMap data");

    // Validate the example-5 CM
    t.is(cm5.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.truthy(cm5.data?.["chuck-says"]);
    t.log("Validated example-5 ConfigMap data");

    // Validate the secret-1 Secret
    t.is(s1.metadata?.annotations?.["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(s1.data?.["example"], "dW5pY29ybiBtYWdpYyAtIG1vZGlmaWVkIGJ5IFBlcHI=");
    t.is(s1.data?.["magic"], "Y2hhbmdlLXdpdGhvdXQtZW5jb2Rpbmc=");
    t.is(
      s1.data?.["binary-data"],
      "iCZQUg8xYucNUqD+8lyl2YcKjYYygvTtiDSEV9b9WKUkxSSLFJTgIWMJ9GcFFYs4T9JCdda51u74jfq8yHzRuEASl60EdTS/NfWgIIFTGqcNRfqMw+vgpyTMmCyJVaJEDFq6AA==",
    );
    t.is(
      s1.data?.["ascii-with-white-space"],
      "VGhpcyBpcyBzb21lIHJhbmRvbSB0ZXh0OgoKICAgIC0gd2l0aCBsaW5lIGJyZWFrcwogICAgLSBhbmQgdGFicw==",
    );
    t.log("Validated secret-1 Secret data");

    // Remove the sample yaml for the HelloPepr capability
    execSync("kubectl delete -f hello-pepr.samples.yaml --ignore-not-found", {
      cwd: resolve(cwd, "capabilities"),
      stdio: "inherit",
    });

    // Check the controller logs
    const logs = await getPodLogs("pepr-system", "app=pepr-static-test");
    t.is(logs.includes("File hash matches, running module"), true);
    t.is(logs.includes("Capability hello-pepr registered"), true);
    t.is(logs.includes("CM with label 'change=by-label' was deleted."), true);
    t.log("Validated controller logs");

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}
