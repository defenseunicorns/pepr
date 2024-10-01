"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const generate_1 = require("./generate");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const quicktype_core_1 = require("quicktype-core");
const fetch_1 = require("./fetch");
const client_node_1 = require("@kubernetes/client-node");
const fluent_1 = require("./fluent");
const upstream_1 = require("./upstream");
// Mock the file system
globals_1.jest.mock("fs", () => ({
    ...globals_1.jest.requireActual("fs"), // Preserve the rest of the fs module
    writeFileSync: globals_1.jest.fn(), // Mock only writeFileSync
    existsSync: globals_1.jest.fn(),
    readFileSync: globals_1.jest.fn(),
}));
globals_1.jest.mock("./fetch");
globals_1.jest.mock("quicktype-core", () => {
    const actualQuicktypeCore = globals_1.jest.requireActual("quicktype-core");
    return {
        quicktype: globals_1.jest.fn(),
        JSONSchemaInput: actualQuicktypeCore.JSONSchemaInput,
        FetchingJSONSchemaStore: actualQuicktypeCore.FetchingJSONSchemaStore,
        InputData: actualQuicktypeCore.InputData,
    };
});
globals_1.jest.mock("@kubernetes/client-node", () => {
    const actualModule = globals_1.jest.requireActual("@kubernetes/client-node");
    return {
        ...(typeof actualModule === "object" ? actualModule : {}),
        loadAllYaml: globals_1.jest.fn(), // Mock only the specific method
    };
});
globals_1.jest.mock("./fluent", () => ({
    K8s: globals_1.jest.fn(),
}));
globals_1.jest.mock("./generate", () => {
    const actualGenerate = globals_1.jest.requireActual("./generate");
    return {
        ...(typeof actualGenerate === "object" ? actualGenerate : {}),
        resolveFilePath: globals_1.jest.fn(), // Mock resolveFilePath globally
        tryParseUrl: globals_1.jest.fn(),
    };
});
// Sample CRD content to use in tests
const sampleCrd = {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
    metadata: { name: "movies.example.com" },
    spec: {
        group: "example.com",
        names: { kind: "Movie", plural: "movies" },
        scope: "Namespaced",
        versions: [
            {
                name: "v1",
                served: true,
                storage: true,
                schema: {
                    openAPIV3Schema: {
                        type: "object",
                        description: "Movie nerd",
                        properties: {
                            spec: {
                                properties: {
                                    title: { type: "string" },
                                    author: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        ],
    },
};
const expectedMovie = [
    "/**",
    " * Movie nerd",
    " */",
    "export interface Movie {",
    "    spec?: any[] | boolean | number | number | null | SpecObject | string;",
    "    [property: string]: any;",
    "}",
    "",
    "export interface SpecObject {",
    "    author?: string;",
    "    title?: string;",
    "    [property: string]: any;",
    "}",
    "",
];
(0, globals_1.describe)("CRD Generate", () => {
    let logFn; // Mock log function
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Reset all mocks before each test
        logFn = globals_1.jest.fn(); // Mock the log function with correct typing
    });
    (0, globals_1.test)("convertCRDtoTS should generate the expected TypeScript file", async () => {
        // Mock convertCRDtoTS to return a valid result structure
        quicktype_core_1.quicktype.mockResolvedValueOnce({
            lines: expectedMovie,
            annotations: [],
        });
        const options = {
            source: "test-crd.yaml",
            language: "ts",
            logFn,
            directory: "test-dir",
            plain: false,
            npmPackage: "kubernetes-fluent-client",
        };
        // Call convertCRDtoTS with sample CRD
        const result = await (0, generate_1.convertCRDtoTS)(sampleCrd, options);
        // Extract the generated types from the result
        const generatedTypes = result[0].results["movie-v1"];
        // Assert that the generated types match the expected TypeScript code
        (0, globals_1.expect)(generatedTypes).toEqual(expectedMovie);
        // Assert the file writing happens with the expected TypeScript content
        (0, globals_1.expect)(fs_1.default.writeFileSync).toHaveBeenCalledWith(path_1.default.join("test-dir", "movie-v1.ts"), expectedMovie.join("\n"));
        // Assert the logs contain expected log messages
        (0, globals_1.expect)(logFn).toHaveBeenCalledWith("- Generating example.com/v1 types for Movie");
    });
});
(0, globals_1.describe)("readOrFetchCrd", () => {
    let mockOpts;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        mockOpts = {
            source: "mock-file-path",
            logFn: globals_1.jest.fn(),
        };
        // Reapply mock for resolveFilePath inside beforeEach
        const { resolveFilePath } = globals_1.jest.requireMock("./generate");
        resolveFilePath.mockReturnValue("mock-file-path");
    });
    (0, globals_1.test)("should load CRD from a local file", async () => {
        // Inside the test:
        const absoluteFilePath = path_1.default.join(process.cwd(), "mock-file-path");
        // Mock file system functions
        fs_1.default.existsSync.mockReturnValue(true);
        fs_1.default.readFileSync.mockReturnValue("mock file content");
        // Mock loadAllYaml to return parsed CRD
        const mockCrd = [{ kind: "CustomResourceDefinition" }];
        client_node_1.loadAllYaml.mockReturnValue(mockCrd);
        // Call the function
        const result = await (0, generate_1.readOrFetchCrd)(mockOpts);
        // Assert fs and loadAllYaml were called with correct args
        (0, globals_1.expect)(fs_1.default.existsSync).toHaveBeenCalledWith(absoluteFilePath);
        (0, globals_1.expect)(fs_1.default.readFileSync).toHaveBeenCalledWith(absoluteFilePath, "utf8");
        (0, globals_1.expect)(client_node_1.loadAllYaml).toHaveBeenCalledWith("mock file content");
        // Assert the result matches the mocked CRD
        (0, globals_1.expect)(result).toEqual(mockCrd);
        // Assert log function was called with correct message
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("Attempting to load mock-file-path as a local file");
    });
});
(0, globals_1.describe)("readOrFetchCrd with URL", () => {
    let mockOpts;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        mockOpts = {
            source: "http://example.com/mock-crd",
            logFn: globals_1.jest.fn(),
        };
        // Mock resolveFilePath to simulate URL logic
        const { resolveFilePath } = globals_1.jest.requireMock("./generate");
        resolveFilePath.mockReturnValue("mock-file-path");
        // Ensure fs.existsSync returns false for URL tests to skip file logic
        fs_1.default.existsSync.mockReturnValue(false);
    });
    (0, globals_1.test)("should fetch CRD from a URL and parse YAML", async () => {
        const { tryParseUrl } = globals_1.jest.requireMock("./generate");
        tryParseUrl.mockReturnValue(new URL("http://example.com/mock-crd"));
        // Mock fetch to return a valid response
        fetch_1.fetch.mockResolvedValue({
            ok: true,
            data: "mock fetched data",
            status: 0,
            statusText: "",
        });
        // Mock loadAllYaml to return parsed CRD
        const mockCrd = [{ kind: "CustomResourceDefinition" }];
        client_node_1.loadAllYaml.mockReturnValue(mockCrd);
        // Call the function
        const result = await (0, generate_1.readOrFetchCrd)(mockOpts);
        // Assert fetch was called with correct URL
        (0, globals_1.expect)(fetch_1.fetch).toHaveBeenCalledWith("http://example.com/mock-crd");
        // Assert loadAllYaml was called with fetched data
        (0, globals_1.expect)(client_node_1.loadAllYaml).toHaveBeenCalledWith("mock fetched data");
        // Assert the result matches the mocked CRD
        (0, globals_1.expect)(result).toEqual(mockCrd);
        // Assert log function was called with correct message
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("Attempting to load http://example.com/mock-crd as a URL");
    });
});
(0, globals_1.describe)("readOrFetchCrd from Kubernetes cluster", () => {
    let mockOpts;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        mockOpts = {
            source: "my-crd",
            logFn: globals_1.jest.fn(),
        };
        // Mock resolveFilePath and tryParseUrl to return null or invalid results
        const { resolveFilePath, tryParseUrl } = globals_1.jest.requireMock("./generate");
        resolveFilePath.mockReturnValue("mock-file-path");
        tryParseUrl.mockReturnValue(null);
        // Ensure fs.existsSync returns false to force fallback to Kubernetes
        fs_1.default.existsSync.mockReturnValue(false);
    });
    (0, globals_1.test)("should load CRD from Kubernetes cluster", async () => {
        // Mock K8s to return a mocked CRD from the Kubernetes cluster
        const mockCrd = { kind: "CustomResourceDefinition" };
        const mockK8sGet = globals_1.jest
            .fn()
            .mockResolvedValue(mockCrd);
        fluent_1.K8s.mockReturnValue({ Get: mockK8sGet });
        // Call the function
        const result = await (0, generate_1.readOrFetchCrd)(mockOpts);
        // Assert K8s.Get was called with the correct source
        (0, globals_1.expect)(fluent_1.K8s).toHaveBeenCalledWith(upstream_1.CustomResourceDefinition);
        (0, globals_1.expect)(mockK8sGet).toHaveBeenCalledWith("my-crd");
        // Assert the result matches the mocked CRD
        (0, globals_1.expect)(result).toEqual([mockCrd]);
        // Assert log function was called with correct message
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("Attempting to read my-crd from the Kubernetes cluster");
    });
    (0, globals_1.test)("should log an error if Kubernetes cluster read fails", async () => {
        // Mock K8s to throw an error
        const mockError = new Error("Kubernetes API error");
        const mockK8sGet = globals_1.jest.fn().mockRejectedValue(mockError);
        fluent_1.K8s.mockReturnValue({ Get: mockK8sGet });
        // Call the function and assert that it throws an error
        await (0, globals_1.expect)((0, generate_1.readOrFetchCrd)(mockOpts)).rejects.toThrowError(`Failed to read my-crd as a file, URL, or Kubernetes CRD`);
        // Assert log function was called with error message
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("Error loading CRD: Kubernetes API error");
        // Assert K8s.Get was called with the correct source
        (0, globals_1.expect)(fluent_1.K8s).toHaveBeenCalledWith(upstream_1.CustomResourceDefinition);
        (0, globals_1.expect)(mockK8sGet).toHaveBeenCalledWith("my-crd");
    });
});
(0, globals_1.describe)("readOrFetchCrd error handling", () => {
    let mockOpts;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        mockOpts = {
            source: "mock-source",
            logFn: globals_1.jest.fn(),
        };
    });
    (0, globals_1.test)("should throw an error if file reading fails", async () => {
        fs_1.default.existsSync.mockReturnValue(true);
        fs_1.default.readFileSync.mockImplementation(() => {
            throw new Error("File read error");
        });
        await (0, globals_1.expect)((0, generate_1.readOrFetchCrd)(mockOpts)).rejects.toThrowError("Failed to read mock-source as a file, URL, or Kubernetes CRD");
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("Error loading CRD: File read error");
    });
});
(0, globals_1.describe)("convertCRDtoTS with invalid CRD", () => {
    (0, globals_1.test)("should skip CRD with no versions", async () => {
        const invalidCrd = {
            ...sampleCrd,
            spec: {
                ...sampleCrd.spec,
                versions: [], // CRD with no versions
            },
        };
        const options = {
            source: "mock-source",
            language: "ts",
            logFn: globals_1.jest.fn(), // Ensure the mock log function is set
            directory: "test-dir",
            plain: false,
            npmPackage: "kubernetes-fluent-client",
        };
        const result = await (0, generate_1.convertCRDtoTS)(invalidCrd, options);
        // Assert that result is empty due to invalid CRD
        (0, globals_1.expect)(result).toEqual([]);
        // Assert the log function is called with the correct message
        (0, globals_1.expect)(options.logFn).toHaveBeenCalledWith("Skipping movies.example.com, it does not appear to be a CRD");
    });
    (0, globals_1.test)("should handle schema with no OpenAPI schema", async () => {
        // Modify the sampleCrd to simulate the invalid CRD
        const invalidCrd = {
            ...sampleCrd,
            spec: {
                ...sampleCrd.spec,
                versions: [
                    {
                        name: "v1",
                        served: true,
                        storage: true,
                        schema: undefined, // No OpenAPI schema
                    },
                ],
            },
        };
        const options = {
            source: "mock-source",
            language: "ts",
            logFn: globals_1.jest.fn(), // Mock log function
            directory: "test-dir",
            plain: false,
            npmPackage: "kubernetes-fluent-client",
        };
        // Call the convertCRDtoTS function with the invalid CRD
        const result = await (0, generate_1.convertCRDtoTS)(invalidCrd, options);
        // Assert that result is empty due to invalid schema
        (0, globals_1.expect)(result).toEqual([]);
        // Assert that the log function was called with the appropriate message
        (0, globals_1.expect)(options.logFn).toHaveBeenCalledWith("Skipping movies.example.com, it does not appear to have a valid schema");
    });
});
