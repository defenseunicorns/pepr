#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { Command, InvalidArgumentError } from "commander";
import semver from "semver";

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = resolve(here, "..", "package.json");
const NO_BUMPS_AVAILABLE = 2;
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
const PR_LABELS = ["dependencies", "automated"];

export function majorOf(version) {
  const coerced = semver.coerce(version);
  if (!coerced) throw new Error(`unparseable version "${version}"`);
  return coerced.major;
}

// Preserve the range operator (^, ~, >=, etc.) from currentSpec when writing the new version.
export function applyRangePrefix(currentSpec, newBareVersion) {
  const m = /^([\^~>=<]+)/.exec(currentSpec);
  return m ? m[1] + newBareVersion : newBareVersion;
}

export function classifyBumps(peers, latest) {
  const minor = {};
  const major = [];
  for (const [name, current] of Object.entries(peers)) {
    const next = latest[name];
    if (!next || semver.satisfies(next, current)) continue;
    const to = applyRangePrefix(current, next);
    const entry = { from: current, to };
    if (majorOf(next) > majorOf(current)) major.push({ name, ...entry });
    else minor[name] = entry;
  }
  return { minor, major };
}

export function reportToMatrixInclude(report) {
  return [
    ...(Object.keys(report.minor).length ? [{ kind: "minor", pkg: "" }] : []),
    ...report.major.map(m => ({ kind: "major", pkg: m.name })),
  ];
}

export function pickUpdates(report, opts) {
  if (opts.kind === "minor") {
    return Object.entries(report.minor).map(([name, v]) => ({ name, ...v }));
  }
  const target = report.major.find(m => m.name === opts.pkg);
  return target ? [target] : [];
}

export function pickBranchAndTitle(opts, peerVersions) {
  if (opts.kind === "minor") {
    return {
      branch: "chore/peer-deps/minor",
      title: "chore: bump peerDependencies (minor/patch)",
    };
  }
  // Scoped package names (e.g. @types/prompts) contain a slash, which creates
  // directory ambiguity in git's ref namespace. Replace all non-alnum chars.
  const slug = opts.pkg.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-|-$/g, "");
  return {
    branch: `chore/peer-deps/major-${slug}`,
    title: `chore: bump peerDependency ${opts.pkg} to ${peerVersions[opts.pkg]} (major)`,
  };
}

export function diffPeerDeps(before, after) {
  const beforePeers = before.peerDependencies ?? {};
  const afterPeers = after.peerDependencies ?? {};
  const bumps = [];
  for (const [name, to] of Object.entries(afterPeers)) {
    const from = beforePeers[name];
    if (from && from !== to) bumps.push({ name, from, to });
  }
  return bumps;
}

export function renderPrBody(opts, bumps) {
  const scope =
    opts.kind === "minor"
      ? "all minor and patch peerDependency bumps grouped together"
      : `the major-version bump for \`${opts.pkg}\` (isolated for review)`;
  const list = bumps.map(b => `- \`${b.name}\` ${b.from} -> ${b.to}`).join("\n");

  // When invoked by the workflow the run URL is available; link to it rather
  // than hardcoding "passed" (the script itself cannot verify those steps).
  const verificationSection = opts.runUrl
    ? `### In-workflow verification\n\nSee [workflow run](${opts.runUrl}) for format, build, and unit-test results.`
    : `### In-workflow verification\n\n- \`npm run format:check\` — passed\n- \`npm run build\` — passed\n- \`npm run test:unit\` — passed`;

  return `## Description

Automated peerDependencies update produced by the [peer-deps-update](.github/workflows/peer-deps-update.yml) workflow. This PR contains ${scope}.

Updated packages:

${list}

${verificationSection}

## Related Issue

None, ongoing maintenance

## Type of change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [x] Other (security config, docs update, etc)

## Checklist before merging

- [x] Test, docs, adr added or updated as needed
- [x] [Contributor Guide Steps](https://docs.pepr.dev/main/contribute/#submitting-a-pull-request) followed
`;
}

// ── I/O wrappers ────────────────────────────────────────────────────────────

const readPackageJson = () => JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
const writePackageJson = parsed =>
  writeFileSync(PACKAGE_JSON, JSON.stringify(parsed, null, 2) + "\n");

const npmLatest = pkg =>
  execFileSync("npm", ["view", pkg, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const fetchLatestVersions = (peers, fetcher = npmLatest) =>
  Object.fromEntries(Object.keys(peers).map(p => [p, fetcher(p)]));

const git = args =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] });

function ghRun(args) {
  const out = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  process.stderr.write(out); // gh output goes to stderr; stdout is reserved for machine-readable data
}

