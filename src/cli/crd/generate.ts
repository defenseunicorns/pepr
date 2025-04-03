// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { stringify as toYAML } from "yaml";

import { createDirectoryIfNotExists } from "../../lib/filesystemService";

// Reads API Types from TypeScript definitions and generates CRD manifests
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

        const specProps = extractSpecProperties(content, `${kind}Spec`);
        const plural = `${kind.toLowerCase()}${kind.toLowerCase().endsWith("s") ? "es" : "s"}`;
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
            },
            scope: "Namespaced",
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
                        properties: specProps,
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
  });

function extractComment(content: string, label: string): string | undefined {
  const regex = new RegExp(`//\\s+${label}:\\s+(.*)`);
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractSpecProperties(
  content: string,
  interfaceName: string,
): Record<string, JSONSchemaProperty> {
  const regex = new RegExp(`export interface ${interfaceName}\\s*{([\\s\\S]*?)^}`, "m");
  const match = content.match(regex);
  if (!match) return {};

  const body = match[1];
  const propRegex = /(?:\/\/\s*(.*)\n)?\s*(\w+)\??:\s*(string|number|boolean)/g;

  const props: Record<string, JSONSchemaProperty> = {};
  let propMatch: RegExpExecArray | null;

  while ((propMatch = propRegex.exec(body)) !== null) {
    const [, comment, name, type] = propMatch;
    const prop: JSONSchemaProperty = { type: mapType(type) };
    if (comment) {
      prop.description = comment.trim();
    }
    props[uncapitalize(name)] = prop;
  }

  return props;
}

function mapType(tsType: string): JSONSchemaProperty["type"] {
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

// function capitalize(str: string): string {
//   return str.charAt(0).toUpperCase() + str.slice(1);
// }

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
    };
    scope: "Namespaced";
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
                  };
                };
              };
            };
          };
        };
      };
      subresources: {
        // status subresource must start empty, it will be filled by the controller
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        status: {};
      };
    }>;
  };
}

interface JSONSchemaProperty {
  type: "string" | "number" | "boolean";
  description?: string;
}

export default generate;
