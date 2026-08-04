import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { overridesFile, type ChartOverrides } from "../../../src/lib/assets/yaml/overridesFile";
import { getHelmValuesDocs } from "./helmValuesDocs.helper";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type DocumentedHelmValue = {
  type: string;
  defaultValue: string;
};

const dynamicDefaults: Record<string, string> = {
  "admission.annotations.pepr.dev/description": "<from package.json>",
  "admission.env": "<from package.json>",
  "admission.failurePolicy": "<from package.json>",
  "admission.image": "<from build>",
  "admission.labels.app": "<generated>",
  "admission.labels.pepr.dev/controller": "<generated>",
  "admission.labels.pepr.dev/uuid": "<generated>",
  "admission.securityContext.fsGroup": "<image-dependent>",
  "admission.securityContext.runAsGroup": "<image-dependent>",
  "admission.securityContext.runAsUser": "<image-dependent>",
  "admission.webhookTimeout": "<from package.json>",
  "watcher.annotations.pepr.dev/description": "<from package.json>",
  "watcher.env": "<from package.json>",
  "watcher.image": "<from build>",
  "watcher.labels.app": "<generated>",
  "watcher.labels.pepr.dev/controller": "<generated>",
  "watcher.labels.pepr.dev/uuid": "<generated>",
  "watcher.securityContext.fsGroup": "<image-dependent>",
  "watcher.securityContext.runAsGroup": "<image-dependent>",
  "watcher.securityContext.runAsUser": "<image-dependent>",
};

describe("Helm values documentation", () => {
  it("matches generated user-tunable values.yaml fields", async () => {
    const generatedValues = await generateValuesYaml();
    const expectedDocs = flattenValues(generatedValues);
    const actualDocs = new Map(
      getHelmValuesDocs().map(({ path, type, defaultValue }) => [path, { type, defaultValue }]),
    );

    expect(toSortedRecord(actualDocs)).toStrictEqual(toSortedRecord(expectedDocs));
  });
});

async function generateValuesYaml(): Promise<JsonValue> {
  const dir = await mkdtemp(path.join(tmpdir(), "pepr-docs-"));
  const valuesPath = path.join(dir, "values.yaml");
  const overrides: ChartOverrides = {
    apiPath: "/some/api",
    capabilities: [],
    config: {
      uuid: "test-module",
      alwaysIgnore: { namespaces: [] },
      onError: "reject",
      webhookTimeout: 10,
      description: "Test Module",
      customLabels: {},
      rbacMode: "scoped",
      rbac: [],
    },
    hash: "test-hash",
    name: "test-module",
    image: "pepr:dev",
  };

  await overridesFile(overrides, valuesPath, []);

  return YAML.parse(await readFile(valuesPath, "utf-8")) as JsonValue;
}

function flattenValues(value: JsonValue, currentPath = ""): Map<string, DocumentedHelmValue> {
  if (isInternalPath(currentPath)) {
    return new Map();
  }

  if (Array.isArray(value)) {
    return new Map([[currentPath, documentedValue(currentPath, value)]]);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return new Map([[currentPath, documentedValue(currentPath, value)]]);
    }

    return entries.reduce((values, [key, child]) => {
      for (const [path, defaultValue] of flattenValues(child, joinPath(currentPath, key))) {
        values.set(path, defaultValue);
      }
      return values;
    }, new Map<string, string>());
  }

  return new Map([[currentPath, documentedValue(currentPath, value)]]);
}

function documentedValue(path: string, value: JsonValue): DocumentedHelmValue {
  return {
    type: documentedType(value),
    defaultValue: dynamicDefaults[path] ?? JSON.stringify(value),
  };
}

function documentedType(value: JsonValue): string {
  if (Array.isArray(value)) {
    return "list";
  }

  if (isRecord(value)) {
    return "object";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function isInternalPath(path: string): boolean {
  return path === "hash" || path === "uuid" || path === "secrets" || path.startsWith("secrets.");
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function toSortedRecord(
  values: Map<string, DocumentedHelmValue>,
): Record<string, DocumentedHelmValue> {
  return Object.fromEntries(
    [...values.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}
