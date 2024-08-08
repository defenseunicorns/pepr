import { Capability } from "./capability";
import Log from "./logger";
import { CapabilityCfg, MutateAction } from "./types";
import { a } from "../lib";
import { V1Pod } from "@kubernetes/client-node";
import { expect, describe, jest, beforeEach, it } from "@jest/globals";
import { PeprMutateRequest } from "./mutate-request";
import { Operation, AdmissionRequest } from "./k8s";

jest.mock("./logger", () => {
  return {
    __esModule: true,
    default: {
      info: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis(),
    },
  };
});

const mockLog = Log as jest.Mocked<typeof Log>;

describe("Capability", () => {
  let mockRequest: AdmissionRequest<V1Pod>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      operation: Operation.CREATE,
      object: {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name: "test-pod",
          namespace: "default",
          labels: {
            "existing-label": "true",
          },
          annotations: {
            "existing-annotation": "true",
          },
        },
        spec: {
          containers: [], // Add the containers property here
        },
      },
      dryRun: false,
      uid: "test-uid",
      name: "test-pod",
      kind: { group: "", version: "v1", kind: "Pod" },
      resource: { group: "", version: "v1", resource: "pods" },
      userInfo: { username: "test-user" },
      oldObject: undefined,
    };
  });

  const capabilityConfig: CapabilityCfg = {
    name: "test-capability",
    description: "Test capability description",
    namespaces: ["default"],
  };

  it("should initialize with given configuration", () => {
    const capability = new Capability(capabilityConfig);

    expect(capability.name).toBe(capabilityConfig.name);
    expect(capability.description).toBe(capabilityConfig.description);
    expect(capability.namespaces).toEqual(capabilityConfig.namespaces);
    expect(mockLog.info).toHaveBeenCalledWith(`Capability ${capabilityConfig.name} registered`);
  });

  it("should register store and schedule store", () => {
    const capability = new Capability(capabilityConfig);

    const storeResult = capability.registerStore();
    expect(storeResult).toHaveProperty("store");
    expect(mockLog.info).toHaveBeenCalledWith(`Registering store for ${capabilityConfig.name}`);

    const scheduleStoreResult = capability.registerScheduleStore();
    expect(scheduleStoreResult).toHaveProperty("scheduleStore");
    expect(mockLog.info).toHaveBeenCalledWith(`Registering schedule store for ${capabilityConfig.name}`);
  });

  it("should throw an error if store is registered twice", () => {
    const capability = new Capability(capabilityConfig);

    capability.registerStore();
    expect(() => capability.registerStore()).toThrowError("Store already registered for test-capability");
  });

  it("should throw an error if schedule store is registered twice", () => {
    const capability = new Capability(capabilityConfig);

    capability.registerScheduleStore();
    expect(() => capability.registerScheduleStore()).toThrowError(
      "Schedule store already registered for test-capability",
    );
  });

  it("should correctly chain When, InNamespace, WithLabel, and Mutate methods", async () => {
    const capability = new Capability(capabilityConfig);

    const mockMutateCallback: MutateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprMutateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Executing mutation action");
      },
    );

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("default")
      .WithLabel("test-label", "value")
      .Alias("test-alias")
      .Mutate(mockMutateCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];
    expect(binding.filters.namespaces).toContain("default");
    expect(binding.filters.labels).toHaveProperty("test-label", "value");
    expect(binding.alias).toBe("test-alias");

    // Simulate the mutation action
    const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);

    if (binding.mutateCallback) {
      await binding.mutateCallback(peprRequest);
    }

    expect(mockMutateCallback).toHaveBeenCalledWith(peprRequest, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: test-alias");
  });

  it("should use child logger for mutate callback", async () => {
    const capability = new Capability(capabilityConfig);

    const mockMutateCallback: MutateAction<typeof V1Pod, V1Pod> = jest.fn(
      (req: PeprMutateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Mutate action log");
      },
    );

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("default")
      .WithLabel("test-label", "value")
      .Alias("test-alias")
      .Mutate(mockMutateCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];

    // Simulate the mutation action
    const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);

    if (binding.mutateCallback) {
      await binding.mutateCallback(peprRequest);
    }

    expect(mockMutateCallback).toHaveBeenCalledWith(peprRequest, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: test-alias");
    expect(mockLog.info).toHaveBeenCalledWith("Mutate action log");
  });

  it("should handle complex alias and logging correctly", async () => {
    const complexCapabilityConfig: CapabilityCfg = {
      name: "complex-capability",
      description: "Test complex capability description",
      namespaces: ["pepr-demo", "pepr-demo-2"],
    };

    const capability = new Capability(complexCapabilityConfig);

    const mockMutateCallback: MutateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (po: PeprMutateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info(`SNAKES ON A PLANE! ${po.Raw.metadata?.name}`);
      },
    );

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("pepr-demo")
      .WithLabel("white")
      .Alias("reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation")
      .Mutate(mockMutateCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];
    expect(binding.filters.namespaces).toContain("pepr-demo");
    expect(binding.filters.labels).toHaveProperty("white", "");
    expect(binding.alias).toBe("reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation");

    // Simulate the mutation action
    const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);

    if (binding.mutateCallback) {
      await binding.mutateCallback(peprRequest);
    }

    expect(mockMutateCallback).toHaveBeenCalledWith(peprRequest, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({
      alias: "reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation",
    });
    expect(mockLog.info).toHaveBeenCalledWith(
      "Executing mutation action with alias: reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation",
    );
    expect(mockLog.info).toHaveBeenCalledWith(`SNAKES ON A PLANE! ${mockRequest.object.metadata?.name}`);
  });
});
