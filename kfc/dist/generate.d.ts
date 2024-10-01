import { InputData, TargetLanguage } from "quicktype-core";
import { CustomResourceDefinition } from "./upstream";
import { LogFn } from "./types";
export interface GenerateOptions {
    source: string;
    directory?: string;
    plain?: boolean;
    language?: string | TargetLanguage;
    npmPackage?: string;
    logFn: LogFn;
    noPost?: boolean;
}
/**
 * Converts a CustomResourceDefinition to TypeScript types
 *
 * @param crd - The CustomResourceDefinition object to convert.
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
export declare function convertCRDtoTS(crd: CustomResourceDefinition, opts: GenerateOptions): Promise<{
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
}[]>;
/**
 * Prepares the input data for quicktype from the provided schema.
 *
 * @param name - The name of the schema.
 * @param schema - The JSON schema as a string.
 * @returns A promise that resolves to the input data for quicktype.
 */
export declare function prepareInputData(name: string, schema: string): Promise<InputData>;
/**
 * Generates TypeScript types using quicktype.
 *
 * @param inputData - The input data for quicktype.
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to an array of generated TypeScript type lines.
 */
export declare function generateTypes(inputData: InputData, opts: GenerateOptions): Promise<string[]>;
/**
 * Writes the processed lines to the output file.
 *
 * @param fileName - The name of the file to write.
 * @param directory - The directory where the file will be written.
 * @param content - The content to write to the file.
 * @param language - The programming language of the file.
 */
export declare function writeGeneratedFile(fileName: string, directory: string, content: string[], language: string | TargetLanguage): void;
/**
 * Reads or fetches a CustomResourceDefinition from a file, URL, or the cluster.
 *
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to an array of CustomResourceDefinition objects.
 */
export declare function readOrFetchCrd(opts: GenerateOptions): Promise<CustomResourceDefinition[]>;
/**
 * Resolves the source file path, treating relative paths as local files.
 *
 * @param source - The source path to resolve.
 * @returns The resolved file path.
 */
export declare function resolveFilePath(source: string): string;
/**
 * Tries to parse the source as a URL.
 *
 * @param source - The source string to parse as a URL.
 * @returns The parsed URL object or null if parsing fails.
 */
export declare function tryParseUrl(source: string): URL | null;
/**
 * Main generate function to convert CRDs to TypeScript types.
 *
 * @param opts - The options for generating the TypeScript types.
 * @returns A promise that resolves to a record of generated TypeScript types.
 */
export declare function generate(opts: GenerateOptions): Promise<{
    results: Record<string, string[]>;
    name: string;
    crd: CustomResourceDefinition;
    version: string;
}[]>;
//# sourceMappingURL=generate.d.ts.map