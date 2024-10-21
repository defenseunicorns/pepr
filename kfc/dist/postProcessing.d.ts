import { GenerateOptions } from "./generate";
import { CustomResourceDefinition } from "./upstream";
import { FileSystem } from "./fileSystem";
type CRDResult = {
    name: string;
    crd: CustomResourceDefinition;
    version: string;
};
type CodeLines = string[];
type ClassContextResult = {
    line: string;
    insideClass: boolean;
    braceBalance: number;
};
/**
 * Performs post-processing on generated TypeScript files.
 *
 * @param allResults The array of CRD results.
 * @param opts The options for post-processing.
 * @param fileSystem The file system interface for reading and writing files.
 */
export declare function postProcessing(allResults: CRDResult[], opts: GenerateOptions, fileSystem?: FileSystem): Promise<void>;
/**
 * Creates a map linking each file to its corresponding CRD result.
 *
 * @param allResults - The array of CRD results.
 * @returns A map linking file names to their corresponding CRD results.
 */
export declare function mapFilesToCRD(allResults: CRDResult[]): Record<string, CRDResult>;
/**
 * Processes the list of files, applying CRD post-processing to each.
 *
 * @param files - The list of file names to process.
 * @param fileResultMap - A map linking file names to their corresponding CRD results.
 * @param opts - Options for the generation process.
 * @param fileSystem - The file system interface for reading and writing files.
 */
export declare function processFiles(files: string[], fileResultMap: Record<string, CRDResult>, opts: GenerateOptions, fileSystem: FileSystem): Promise<void>;
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
export declare function processAndModifySingleFile(filePath: string, fileResult: CRDResult, opts: GenerateOptions, fileSystem: FileSystem): void;
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
export declare function applyCRDPostProcessing(content: string, name: string, crd: CustomResourceDefinition, version: string, opts: GenerateOptions): string;
/**
 * Reads the content of a file from disk.
 *
 * @param filePath The path to the file.
 * @returns The file contents as a string.
 */
export declare function readFile(filePath: string): string;
/**
 * Writes the modified content back to the file.
 *
 * @param filePath The path to the file.
 * @param content The modified content to write.
 */
export declare function writeFile(filePath: string, content: string): void;
/**
 * Retrieves the properties of the `GenericKind` class, excluding dynamic properties like `[key: string]: any`.
 *
 * @returns An array of property names that belong to `GenericKind`.
 */
export declare function getGenericKindProperties(): string[];
/**
 * Collects interface names from TypeScript file lines.
 *
 * @param lines The lines of the file content.
 * @returns A set of found interface names.
 */
export declare function collectInterfaceNames(lines: CodeLines): Set<string>;
/**
 * Identifies whether a line declares a class that extends `GenericKind`.
 *
 * @param line The current line of code.
 * @returns True if the line defines a class that extends `GenericKind`, false otherwise.
 */
export declare function isClassExtendingGenericKind(line: string): boolean;
/**
 * Adjusts the brace balance to determine if the parser is within a class definition.
 *
 * @param line The current line of code.
 * @param braceBalance The current balance of curly braces.
 * @returns The updated brace balance.
 */
export declare function updateBraceBalance(line: string, braceBalance: number): number;
/**
 * Generates a regular expression to match a property pattern in TypeScript.
 *
 * @param prop The property name to match.
 * @returns A regular expression to match the property pattern.
 */
export declare function getPropertyPattern(prop: string): RegExp;
/**
 * Applies ESLint and property modifiers to a line of code.
 *
 * @param line - The current line of code.
 * @param genericKindProperties - The list of properties from `GenericKind`.
 * @param foundInterfaces - The set of found interfaces in the file.
 * @returns The modified line.
 */
export declare function modifyPropertiesAndAddEslintDirective(line: string, genericKindProperties: string[], foundInterfaces: Set<string>): string;
/**
 * Applies property modifiers to a line of code.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line.
 */
export declare function addDeclareAndOptionalModifiersToProperties(line: string, genericKindProperties: string[], foundInterfaces: Set<string>): string;
/**
 * Adds the `declare` keyword to `GenericKind` properties.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @returns The modified line with the `declare` keyword, if applicable.
 */
export declare function addDeclareToGenericKindProperties(line: string, genericKindProperties: string[]): string;
/**
 * Makes a property optional if its type matches one of the found interfaces and it is not already optional.
 *
 * @param line The current line of code.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line with the optional `?` symbol.
 */
export declare function makePropertiesOptional(line: string, foundInterfaces: Set<string>): string;
/**
 * Adds an ESLint disable comment for `[key: string]: any` if it's not part of `GenericKind`.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @returns The modified line with the ESLint disable comment.
 */
export declare function processEslintDisable(line: string, genericKindProperties: string[]): string;
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
export declare function wrapWithFluentClient(lines: CodeLines, name: string, crd: CustomResourceDefinition, version: string, npmPackage?: string): string[];
/**
 * Normalizes indentation for TypeScript lines to a consistent format.
 *
 * @param lines The generated TypeScript lines.
 * @returns The lines with normalized indentation.
 */
export declare function normalizeIndentation(lines: CodeLines): string[];
/**
 * Normalizes the indentation of a single line to use two spaces instead of four.
 *
 * @param line The line of code to normalize.
 * @returns The line with normalized indentation.
 */
export declare function normalizeLineIndentation(line: string): string;
/**
 * Normalizes spacing between property names and types in TypeScript lines.
 *
 * @param lines The generated TypeScript lines.
 * @returns The lines with normalized property spacing.
 */
export declare function normalizePropertySpacing(lines: CodeLines): string[];
/**
 * Removes lines containing `[property: string]: any;` from TypeScript files.
 *
 * @param lines The generated TypeScript lines.
 * @param opts The options for processing.
 * @returns The lines with `[property: string]: any;` removed.
 */
export declare function removePropertyStringAny(lines: CodeLines, opts: GenerateOptions): string[];
/**
 * Determines if the content should be wrapped with the fluent client.
 *
 * @param opts The options for generating the content.
 * @returns True if the content should be wrapped with the fluent client, false otherwise.
 */
export declare function shouldWrapWithFluentClient(opts: GenerateOptions): boolean;
/**
 * Processes the lines of the TypeScript file, focusing on classes extending `GenericKind`.
 *
 * @param lines The lines of the file content.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The processed lines.
 */
export declare function processLines(lines: CodeLines, genericKindProperties: string[], foundInterfaces: Set<string>): string[];
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
export declare function processClassContext(line: string, insideClass: boolean, braceBalance: number, genericKindProperties: string[], foundInterfaces: Set<string>): ClassContextResult;
/**
 * Processes a single line inside a class extending `GenericKind`.
 *
 * @param line The current line of code.
 * @param genericKindProperties The list of properties from `GenericKind`.
 * @param foundInterfaces The set of found interfaces in the file.
 * @returns The modified line.
 */
export declare function modifyAndNormalizeClassProperties(line: string, genericKindProperties: string[], foundInterfaces: Set<string>): string;
/**
 * Normalizes lines after processing, including indentation, spacing, and removing unnecessary lines.
 *
 * @param lines The lines of the file content.
 * @param opts The options for processing.
 * @returns The normalized lines.
 */
export declare function normalizeIndentationAndSpacing(lines: CodeLines, opts: GenerateOptions): string[];
/**
 * Handles logging for errors with stack trace.
 *
 * @param error The error object to log.
 * @param filePath The path of the file being processed.
 * @param logFn The logging function.
 */
export declare function logError(error: Error, filePath: string, logFn: (msg: string) => void): void;
export {};
//# sourceMappingURL=postProcessing.d.ts.map