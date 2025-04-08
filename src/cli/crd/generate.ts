// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { stringify as toYAML } from "yaml";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";
import { kind as k } from "kubernetes-fluent-client";

const generate = new Command("generate")
  .description("Generate CRD manifests from TypeScript definitions")
  .option("--output <output>", "Output directory for generated CRDs", "./crds")
  .action(async options => {
    const outputDir = path.resolve(options.output);
    await createDirectoryIfNotExists(outputDir);

    // Scans the api directory for versions
    const apiRoot = path.resolve("api");
    const versions = fs
      .readdirSync(apiRoot)
      .filter(v => fs.statSync(path.join(apiRoot, v)).isDirectory());

    for (const version of versions) {
      await processVersion(version, apiRoot, outputDir);
    }
  });

/**
 * Generates CRD YAML files from TypeScript definitions.
 * @param version - The version of the API.
 * @param content - The TypeScript content to process.
 * @returns An object containing the extracted metadata.
 */
function extractMetadata(
  kind: string,
  content: string,
): {
  specProps: Record<string, JSONSchemaPropertyWithMetadata>;
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
    fqdn,
  };
}

/**
 * Processes a version directory, extracting metadata and generating CRD YAML files.
 * @param version - The version directory to process.
 * @param apiRoot - The root directory of the API definitions.
 * @param outputDir - The output directory for generated CRD files.
 */
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
    const { fqdn, specProps, requiredProps, plural, scope, shortNames } = extractMetadata(
      kind,
      content,
    );

    const typedSpecProps: Record<string, JSONSchemaProperty> = {};
    for (const [key, value] of Object.entries(specProps)) {
      // remove _required property since it cannot exist in the final schema in the CRD or it breaks
      delete value._required;
      typedSpecProps[key] = value;
    }
    const conditionSchema = extractConditionTypeProperties(content, `${kind}StatusCondition`);
    const crd: k.CustomResourceDefinition = {
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
                          properties: conditionSchema.properties,
                          required: conditionSchema.required,
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

export function extractComment(content: string, label: string): string | undefined {
  const regex = new RegExp(`//\\s+${label}:\\s+(.*)`);
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extracts details from the content string.
 * @param plural - Plural name of the resource
 * @param scope - "Cluster" | "Namespaced"
 * @param shortName - Short name of the resource
 */
export function extractDetails(content: string): {
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
}

/**
 * Matches a field in the content string.
 * @param body - The content string to search in.
 * @param key - The key to match.
 * @returns The value of the matched field or undefined if not found.
 */
export function matchField(body: string, key: string): string | undefined {
  const reg = new RegExp(`${key}\\s*:\\s*["'](.*?)["']`);
  const result = body.match(reg);
  return result?.[1];
}

export function extractSpecProperties(
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
        const body = blockLines
          .join("\n")
          .replace(/^[^{]*{/, "{")
          .replace(/};?$/, "}");
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

/**
 * Extracts properties from an inline object in TypeScript.
 * @param typeString - The TypeScript type string to extract from.
 * @returns An object containing the extracted properties and required fields.
 */
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

    // Match object fields: key?: { (optional) }
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

/**
 * Extracts properties from a TypeScript condition type.
 * @param content - The TypeScript content to search in.
 * @param typeName - The name of the condition type to extract.
 * @returns An object containing the extracted properties and required fields.
 */
export function extractConditionTypeProperties(
  content: string,
  typeName: string,
): { properties: Record<string, JSONSchemaProperty>; required: string[] } {
  const regex = new RegExp(`type\\s+${typeName}\\s*=\\s*{([\\s\\S]*?)}\\s*`, "m");
  const match = content.match(regex);
  if (!match) return { properties: {}, required: [] };

  const lines = match[1].split("\n").map(l => l.trim());
  const props: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];
  let currentDescription: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle comments to create CRD descriptions
    if (line.startsWith("/**")) {
      currentDescription = [];

      // Start collecting comment lines including the first
      while (i < lines.length) {
        const commentLine = lines[i].trim();

        // End of comment
        if (commentLine.endsWith("*/")) {
          // Remove trailing */
          currentDescription.push(
            commentLine
              .replace(/^\/\*\*?/, "")
              .replace(/\*\/$/, "")
              .replace(/^\*\s?/, "")
              .trim(),
          );
          break;
        }

        // Normal JSDoc line
        currentDescription.push(
          commentLine
            .replace(/^\/\*\*?/, "")
            .replace(/^\*\s?/, "")
            .trim(),
        );
        i++;
      }

      // Remove any empty lines and join
      currentDescription = currentDescription.filter(Boolean);
      continue;
    }
    // Inline nested object e.g. work: {
    const objectStartMatch = line.match(/^(\w+)(\??):\s*{(.*)?$/);
    if (objectStartMatch) {
      const [, key, optionalToken] = objectStartMatch;
      const isOptional = optionalToken === "?";

      // Handle inline on one line: e.g., work: { name: string; }
      const inlineBody = objectStartMatch[3];
      if (inlineBody?.trim().endsWith("}")) {
        const inlineObject = `{${inlineBody}`;
        const { properties: inlineProps, required: inlineReq } = extractInlineObject(inlineObject);
        props[key] = {
          type: "object",
          properties: inlineProps,
          ...(inlineReq.length > 0 ? { required: inlineReq } : {}),
          ...(currentDescription.length > 0 ? { description: currentDescription.join(" ") } : {}),
        };
        if (!isOptional) required.push(key);
        currentDescription = [];
        continue;
      }

      // Multi-line object
      let braceDepth = 1;
      const nestedLines: string[] = [];
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
        ...(currentDescription.length > 0 ? { description: currentDescription.join(" ") } : {}),
      };

      if (!isOptional) {
        required.push(key);
      }

      currentDescription = [];
      continue;
    }

    // Simple field - e.g., name: string;
    const flatMatch = line.match(/^(\w+)(\??):\s*(\w+);/);
    if (flatMatch) {
      const [, key, optional, tsType] = flatMatch;
      const isOptional = optional === "?";
      const type = tsType === "Date" ? "string" : normalizeType(tsType);
      const format = tsType === "Date" ? "date-time" : undefined;

      props[key] = {
        type,
        ...(format ? { format } : {}),
        ...(currentDescription.length > 0 ? { description: currentDescription.join(" ") } : {}),
      };

      if (!isOptional) {
        required.push(key);
      }

      currentDescription = [];
    }
  }

  return { properties: props, required };
}

/**
 * Normalizes TypeScript types to JSON Schema types.
 * @param tsType - The TypeScript type to normalize.
 * @returns The normalized type as a string.
 */
export function normalizeType(tsType: string): "string" | "number" | "boolean" {
  switch (tsType) {
    case "string":
    case "number":
    case "boolean":
      return tsType;
    default:
      return "string";
  }
}

/**
 * Converts the first character of a string to lowercase.
 * @param str - The string to convert.
 * @returns The string with the first character in lowercase.
 */
export function uncapitalize(str: string): string {
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

export default generate;
