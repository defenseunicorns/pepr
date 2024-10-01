"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCRDtoTS = convertCRDtoTS;
exports.prepareInputData = prepareInputData;
exports.generateTypes = generateTypes;
exports.writeGeneratedFile = writeGeneratedFile;
exports.readOrFetchCrd = readOrFetchCrd;
exports.resolveFilePath = resolveFilePath;
exports.tryParseUrl = tryParseUrl;
exports.generate = generate;
const client_node_1 = require("@kubernetes/client-node");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const quicktype_core_1 = require("quicktype-core");
const fetch_1 = require("./fetch");
const fluent_1 = require("./fluent");
const upstream_1 = require("./upstream");
/**
 * Converts a CustomResourceDefinition to TypeScript types
 *
 * @param crd - The CustomResourceDefinition object to convert.
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
async function convertCRDtoTS(crd, opts) {
    const name = crd.spec.names.kind;
    const results = {};
    const output = [];
    // Check for missing versions or empty schema
    if (!crd.spec.versions || crd.spec.versions.length === 0) {
        opts.logFn(`Skipping ${crd.metadata?.name}, it does not appear to be a CRD`);
        return [];
    }
    // Iterate through each version of the CRD
    for (const match of crd.spec.versions) {
        if (!match.schema?.openAPIV3Schema) {
            opts.logFn(`Skipping ${crd.metadata?.name ?? "unknown"}, it does not appear to have a valid schema`);
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
async function prepareInputData(name, schema) {
    // Create a new JSONSchemaInput
    const schemaInput = new quicktype_core_1.JSONSchemaInput(new quicktype_core_1.FetchingJSONSchemaStore());
    // Add the schema to the input
    await schemaInput.addSource({ name, schema });
    // Create a new InputData object
    const inputData = new quicktype_core_1.InputData();
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
async function generateTypes(inputData, opts) {
    // If the language is not specified, default to TypeScript
    const language = opts.language || "ts";
    // Generate the types
    const out = await (0, quicktype_core_1.quicktype)({
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
function writeGeneratedFile(fileName, directory, content, language) {
    language = language || "ts";
    if (!directory)
        return;
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
async function readOrFetchCrd(opts) {
    try {
        const filePath = resolveFilePath(opts.source);
        if (fs.existsSync(filePath)) {
            opts.logFn(`Attempting to load ${opts.source} as a local file`);
            const content = fs.readFileSync(filePath, "utf8");
            return (0, client_node_1.loadAllYaml)(content);
        }
        const url = tryParseUrl(opts.source);
        if (url) {
            opts.logFn(`Attempting to load ${opts.source} as a URL`);
            const { ok, data } = await (0, fetch_1.fetch)(url.href);
            if (ok) {
                return (0, client_node_1.loadAllYaml)(data);
            }
        }
        // Fallback to Kubernetes cluster
        opts.logFn(`Attempting to read ${opts.source} from the Kubernetes cluster`);
        return [await (0, fluent_1.K8s)(upstream_1.CustomResourceDefinition).Get(opts.source)];
    }
    catch (error) {
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
function resolveFilePath(source) {
    return source.startsWith("/") ? source : path.join(process.cwd(), source);
}
/**
 * Tries to parse the source as a URL.
 *
 * @param source - The source string to parse as a URL.
 * @returns The parsed URL object or null if parsing fails.
 */
function tryParseUrl(source) {
    try {
        return new URL(source);
    }
    catch {
        return null;
    }
}
/**
 * Main generate function to convert CRDs to TypeScript types.
 *
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
async function generate(opts) {
    const crds = (await readOrFetchCrd(opts)).filter(crd => !!crd);
    const allResults = [];
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
    }
    else {
        // Log a message about the number of generated files even when no directory is provided
        opts.logFn(`\n✅ Generated ${allResults.length} files`);
    }
    return allResults;
}
