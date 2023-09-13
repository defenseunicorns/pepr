import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Operation } from "fast-json-patch";

import Log from "../../logger";
import { Pod } from "../upstream";
import { Kube } from "./kube";
import { kubeExec } from "./utils";

// Setup mocks
jest.mock("./utils");

describe("Kube", () => {
  const fakeResource = { metadata: { name: "fake", namespace: "default" } };
  const mockedKubeExec = jest.mocked(kubeExec).mockResolvedValue(fakeResource);
  const mockedLogInfo = jest.mocked(Log.info);

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    mockedLogInfo.mockClear();
    mockedKubeExec.mockClear();
  });

  it("should create a resource", async () => {
    const kube = Kube(Pod);
    const result = await kube.Create(fakeResource);

    expect(result).toEqual(fakeResource);
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        name: "fake",
        namespace: "default",
      }),
      "POST",
      fakeResource,
    );
  });

  it("should delete a resource", async () => {
    const kube = Kube(Pod);
    await kube.Delete(fakeResource);

    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        name: "fake",
        namespace: "default",
      }),
      "DELETE",
    );
  });

  it("should replace a resource", async () => {
    const kube = Kube(Pod);
    const result = await kube.Replace(fakeResource);

    expect(result).toEqual(fakeResource);
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        name: "fake",
        namespace: "default",
      }),
      "PUT",
      fakeResource,
    );
  });

  it("should patch a resource", async () => {
    const patchOperations: Operation[] = [{ op: "replace", path: "/metadata/name", value: "new-fake" }];

    const kube = Kube(Pod);
    const result = await kube.Patch(patchOperations);

    expect(result).toEqual(fakeResource);
    expect(mockedKubeExec).toHaveBeenCalledWith(Pod, {}, "PATCH", patchOperations);
  });

  it("should create or replace a resource", async () => {
    mockedKubeExec
      .mockRejectedValueOnce({ status: 409 }) // Conflict on first call
      .mockResolvedValue(fakeResource); // Successful creation on second call

    const kube = Kube(Pod);
    const result = await kube.CreateOrReplace(fakeResource);

    expect(result).toEqual(fakeResource);
    expect(kubeExec).toHaveBeenCalledTimes(3);
    expect(Log.info).toHaveBeenCalledWith("Resource already exists, deleting and re-creating");
  });

  it("should filter with WithField", async () => {
    const kube = Kube(Pod).WithField("metadata.name", "fake");
    await kube.Get();
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        fields: {
          "metadata.name": "fake",
        },
      }),
      "GET",
    );
  });

  it("should filter with WithLabel", async () => {
    const kube = Kube(Pod).WithLabel("app", "fakeApp");
    await kube.Get();
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        labels: {
          app: "fakeApp",
        },
      }),
      "GET",
    );
  });

  it("should use InNamespace", async () => {
    const kube = Kube(Pod).InNamespace("fakeNamespace");
    await kube.Get();
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        namespace: "fakeNamespace",
      }),
      "GET",
    );
  });

  it("should throw an error if namespace is already specified", async () => {
    const kube = Kube(Pod, { namespace: "default" });
    expect(() => kube.InNamespace("fakeNamespace")).toThrow("Namespace already specified: default");
  });

  it("should handle Delete when the resource doesn't exist", async () => {
    mockedKubeExec.mockRejectedValueOnce({ status: 404 }); // Not Found on first call
    const kube = Kube(Pod);
    await expect(kube.Delete("fakeResource")).resolves.toBeUndefined();
  });

  it("should handle Get", async () => {
    const kube = Kube(Pod);
    const result = await kube.Get("fakeResource");

    expect(result).toEqual(fakeResource);
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({
        name: "fakeResource",
      }),
      "GET",
    );
  });

  it("should thrown an error if Get is called with a name and filters are already specified a name", async () => {
    const kube = Kube(Pod, { name: "fake" });
    await expect(kube.Get("fakeResource")).rejects.toThrow("Name already specified: fake");
  });

  it("should handle Patch with two objects", async () => {
    const original = { metadata: { name: "old-fake", namespace: "default" } };
    const updated = { metadata: { name: "new-fake", namespace: "default" } };

    const kube = Kube(Pod);
    await kube.Patch({ original, updated });

    // Assuming that the patch operation would be a 'replace' on '/metadata/name'
    expect(mockedKubeExec).toHaveBeenCalledWith(
      Pod,
      expect.objectContaining({}),
      "PATCH",
      expect.arrayContaining([{ op: "replace", path: "/metadata/name", value: "new-fake" }]),
    );
  });

  it("should throw an error if no patch operations provided", async () => {
    const kube = Kube(Pod);
    await expect(kube.Patch([])).rejects.toThrow("No operations specified");
  });
});
