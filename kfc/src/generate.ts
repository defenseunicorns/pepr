// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { loadAllYaml } from "@kubernetes/client-node";
import * as fs from "fs";
import * as path from "path";
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  TargetLanguage,
  quicktype,
} from "quicktype-core";

import { fetch } from "./fetch";
import { K8s } from "./fluent";
import { CustomResourceDefinition } from "./upstream";
import { LogFn } from "./types";

export interface GenerateOptions {
  source: string; // URL, file path, or K8s CRD name
  directory?: string; // Output directory path
  plain?: boolean; // Disable fluent client wrapping
  language?: string | TargetLanguage;
  npmPackage?: string; // Override NPM package
  logFn: LogFn; // Log function callback
  noPost?: boolean; // Enable/disable post-processing
}

/**
 * Converts a CustomResourceDefinition to TypeScript types
 *
 * @param crd - The CustomResourceDefinition object to convert.
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
export async function convertCRDtoTS(
  crd: CustomResourceDefinition,
  opts: GenerateOptions,
): Promise<
  {
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
  }[]
> {
  const name = crd.spec.names.kind;
  const results: Record<string, string[]> = {};
  const output: {
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
  }[] = [];

  // Check for missing versions or empty schema
  if (!crd.spec.versions || crd.spec.versions.length === 0) {
    opts.logFn(`Skipping ${crd.metadata?.name}, it does not appear to be a CRD`);
    return [];
  }

  // Iterate through each version of the CRD
  for (const match of crd.spec.versions) {
    if (!match.schema?.openAPIV3Schema) {
      opts.logFn(
        `Skipping ${crd.metadata?.name ?? "unknown"}, it does not appear to have a valid schema`,
      );
      continue;
    }

    const schema = JSON.stringify(match.schema.openAPIV3Schema);
    opts.logFn(`- Generating ${crd.spec.group}/${match.name} types for ${name}`);

    const inputData = await prepareInputData(name, schema);
    const generatedTypes = await generateTypes(inputData, opts);

    const fileName = `${name.toLowerCase()}-${match.name.toLowerCase()}`;
    writeGeneratedFile(fileName, opts.directory || "", generatedTypes, opts.language || "ts");

    results[fileName] = generatedTypes;
    output.push({ results, name, crd, version: match.name });
  }

  return output;
}

/**
 * Prepares the input data for quicktype from the provided schema.
 *
 * @param name - The name of the schema.
 * @param schema - The JSON schema as a string.
 * @returns A promise that resolves to the input data for quicktype.
 */
export async function prepareInputData(name: string, schema: string): Promise<InputData> {
  // Create a new JSONSchemaInput
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  // Add the schema to the input
  await schemaInput.addSource({ name, schema });

  // Create a new InputData object
  const inputData = new InputData();
  inputData.addInput(schemaInput);

  return inputData;
}

/**
 * Generates TypeScript types using quicktype.
 *
 * @param inputData - The input data for quicktype.
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to an array of generated TypeScript type lines.
 */
export async function generateTypes(
  inputData: InputData,
  opts: GenerateOptions,
): Promise<string[]> {
  // If the language is not specified, default to TypeScript
  const language = opts.language || "ts";

  // Generate the types
  const out = await quicktype({
    inputData,
    lang: language,
    rendererOptions: { "just-types": "true" },
  });

  return out.lines;
}

/**
 * Writes the processed lines to the output file.
 *
 * @param fileName - The name of the file to write.
 * @param directory - The directory where the file will be written.
 * @param content - The content to write to the file.
 * @param language - The programming language of the file.
 */
export function writeGeneratedFile(
  fileName: string,
  directory: string,
  content: string[],
  language: string | TargetLanguage,
): void {
  language = language || "ts";
  if (!directory) return;

  const filePath = path.join(directory, `${fileName}.${language}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, content.join("\n"));
}

/**
 * Reads or fetches a CustomResourceDefinition from a file, URL, or the cluster.
 *
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to an array of CustomResourceDefinition objects.
 */
export async function readOrFetchCrd(opts: GenerateOptions): Promise<CustomResourceDefinition[]> {
  try {
    const filePath = resolveFilePath(opts.source);

    if (fs.existsSync(filePath)) {
      opts.logFn(`Attempting to load ${opts.source} as a local file`);
      const content = fs.readFileSync(filePath, "utf8");
      return loadAllYaml(content) as CustomResourceDefinition[];
    }

    const url = tryParseUrl(opts.source);
    if (url) {
      opts.logFn(`Attempting to load ${opts.source} as a URL`);
      const { ok, data } = await fetch<string>(url.href);
      if (ok) {
        return loadAllYaml(data) as CustomResourceDefinition[];
      }
    }

    // Fallback to Kubernetes cluster
    opts.logFn(`Attempting to read ${opts.source} from the Kubernetes cluster`);
    return [await K8s(CustomResourceDefinition).Get(opts.source)];
  } catch (error) {
    opts.logFn(`Error loading CRD: ${error.message}`);
    throw new Error(`Failed to read ${opts.source} as a file, URL, or Kubernetes CRD`);
  }
}

/**
 * Resolves the source file path, treating relative paths as local files.
 *
 * @param source - The source path to resolve.
 * @returns The resolved file path.
 */
export function resolveFilePath(source: string): string {
  return source.startsWith("/") ? source : path.join(process.cwd(), source);
}

/**
 * Tries to parse the source as a URL.
 *
 * @param source - The source string to parse as a URL.
 * @returns The parsed URL object or null if parsing fails.
 */
export function tryParseUrl(source: string): URL | null {
  try {
    return new URL(source);
  } catch {
    return null;
  }
}

/**
 * Main generate function to convert CRDs to TypeScript types.
 *
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
export async function generate(opts: GenerateOptions): Promise<
  {
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
  }[]
> {
  const crds = (await readOrFetchCrd(opts)).filter(crd => !!crd);
  const allResults: {
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
  }[] = [];

  opts.logFn("");

  for (const crd of crds) {
    if (crd.kind !== "CustomResourceDefinition" || !crd.spec?.versions?.length) {
      opts.logFn(`Skipping ${crd?.metadata?.name}, it does not appear to be a CRD`);
      // Ignore empty and non-CRD objects
      continue;
    }

    allResults.push(...(await convertCRDtoTS(crd, opts)));
  }

  if (opts.directory) {
    // Notify the user that the files have been generated
    opts.logFn(`\n✅ Generated ${allResults.length} files in the ${opts.directory} directory`);
  } else {
    // Log a message about the number of generated files even when no directory is provided
    opts.logFn(`\n✅ Generated ${allResults.length} files`);
  }

  return allResults;
}
