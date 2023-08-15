import test from "ava";
import { execSync, spawn } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";

import { Kube, Log, a, k8s } from "../dist/lib.js";

const { CoreV1Api, KubeConfig, loadYaml } = k8s;

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sCoreApi = kc.makeApiClient(CoreV1Api);

// Timeout in milliseconds
const TIMEOUT = 120 * 1000;
const testDir = "pepr-test-module";

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "hello-pepr: V1ConfigMap Mutate CapabilityAction Created",
  "hello-pepr: V1ConfigMap Validate CapabilityAction Created",
  "Server listening on port 3000",
];

function stripAnsiCodes(input) {
  return input.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

test.before(async t => {
  const dir = resolve(testDir);

  try {
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
      // The directory does not exist, do nothing
    }
  }
});

test.serial("E2E: `pepr init`", t => {
  try {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: `pepr format`", t => {
  try {
    execSync("npx pepr format", { cwd: testDir, stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: `pepr build`", async t => {
  try {
    execSync("npx pepr build", { cwd: testDir, stdio: "inherit" });
    // check if the file exists
    await fs.access(resolve(testDir, "dist", "zarf.yaml"));
    await fs.access(resolve(testDir, "dist", "pepr-module-static-test.yaml"));

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: zarf.yaml validation", async t => {
  try {
    // Get the version of the pepr binary
    const peprVer = execSync("npx pepr --version", { cwd: testDir }).toString().trim();

    // Read the generated yaml files
    const k8sYaml = await fs.readFile(
      resolve(testDir, "dist", "pepr-module-static-test.yaml"),
      "utf8",
    );
    const zarfYAML = await fs.readFile(resolve(testDir, "dist", "zarf.yaml"), "utf8");

    // The expected image name
    const expectedImage = `ghcr.io/defenseunicorns/pepr/controller:v${peprVer}`;

    // The expected zarf yaml contents
    const expectedZarfYaml = {
      kind: "ZarfPackageConfig",
      metadata: {
        name: "pepr-static-test",
        description: "Pepr Module: A test module for Pepr",
        url: "https://github.com/defenseunicorns/pepr",
        version: "0.0.1",
      },
      components: [
        {
          name: "module",
          required: true,
          manifests: [
            {
              name: "module",
              namespace: "pepr-system",
              files: ["pepr-module-static-test.yaml"],
            },
          ],
          images: [expectedImage],
        },
      ],
    };

    // Check the generated zarf yaml
    t.deepEqual(loadYaml(zarfYAML), expectedZarfYaml);

    // Check the generated k8s yaml
    t.true(k8sYaml.includes(`image: ${expectedImage}`));

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: `pepr deploy`", async t => {
  try {
    // Deploy the module
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd: testDir, stdio: "inherit" });

    // Wait for the deployment to be ready
    await waitForDeploymentReady("pepr-system", "pepr-static-test");

    t.log("Deployment ready");

    // Apply the sample yaml for the HelloPepr capability
    execSync("kubectl apply -f hello-pepr.samples.yaml", {
      cwd: resolve(testDir, "capabilities"),
      stdio: "inherit",
    });

    t.log("Sample yaml applied");

    // Wait for the namespace to be created
    const ns = await waitForNamespace("pepr-demo");

    t.log("Namespace created");

    // Check if the namespace has the correct labels and annotations
    t.deepEqual(ns.metadata.labels, {
      "keep-me": "please",
      "kubernetes.io/metadata.name": "pepr-demo",
    });
    t.is(ns.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");

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
    t.is(cm1.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm1.metadata.annotations["pepr.dev"], "annotations-work-too");
    t.is(cm1.metadata.labels["pepr"], "was-here");
    t.log("Validated example-1 ConfigMap data");

    // Validate the example-2 CM
    t.is(cm2.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm2.metadata.annotations["pepr.dev"], "annotations-work-too");
    t.is(cm2.metadata.labels["pepr"], "was-here");
    t.log("Validated example-2 ConfigMap data");

    // Validate the example-3 CM
    t.is(cm3.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm3.metadata.annotations["pepr.dev"], "making-waves");
    t.deepEqual(cm3.data, { key: "ex-3-val", username: "system:admin" });
    t.log("Validated example-3 ConfigMap data");

    // Validate the example-4 CM
    t.is(cm4.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm4.metadata.labels["pepr.dev/first"], "true");
    t.is(cm4.metadata.labels["pepr.dev/second"], "true");
    t.is(cm4.metadata.labels["pepr.dev/third"], "true");
    t.log("Validated example-4 ConfigMap data");

    // Validate the example-4a CM
    t.is(cm4a.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(cm4a.metadata.labels["pepr.dev/first"], "true");
    t.is(cm4a.metadata.labels["pepr.dev/second"], "true");
    t.is(cm4a.metadata.labels["pepr.dev/third"], "true");
    t.log("Validated example-4a ConfigMap data");

    // Validate the example-5 CM
    t.is(cm5.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.truthy(cm5.data["chuck-says"]);
    t.log("Validated example-5 ConfigMap data");

    // Validate the secret-1 Secret
    t.is(s1.metadata.annotations["static-test.pepr.dev/hello-pepr"], "succeeded");
    t.is(s1.data["example"], "dW5pY29ybiBtYWdpYyAtIG1vZGlmaWVkIGJ5IFBlcHI=");
    t.is(s1.data["magic"], "Y2hhbmdlLXdpdGhvdXQtZW5jb2Rpbmc=");
    t.is(
      s1.data["binary-data"],
      "iCZQUg8xYucNUqD+8lyl2YcKjYYygvTtiDSEV9b9WKUkxSSLFJTgIWMJ9GcFFYs4T9JCdda51u74jfq8yHzRuEASl60EdTS/NfWgIIFTGqcNRfqMw+vgpyTMmCyJVaJEDFq6AA==",
    );
    t.is(
      s1.data["ascii-with-white-space"],
      "VGhpcyBpcyBzb21lIHJhbmRvbSB0ZXh0OgoKICAgIC0gd2l0aCBsaW5lIGJyZWFrcwogICAgLSBhbmQgdGFicw==",
    );
    t.log("Validated secret-1 Secret data");

    // Remove the sample yaml for the HelloPepr capability
    execSync("kubectl delete -f hello-pepr.samples.yaml", {
      cwd: resolve(testDir, "capabilities"),
      stdio: "inherit",
    });

    // Check the controller logs
    const logs = await getPodLogs("pepr-system", "app=pepr", "static-test");
    t.is(logs.includes("File hash matches, running module"), true);
    t.is(logs.includes("Capability hello-pepr registered"), true);
    t.is(logs.includes("CM with label 'change=by-label' was deleted."), true);
    t.log("Validated controller logs");

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: `pepr dev`", async t => {
  try {
    const cmd = await new Promise(peprDev);

    const healthz = await testHealthz();
    t.is(healthz, true);

    await testAPIKey();

    cmd.kill();
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test.serial("E2E: `pepr metrics`", async t => {
  try {
    const cmd = await new Promise(peprDev);

    const metrics = await testMetrics();
    t.is(metrics.includes("pepr_summary_count"), true);
    t.is(metrics.includes("pepr_errors"), true);
    t.is(metrics.includes("pepr_alerts"), true);
    t.log("Validated metrics endpoint");

    cmd.kill();
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

async function testHealthz() {
  // Ignore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const base = "https://localhost:3000/healthz";

  const healthzOk = await fetch(base);

  // Restore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

  if (healthzOk.status !== 200) {
    await delay2Secs();
    return testHealthz();
  }

  return true;
}

async function testAPIKey() {
  // Ignore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const base = "https://localhost:3000/mutate/";

  // Test api token validation
  const evilToken = await fetch(`${base}evil-token`, { method: "POST" });

  // Test for empty api token
  const emptyToken = await fetch(base, { method: "POST" });

  if (evilToken.status !== 401) {
    throw new Error("Expected evil token to return 401");
  }

  if (emptyToken.status !== 404) {
    throw new Error("Expected empty token to return 404");
  }

  // Restore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
}

async function testMetrics() {
  // Ignore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const metricsEndpoint = "https://localhost:3000/metrics";

  const metricsOk = await fetch(metricsEndpoint);

  if (metricsOk.status !== 200) {
    throw new Error("Expected metrics ok to return a 200");
  }
  // Restore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

  return await metricsOk.text();
}

function peprDev(resolve, reject) {
  const cmd = spawn("npx", ["pepr", "dev", "--confirm"], { cwd: testDir });

  cmd.stdout.on("data", data => {
    // Convert buffer to string
    data = stripAnsiCodes(data.toString());
    console.log(data);

    // Check if any expected lines are found
    expectedLines = expectedLines.filter(expectedLine => {
      // Check if the expected line is found in the output, ignoring whitespace
      return !data.replace(/\s+/g, " ").includes(expectedLine);
    });

    if (expectedLines.length > 0) {
      console.log(
        "\x1b[36m%s\x1b[0m'",
        "Remaining expected lines:" + JSON.stringify(expectedLines, null, 2),
      );
    }

    // If all expected lines are found, resolve the promise
    if (expectedLines.length < 1) {
      resolve(cmd);
    }
  });

  // Log stderr
  cmd.stderr.on("data", data => {
    console.error(`stderr: ${data}`);
  });

  // This command should not exit on its own
  cmd.on("close", code => {
    reject(new Error(`Command exited with code ${code}`));
  });

  // Reject on error
  cmd.on("error", error => {
    reject(error);
  });

  // Reject on timeout
  setTimeout(() => {
    console.error("Remaining expected lines:" + JSON.stringify(expectedLines, null, 2));
    cmd.kill();
    reject(new Error("Timeout: Expected lines not found"));
  }, TIMEOUT);
}

async function waitForDeploymentReady(namespace, name) {
  const deployment = await Kube(a.Deployment).InNamespace(namespace).Get(name);
  const replicas = deployment.spec.replicas || 1;
  const readyReplicas = deployment.status.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await delay2Secs();
    return waitForDeploymentReady(namespace, name);
  }
}

async function waitForNamespace(namespace) {
  try {
    return await Kube(a.Namespace).Get(namespace);
  } catch (error) {
    await delay2Secs();
    return waitForNamespace(namespace);
  }
}

async function waitForConfigMap(namespace, name) {
  try {
    return await Kube(a.ConfigMap).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForConfigMap(namespace, name);
  }
}

async function waitForSecret(namespace, name) {
  try {
    return await Kube(a.Secret).InNamespace(namespace).Get(name);
  } catch (error) {
    await delay2Secs();
    return waitForSecret(namespace, name);
  }
}

function delay2Secs() {
  return new Promise(resolve => setTimeout(resolve, 2000));
}

async function getPodLogs(namespace, labelKey, labelValue) {
  let allLogs = "";

  try {
    const pods = await Kube(a.Pod).InNamespace(namespace).WithLabel(labelKey, labelValue).Get();
    for (const pod of pods.items) {
      const podName = pod.metadata.name;
      const log = await k8sCoreApi.readNamespacedPodLog(podName, namespace);
      allLogs += log.body;
    }
  } catch (err) {
    console.error("Error: ", err);
  }

  return allLogs;
}
