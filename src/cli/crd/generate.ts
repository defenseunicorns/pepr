// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { stringify as toYAML } from "yaml";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";

const generate = new Command("generate")
  .description("Generate CRD manifests from TypeScript definitions")
  .option("--output <output>", "Output directory for generated CRDs", "./crds")
  .action(async options => {
    const outputDir = path.resolve(options.output);
    await createDirectoryIfNotExists(outputDir);

    const apiRoot = path.resolve("api");
    const versions = fs
      .readdirSync(apiRoot)
      .filter(v => fs.statSync(path.join(apiRoot, v)).isDirectory());

    for (const version of versions) {
      await processVersion(version, apiRoot, outputDir);
    }
  });

function extractMetadata(kind: string, content: string): {
  specProps: Record<string, JSONSchemaPropertyWithMetadata>
  fqdn: string;
  requiredProps: string[];
  shortNames?: string[];
  plural: string;
  scope: "Cluster" | "Namespaced";
} {
  const group = extractComment(content, "Group") ?? "example";
  const domain = extractComment(content, "Domain") ?? "pepr.dev";
  const fqdn = `${group}.${domain}`;
  const details = extractDetails(content);
  const specProps = extractSpecProperties(content, `${kind}Spec`);
  const requiredProps = Object.keys(specProps).filter(key => specProps[key]._required);
  const plural =
    details.plural ?? `${kind.toLowerCase()}${kind.toLowerCase().endsWith("s") ? "es" : "s"}`;
  const scope = details.scope ?? "Namespaced";
  const shortNames = details.shortName ? [details.shortName] : undefined;
  return {
    requiredProps,
    plural,
    scope,
    shortNames,
    specProps,
    fqdn
  };
}
async function processVersion(version: string, apiRoot: string, outputDir: string): Promise<void> {
  const versionDir = path.join(apiRoot, version);
  const files = fs.readdirSync(versionDir).filter(f => f.endsWith(".ts"));

  for (const file of files) {
    const filePath = path.join(versionDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    const kindFromComment = extractComment(content, "Kind");
    if (!kindFromComment) {
      console.warn(`⚠️ Skipping ${file}: missing '// Kind: <KindName>' comment`);
      continue;
    }

    const kind = kindFromComment;
    const { fqdn, specProps, requiredProps, plural, scope, shortNames } = extractMetadata(kind, content);

    const typedSpecProps: Record<string, JSONSchemaProperty> = {};
    for (const [key, value] of Object.entries(specProps)) {
      // remove _required property since it cannot exist in the final schema
      delete value._required;
      typedSpecProps[key] = value;
    }

    const crd: CustomResourceDefinition = {
      apiVersion: "apiextensions.k8s.io/v1",
      kind: "CustomResourceDefinition",
      metadata: {
        name: `${plural}.${fqdn}`,
      },
      spec: {
        group: fqdn,
        names: {
          kind,
          plural,
          singular: kind.toLowerCase(),
          ...(shortNames ? { shortNames } : {}),
        },
        scope,
        versions: [
          {
            name: version,
            served: true,
            storage: true,
            schema: {
              openAPIV3Schema: {
                type: "object",
                properties: {
                  spec: {
                    type: "object",
                    description: `${kind}Spec defines the desired state of ${kind}`,
                    properties: typedSpecProps,
                    ...(requiredProps.length > 0 ? { required: requiredProps } : {}),
                  },
                  status: {
                    type: "object",
                    description: `${kind}Status defines the observed state of ${kind}`,
                    properties: {
                      conditions: {
                        type: "array",
                        description: "Conditions describing the current state",
                        items: {
                          type: "object",
                          description:
                            "Condition contains details for one aspect of the current state of this API Resource.",
                          properties: extractConditionTypeProperties(
                            content,
                            `${kind}StatusCondition`,
                          ),
                          required: ["lastTransitionTime", "message", "reason", "status"],
                        },
                      },
                    },
                  },
                },
              },
            },
            subresources: {
              status: {},
            },
          },
        ],
      },
    };

    const outPath = path.join(outputDir, `${kind.toLowerCase()}.yaml`);
    fs.writeFileSync(outPath, toYAML(crd), "utf8");
    console.log(`✔ Created ${outPath}`);
  }
}

function extractComment(content: string, label: string): string | undefined {
  const regex = new RegExp(`//\\s+${label}:\\s+(.*)`);
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractDetails(content: string): {
  plural?: string;
  scope?: "Cluster" | "Namespaced";
  shortName?: string;
} {
  const match = content.match(/export const details\s*=\s*{([\s\S]*?)}/m);
  if (!match) return {};
  const body = match[1];

  const plural = matchField(body, "plural");
  const scope = matchField(body, "scope") as "Cluster" | "Namespaced" | undefined;
  const shortName = matchField(body, "shortName");

  return { plural, scope, shortName };

  function matchField(body: string, key: string): string | undefined {
    const reg = new RegExp(`${key}\\s*:\\s*["'](.*?)["']`);
    const result = body.match(reg);
    return result?.[1];
  }
}

function extractSpecProperties(
  content: string,
  interfaceName: string,
): Record<string, JSONSchemaPropertyWithMetadata> {
  const regex = new RegExp(`export interface ${interfaceName}\\s*{([\\s\\S]*?)^}`, "m");
  const match = content.match(regex);
  if (!match) return {};

  const lines = match[1].split("\n");
  const props: Record<string, JSONSchemaPropertyWithMetadata> = {};

  let currentComment: string | undefined;
  let collectingBlock = false;
  let blockKey = "";
  let blockRequired = false;
  let blockLines: string[] = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith("//")) {
      currentComment = line.replace(/^\/\/\s?/, "").trim();
      continue;
    }

    if (collectingBlock) {
      // Inside a multi-line inline object
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;
      blockLines.push(rawLine);

      if (braceDepth === 0) {
        // Done collecting block
        const body = blockLines.join("\n").replace(/^[^{]*{/, "{").replace(/};?$/, "}");
        const { properties, required } = extractInlineObject(body);

        props[uncapitalize(blockKey)] = {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
          ...(currentComment ? { description: currentComment } : {}),
          _required: blockRequired,
        };

        // Reset
        collectingBlock = false;
        blockKey = "";
        blockLines = [];
        currentComment = undefined;
      }

      continue;
    }

    // Match start of object block
    const blockStart = line.match(/^(\w+)(\??):\s*{?$/);
    if (blockStart) {
      blockKey = blockStart[1];
      blockRequired = blockStart[2] !== "?";
      collectingBlock = true;
      braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      blockLines = [rawLine];
      continue;
    }

    const flatMatch = line.match(/^(\w+)(\??):\s*(\S+);$/);
    if (flatMatch) {
      const [, name, optional, tsType] = flatMatch;
      const isOptional = optional === "?";

      let schema: JSONSchemaProperty;
      if (tsType.endsWith("[]")) {
        schema = {
          type: "array",
          items: { type: normalizeType(tsType.slice(0, -2)) },
        };
      } else {
        schema = { type: normalizeType(tsType) };
      }

      if (currentComment) {
        schema.description = currentComment;
        currentComment = undefined;
      }

      props[uncapitalize(name)] = {
        ...schema,
        _required: !isOptional,
      };
      continue;
    }
  }

  return props;
}

function extractInlineObject(typeString: string): {
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
} {
  const props: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  const lines = typeString
    .replace(/^{/, "")
    .replace(/}$/, "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Match simple types or arrays
    const simpleMatch = line.match(/^(\w+)(\??):\s*(\w+)(\[\])?;?$/);
    if (simpleMatch) {
      const [, key, optional, baseType, isArray] = simpleMatch;
      const isOptional = optional === "?";

      const normalizedType = normalizeType(baseType);
      props[key] = isArray
        ? { type: "array", items: { type: normalizedType } }
        : { type: normalizedType };

      if (!isOptional) required.push(key);
      i++;
      continue;
    }

    // Match object fields: key?: {
    const objectStartMatch = line.match(/^(\w+)(\??):\s*{$/);
    if (objectStartMatch) {
      const [, key, optional] = objectStartMatch;
      const isOptional = optional === "?";
      let depth = 1;
      const objectLines = [];
      i++;

      while (i < lines.length && depth > 0) {
        const l = lines[i];
        depth += (l.match(/{/g) || []).length;
        depth -= (l.match(/}/g) || []).length;
        objectLines.push(l);
        i++;
      }

      const nestedBody = `{${objectLines.join("\n")}}`;
      const { properties: nestedProps, required: nestedReqs } = extractInlineObject(nestedBody);

      props[key] = {
        type: "object",
        properties: nestedProps,
        ...(nestedReqs.length > 0 ? { required: nestedReqs } : {}),
      };

      if (!isOptional) required.push(key);
      continue;
    }

    i++; // fallback advance
  }

  return { properties: props, required };
}

function extractConditionTypeProperties(
  content: string,
  typeName: string,
): Record<string, JSONSchemaProperty> {
  const regex = new RegExp(`type\\s+${typeName}\\s*=\\s*{([\\s\\S]*?)}\\s*`, "m");
  const match = content.match(regex);
  if (!match) return {};

  const lines = match[1].split("\n").map(l => l.trim());
  const props: Record<string, JSONSchemaProperty> = {};
  let currentDescription: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle JSDoc
    if (line.startsWith("/**")) {
      currentDescription = [];
      while (!lines[i].endsWith("*/") && i < lines.length) {
        currentDescription.push(lines[i].replace(/^(\*\s?)/, ""));
        i++;
      }
      continue;
    }

    // Inline nested object e.g. work: {
    const objectStartMatch = line.match(/^(\w+)(\??):\s*{$/);
    if (objectStartMatch) {
      const [, key] = objectStartMatch;
      let braceDepth = 1;
      const nestedLines = [];
      i++;

      while (i < lines.length && braceDepth > 0) {
        const l = lines[i];
        braceDepth += (l.match(/{/g) || []).length;
        braceDepth -= (l.match(/}/g) || []).length;
        nestedLines.push(l);
        i++;
      }

      const nestedBody = `{${nestedLines.join("\n")}}`;
      const nested = extractInlineObject(nestedBody);
      props[key] = {
        type: "object",
        properties: nested.properties,
        ...(nested.required.length > 0 ? { required: nested.required } : {}),
        ...(currentDescription.length > 0
          ? { description: currentDescription.join(" ") }
          : {}),
      };
      currentDescription = [];
      continue;
    }

    // Simple field
    const flatMatch = line.match(/^(\w+)(\??):\s*(\w+);/);
    if (flatMatch) {
      const [, key, , tsType] = flatMatch;
      const type = tsType === "Date" ? "string" : normalizeType(tsType);
      const format = tsType === "Date" ? "date-time" : undefined;

      props[key] = {
        type,
        ...(format ? { format } : {}),
        ...(currentDescription.length > 0
          ? { description: currentDescription.join(" ") }
          : {}),
      };
      currentDescription = [];
    }
  }

  return props;
}

function normalizeType(tsType: string): "string" | "number" | "boolean" {
  switch (tsType) {
    case "string":
    case "number":
    case "boolean":
      return tsType;
    default:
      return "string";
  }
}

function uncapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

interface JSONSchemaProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  format?: string;
  items?: {
    type: "string" | "number" | "boolean";
  };
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface JSONSchemaPropertyWithMetadata extends JSONSchemaProperty {
  _required?: boolean;
}

export interface CustomResourceDefinition {
  apiVersion: "apiextensions.k8s.io/v1";
  kind: "CustomResourceDefinition";
  metadata: {
    name: string;
  };
  spec: {
    group: string;
    names: {
      kind: string;
      plural: string;
      singular: string;
      shortNames?: string[];
    };
    scope: "Namespaced" | "Cluster";
    versions: Array<{
      name: string;
      served: true;
      storage: true;
      schema: {
        openAPIV3Schema: {
          type: "object";
          properties: {
            spec: {
              type: "object";
              description?: string;
              properties: Record<string, JSONSchemaProperty>;
              required?: string[];
            };
            status: {
              type: "object";
              description?: string;
              properties: {
                conditions: {
                  type: "array";
                  description?: string;
                  items: {
                    type: "object";
                    description?: string;
                    properties: Record<string, JSONSchemaProperty>;
                    required?: string[];
                  };
                };
              };
            };
          };
        };
      };
      subresources: {
        // Not optional, subresource must be present and it is empty
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        status: {};
      };
    }>;
  };
}

export default generate;
