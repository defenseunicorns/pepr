import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { convertFromBase64Map, convertToBase64Map } from "../utils";
import { PeprMutateRequest } from "../mutate-request";
import { decodeData, reencodeData } from "./decode-utils";
import { createMockAdmissionRequest } from "../assets/defaultTestObjects";

jest.mock("../utils");

const defaultAdmissionRequest = createMockAdmissionRequest();

const defaultPeprMutateRequest = (admissionRequest = defaultAdmissionRequest) =>
  new PeprMutateRequest(admissionRequest);

const mockConvertToBase64Map = jest.mocked(convertToBase64Map);
const mockConvertFromBase64Map = jest.mocked(convertFromBase64Map);

describe("decodeData", () => {
  const skips = ["convert", "From", "Base64", "Map"];

  beforeEach(() => {
    mockConvertFromBase64Map.mockClear();
    mockConvertFromBase64Map.mockImplementation(() => skips);
  });

  it("returns skips if required & given a Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const { skipped, wrapped } = decodeData(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertFromBase64Map.mock.calls[0].at(0)).toBe(testPeprMutateRequest.Raw);
    expect(skipped).toBe(skips);
    expect(wrapped).toBe(testPeprMutateRequest);
  });

  it("returns no skips when given a non-Secret", () => {
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "NotASecret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const { skipped, wrapped } = decodeData(testPeprMutateRequest);

    expect(mockConvertFromBase64Map.mock.calls.length).toBe(0);
    expect(skipped).toEqual([]);
    expect(wrapped).toBe(testPeprMutateRequest);
  });
});

describe("reencodeData", () => {
  it("returns unchanged content when given non-secret", () => {
    const skipped = ["convert", "To", "Base64", "Map"];
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "NotASecret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const transformed = reencodeData(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(0);
    expect(transformed).toEqual(testAdmissionRequest.object);
  });

  it("returns modified content when given a secret and skips", () => {
    const skipped = ["convert", "To", "Base64", "Map"];
    const testAdmissionRequest = {
      ...defaultAdmissionRequest,
      kind: {
        kind: "Secret",
        version: "v1",
        group: "",
      },
    };
    const testPeprMutateRequest = defaultPeprMutateRequest(testAdmissionRequest);

    const transformed = reencodeData(testPeprMutateRequest, skipped);

    expect(mockConvertToBase64Map.mock.calls.length).toBe(1);
    expect(mockConvertToBase64Map.mock.calls[0].at(0)).toEqual(testPeprMutateRequest.Raw);
    expect(mockConvertToBase64Map.mock.calls[0].at(1)).toBe(skipped);
    expect(transformed).toEqual(testPeprMutateRequest.Raw);
  });
});