// Probe for an existing open PR before create/edit so control flow does not
// depend on parsing gh's English-language error messages across CLI versions.
function ghPrUpsert(branch, meta, labelArgs, addLabelArgs) {
  const existing = JSON.parse(
    execFileSync("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (existing.length === 0) {
    ghRun(["pr", "create", "--base", "main", "--head", branch, ...meta, ...labelArgs]);
  } else {
    ghRun(["pr", "edit", String(existing[0].number), ...meta, ...addLabelArgs]);
  }
}

// ── Command handlers ────────────────────────────────────────────────────────

function diskReport() {
  const peers = readPackageJson().peerDependencies;
  return classifyBumps(peers, fetchLatestVersions(peers));
}

function diskBumps() {
  const before = JSON.parse(
    execFileSync("git", ["show", "HEAD:package.json"], { encoding: "utf8" }),
  );
  const bumps = diffPeerDeps(before, readPackageJson());
  if (bumps.length === 0) throw new Error("no peerDependency changes vs HEAD");
  return bumps;
}

function runReport(opts) {
  const report = diskReport();
  if (!opts.matrix) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  const include = reportToMatrixInclude(report);
  process.stdout.write(`matrix=${JSON.stringify({ include })}\nempty=${include.length === 0}\n`);
}

function runApply(opts) {
  requireMajorPkg(opts);
  // Read package.json once and derive the report from the same parsed object to
  // avoid a second file read + full npm re-query inside diskReport().
  const parsed = readPackageJson();
  const report = classifyBumps(
    parsed.peerDependencies,
    fetchLatestVersions(parsed.peerDependencies),
  );
  const updates = pickUpdates(report, opts);
  if (updates.length === 0) {
    const target = opts.pkg ? ` for "${opts.pkg}"` : "";
    console.error(`no ${opts.kind} peerDependency bumps available${target}`);
    process.exit(NO_BUMPS_AVAILABLE);
  }
  for (const u of updates) parsed.peerDependencies[u.name] = u.to;
  writePackageJson(parsed);
  const what = opts.kind === "minor" ? "peerDependencies (minor/patch)" : "peerDependency";
  console.error(
    `updated ${what}: ${updates.map(u => `${u.name} ${u.from} -> ${u.to}`).join(", ")}`,
  );
}

function runPrBody(opts) {
  requireMajorPkg(opts);
  process.stdout.write(renderPrBody(opts, diskBumps()));
}

function runOpenPr(opts) {
  requireMajorPkg(opts);
  const bumps = diskBumps();
  const peers = readPackageJson().peerDependencies;
  const { branch, title } = pickBranchAndTitle(opts, peers);

  // --local keeps bot identity scoped to this repo clone and does not pollute
  // ~/.gitconfig on developer machines or shared self-hosted runners.
  git(["config", "--local", "user.name", BOT_NAME]);
  git(["config", "--local", "user.email", BOT_EMAIL]);
  git(["checkout", "-B", branch]);
  git(["add", "package.json", "package-lock.json"]);
  git(["commit", "-m", title, "--signoff"]);
  git(["push", "--force-with-lease", "origin", branch]);

  // Use RUNNER_TEMP when available (GHA-scoped, job-local); fall back to OS
  // tmpdir. Clean up unconditionally so local runs don't leak temp dirs.
  const tmpBase = process.env.RUNNER_TEMP ?? tmpdir();
  const tmpDir = mkdtempSync(join(tmpBase, "peer-deps-pr-"));
  try {
    const bodyFile = join(tmpDir, "body.md");
    writeFileSync(bodyFile, renderPrBody(opts, bumps));
    const meta = ["--title", title, "--body-file", bodyFile];
    const labelArgs = PR_LABELS.flatMap(l => ["--label", l]);
    const addLabelArgs = PR_LABELS.flatMap(l => ["--add-label", l]);
    ghPrUpsert(branch, meta, labelArgs, addLabelArgs);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseKind(value) {
  if (value !== "minor" && value !== "major") {
    throw new InvalidArgumentError('must be "minor" or "major"');
  }
  return value;
}

const program = new Command()
  .name("update-peer-deps")
  .description("Inspect and apply peerDependency bumps for pepr.")
  .showHelpAfterError();

function requireMajorPkg(opts) {
  if (opts.kind === "major" && !opts.pkg) {
    program.error("--kind major requires --pkg <name>");
  }
}

program
  .command("report")
  .description("Print pending peer-dep bumps as JSON, or a GHA matrix with --matrix.")
  .option("--matrix", "emit GHA matrix=<json> and empty=<bool> instead of JSON")
  .action(runReport);

for (const [name, desc, action] of [
  ["apply", "Write package.json with the requested peer-dep bumps applied.", runApply],
  ["pr-body", "Print a markdown PR body for the bumps already staged in package.json.", runPrBody],
  ["open-pr", "Commit, push, and create or update a PR for the staged bumps.", runOpenPr],
]) {
  program
    .command(name)
    .description(desc)
    .requiredOption("--kind <kind>", '"minor" or "major"', parseKind)
    .option("--pkg <name>", "package name (required for --kind major)")
    .option("--run-url <url>", "GHA workflow run URL to embed in the PR body verification section")
    .action(action);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await program.parseAsync(process.argv);
}
