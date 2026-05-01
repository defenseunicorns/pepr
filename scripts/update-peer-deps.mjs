#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { Command, InvalidArgumentError } from "commander";

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = resolve(here, "..", "package.json");
const NO_BUMPS_AVAILABLE = 2;

// ── Pure logic (no I/O) ─────────────────────────────────────────────────────

export function majorOf(version) {
  const head = Number.parseInt(version.split(".")[0], 10);
  if (Number.isNaN(head)) throw new Error(`unparseable version "${version}"`);
  return head;
}

export function classifyBumps(peers, latest) {
  const minor = {};
  const major = [];
  for (const [name, current] of Object.entries(peers)) {
    const next = latest[name];
    if (!next || next === current) continue;
    const entry = { from: current, to: next };
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
  return {
    branch: `chore/peer-deps/major-${opts.pkg}`,
    title: `chore: bump peerDependency ${opts.pkg} to ${peerVersions[opts.pkg]} (major)`,
  };
}

export function parseDiffBumps(diff) {
  const before = {};
  const after = {};
  for (const line of diff.split("\n")) {
    const m = line.match(/^([-+])\s+"([^"]+)":\s+"([^"]+)",?\s*$/);
    if (m) (m[1] === "-" ? before : after)[m[2]] = m[3];
  }
  return Object.keys(after).map(name => ({
    name,
    from: before[name] ?? "—",
    to: after[name],
  }));
}

export function renderPrBody(opts, bumps) {
  const scope =
    opts.kind === "minor"
      ? "all minor and patch peerDependency bumps grouped together"
      : `the major-version bump for \`${opts.pkg}\` (isolated for review)`;
  return [
    "## Description",
    "",
    `Automated peerDependencies update produced by the [peer-deps-update](.github/workflows/peer-deps-update.yml) workflow. This PR contains ${scope}.`,
    "",
    "Updated packages:",
    "",
    ...bumps.map(b => `- \`${b.name}\` ${b.from} -> ${b.to}`),
    "",
    "### In-workflow verification",
    "",
    "- `npm run format:check` — passed",
    "- `npm run build` — passed",
    "- `npm run test:unit` — passed",
    "",
    "## Related Issue",
    "",
    "Relates to #",
    "",
    "## Type of change",
    "",
    "- [ ] Bug fix (non-breaking change which fixes an issue)",
    "- [ ] New feature (non-breaking change which adds functionality)",
    "- [x] Other (security config, docs update, etc)",
    "",
    "## Checklist before merging",
    "",
    "- [x] Test, docs, adr added or updated as needed",
    "- [x] [Contributor Guide Steps](https://docs.pepr.dev/main/contribute/#submitting-a-pull-request) followed",
    "",
  ].join("\n");
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
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });

// gh always pipes stderr so "already exists" detection works; on failure we
// forward the captured streams so workflow logs aren't silenced.
function gh(args) {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (out) process.stdout.write(out);
    return out;
  } catch (err) {
    if (err.stdout) process.stdout.write(String(err.stdout));
    if (err.stderr) process.stderr.write(String(err.stderr));
    throw err;
  }
}

// ── Command handlers ────────────────────────────────────────────────────────

function buildReportFromDisk() {
  const peers = readPackageJson().peerDependencies ?? {};
  return classifyBumps(peers, fetchLatestVersions(peers));
}

function readDiffBumps() {
  return parseDiffBumps(
    execFileSync("git", ["diff", "-U0", "--", "package.json"], { encoding: "utf8" }),
  );
}

function runReport(opts) {
  const report = buildReportFromDisk();
  if (!opts.matrix) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  const include = reportToMatrixInclude(report);
  process.stdout.write(`matrix=${JSON.stringify({ include })}\nempty=${include.length === 0}\n`);
}

function runApply(opts) {
  requireMajorPkg(opts);
  const parsed = readPackageJson();
  const peers = parsed.peerDependencies ?? {};
  const updates = pickUpdates(classifyBumps(peers, fetchLatestVersions(peers)), opts);
  if (updates.length === 0) {
    const target = opts.pkg ? ` for "${opts.pkg}"` : "";
    console.error(`no ${opts.kind} peerDependency bumps available${target}`);
    process.exit(NO_BUMPS_AVAILABLE);
  }
  for (const u of updates) parsed.peerDependencies[u.name] = u.to;
  writePackageJson(parsed);
  const what = opts.kind === "minor" ? "peerDependencies (minor/patch)" : "peerDependency";
  const detail = updates.map(u => `${u.name} ${u.from} -> ${u.to}`).join(", ");
  console.error(`updated ${what}: ${detail}`);
}

function runPrBody(opts) {
  requireMajorPkg(opts);
  const bumps = readDiffBumps();
  if (bumps.length === 0) throw new Error("no peerDependency changes in git diff -- package.json");
  process.stdout.write(renderPrBody(opts, bumps));
}

function runOpenPr(opts) {
  requireMajorPkg(opts);
  const bumps = readDiffBumps();
  if (bumps.length === 0) throw new Error("no peerDependency changes in git diff -- package.json");

  const peers = readPackageJson().peerDependencies ?? {};
  const { branch, title } = pickBranchAndTitle(opts, peers);
  const body = renderPrBody(opts, bumps);

  git(["config", "user.name", "github-actions[bot]"]);
  git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  git(["checkout", "-B", branch]);
  git(["add", "package.json", "package-lock.json"]);
  git(["commit", "-m", title, "--signoff"]);
  git(["push", "--force", "origin", branch]);

  const bodyFile = join(mkdtempSync(join(tmpdir(), "peer-deps-pr-")), "body.md");
  writeFileSync(bodyFile, body);

  const labels = ["--label", "dependencies", "--label", "automated"];
  const head = ["--head", branch, "--title", title, "--body-file", bodyFile];
  try {
    gh(["pr", "create", "--base", "main", ...head, ...labels]);
  } catch (err) {
    if (!/already exists/i.test(String(err.stderr ?? ""))) throw err;
    gh([
      "pr",
      "edit",
      branch,
      ...head.slice(2),
      "--add-label",
      "dependencies",
      "--add-label",
      "automated",
    ]);
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
    .action(action);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await program.parseAsync(process.argv);
}
