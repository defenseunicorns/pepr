// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { stringify } from "yaml";
import {
  Project,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  SyntaxKind,
  Node,
  SourceFile,
  Type,
} from "ts-morph";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";
import { kind as k } from "kubernetes-fluent-client";
import { V1JSONSchemaProps } from "@kubernetes/client-node";
import { WarningMessages, ErrorMessages } from "./messages";

export default new Command("generate")
  .description("Generate CRD manifests from TypeScript definitions")
  .option("-o, --output [directory]", "Output directory for generated CRDs. Default: ./crds")
  .helpOption("-h, --help", "Display help for command")
  .action(generateCRDs);

export function extractCRDDetails(
  content: string,
  sourceFile: SourceFile,
): {
  kind: string | undefined;
  fqdn: string;
  scope: "Cluster" | "Namespaced";
  plural: string;
  shortNames?: string[];
} {
  const kind = extractSingleLineComment(content, "Kind");
  const group = extractSingleLineComment(content, "Group") ?? "example";
  const domain = extractSingleLineComment(content, "Domain") ?? "pepr.dev";
  const details = extractDetails(sourceFile);

  const fqdn = `${group}.${domain}`;

  const { plural, scope } = details;

  const shortNames = details.shortName ? [details.shortName] : undefined;
  return { kind, plural, scope, shortNames, fqdn };
}

export async function generateCRDs(options: { output: string }): Promise<void> {
  console.log("This feature is currently in alpha.\n");
  const outputDir = path.resolve(options.output);
  await createDirectoryIfNotExists(outputDir);

  const project = new Project();
  const apiRoot = path.resolve("api");
  const versions = getAPIVersions(apiRoot);

  for (const version of versions) {
    const sourceFiles = loadVersionFiles(project, path.join(apiRoot, version));
    for (const sourceFile of sourceFiles) {
      processSourceFile(sourceFile, version, outputDir);
    }
  }
}

export function getAPIVersions(apiRoot: string): string[] {
  return fs.readdirSync(apiRoot).filter(v => fs.statSync(path.join(apiRoot, v)).isDirectory());
}

export function loadVersionFiles(project: Project, versionDir: string): SourceFile[] {
  const files = fs.readdirSync(versionDir).filter(f => f.endsWith(".ts"));
  const filePaths = files.map(f => path.join(versionDir, f));
  return project.addSourceFilesAtPaths(filePaths);
}

export function processSourceFile(
  sourceFile: SourceFile,
  version: string,
  outputDir: string,
): void {
  const content = sourceFile.getFullText();
  const { kind, fqdn, scope, plural, shortNames } = extractCRDDetails(content, sourceFile);

  if (!kind) {
    console.warn(WarningMessages.MISSING_KIND_COMMENT(sourceFile.getBaseName()));
    return;
  }

  const spec = sourceFile.getInterface(`${kind}Spec`);
  if (!spec) {
    console.warn(WarningMessages.MISSING_INTERFACE(sourceFile.getBaseName(), kind));
    return;
  }

  const condition = sourceFile.getTypeAlias(`${kind}StatusCondition`);
  const specSchema = getSchemaFromType(spec);
  const conditionSchema = condition ? getSchemaFromType(condition) : emptySchema();

  const crd = buildCRD({
    kind,
    fqdn,
    version,
    plural,
    scope,
    shortNames,
    specSchema,
    conditionSchema,
  });

  const outPath = path.join(outputDir, `${kind.toLowerCase()}.yaml`);
  fs.writeFileSync(outPath, stringify(crd), "utf8");
  console.log(`✔ Created ${outPath}`);
}

// Extracts a comment from the content of a file based on a label.
export function extractSingleLineComment(content: string, label: string): string | undefined {
  // https://regex101.com/r/oLFaHP/1
  const match = content.match(new RegExp(`//\\s+${label}:\\s+(.*)`));
  return match?.[1].trim();
}

