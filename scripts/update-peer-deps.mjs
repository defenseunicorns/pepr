#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = resolve(here, "..", "package.json");

function parseArgs(argv) {
  const args = { mode: "report", kind: null, pkg: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--report") {
      args.mode = "report";
    } else if (flag === "--write") {
      args.mode = "write";
      args.kind = argv[++i];
    } else if (flag === "--pkg") {
      args.pkg = argv[++i];
    } else if (flag === "--help" || flag === "-h") {
      args.mode = "help";
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/update-peer-deps.mjs [--report | --write <kind> [--pkg <name>]]",
      "",
      "  --report                Print JSON of pending peer-dep bumps to stdout (default).",
      "  --write minor           Apply all minor/patch peer-dep bumps to package.json.",
      "  --write major --pkg N   Apply the named major peer-dep bump to package.json.",
      "",
      "Exit codes:",
      "  0  changes applied (or report printed)",
      "  2  no changes to apply for the requested mode",
      "  1  invalid arguments",
      "",
    ].join("\n"),
  );
}

function readPackageJson() {
  const raw = readFileSync(PACKAGE_JSON, "utf8");
  return { raw, parsed: JSON.parse(raw) };
}

function npmLatest(pkg) {
  return execFileSync("npm", ["view", pkg, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function majorOf(version) {
  const head = version.split(".")[0];
  const num = Number.parseInt(head, 10);
  if (Number.isNaN(num)) {
    throw new Error(`cannot parse major version from "${version}"`);
  }
  return num;
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

function writePackageJson(parsed) {
  const next = JSON.stringify(parsed, null, 2) + "\n";
  writeFileSync(PACKAGE_JSON, next);
}

function applyMinorBumps(parsed, minor) {
  for (const [name, { to }] of Object.entries(minor)) {
    parsed.peerDependencies[name] = to;
  }
}

function applyMajorBump(parsed, target) {
  parsed.peerDependencies[target.name] = target.to;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(1);
  }

  if (args.mode === "help") {
    printHelp();
    return;
  }

  const { parsed } = readPackageJson();
  const peers = parsed.peerDependencies ?? {};
  const report = buildReport(peers);

  if (args.mode === "report") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  if (args.kind === "minor") {
    if (Object.keys(report.minor).length === 0) {
      console.error("no minor/patch peerDependency bumps available");
      process.exit(2);
    }
    applyMinorBumps(parsed, report.minor);
    writePackageJson(parsed);
    const summary = Object.entries(report.minor)
      .map(([n, v]) => `${n} ${v.from} -> ${v.to}`)
      .join(", ");
    console.log(`updated peerDependencies (minor/patch): ${summary}`);
    return;
  }

  if (args.kind === "major") {
    if (!args.pkg) {
      console.error("--write major requires --pkg <name>");
      process.exit(1);
    }
    const target = report.major.find(m => m.name === args.pkg);
    if (!target) {
      console.error(`no major peerDependency bump available for "${args.pkg}"`);
      process.exit(2);
    }
    applyMajorBump(parsed, target);
    writePackageJson(parsed);
    console.log(`updated peerDependency ${target.name} ${target.from} -> ${target.to}`);
    return;
  }

  console.error(`unknown --write kind: ${args.kind}`);
  printHelp();
  process.exit(1);
}

main();
