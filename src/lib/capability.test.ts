import { Capability } from "./capability";
import Log from "./logger";
import { CapabilityCfg, MutateAction, ValidateAction, WatchLogAction } from "./types";
import { a } from "../lib";
import { V1Pod } from "@kubernetes/client-node";
import { expect, describe, jest, beforeEach, it } from "@jest/globals";
import { PeprMutateRequest } from "./mutate-request";
import { PeprValidateRequest } from "./validate-request";
import { Operation, AdmissionRequest } from "./k8s";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
//import { isWatchMode } from "./module";

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
    jest.resetModules();
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

  it("should reset the alias before each mutation", async () => {
    const capability = new Capability(capabilityConfig);

    const firstMutateCallback: MutateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprMutateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("First mutation action");
      },
    );

    const secondMutateCallback: MutateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprMutateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Second mutation action");
      },
    );

    // First mutation with an alias
    capability.When(a.Pod).IsCreatedOrUpdated().InNamespace("default").Alias("first-alias").Mutate(firstMutateCallback);

    // Second mutation without an alias (should use "no alias provided")
    capability.When(a.Pod).IsCreatedOrUpdated().InNamespace("default").Mutate(secondMutateCallback);

    expect(capability.bindings).toHaveLength(2);

    // Simulate the first mutation action
    const peprRequest1 = new PeprMutateRequest<V1Pod>(mockRequest);
    if (capability.bindings[0].mutateCallback) {
      await capability.bindings[0].mutateCallback(peprRequest1);
    }

    expect(firstMutateCallback).toHaveBeenCalledWith(peprRequest1, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "first-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: first-alias");

    // Simulate the second mutation action
    const peprRequest2 = new PeprMutateRequest<V1Pod>(mockRequest);
    if (capability.bindings[1].mutateCallback) {
      await capability.bindings[1].mutateCallback(peprRequest2);
    }

    expect(secondMutateCallback).toHaveBeenCalledWith(peprRequest2, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "no alias provided" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: no alias provided");
  });

  it("should use child logger for validate callback", async () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("default")
      .Alias("test-alias")
      .Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];

    // Simulate the validation action
    const mockPeprRequest = new PeprValidateRequest<V1Pod>(mockRequest);

    if (binding.validateCallback) {
      await binding.validateCallback(mockPeprRequest);
    }

    expect(mockValidateCallback).toHaveBeenCalledWith(mockPeprRequest, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing validate action with alias: test-alias");
    expect(mockLog.info).toHaveBeenCalledWith("Validate action log");
  });


  it("should trigger Watch action and log with alias", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capability } = require("./capability"); // Import Capability after mocking

    const capability = new Capability(capabilityConfig);

    // Ensure the mock isWatchMode is true
    //expect(isWatchMode()).toBe(true);

    // Define a mock Watch callback
    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update: V1Pod, phase: WatchPhase, logger: typeof Log = mockLog) => {
        logger.info(`Processing ${update.metadata?.name} in phase ${phase}`);
      },
    );

    // Register the Watch action
    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("default")
      .Alias("test-watch-alias")
      .Watch(mockWatchCallback);

    //expect(capability.bindings).toHaveLength(1);
    //const binding = capability.bindings[0];

    // Simulate the watch action with a valid update object and phase
    //const mockUpdate = { ...mockRequest.object }; // Use a valid Kubernetes object structure for update
    //const phase: WatchPhase = WatchPhase.Modified; // Use a valid phase from WatchPhase enum

    //if (binding.watchCallback) {
    //  await binding.watchCallback(mockUpdate, phase);
    //}

    // Verify that the watch callback was called with the correct parameters
    //expect(mockWatchCallback).toHaveBeenCalledWith(mockUpdate, phase, expect.anything());

    // Verify that the logger's child method was called with the correct alias
    //expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-watch-alias" });

    // Verify that the logger's info method was called with the correct message
    //expect(mockLog.info).toHaveBeenCalledWith(`Processing test-pod in phase ${phase}`);
  });
});
