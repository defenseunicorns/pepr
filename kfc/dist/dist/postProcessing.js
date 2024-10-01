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
exports.postProcessing = postProcessing;
exports.mapFilesToCRD = mapFilesToCRD;
exports.processFiles = processFiles;
exports.processAndModifySingleFile = processAndModifySingleFile;
exports.applyCRDPostProcessing = applyCRDPostProcessing;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.getGenericKindProperties = getGenericKindProperties;
exports.collectInterfaceNames = collectInterfaceNames;
exports.isClassExtendingGenericKind = isClassExtendingGenericKind;
exports.updateBraceBalance = updateBraceBalance;
exports.getPropertyPattern = getPropertyPattern;
exports.modifyPropertiesAndAddEslintDirective = modifyPropertiesAndAddEslintDirective;
exports.addDeclareAndOptionalModifiersToProperties = addDeclareAndOptionalModifiersToProperties;
exports.addDeclareToGenericKindProperties = addDeclareToGenericKindProperties;
exports.makePropertiesOptional = makePropertiesOptional;
exports.processEslintDisable = processEslintDisable;
exports.wrapWithFluentClient = wrapWithFluentClient;
exports.normalizeIndentation = normalizeIndentation;
exports.normalizeLineIndentation = normalizeLineIndentation;
exports.normalizePropertySpacing = normalizePropertySpacing;
exports.removePropertyStringAny = removePropertyStringAny;
exports.shouldWrapWithFluentClient = shouldWrapWithFluentClient;
exports.processLines = processLines;
exports.processClassContext = processClassContext;
exports.modifyAndNormalizeClassProperties = modifyAndNormalizeClassProperties;
exports.normalizeIndentationAndSpacing = normalizeIndentationAndSpacing;
exports.logError = logError;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
const fileSystem_1 = require("./fileSystem");
const genericKindProperties = getGenericKindProperties();
/**
 * Performs post-processing on generated TypeScript files.
 *
 * @param allResults The array of CRD results.
 * @param opts The options for post-processing.
 * @param fileSystem The file system interface for reading and writing files.
 */
async function postProcessing(allResults, opts, fileSystem = new fileSystem_1.NodeFileSystem()) {
    if (!opts.directory) {
        opts.logFn("⚠️ Error: Directory is not defined.");
        return;
    }
    const files = fileSystem.readdirSync(opts.directory);
    opts.logFn("\n🔧 Post-processing started...");
    const fileResultMap = mapFilesToCRD(allResults);
    await processFiles(files, fileResultMap, opts, fileSystem);
    opts.logFn("🔧 Post-processing completed.\n");
}
/**
 * Creates a map linking each file to its corresponding CRD result.
 *
 * @param allResults - The array of CRD results.
 * @returns A map linking file names to their corresponding CRD results.
 */
function mapFilesToCRD(allResults) {
    const fileResultMap = {};
    for (const { name, crd, version } of allResults) {
        const expectedFileName = `${name.toLowerCase()}-${version.toLowerCase()}.ts`;
        fileResultMap[expectedFileName] = { name, crd, version };
    }
    if (Object.keys(fileResultMap).length === 0) {
        console.warn("⚠️ Warning: No CRD results were mapped to files.");
    }
    return fileResultMap;
}
/**
 * Processes the list of files, applying CRD post-processing to each.
 *
 * @param files - The list of file names to process.
 * @param fileResultMap - A map linking file names to their corresponding CRD results.
 * @param opts - Options for the generation process.
 * @param fileSystem - The file system interface for reading and writing files.
 */
async function processFiles(files, fileResultMap, opts, fileSystem) {
    for (const file of files) {
        if (!opts.directory) {
            throw new Error("Directory is not defined.");
        }
        const filePath = path.join(opts.directory, file);
        const fileResult = fileResultMap[file];
        if (!fileResult) {
            opts.logFn(`⚠️ Warning: No matching CRD result found for file: ${filePath}`);
            continue;
        }
        try {
            processAndModifySingleFile(filePath, fileResult, opts, fileSystem);
        }
        catch (error) {
            logError(error, filePath, opts.logFn);
        }
    }
}
/**
 * Handles the processing of a single file: reading, modifying, and writing back to disk.
 *
 * @param filePath - The path to the file to be processed.
 * @param fileResult - The associated CRD result for this file.
 * @param fileResult.name - The name of the schema.
 * @param fileResult.crd - The CustomResourceDefinition object.
 * @param fileResult.version - The version of the CRD.
 * @param opts - Options for the generation process.
 * @param fileSystem - The file system interface for reading and writing files.
 */
