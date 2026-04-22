// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterEach, describe, expect, it, vi } from "vitest";
import { MutateResponse, ValidateResponse } from "../k8s";
import * as sut from "./index.util";
import { AdmissionRequest } from "../common-types";

describe("karForMutate()", () => {
  it("returns given MutateResponse wrapped in an KubeAdmissionReview", () => {
    const mr: MutateResponse = { uid: "uid", allowed: true };
    const kar: sut.KubeAdmissionReview = {
      apiVersion: "admission.k8s.io/v1",
      kind: "AdmissionReview",
      response: mr,
    };
    const result = sut.karForMutate(mr);
    expect(result).toEqual(kar);
  });
});

describe("karForValidate()", () => {
  describe("given 0 ValidationResponse[]'s", () => {
    it("returns KubeAdmissionReview with abbreviated success message", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [];
      const resp = {
        uid: ar.uid,
        allowed: true,
        status: { code: 200, message: "no in-scope validations -- allowed!" },
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });

    it("returns KubeAdmissionReview with warnings when provided", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [
        {
          uid: "uid",
          allowed: true,
          warnings: ["This is a warning message"],
        },
      ];
      const resp = {
        uid: "uid",
        allowed: true,
        status: { code: 200, message: "" },
        warnings: ["This is a warning message"],
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });
  });

  describe("given 1-or-more ValidationResponse[]'s", () => {
    it("returns KubeAdmissionReview with detailed success message", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [
        {
          uid: "uid",
          allowed: true,
          status: {
            code: 200,
            message: "msg",
          },
        },
      ];
      const resp = {
        uid: ar.uid,
        allowed: true,
        status: { code: 200, message: "" },
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });

    it("returns KubeAdmissionReview with detailed failure message", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [
        {
          uid: "uid",
          allowed: false,
          status: {
            code: 422,
            message: "mess",
          },
        },
        {
          uid: "uid",
          allowed: false,
          status: {
            code: 422,
            message: "age",
          },
        },
      ];
      const resp = {
        uid: ar.uid,
        allowed: false,
        status: { code: 422, message: "mess; age" },
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });

    it("returns KubeAdmissionReview with multiple warnings from different responses", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [
        {
          uid: "uid",
          allowed: true,
          warnings: ["First warning message"],
          status: {
            code: 200,
            message: "success",
          },
        },
        {
          uid: "uid",
          allowed: true,
          warnings: ["Second warning message"],
          status: {
            code: 200,
            message: "also success",
          },
        },
      ];
      const resp = {
        uid: "uid",
        allowed: true,
        status: { code: 200, message: "" },
        warnings: ["First warning message", "Second warning message"],
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });

    it("returns KubeAdmissionReview with warnings in denied responses", () => {
      const ar = { uid: "uid" } as unknown as AdmissionRequest;
      const vrs: ValidateResponse[] = [
        {
          uid: "uid",
          allowed: false,
          warnings: ["Warning with denial"],
          status: {
            code: 422,
            message: "denied",
          },
        },
      ];
      const resp = {
        uid: "uid",
        allowed: false,
        status: { code: 422, message: "denied" },
        warnings: ["Warning with denial"],
      };
      const kar: sut.KubeAdmissionReview = {
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response: resp,
      };
      const result = sut.karForValidate(ar, vrs);
      expect(result).toEqual(kar);
    });
  });
});

describe("parseWebhookTimeouts()", () => {
  const originalKeepAlive = process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS;
  const originalHeaders = process.env.PEPR_HEADERS_TIMEOUT_MS;

  afterEach(() => {
    if (originalKeepAlive === undefined) {
      delete process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS;
    } else {
      process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS = originalKeepAlive;
    }
    if (originalHeaders === undefined) {
      delete process.env.PEPR_HEADERS_TIMEOUT_MS;
    } else {
      process.env.PEPR_HEADERS_TIMEOUT_MS = originalHeaders;
    }
  });

  it("returns default values when env vars are not set", () => {
    delete process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS;
    delete process.env.PEPR_HEADERS_TIMEOUT_MS;

    const result = sut.parseWebhookTimeouts();

    expect(result).toEqual({
      keepAliveTimeoutMs: 90000,
      headersTimeoutMs: 32000,
    });
  });

  it("uses environment variables to configure timeouts", () => {
    const parseIntSpy = vi.spyOn(global, "parseInt");

    process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS = "120000";
    process.env.PEPR_HEADERS_TIMEOUT_MS = "60000";

    const result = sut.parseWebhookTimeouts();

    expect(parseIntSpy).toHaveBeenCalledWith("120000", 10);
    expect(parseIntSpy).toHaveBeenCalledWith("60000", 10);
    expect(result).toEqual({
      keepAliveTimeoutMs: 120000,
      headersTimeoutMs: 60000,
    });

    parseIntSpy.mockRestore();
  });

  it("uses default keepAliveTimeoutMs when only PEPR_HEADERS_TIMEOUT_MS is set", () => {
    delete process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS;
    process.env.PEPR_HEADERS_TIMEOUT_MS = "45000";

    const result = sut.parseWebhookTimeouts();

    expect(result).toEqual({
      keepAliveTimeoutMs: 90000,
      headersTimeoutMs: 45000,
    });
  });

  it("uses default headersTimeoutMs when only PEPR_KEEP_ALIVE_TIMEOUT_MS is set", () => {
    process.env.PEPR_KEEP_ALIVE_TIMEOUT_MS = "120000";
    delete process.env.PEPR_HEADERS_TIMEOUT_MS;

    const result = sut.parseWebhookTimeouts();

    expect(result).toEqual({
      keepAliveTimeoutMs: 120000,
      headersTimeoutMs: 32000,
    });
  });
});