export function extractDetails(sourceFile: SourceFile): {
  plural: string;
  scope: "Cluster" | "Namespaced";
  shortName: string;
} {
  const decl = sourceFile.getVariableDeclaration("details");
  if (!decl) {
    throw new Error(ErrorMessages.MISSING_DETAILS);
  }

  const init = decl.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const getStr = (key: string): string => {
    const prop = init.getProperty(key);
    const value = prop?.getFirstChildByKind(SyntaxKind.StringLiteral)?.getLiteralText();
    if (!value) {
      throw new Error(ErrorMessages.MISSING_OR_INVALID_KEY(key));
    }
    return value;
  };

  const scope = getStr("scope");
  if (scope === "Cluster" || scope === "Namespaced") {
    return {
      plural: getStr("plural"),
      scope,
      shortName: getStr("shortName"),
    };
  }

  throw new Error(ErrorMessages.INVALID_SCOPE(scope));
}

export function getJsDocDescription(node: Node): string {
  if (!Node.isPropertySignature(node) && !Node.isPropertyDeclaration(node)) return "";
  return node
    .getJsDocs()
    .map(doc => doc.getComment())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function getSchemaFromType(decl: InterfaceDeclaration | TypeAliasDeclaration): {
  properties: Record<string, V1JSONSchemaProps>;
  required: string[];
} {
  const type = decl.getType();
  const properties: Record<string, V1JSONSchemaProps> = {};
  const required: string[] = [];

  for (const prop of type.getProperties()) {
    const name = uncapitalize(prop.getName());
    const declarations = prop.getDeclarations();
    if (!declarations.length) continue;

    const declaration = declarations[0];
    const description = getJsDocDescription(declaration);
    const valueType = declaration.getType();

    properties[name] = {
      ...mapTypeToSchema(valueType),
      ...(description ? { description } : {}),
    };

    if (!prop.isOptional()) required.push(name);
  }

  return { properties, required };
}

export function mapTypeToSchema(type: Type): V1JSONSchemaProps {
  if (type.getText() === "Date") return { type: "string", format: "date-time" };
  if (type.isString()) return { type: "string" };
  if (type.isNumber()) return { type: "number" };
  if (type.isBoolean()) return { type: "boolean" };
  if (type.isArray()) {
    return {
      type: "array",
      items: mapTypeToSchema(type.getArrayElementTypeOrThrow()),
    };
  }

  if (type.isObject()) return buildObjectSchema(type);
  return { type: "string" };
}

export function buildObjectSchema(type: Type): V1JSONSchemaProps {
  const props: Record<string, V1JSONSchemaProps> = {};
  const required: string[] = [];

  for (const prop of type.getProperties()) {
    const name = uncapitalize(prop.getName());
    const declarations = prop.getDeclarations();
    if (!declarations.length) continue;

    const decl = declarations[0];
    const description = getJsDocDescription(decl);
    const subType = decl.getType();

    props[name] = {
      ...mapTypeToSchema(subType),
      ...(description ? { description } : {}),
    };

    if (!prop.isOptional()) required.push(name);
  }

  return {
    type: "object",
    properties: props,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function uncapitalize(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function emptySchema(): {
  properties: Record<string, V1JSONSchemaProps>;
  required: string[];
} {
  return { properties: {}, required: [] };
}

interface CRDConfig {
  kind: string;
  fqdn: string;
  version: string;
  plural: string;
  scope: "Cluster" | "Namespaced";
  shortNames?: string[];
  specSchema: ReturnType<typeof getSchemaFromType>;
  conditionSchema: ReturnType<typeof getSchemaFromType>;
}

export function buildCRD(config: CRDConfig): k.CustomResourceDefinition {
  return {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
    metadata: {
      name: `${config.plural}.${config.fqdn}`,
    },
    spec: {
      group: config.fqdn,
      names: {
        kind: config.kind,
        plural: config.plural,
        singular: config.kind.toLowerCase(),
        ...(config.shortNames ? { shortNames: config.shortNames } : {}),
      },
      scope: config.scope,
      versions: [
        {
          name: config.version,
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              type: "object",
              properties: {
                spec: {
                  type: "object",
                  description: `${config.kind}Spec defines the desired state of ${config.kind}`,
                  properties: config.specSchema.properties,
                  required: config.specSchema.required,
                },
                status: {
                  type: "object",
                  description: `${config.kind}Status defines the observed state of ${config.kind}`,
                  properties: {
                    conditions: {
                      type: "array",
                      description: "Conditions describing the current state",
                      items: {
                        type: "object",
                        description:
                          "Condition contains details for one aspect of the current state of this API Resource.",
                        properties: config.conditionSchema.properties,
                        required: config.conditionSchema.required,
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
}