function processAndModifySingleFile(filePath, fileResult, opts, fileSystem) {
    opts.logFn(`🔍 Processing file: ${filePath}`);
    const { name, crd, version } = fileResult;
    let fileContent;
    try {
        fileContent = fileSystem.readFile(filePath);
    }
    catch (error) {
        logError(error, filePath, opts.logFn);
        return;
    }
    let modifiedContent;
    try {
        modifiedContent = applyCRDPostProcessing(fileContent, name, crd, version, opts);
    }
    catch (error) {
        logError(error, filePath, opts.logFn);
        return;
    }
    try {
        fileSystem.writeFile(filePath, modifiedContent);
        opts.logFn(`✅ Successfully processed and wrote file: ${filePath}`);
    }
    catch (error) {
        logError(error, filePath, opts.logFn);
    }
}
/**
 * Processes the TypeScript file content, applying wrapping and property modifications.
 *
 * @param content The content of the TypeScript file.
 * @param name The name of the schema.
 * @param crd The CustomResourceDefinition object.
 * @param version The version of the CRD.
 * @param opts The options for processing.
 * @returns The processed TypeScript file content.
 */
function applyCRDPostProcessing(content, name, crd, version, opts) {
    try {
        let lines = content.split("\n");
        // Wraps with the fluent client if needed
        if (shouldWrapWithFluentClient(opts)) {
            lines = wrapWithFluentClient(lines, name, crd, version, opts.npmPackage);
        }
        const foundInterfaces = collectInterfaceNames(lines);
        // Process the lines, focusing on classes extending `GenericKind`
        const processedLines = processLines(lines, genericKindProperties, foundInterfaces);
        // Normalize the final output
        const normalizedLines = normalizeIndentationAndSpacing(processedLines, opts);
        return normalizedLines.join("\n");
    }
    catch (error) {
        throw new Error(`Error while applying post-processing for ${name}: ${error.message}`);
    }
}
/**
 * Reads the content of a file from disk.
 *
 * @param filePath The path to the file.
 * @returns The file contents as a string.
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8");
    }
    catch (error) {
        throw new Error(`Failed to read file at ${filePath}: ${error.message}`);
    }
}
/**
 * Writes the modified content back to the file.
 *
 * @param filePath The path to the file.
 * @param content The modified content to write.
 */
function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, "utf8");
    }
    catch (error) {
        throw new Error(`Failed to write file at ${filePath}: ${error.message}`);
    }
}
/**
 * Retrieves the properties of the `GenericKind` class, excluding dynamic properties like `[key: string]: any`.
 *
 * @returns An array of property names that belong to `GenericKind`.
 */
function getGenericKindProperties() {
    const properties = Object.getOwnPropertyNames(new types_1.GenericKind());
    return properties.filter(prop => prop !== "[key: string]");
}
/**
 * Collects interface names from TypeScript file lines.
 *
 * @param lines The lines of the file content.
 * @returns A set of found interface names.
 */
function collectInterfaceNames(lines) {
    // https://regex101.com/r/S6w8pW/1
    const interfacePattern = /export interface (?<interfaceName>\w+)/;
    const foundInterfaces = new Set();
    for (const line of lines) {
        const match = line.match(interfacePattern);
        if (match?.groups?.interfaceName) {
            foundInterfaces.add(match.groups.interfaceName);
        }
    }
    return foundInterfaces;
}
/**
 * Identifies whether a line declares a class that extends `GenericKind`.
 *
 * @param line The current line of code.
 * @returns True if the line defines a class that extends `GenericKind`, false otherwise.
 */
function isClassExtendingGenericKind(line) {
    return line.includes("class") && line.includes("extends GenericKind");
}
/**
 * Adjusts the brace balance to determine if the parser is within a class definition.
 *
 * @param line The current line of code.
 * @param braceBalance The current balance of curly braces.
 * @returns The updated brace balance.
 */
