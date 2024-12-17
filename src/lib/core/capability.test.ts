import { Capability } from "./capability";
import Log from "../telemetry/logger";
import { CapabilityCfg, FinalizeAction, MutateAction, ValidateAction, WatchLogAction } from "../types";
import { a } from "../../lib";
import { V1Pod } from "@kubernetes/client-node";
import { expect, describe, jest, beforeEach, it } from "@jest/globals";
import { Event, Operation } from "../enums";
import { PeprMutateRequest } from "../mutate-request";
import { PeprValidateRequest } from "../validate-request";
import { AdmissionRequest } from "../types";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";
import { GenericClass } from "kubernetes-fluent-client";
import { Schedule } from "./schedule";
import { OnSchedule } from "./schedule";

// Mocking isBuildMode, isWatchMode, and isDevMode globally
jest.mock("./module", () => ({
  isBuildMode: jest.fn(() => true),
  isWatchMode: jest.fn(() => true),
  isDevMode: jest.fn(() => true),
}));

// Mock logger globally
jest.mock("../telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
}));

// Mock Storage and OnSchedule
jest.mock("./storage", () => ({
  Storage: jest.fn(() => ({
    onReady: jest.fn(),
  })),
}));

// Mock OnSchedule and ensure it has a mock setStore method
jest.mock("./schedule", () => ({
  OnSchedule: jest.fn().mockImplementation(() => ({
    setStore: jest.fn(), // Ensure setStore is a mocked function
  })),
}));

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
          containers: [],
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
    expect(storeResult).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Registering store for ${capabilityConfig.name}`);

    const scheduleStoreResult = capability.registerScheduleStore();
    expect(scheduleStoreResult.onReady).toBeDefined();
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

  it("should log 'no alias provided' if alias is not set in validate callback", async () => {
    const capability = new Capability(capabilityConfig);

    // Mock the validate callback
    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    // Do not set alias, to trigger "no alias provided"
    capability.When(a.Pod).IsCreatedOrUpdated().Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];

    // Simulate the validation action
    const mockPeprRequest = new PeprValidateRequest<V1Pod>(mockRequest);

    if (binding.validateCallback) {
      await binding.validateCallback(mockPeprRequest);
    }

    // Expect the log to contain "no alias provided"
    expect(mockLog.info).toHaveBeenCalledWith("Executing validate action with alias: no alias provided");
    expect(mockLog.info).toHaveBeenCalledWith("Validate action log");
  });

  it("should register a Watch action and execute it with the logger", async () => {
    const capability = new Capability(capabilityConfig);

    // Mock Watch callback function
    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update, phase, logger: typeof Log = mockLog) => {
        logger.info("Watch action executed");
      },
    );

    // Chain the When and Watch methods
    capability.When(a.Pod).IsCreated().Watch(mockWatchCallback);

    // Retrieve the registered binding
    const binding = capability.bindings.find(b => b.isWatch === true);

    // Check that the watch callback was registered
    expect(binding).toBeDefined();
    expect(binding?.isWatch).toBe(true);

    // Simulate calling the watch callback with test data
    const testPod = new V1Pod();
    await binding?.watchCallback?.(testPod, WatchPhase.Added, mockLog);

    // Ensure that the logger's `info` method was called
    expect(mockLog.info).toHaveBeenCalledWith("Watch action executed");
    expect(mockWatchCallback).toHaveBeenCalledWith(testPod, WatchPhase.Added, mockLog);
  });

  it("should pass the correct parameters to the Watch action", async () => {
    const capability = new Capability(capabilityConfig);

    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update, phase, logger: typeof Log = mockLog) => {
        logger.info("Watch action executed");
      },
    );

    capability.When(a.Pod).IsCreated().Watch(mockWatchCallback);

    const binding = capability.bindings.find(b => b.isWatch);
    expect(binding).toBeDefined();

    const testPod = new V1Pod();
    const testPhase = WatchPhase.Modified;

    // Call the watch callback with custom data
    await binding?.watchCallback?.(testPod, testPhase, mockLog);

    expect(mockWatchCallback).toHaveBeenCalledWith(testPod, testPhase, mockLog);
    expect(mockLog.info).toHaveBeenCalledWith("Watch action executed");
  });

  it("should use child logger for reconcile callback", async () => {
    const capability = new Capability(capabilityConfig);

    const mockReconcileCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update, phase, logger: typeof Log = mockLog) => {
        logger.info("Reconcile action log");
      },
    );

    capability.When(a.Pod).IsCreatedOrUpdated().Reconcile(mockReconcileCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];

    // Simulate calling the reconcile action
    const testPod = new V1Pod();
    const testPhase = WatchPhase.Modified;

    if (binding.watchCallback) {
      await binding.watchCallback(testPod, testPhase);
    }

    expect(mockReconcileCallback).toHaveBeenCalledWith(testPod, testPhase, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "no alias provided" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing reconcile action with alias: no alias provided");
    expect(mockLog.info).toHaveBeenCalledWith("Reconcile action log");
  });

  it("should use user-provided alias for finalizer with reconcile", async () => {
    const capability = new Capability(capabilityConfig);

    const mockReconcileCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update, phase, logger: typeof Log = mockLog) => {
        logger.info("external api call (reconcile-create-alias): reconcile/callback");
      },
    );

    const mockFinalizeCallback: FinalizeAction<typeof V1Pod> = jest.fn(
      async (update: V1Pod, logger: typeof Log = mockLog) => {
        logger.info("Finalize action log");
      },
    );

    // Set up a When binding with a user-provided alias and Finalize
    // Chain .Reconcile() with the correct function signature before .Finalize()
    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .Alias("custom-finalizer-alias")
      .Reconcile(mockReconcileCallback)
      .Finalize(mockFinalizeCallback);

    // Find the finalize binding
    const finalizeBinding = capability.bindings.find(binding => binding.finalizeCallback);

    expect(finalizeBinding).toBeDefined(); // Ensure the finalize binding exists

    // Simulate calling the finalize action
    const testPod = new V1Pod();

    if (finalizeBinding?.finalizeCallback) {
      await finalizeBinding.finalizeCallback(testPod);
    }

    // Assertions to ensure the user-provided alias is used in the logger
    expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "custom-finalizer-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing finalize action with alias: custom-finalizer-alias");
    expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
  });

  it("should use user-provided alias for finalizer with watch", async () => {
    const capability = new Capability(capabilityConfig);

    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update, phase, logger: typeof Log = mockLog) => {
        logger.info("external api call (watch-create-alias): watch/callback");
      },
    );

    const mockFinalizeCallback: FinalizeAction<typeof V1Pod> = jest.fn(
      async (update: V1Pod, logger: typeof Log = mockLog) => {
        logger.info("Finalize action log");
      },
    );

    // Set up a When binding with a user-provided alias and Finalize
    // Chain .Watch() with the correct function signature before .Finalize()
    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .Alias("custom-finalizer-alias")
      .Watch(mockWatchCallback)
      .Finalize(mockFinalizeCallback);

    // Find the finalize binding
    const finalizeBinding = capability.bindings.find(binding => binding.finalizeCallback);

    expect(finalizeBinding).toBeDefined(); // Ensure the finalize binding exists

    // Simulate calling the finalize action
    const testPod = new V1Pod();

    if (finalizeBinding?.finalizeCallback) {
      await finalizeBinding.finalizeCallback(testPod);
    }

    // Assertions to ensure the user-provided alias is used in the logger
    expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "custom-finalizer-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing finalize action with alias: custom-finalizer-alias");
    expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
  });

  it("should use child logger for finalize callback", async () => {
    const capability = new Capability(capabilityConfig);

    const mockFinalizeCallback: FinalizeAction<typeof V1Pod> = jest.fn(async (update, logger: typeof Log = mockLog) => {
      logger.info("Finalize action log");
    });

    // Create a mock WatchLogAction function that matches the expected signature
    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (update: V1Pod, phase: WatchPhase, logger?: typeof Log) => {},
    );

    // Chain .Watch() with the correct function signature before .Finalize()
    capability.When(a.Pod).IsCreatedOrUpdated().Watch(mockWatchCallback).Finalize(mockFinalizeCallback);

    // Find the finalize binding
    const finalizeBinding = capability.bindings.find(binding => binding.finalizeCallback);

    expect(finalizeBinding).toBeDefined(); // Ensure the finalize binding exists

    // Simulate calling the finalize action
    const testPod = new V1Pod();

    if (finalizeBinding?.finalizeCallback) {
      await finalizeBinding.finalizeCallback(testPod);
    }

    expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "no alias provided" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing finalize action with alias: no alias provided");
    expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
  });

  it("should add deletionTimestamp filter", () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability.When(a.Pod).IsCreatedOrUpdated().WithDeletionTimestamp().Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1); // Ensure binding is created
    expect(capability.bindings[0].filters.deletionTimestamp).toBe(true);
  });

  it("should add name filter", () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability.When(a.Pod).IsCreatedOrUpdated().WithName("test-name").Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1); // Ensure binding is created
    expect(capability.bindings[0].filters.name).toBe("test-name");
  });

  it("should add annotation filter", () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability.When(a.Pod).IsCreatedOrUpdated().WithAnnotation("test-key", "test-value").Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1); // Ensure binding is created
    expect(capability.bindings[0].filters.annotations["test-key"]).toBe("test-value");
  });

  it("should bind an update event", () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability.When(a.Pod).IsUpdated().InNamespace("default").Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1); // Ensure binding is created
    expect(capability.bindings[0].event).toBe(Event.UPDATE);
  });

  it("should bind a delete event", async () => {
    const capability = new Capability(capabilityConfig);

    const mockValidateCallback: ValidateAction<typeof V1Pod, V1Pod> = jest.fn(
      async (req: PeprValidateRequest<V1Pod>, logger: typeof Log = mockLog) => {
        logger.info("Validate action log");
        return { allowed: true };
      },
    );

    capability.When(a.Pod).IsDeleted().InNamespace("default").Validate(mockValidateCallback);

    expect(capability.bindings).toHaveLength(1);

    expect(capability.bindings).toHaveLength(1); // Ensure binding is created
    expect(capability.bindings[0].event).toBe(Event.DELETE);
  });

  it("should throw an error if neither matchedKind nor kind is provided", () => {
    const capability = new Capability(capabilityConfig);

    // Mock a model with just a name, missing the kind
    const mockModel: { name: string } = {
      name: "InvalidModel",
    };

    // Expect an error when neither matchedKind nor kind is provided
    expect(() => {
      capability.When(mockModel as unknown as GenericClass); // Cast to the expected type without using 'any'
    }).toThrowError(`Kind not specified for ${mockModel.name}`);
  });

  it("should create a new schedule and watch the schedule store when PEPR_WATCH_MODE is 'true'", () => {
    // Set the environment variable
    process.env.PEPR_WATCH_MODE = "true";

    const capability = new Capability(capabilityConfig);

    const mockSchedule: Schedule = {
      name: "test-schedule",
      every: 5,
      unit: "minutes",
      run: jest.fn(),
      startTime: new Date(),
      completions: 1,
    };

    // Call OnSchedule with a mock schedule
    capability.OnSchedule(mockSchedule);

    // Ensure that the schedule store's `onReady` method is called with the correct callback
    const scheduleStoreInstance = capability.getScheduleStore();
    expect(scheduleStoreInstance.onReady).toHaveBeenCalledWith(expect.any(Function));

    // Simulate the `onReady` callback being invoked
    const onReadyCallback = (scheduleStoreInstance.onReady as jest.Mock).mock.calls[0][0] as () => void;
    onReadyCallback(); // The callback function is now invoked as a type of `() => void`

    // Ensure the new OnSchedule instance is created with the correct schedule data
    expect(OnSchedule).toHaveBeenCalledWith(mockSchedule);

    // Clean up environment variables after the test
    delete process.env.PEPR_WATCH_MODE;
  });

  it("should not create a new schedule or watch the schedule store when PEPR_WATCH_MODE is not set", () => {
    // Ensure environment variables are not set
    delete process.env.PEPR_WATCH_MODE;
    delete process.env.PEPR_MODE;

    const capability = new Capability(capabilityConfig);

    const mockSchedule: Schedule = {
      name: "test-schedule",
      every: 5,
      unit: "minutes",
      run: jest.fn(),
      startTime: new Date(),
      completions: 1,
    };

    // Call OnSchedule with a mock schedule
    capability.OnSchedule(mockSchedule);

    // Ensure that the schedule store's `onReady` method is not called
    const scheduleStoreInstance = capability.getScheduleStore();
    expect(scheduleStoreInstance.onReady).not.toHaveBeenCalled();

    // Ensure that OnSchedule was not called
    expect(OnSchedule).not.toHaveBeenCalled();
  });

  it("should use aliasLogger if no logger is provided in watch callback", async () => {
    const capability = new Capability(capabilityConfig);

    // Mock the watch callback
    const mockWatchCallback: WatchLogAction<typeof V1Pod> = jest.fn(
      async (update: V1Pod, phase: WatchPhase, logger?: typeof Log) => {
        logger?.info("Watch action log");
      },
    );

    // Chain Watch without providing an explicit logger
    capability.When(a.Pod).IsCreatedOrUpdated().Watch(mockWatchCallback);

    expect(capability.bindings).toHaveLength(1);
    const binding = capability.bindings[0];

    // Simulate the watch action without passing a logger, so aliasLogger is used
    const testPod = new V1Pod();
    await binding.watchCallback?.(testPod, WatchPhase.Added); // No logger passed

    // Assert that aliasLogger was used
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "no alias provided" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing watch action with alias: no alias provided");
    expect(mockLog.info).toHaveBeenCalledWith("Watch action log");
  });

  it("should add annotation with an empty value when no value is provided in WithAnnotation", () => {
    const capability = new Capability(capabilityConfig);

    // Chain WithAnnotation without providing a value (default to empty string)
    capability.When(a.Pod).IsCreatedOrUpdated().WithAnnotation("test-annotation");

    expect(capability.bindings).toHaveLength(0);
  });
});
