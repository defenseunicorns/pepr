import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { convertCRDtoTS, GenerateOptions, readOrFetchCrd } from "./generate";
import fs from "fs";
import path from "path";
import { quicktype } from "quicktype-core";
import { fetch } from "./fetch";
import { loadAllYaml } from "@kubernetes/client-node";
import { K8s } from "./fluent";
import { CustomResourceDefinition } from "./upstream";

// Mock the file system
jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object), // Preserve the rest of the fs module
  writeFileSync: jest.fn(), // Mock only writeFileSync
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock("./fetch");
jest.mock("quicktype-core", () => {
  const actualQuicktypeCore = jest.requireActual<typeof import("quicktype-core")>("quicktype-core");
  return {
    quicktype: jest.fn(),
    JSONSchemaInput: actualQuicktypeCore.JSONSchemaInput,
    FetchingJSONSchemaStore: actualQuicktypeCore.FetchingJSONSchemaStore,
    InputData: actualQuicktypeCore.InputData,
  };
});
jest.mock("@kubernetes/client-node", () => {
  const actualModule = jest.requireActual("@kubernetes/client-node");
  return {
    ...(typeof actualModule === "object" ? actualModule : {}),
    loadAllYaml: jest.fn(), // Mock only the specific method
  };
});
jest.mock("./fluent", () => ({
  K8s: jest.fn(),
}));
jest.mock("./generate", () => {
  const actualGenerate = jest.requireActual("./generate");
  return {
    ...(typeof actualGenerate === "object" ? actualGenerate : {}),
    resolveFilePath: jest.fn(), // Mock resolveFilePath globally
    tryParseUrl: jest.fn(),
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

describe("CRD Generate", () => {
  let logFn: jest.Mock; // Mock log function

  beforeEach(() => {
    jest.clearAllMocks(); // Reset all mocks before each test
    logFn = jest.fn(); // Mock the log function with correct typing
  });

  test("convertCRDtoTS should generate the expected TypeScript file", async () => {
    // Mock convertCRDtoTS to return a valid result structure
    (quicktype as jest.MockedFunction<typeof quicktype>).mockResolvedValueOnce({
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
    const result = await convertCRDtoTS(sampleCrd, options);

    // Extract the generated types from the result
    const generatedTypes = result[0].results["movie-v1"];

    // Assert that the generated types match the expected TypeScript code
    expect(generatedTypes).toEqual(expectedMovie);

    // Assert the file writing happens with the expected TypeScript content
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("test-dir", "movie-v1.ts"),
      expectedMovie.join("\n"),
    );

    // Assert the logs contain expected log messages
    expect(logFn).toHaveBeenCalledWith("- Generating example.com/v1 types for Movie");
  });
});

describe("readOrFetchCrd", () => {
  let mockOpts: GenerateOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpts = {
      source: "mock-file-path",
      logFn: jest.fn(),
    };

    // Reapply mock for resolveFilePath inside beforeEach
    const { resolveFilePath } = jest.requireMock("./generate") as { resolveFilePath: jest.Mock };
    resolveFilePath.mockReturnValue("mock-file-path");
  });

  test("should load CRD from a local file", async () => {
    // Inside the test:
    const absoluteFilePath = path.join(process.cwd(), "mock-file-path");

    // Mock file system functions
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("mock file content");

    // Mock loadAllYaml to return parsed CRD
    const mockCrd = [{ kind: "CustomResourceDefinition" }] as CustomResourceDefinition[];
    (loadAllYaml as jest.Mock).mockReturnValue(mockCrd);

    // Call the function
    const result = await readOrFetchCrd(mockOpts);

    // Assert fs and loadAllYaml were called with correct args
    expect(fs.existsSync).toHaveBeenCalledWith(absoluteFilePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(absoluteFilePath, "utf8");
    expect(loadAllYaml).toHaveBeenCalledWith("mock file content");

    // Assert the result matches the mocked CRD
    expect(result).toEqual(mockCrd);

    // Assert log function was called with correct message
    expect(mockOpts.logFn).toHaveBeenCalledWith(
      "Attempting to load mock-file-path as a local file",
    );
  });
});

describe("readOrFetchCrd with URL", () => {
  let mockOpts: GenerateOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpts = {
      source: "http://example.com/mock-crd",
      logFn: jest.fn(),
    };

    // Mock resolveFilePath to simulate URL logic
    const { resolveFilePath } = jest.requireMock("./generate") as {
      resolveFilePath: jest.Mock;
    };
    resolveFilePath.mockReturnValue("mock-file-path");

    // Ensure fs.existsSync returns false for URL tests to skip file logic
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  test("should fetch CRD from a URL and parse YAML", async () => {
    const { tryParseUrl } = jest.requireMock("./generate") as { tryParseUrl: jest.Mock };
    tryParseUrl.mockReturnValue(new URL("http://example.com/mock-crd"));

    // Mock fetch to return a valid response
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      data: "mock fetched data",
      status: 0,
      statusText: "",
    });

    // Mock loadAllYaml to return parsed CRD
    const mockCrd = [{ kind: "CustomResourceDefinition" }] as CustomResourceDefinition[];
    (loadAllYaml as jest.Mock).mockReturnValue(mockCrd);

    // Call the function
    const result = await readOrFetchCrd(mockOpts);

    // Assert fetch was called with correct URL
    expect(fetch).toHaveBeenCalledWith("http://example.com/mock-crd");

    // Assert loadAllYaml was called with fetched data
    expect(loadAllYaml).toHaveBeenCalledWith("mock fetched data");

    // Assert the result matches the mocked CRD
    expect(result).toEqual(mockCrd);

    // Assert log function was called with correct message
    expect(mockOpts.logFn).toHaveBeenCalledWith(
      "Attempting to load http://example.com/mock-crd as a URL",
    );
  });
});

describe("readOrFetchCrd from Kubernetes cluster", () => {
  let mockOpts: GenerateOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpts = {
      source: "my-crd",
      logFn: jest.fn(),
    };

    // Mock resolveFilePath and tryParseUrl to return null or invalid results
    const { resolveFilePath, tryParseUrl } = jest.requireMock("./generate") as {
      resolveFilePath: jest.Mock;
      tryParseUrl: jest.Mock;
    };
    resolveFilePath.mockReturnValue("mock-file-path");
    tryParseUrl.mockReturnValue(null);

    // Ensure fs.existsSync returns false to force fallback to Kubernetes
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  test("should load CRD from Kubernetes cluster", async () => {
    // Mock K8s to return a mocked CRD from the Kubernetes cluster
    const mockCrd = { kind: "CustomResourceDefinition" } as CustomResourceDefinition;
    const mockK8sGet = jest
      .fn<() => Promise<CustomResourceDefinition>>()
      .mockResolvedValue(mockCrd);
    (K8s as jest.Mock).mockReturnValue({ Get: mockK8sGet });

    // Call the function
    const result = await readOrFetchCrd(mockOpts);

    // Assert K8s.Get was called with the correct source
    expect(K8s).toHaveBeenCalledWith(CustomResourceDefinition);
    expect(mockK8sGet).toHaveBeenCalledWith("my-crd");

    // Assert the result matches the mocked CRD
    expect(result).toEqual([mockCrd]);

    // Assert log function was called with correct message
    expect(mockOpts.logFn).toHaveBeenCalledWith(
      "Attempting to read my-crd from the Kubernetes cluster",
    );
  });

  test("should log an error if Kubernetes cluster read fails", async () => {
    // Mock K8s to throw an error
    const mockError = new Error("Kubernetes API error");
    const mockK8sGet = jest.fn<() => Promise<never>>().mockRejectedValue(mockError);
    (K8s as jest.Mock).mockReturnValue({ Get: mockK8sGet });

    // Call the function and assert that it throws an error
    await expect(readOrFetchCrd(mockOpts)).rejects.toThrowError(
      `Failed to read my-crd as a file, URL, or Kubernetes CRD`,
    );

    // Assert log function was called with error message
    expect(mockOpts.logFn).toHaveBeenCalledWith("Error loading CRD: Kubernetes API error");

    // Assert K8s.Get was called with the correct source
    expect(K8s).toHaveBeenCalledWith(CustomResourceDefinition);
    expect(mockK8sGet).toHaveBeenCalledWith("my-crd");
  });
});

describe("readOrFetchCrd error handling", () => {
  let mockOpts: GenerateOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpts = {
      source: "mock-source",
      logFn: jest.fn(),
    };
  });

  test("should throw an error if file reading fails", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("File read error");
    });

    await expect(readOrFetchCrd(mockOpts)).rejects.toThrowError(
      "Failed to read mock-source as a file, URL, or Kubernetes CRD",
    );

    expect(mockOpts.logFn).toHaveBeenCalledWith("Error loading CRD: File read error");
  });
});

describe("convertCRDtoTS with invalid CRD", () => {
  test("should skip CRD with no versions", async () => {
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
      logFn: jest.fn(), // Ensure the mock log function is set
      directory: "test-dir",
      plain: false,
      npmPackage: "kubernetes-fluent-client",
    };

    const result = await convertCRDtoTS(invalidCrd, options);

    // Assert that result is empty due to invalid CRD
    expect(result).toEqual([]);

    // Assert the log function is called with the correct message
    expect(options.logFn).toHaveBeenCalledWith(
      "Skipping movies.example.com, it does not appear to be a CRD",
    );
  });

  test("should handle schema with no OpenAPI schema", async () => {
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
      logFn: jest.fn(), // Mock log function
      directory: "test-dir",
      plain: false,
      npmPackage: "kubernetes-fluent-client",
    };

    // Call the convertCRDtoTS function with the invalid CRD
    const result = await convertCRDtoTS(invalidCrd, options);

    // Assert that result is empty due to invalid schema
    expect(result).toEqual([]);

    // Assert that the log function was called with the appropriate message
    expect(options.logFn).toHaveBeenCalledWith(
      "Skipping movies.example.com, it does not appear to have a valid schema",
    );
  });
});