function updateBraceBalance(line, braceBalance) {
    return braceBalance + (line.includes("{") ? 1 : 0) - (line.includes("}") ? 1 : 0);
}
/**
 * Generates a regular expression to match a property pattern in TypeScript.
 *
 * @param prop The property name to match.
 * @returns A regular expression to match the property pattern.
 */
function getPropertyPattern(prop) {
    // For prop="kind", the pattern will match "kind ? :" or "kind :"
    // https://regex101.com/r/mF8kXn/1
    return new RegExp(`\\b${prop}\\b\\s*\\?\\s*:|\\b${prop}\\b\\s*:`);
}
/**
 * Applies ESLint and property modifiers to a line of code.
 *
 * @param line - The current line of code.
 * @param genericKindProperties - The list of properties from `GenericKind`.
 * @param foundInterfaces - The set of found interfaces in the file.
 * @returns The modified line.
 */
function modifyPropertiesAndAddEslintDirective(line, genericKindProperties, foundInterfaces) {
    line = addDeclareAndOptionalModifiersToProperties(line, genericKindProperties, foundInterfaces);
    line = processEslintDisable(line, genericKindProperties);
    return line;
}
/**
 * Applies property modifiers to a line of code.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line.
 */
function addDeclareAndOptionalModifiersToProperties(line, genericKindProperties, foundInterfaces) {
    line = addDeclareToGenericKindProperties(line, genericKindProperties);
    line = makePropertiesOptional(line, foundInterfaces);
    line = normalizeLineIndentation(line);
    return line;
}
/**
 * Adds the `declare` keyword to `GenericKind` properties.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @returns The modified line with the `declare` keyword, if applicable.
 */
function addDeclareToGenericKindProperties(line, genericKindProperties) {
    for (const prop of genericKindProperties) {
        const propertyPattern = getPropertyPattern(prop);
        if (propertyPattern.test(line)) {
            return line.replace(prop, `declare ${prop}`);
        }
    }
    return line;
}
/**
 * Makes a property optional if its type matches one of the found interfaces and it is not already optional.
 *
 * @param line The current line of code.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line with the optional `?` symbol.
 */
function makePropertiesOptional(line, foundInterfaces) {
    // https://regex101.com/r/kX8TCj/1
    const propertyTypePattern = /:\s*(?<propertyType>\w+)\s*;/;
    const match = line.match(propertyTypePattern);
    if (match?.groups?.propertyType) {
        const { propertyType } = match.groups;
        if (foundInterfaces.has(propertyType) && !line.includes("?")) {
            return line.replace(":", "?:");
        }
    }
    return line;
}
/**
 * Adds an ESLint disable comment for `[key: string]: any` if it's not part of `GenericKind`.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @returns The modified line with the ESLint disable comment.
 */
function processEslintDisable(line, genericKindProperties) {
    if (line.includes("[key: string]: any") && !genericKindProperties.includes("[key: string]")) {
        return `  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n${line}`;
    }
    return line;
}
/**
 * Wraps the generated TypeScript file with fluent client elements (`GenericKind` and `RegisterKind`).
 *
 * @param lines The generated TypeScript lines.
 * @param name The name of the schema.
 * @param crd The CustomResourceDefinition object.
 * @param version The version of the CRD.
 * @param npmPackage The NPM package name for the fluent client.
 * @returns The processed TypeScript lines.
 */
function wrapWithFluentClient(lines, name, crd, version, npmPackage = "kubernetes-fluent-client") {
    const autoGenNotice = `// This file is auto-generated by ${npmPackage}, do not edit manually`;
    const imports = `import { GenericKind, RegisterKind } from "${npmPackage}";`;
    const classIndex = lines.findIndex(line => line.includes(`export interface ${name} {`));
    if (classIndex !== -1) {
        lines[classIndex] = `export class ${name} extends GenericKind {`;
    }
    lines.unshift(autoGenNotice, imports);
    lines.push(`RegisterKind(${name}, {`, `  group: "${crd.spec.group}",`, `  version: "${version}",`, `  kind: "${name}",`, `  plural: "${crd.spec.names.plural}",`, `});`);
    return lines;
}
/**
 * Normalizes indentation for TypeScript lines to a consistent format.
 *
 * @param lines The generated TypeScript lines.
 * @returns The lines with normalized indentation.
 */
