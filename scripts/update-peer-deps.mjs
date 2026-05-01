#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { Command, InvalidArgumentError } from "commander";

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = resolve(here, "..", "package.json");
const NO_BUMPS_AVAILABLE = 2;

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
}
function readPackageJson() {
  const raw = readFileSync(PACKAGE_JSON, "utf8");
  return { parsed: JSON.parse(raw) };
}

function npmLatest(pkg) {
  return execFileSync("npm", ["view", pkg, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function majorOf(version) {
  const head = Number.parseInt(version.split(".")[0], 10);
  if (Number.isNaN(head)) {
    throw new Error(`cannot parse major version from "${version}"`);
  }
  return head;
}

function classify(current, latest) {
  if (current === latest) return "same";
  return majorOf(latest) > majorOf(current) ? "major" : "minor";
}

function buildReport(peers) {
  const minor = {};
  const major = [];
  for (const [name, current] of Object.entries(peers)) {
    const latest = npmLatest(name);
    const kind = classify(current, latest);
    if (kind === "same") continue;
    if (kind === "minor") {
      minor[name] = { from: current, to: latest };
    } else {
      major.push({ name, from: current, to: latest });
    }
  }
  return { minor, major };
}

function reportToMatrixInclude(report) {
  const include = [];
  if (Object.keys(report.minor).length > 0) {
    include.push({ kind: "minor", pkg: "" });
  }
  for (const { name } of report.major) {
    include.push({ kind: "major", pkg: name });
  }
  return include;
}

function gitDiffPeerBumps() {
  const diff = execFileSync("git", ["diff", "-U0", "--", "package.json"], {
    encoding: "utf8",
  });
  const before = {};
  const after = {};
  for (const line of diff.split("\n")) {
    const match = line.match(/^([-+])\s+"([^"]+)":\s+"([^"]+)",?\s*$/);
    if (!match) continue;
    const [, sign, name, version] = match;
    (sign === "-" ? before : after)[name] = version;
  }
  return Object.keys(after).map(name => ({
    name,
    from: before[name] ?? "—",
    to: after[name],
  }));
}

function pickBranchAndTitle(opts) {
  if (opts.kind === "minor") {
    return {
      branch: "chore/peer-deps/minor",
      title: "chore: bump peerDependencies (minor/patch)",
    };
  }
  const peers = readPackageJson().peerDependencies ?? {};
  const newVersion = peers[opts.pkg];
  return {
    branch: `chore/peer-deps/major-${opts.pkg}`,
    title: `chore: bump peerDependency ${opts.pkg} to ${newVersion} (major)`,
  };
}

function renderPrBody(opts, bumps) {
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

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function gh(args, captureStderr = false) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "inherit", captureStderr ? "pipe" : "inherit"],
  });
}

function parseKind(value) {
  if (value !== "minor" && value !== "major") {
    throw new InvalidArgumentError('must be "minor" or "major"');
  }
  return value;
}

function requireMajorPkg(opts) {
  if (opts.kind === "major" && !opts.pkg) {
    program.error("--kind major requires --pkg <name>");
  }
}

function runReport(opts) {
  const peers = readPackageJson().peerDependencies ?? {};
  const report = buildReport(peers);
  if (opts.matrix) {
    const include = reportToMatrixInclude(report);
    process.stdout.write(`matrix=${JSON.stringify({ include })}\n`);
    process.stdout.write(`empty=${include.length === 0 ? "true" : "false"}\n`);
    return;
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

function runApply(opts) {
  requireMajorPkg(opts);
  const parsed = readPackageJson();
  const peers = parsed.peerDependencies ?? {};
  const report = buildReport(peers);

  if (opts.kind === "minor") {
    if (Object.keys(report.minor).length === 0) {
      console.error("no minor/patch peerDependency bumps available");
      process.exit(NO_BUMPS_AVAILABLE);
    }
    for (const [name, { to }] of Object.entries(report.minor)) {
      parsed.peerDependencies[name] = to;
    }
    writePackageJson(parsed);
    const summary = Object.entries(report.minor)
      .map(([n, v]) => `${n} ${v.from} -> ${v.to}`)
      .join(", ");
    console.error(`updated peerDependencies (minor/patch): ${summary}`);
    return;
  }

  const target = report.major.find(m => m.name === opts.pkg);
  if (!target) {
    console.error(`no major peerDependency bump available for "${opts.pkg}"`);
    process.exit(NO_BUMPS_AVAILABLE);
  }
  parsed.peerDependencies[target.name] = target.to;
  writePackageJson(parsed);
  console.error(`updated peerDependency ${target.name} ${target.from} -> ${target.to}`);
}

function runPrBody(opts) {
  requireMajorPkg(opts);
  const bumps = gitDiffPeerBumps();
  if (bumps.length === 0) {
    throw new Error("no peerDependency changes found in git diff -- package.json");
  }
  process.stdout.write(renderPrBody(opts, bumps));
}

function runOpenPr(opts) {
  requireMajorPkg(opts);
  const bumps = gitDiffPeerBumps();
  if (bumps.length === 0) {
    throw new Error("no peerDependency changes found in git diff -- package.json");
  }

  const { branch, title } = pickBranchAndTitle(opts);
  const body = renderPrBody(opts, bumps);

  git(["config", "user.name", "github-actions[bot]"]);
  git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);

  git(["checkout", "-B", branch]);
  git(["add", "package.json", "package-lock.json"]);
  git(["commit", "-m", title, "--signoff"]);
  git(["push", "--force", "origin", branch]);

  const dir = mkdtempSync(join(tmpdir(), "peer-deps-pr-"));
  const bodyFile = join(dir, "body.md");
  writeFileSync(bodyFile, body);

  const createArgs = [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    title,
    "--body-file",
    bodyFile,
    "--label",
    "dependencies",
    "--label",
    "automated",
  ];
  try {
    gh(createArgs);
  } catch (err) {
    const stderr = String(err.stderr ?? "");
    if (!/already exists/i.test(stderr)) throw err;
    gh([
      "pr",
      "edit",
      branch,
      "--title",
      title,
      "--body-file",
      bodyFile,
      "--add-label",
      "dependencies",
      "--add-label",
      "automated",
    ]);
  }
}

const program = new Command();
program
  .name("update-peer-deps")
  .description("Inspect and apply peerDependency bumps for pepr.")
  .showHelpAfterError();

program
  .command("report")
  .description("Print pending peer-dep bumps as JSON, or as a GHA matrix with --matrix.")
  .option("--matrix", "emit GitHub Actions matrix=<json> and empty=<bool> instead of JSON")
  .action(runReport);

program
  .command("apply")
  .description("Write package.json with the requested peer-dep bumps applied.")
  .requiredOption("--kind <kind>", '"minor" (all minor/patch) or "major" (one package)', parseKind)
  .option("--pkg <name>", "package name (required for --kind major)")
  .action(runApply);

program
  .command("pr-body")
  .description("Print a markdown PR body for the bumps already staged in package.json.")
  .requiredOption("--kind <kind>", '"minor" or "major"', parseKind)
  .option("--pkg <name>", "package name (required for --kind major)")
  .action(runPrBody);

program
  .command("open-pr")
  .description("Commit the staged peer-dep bumps, push the bot branch, and create or update a PR.")
  .requiredOption("--kind <kind>", '"minor" or "major"', parseKind)
  .option("--pkg <name>", "package name (required for --kind major)")
  .action(runOpenPr);

await program.parseAsync(process.argv);
