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
    const group = extractComment(content, "Group") ?? "example";
    const domain = extractComment(content, "Domain") ?? "pepr.dev";
    const fqdn = `${group}.${domain}`;
    const details = extractDetails(content);

    const specProps = extractSpecProperties(content, `${kind}Spec`);
    const requiredProps = Object.keys(specProps).filter(key => specProps[key].required);
    const plural =
      details.plural ?? `${kind.toLowerCase()}${kind.toLowerCase().endsWith("s") ? "es" : "s"}`;
    const scope = details.scope ?? "Namespaced";
    const shortNames = details.shortName ? [details.shortName] : undefined;

    const typedSpecProps: Record<string, JSONSchemaProperty> = {};
    for (const [key, value] of Object.entries(specProps)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { required: _required, ...typed } = value;
      typedSpecProps[key] = typed;
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
                          required: ["lastTransitionTime", "message", "reason", "status", "type"],
                        },
                      },
                    },
                  },
                },
              },
            },
            subresources: {
              // subresource status must be empty for CRD to be correct
              // eslint-disable-next-line @typescript-eslint/no-empty-object-type
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
  interfaceName: string
): Record<string, JSONSchemaProperty & { required: boolean }> {
  const regex = new RegExp(`export interface ${interfaceName}\\s*{([\\s\\S]*?)^}`, "m");
  const match = content.match(regex);
  if (!match) return {};

  const body = match[1];

  // This regex handles: optional, arrays, comments
  const propRegex = /^\s*(\/\/.*\n)?\s*(\w+)(\??):\s*([\w\[\]<> \{\}:|]+);/gm;

  const props: Record<string, JSONSchemaProperty & { required: boolean }> = {};
  let propMatch: RegExpExecArray | null;

  while ((propMatch = propRegex.exec(body)) !== null) {
    const [, commentBlock, name, optional, typeString] = propMatch;
    const isArray = typeString.trim().endsWith("[]");
    const baseType = normalizeType(typeString.trim().replace(/\[\]$/, ""));
    const required = optional !== "?";

    const prop: JSONSchemaProperty & { required: boolean } = {
      type: isArray ? "array" : baseType,
      ...(isArray ? { items: { type: baseType } } : {}),
      required,
    };

    if (commentBlock) {
      prop.description = commentBlock.trim().replace(/^\/\/\s*/, "");
    }

    props[uncapitalize(name)] = prop;
  }

  return props;
}

function extractConditionTypeProperties(
  content: string,
  typeName: string,
): Record<string, JSONSchemaProperty> {
  const regex = new RegExp(`type ${typeName}\\s*=\\s*{([\\s\\S]*?)^}`, "m");
  const match = content.match(regex);
  if (!match) return {};

  const body = match[1];
  const propRegex =
    /(?:\/\*\*\\s*\\n(?:\\s*\*\\s*(.*?)\\n)+\\s*\*\/\\s*)?['"]?(\\w+)['"]?(\\??):\\s*(string|number|boolean|Date);/g;

  const props: Record<string, JSONSchemaProperty> = {};
  let propMatch: RegExpExecArray | null;

  while ((propMatch = propRegex.exec(body)) !== null) {
    const [, docComment, name, , tsType] = propMatch;
    const type = tsType === "Date" ? "string" : normalizeType(tsType);
    const format = tsType === "Date" ? "date-time" : undefined;

    props[name] = {
      type,
      ...(format ? { format } : {}),
      ...(docComment ? { description: docComment.trim() } : {}),
    };
  }

  return props;
}

function normalizeType(tsType: string): "string" | "number" | "boolean" {
  if (tsType.endsWith("[]")) {
    tsType = tsType.replace(/\[\]$/, "");
  }
  switch (tsType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

function uncapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

interface CustomResourceDefinition {
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
        // subresource status must be empty for CRD to be correct
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        status: {};
      };
    }>;
  };
}

interface JSONSchemaProperty {
  type: "string" | "number" | "boolean" | "array";
  description?: string;
  format?: string;
  items?: {
    type: "string" | "number" | "boolean";
  };
}

export default generate;