function normalizeIndentation(lines) {
    return lines.map(line => line.replace(/^ {4}/, "  "));
}
/**
 * Normalizes the indentation of a single line to use two spaces instead of four.
 *
 * @param line The line of code to normalize.
 * @returns The line with normalized indentation.
 */
function normalizeLineIndentation(line) {
    return line.replace(/^ {4}/, "  ");
}
/**
 * Normalizes spacing between property names and types in TypeScript lines.
 *
 * @param lines The generated TypeScript lines.
 * @returns The lines with normalized property spacing.
 */
function normalizePropertySpacing(lines) {
    // https://regex101.com/r/XEv3pL/1
    return lines.map(line => line.replace(/\s*\?\s*:\s*/, "?: "));
}
/**
 * Removes lines containing `[property: string]: any;` from TypeScript files.
 *
 * @param lines The generated TypeScript lines.
 * @param opts The options for processing.
 * @returns The lines with `[property: string]: any;` removed.
 */
function removePropertyStringAny(lines, opts) {
    if (opts.language === "ts" || opts.language === "typescript") {
        return lines.filter(line => !line.includes("[property: string]: any;"));
    }
    return lines;
}
/**
 * Determines if the content should be wrapped with the fluent client.
 *
 * @param opts The options for generating the content.
 * @returns True if the content should be wrapped with the fluent client, false otherwise.
 */
function shouldWrapWithFluentClient(opts) {
    return opts.language === "ts" && !opts.plain;
}
/**
 * Processes the lines of the TypeScript file, focusing on classes extending `GenericKind`.
 *
 * @param lines The lines of the file content.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The processed lines.
 */
function processLines(lines, genericKindProperties, foundInterfaces) {
    let insideClass = false;
    let braceBalance = 0;
    return lines.map(line => {
        const result = processClassContext(line, insideClass, braceBalance, genericKindProperties, foundInterfaces);
        insideClass = result.insideClass;
        braceBalance = result.braceBalance;
        return result.line;
    });
}
/**
 * Processes a single line inside a class extending `GenericKind`.
 *
 * @param line The current line of code.
 * @param insideClass Whether we are inside a class context.
 * @param braceBalance The current brace balance to detect when we exit the class.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns An object containing the updated line, updated insideClass flag, and braceBalance.
 */
function processClassContext(line, insideClass, braceBalance, genericKindProperties, foundInterfaces) {
    if (isClassExtendingGenericKind(line)) {
        insideClass = true;
        braceBalance = 0;
    }
    if (!insideClass)
        return { line, insideClass, braceBalance };
    braceBalance = updateBraceBalance(line, braceBalance);
    line = modifyAndNormalizeClassProperties(line, genericKindProperties, foundInterfaces);
    if (braceBalance === 0) {
        insideClass = false;
    }
    return { line, insideClass, braceBalance };
}
/**
 * Processes a single line inside a class extending `GenericKind`.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line.
 */
function modifyAndNormalizeClassProperties(line, genericKindProperties, foundInterfaces) {
    line = modifyPropertiesAndAddEslintDirective(line, genericKindProperties, foundInterfaces);
    line = normalizeLineIndentation(line);
    return line;
}
/**
 * Normalizes lines after processing, including indentation, spacing, and removing unnecessary lines.
 *
 * @param lines The lines of the file content.
 * @param opts The options for processing.
 * @returns The normalized lines.
 */
function normalizeIndentationAndSpacing(lines, opts) {
    let normalizedLines = normalizeIndentation(lines);
    normalizedLines = normalizePropertySpacing(normalizedLines);
    return removePropertyStringAny(normalizedLines, opts);
}
/**
 * Handles logging for errors with stack trace.
 *
 * @param error The error object to log.
 * @param filePath The path of the file being processed.
 * @param logFn The logging function.
 */
function logError(error, filePath, logFn) {
    logFn(`❌ Error processing file: ${filePath} - ${error.message}`);
    logFn(`Stack trace: ${error.stack}`);
}
