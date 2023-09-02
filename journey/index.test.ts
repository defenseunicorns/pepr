import { AppsV1Api, CoreV1Api, KubeConfig, loadYaml } from "@kubernetes/client-node";
import anyTest from "ava";
import { ChildProcessWithoutNullStreams, execSync, spawn, spawnSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";

// Journey tests must be run serially
const test = anyTest.serial;

const kc = new KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

// Timeout in milliseconds
const TIMEOUT = 120 * 1000;
const testDir = "pepr-test-module";

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "Mutate Action configured for CREATE",
  "Validate Action configured for CREATE",
  "Server listening on port 3000",
];

test.before(async () => {
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

test("Journey: `pepr init`", t => {
  try {
    const peprAlias = "file:pepr-0.0.0-development.tgz";
    execSync(`TEST_MODE=true npx --yes ${peprAlias} init`, { stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test("Journey: `pepr format`", t => {
  try {
    execSync("npx pepr format", { cwd: testDir, stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test("Journey: `pepr build`", async t => {
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

test("Journey: zarf.yaml validation", async t => {
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

test("Journey: `pepr deploy`", async t => {
  try {
    // Deploy the module
    execSync("npx pepr deploy -i pepr:dev --confirm", { cwd: testDir, stdio: "inherit" });

    // Wait for the deployment to be ready
    await waitForDeploymentReady("pepr-system", "pepr-static-test");

    t.log("Deployment ready");
  } catch (e) {
    t.fail(e.message);
    return;
  }

  // Cleanup existing resources from previous runs, if any
  execSync("kubectl delete -f hello-pepr.samples.yaml --ignore-not-found=true", {
    cwd: resolve(testDir, "capabilities"),
    stdio: "inherit",
  });

  // Apply the sample yaml for the HelloPepr capability
  const applyOut = spawnSync("kubectl apply -f hello-pepr.samples.yaml", {
    shell: true, // Run command in a shell
    encoding: "utf-8", // Encode result as string
    cwd: resolve(testDir, "capabilities"),
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
      cwd: resolve(testDir, "capabilities"),
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
});

test("Journey: `pepr dev`", async t => {
  try {
    const cmd = await new Promise<ChildProcessWithoutNullStreams>(peprDev);

    await testAPIKey();

    cmd.kill();
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test("Journey: `pepr metrics`", async t => {
  try {
    const cmd = await new Promise<ChildProcessWithoutNullStreams>(peprDev);

    const metrics = await testMetrics();
    t.is(metrics.includes("pepr_Validate"), true);
    t.is(metrics.includes("pepr_Mutate"), true);
    t.is(metrics.includes("pepr_errors"), true);
    t.is(metrics.includes("pepr_alerts"), true);
    t.log("Validated metrics endpoint");

    cmd.kill();
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

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

function peprDev(resolve, reject): ChildProcessWithoutNullStreams {
  const cmd = spawn("npx", ["pepr", "dev", "--confirm"], { cwd: testDir });

  cmd.stdout.on("data", data => {
    // Convert buffer to string
    console.log(data);

    // Check if any expected lines are found
    expectedLines = expectedLines.filter(expectedLine => {
      // Check if the expected line is found in the output, ignoring whitespace
      return !data.replace(/\s+/g, " ").includes(expectedLine);
    });

    console.log(
      "\x1b[36m%s\x1b[0m'",
      "Remaining expected lines:" + JSON.stringify(expectedLines, null, 2),
    );

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

  return cmd;
}

async function waitForDeploymentReady(namespace, name) {
  const deployment = await k8sApi.readNamespacedDeployment(name, namespace);
  const replicas = deployment.body.spec?.replicas || 1;
  const readyReplicas = deployment.body.status?.readyReplicas || 0;

  if (replicas !== readyReplicas) {
    await delay2Secs();
    return waitForDeploymentReady(namespace, name);
  }
}

async function waitForNamespace(namespace: string) {
  try {
    const resp = await k8sCoreApi.readNamespace(namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForNamespace(namespace);
  }
}

async function waitForConfigMap(namespace: string, name: string) {
  try {
    const resp = await k8sCoreApi.readNamespacedConfigMap(name, namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForConfigMap(namespace, name);
  }
}

async function waitForSecret(namespace: string, name: string) {
  try {
    const resp = await k8sCoreApi.readNamespacedSecret(name, namespace);
    return resp.body;
  } catch (error) {
    await delay2Secs();
    return waitForSecret(namespace, name);
  }
}

function delay2Secs() {
  return new Promise(resolve => setTimeout(resolve, 2000));
}

async function getPodLogs(namespace: string, labelSelector: string) {
  let allLogs = "";

  try {
    const res = await k8sCoreApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector,
    );
    const pods = res.body.items;

    for (const pod of pods) {
      const podName = pod.metadata?.name || "unknown";
      const log = await k8sCoreApi.readNamespacedPodLog(podName, namespace);
      allLogs += log.body;
    }
  } catch (err) {
    console.error("Error: ", err);
  }

  return allLogs;
}
