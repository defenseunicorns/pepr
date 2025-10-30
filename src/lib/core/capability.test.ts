import { Capability } from "./capability";
import Log from "../telemetry/logger";
import {
  CapabilityCfg,
  FinalizeAction,
  MutateAction,
  ValidateAction,
  WatchLogAction,
} from "../types";
import { a } from "../../lib";
import { V1Pod } from "@kubernetes/client-node";
import { expect, describe, vi, beforeEach, it, type Mock } from "vitest";
import { Event, Operation } from "../enums";
import { PeprMutateRequest } from "../mutate-request";
import { PeprValidateRequest } from "../validate-request";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/shared-types";
import { GenericClass } from "kubernetes-fluent-client";
import { Schedule } from "./schedule";
import { OnSchedule } from "./schedule";
import { AdmissionRequest } from "../common-types";
import type { Logger } from "pino";

vi.mock("./envChecks", () => ({
  isBuildMode: vi.fn(() => true),
  isWatchMode: vi.fn(() => true),
  isDevMode: vi.fn(() => true),
}));

vi.mock("../telemetry/logger", () => {
  const info = vi.fn();
  const debug = vi.fn();
  const logger = { info, debug, child: vi.fn(() => logger) };
  return { default: logger };
});

vi.mock("./storage", () => {
  class Storage {
    public onReady = vi.fn<(cb: () => void) => void>();
  }
  return { Storage };
});

vi.mock("./schedule", () => {
  interface OnScheduleInstance {
    setStore: (store: unknown) => void;
  }

  function RealOnSchedule(this: OnScheduleInstance) {
    this.setStore = vi.fn<(store: unknown) => void>();
  }

  type OnScheduleMock = Mock & {
    new (schedule: unknown): OnScheduleInstance;
    (...args: [unknown]): void;
  };

  const OnSchedule = vi.fn(RealOnSchedule) as unknown as OnScheduleMock;

  type Schedule = {
    name: string;
    every: number;
    unit: "seconds" | "minutes" | "hours" | "days" | "weeks" | "cron";
    run: () => unknown | Promise<unknown>;
    startTime?: Date;
    completions?: number;
  };

  return { OnSchedule, Schedule: undefined as unknown as Schedule };
});

const mockLog = Log as unknown as {
  info: Mock;
  debug: Mock;
  child: Mock;
};

describe("Capability", () => {
  let mockRequest: AdmissionRequest<V1Pod>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

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
    expect(mockLog.debug).toHaveBeenCalledWith(`Capability ${capabilityConfig.name} registered`);
  });

  it("should register store and schedule store", () => {
    const capability = new Capability(capabilityConfig);

    const storeResult = capability.registerStore();
    expect(storeResult).toBeDefined();
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering store for ${capabilityConfig.name}`);

    const scheduleStoreResult = capability.registerScheduleStore();
    expect(scheduleStoreResult.onReady).toBeDefined();
    expect(mockLog.debug).toHaveBeenCalledWith(
      `Registering schedule store for ${capabilityConfig.name}`,
    );
  });

  describe("when a store is registered multiple times", () => {
    it("should throw an error if store is registered twice", () => {
      const capability = new Capability(capabilityConfig);

      capability.registerStore();
      expect(() => capability.registerStore()).toThrowError(
        "Store already registered for test-capability",
      );
    });

    it("should throw an error if schedule store is registered twice", () => {
      const capability = new Capability(capabilityConfig);

      capability.registerScheduleStore();
      expect(() => capability.registerScheduleStore()).toThrowError(
        "Schedule store already registered for test-capability",
      );
    });
  });

  it("should correctly chain When, InNamespace, WithLabel, and Mutate methods", async () => {
    const capability = new Capability(capabilityConfig);

    type MA = MutateAction<typeof V1Pod, V1Pod>;
    const mockMutateCallback = vi.fn<MA>(async (_req, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Executing mutation action");
    }) as unknown as MA;

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

    const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);

    await binding.mutateCallback?.(peprRequest);

    expect(mockMutateCallback).toHaveBeenCalledWith(peprRequest, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: test-alias");
  });

  describe("when creating log messages", () => {
    it("should use child logger for mutate callback", async () => {
      const capability = new Capability(capabilityConfig);

      type MA = MutateAction<typeof V1Pod, V1Pod>;
      const mockMutateCallback = vi.fn<MA>((_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Mutate action log");
      }) as unknown as MA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .InNamespace("default")
        .WithLabel("test-label", "value")
        .Alias("test-alias")
        .Mutate(mockMutateCallback);

      expect(capability.bindings).toHaveLength(1);
      const binding = capability.bindings[0];

      const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);
      await binding.mutateCallback?.(peprRequest);

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

      type MA = MutateAction<typeof V1Pod, V1Pod>;
      const mockMutateCallback = vi.fn<MA>(async (po, logger) => {
        (logger ?? (Log as unknown as Logger)).info(`SNAKES ON A PLANE! ${po.Raw.metadata?.name}`);
      }) as unknown as MA;

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
      expect(binding.alias).toBe(
        "reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation",
      );

      const peprRequest = new PeprMutateRequest<V1Pod>(mockRequest);
      await binding.mutateCallback?.(peprRequest);

      expect(mockMutateCallback).toHaveBeenCalledWith(peprRequest, expect.anything());
      expect(mockLog.child).toHaveBeenCalledWith({
        alias: "reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation",
      });
      expect(mockLog.info).toHaveBeenCalledWith(
        "Executing mutation action with alias: reject:pods:runAsRoot:privileged:runAsGroup<10:allowPrivilegeEscalation",
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        `SNAKES ON A PLANE! ${mockRequest.object.metadata?.name}`,
      );
    });

    it("should use child logger for validate callback", async () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .InNamespace("default")
        .Alias("test-alias")
        .Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      const binding = capability.bindings[0];

      const mockPeprRequest = new PeprValidateRequest<V1Pod>(mockRequest);
      await binding.validateCallback?.(mockPeprRequest);

      expect(mockValidateCallback).toHaveBeenCalledWith(mockPeprRequest, expect.anything());
      expect(mockLog.child).toHaveBeenCalledWith({ alias: "test-alias" });
      expect(mockLog.info).toHaveBeenCalledWith("Executing validate action with alias: test-alias");
      expect(mockLog.info).toHaveBeenCalledWith("Validate action log");
    });

    it("should use child logger for reconcile callback", async () => {
      const capability = new Capability(capabilityConfig);

      type WA = WatchLogAction<typeof V1Pod>;
      const mockReconcileCallback = vi.fn<WA>(async (_update, _phase, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Reconcile action log");
      }) as unknown as WA;

      capability.When(a.Pod).IsCreatedOrUpdated().Reconcile(mockReconcileCallback);

      expect(capability.bindings).toHaveLength(1);
      const binding = capability.bindings[0];

      const testPod = new V1Pod();
      const testPhase = WatchPhase.Modified;

      await binding.watchCallback?.(testPod, testPhase);

      expect(mockReconcileCallback).toHaveBeenCalledWith(testPod, testPhase, expect.anything());
      expect(mockLog.info).toHaveBeenCalledWith("Reconcile action log");
    });

    it("should use child logger for finalize callback", async () => {
      const capability = new Capability(capabilityConfig);

      type FA = FinalizeAction<typeof V1Pod>;
      const mockFinalizeCallback = vi.fn<FA>(async (_update, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Finalize action log");
      }) as unknown as FA;

      type WA = WatchLogAction<typeof V1Pod>;
      const mockWatchCallback = vi.fn<WA>(async () => {}) as unknown as WA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .Watch(mockWatchCallback)
        .Finalize(mockFinalizeCallback);

      const finalizeBinding = capability.bindings.find(b => b.finalizeCallback);

      const testPod = new V1Pod();
      await finalizeBinding?.finalizeCallback?.(testPod);

      expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
      expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
    });

    it("should use aliasLogger if no logger is provided in watch callback", async () => {
      const capability = new Capability(capabilityConfig);

      type WA = WatchLogAction<typeof V1Pod>;
      const mockWatchCallback = vi.fn<WA>(async (_update, _phase, logger) => {
        logger?.info("Watch action log");
      }) as unknown as WA;

      capability.When(a.Pod).IsCreatedOrUpdated().Watch(mockWatchCallback);

      const binding = capability.bindings[0];

      const testPod = new V1Pod();
      await binding.watchCallback?.(testPod, WatchPhase.Added);

      expect(mockLog.info).toHaveBeenCalledWith("Watch action log");
    });
  });

  it("should reset the alias before each mutation", async () => {
    const capability = new Capability(capabilityConfig);

    type MA = MutateAction<typeof V1Pod, V1Pod>;
    const firstMutateCallback = vi.fn<MA>(async (_req, logger) => {
      (logger ?? (Log as unknown as Logger)).info("First mutation action");
    }) as unknown as MA;

    const secondMutateCallback = vi.fn<MA>(async (_req, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Second mutation action");
    }) as unknown as MA;

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .InNamespace("default")
      .Alias("first-alias")
      .Mutate(firstMutateCallback);

    capability.When(a.Pod).IsCreatedOrUpdated().InNamespace("default").Mutate(secondMutateCallback);

    expect(capability.bindings).toHaveLength(2);

    const peprRequest1 = new PeprMutateRequest<V1Pod>(mockRequest);
    await capability.bindings[0].mutateCallback?.(peprRequest1);

    expect(firstMutateCallback).toHaveBeenCalledWith(peprRequest1, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "first-alias" });
    expect(mockLog.info).toHaveBeenCalledWith("Executing mutation action with alias: first-alias");

    const peprRequest2 = new PeprMutateRequest<V1Pod>(mockRequest);
    await capability.bindings[1].mutateCallback?.(peprRequest2);

    expect(secondMutateCallback).toHaveBeenCalledWith(peprRequest2, expect.anything());
  });

  it("should register a Watch action and execute it with the logger", async () => {
    const capability = new Capability(capabilityConfig);

    type WA = WatchLogAction<typeof V1Pod>;
    const mockWatchCallback = vi.fn<WA>(async (_update, _phase, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Watch action executed");
    }) as unknown as WA;

    capability.When(a.Pod).IsCreated().Watch(mockWatchCallback);

    const binding = capability.bindings.find(b => b.isWatch === true);
    expect(binding).toBeDefined();
    expect(binding?.isWatch).toBe(true);

    const testPod = new V1Pod();
    await binding?.watchCallback?.(testPod, WatchPhase.Added, Log as unknown as Logger);

    expect(mockLog.info).toHaveBeenCalledWith("Watch action executed");
    expect(mockWatchCallback).toHaveBeenCalledWith(testPod, WatchPhase.Added, Log);
  });

  it("should pass the correct parameters to the Watch action", async () => {
    const capability = new Capability(capabilityConfig);

    type WA = WatchLogAction<typeof V1Pod>;
    const mockWatchCallback = vi.fn<WA>(async (_update, _phase, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Watch action executed");
    }) as unknown as WA;

    capability.When(a.Pod).IsCreated().Watch(mockWatchCallback);

    const binding = capability.bindings.find(b => b.isWatch);
    expect(binding).toBeDefined();

    const testPod = new V1Pod();
    const testPhase = WatchPhase.Modified;

    await binding?.watchCallback?.(testPod, testPhase, Log as unknown as Logger);

    expect(mockWatchCallback).toHaveBeenCalledWith(testPod, testPhase, Log);
    expect(mockLog.info).toHaveBeenCalledWith("Watch action executed");
  });

  it("should use user-provided alias for finalizer with reconcile", async () => {
    const capability = new Capability(capabilityConfig);

    type WA = WatchLogAction<typeof V1Pod>;
    const mockReconcileCallback = vi.fn<WA>(async (_update, _phase, logger) => {
      (logger ?? (Log as unknown as Logger)).info(
        "external api call (reconcile-create-alias): reconcile/callback",
      );
    }) as unknown as WA;

    type FA = FinalizeAction<typeof V1Pod>;
    const mockFinalizeCallback = vi.fn<FA>(async (_update, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Finalize action log");
    }) as unknown as FA;

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .Alias("custom-finalizer-alias")
      .Reconcile(mockReconcileCallback)
      .Finalize(mockFinalizeCallback);

    const finalizeBinding = capability.bindings.find(b => b.finalizeCallback);

    const testPod = new V1Pod();
    await finalizeBinding?.finalizeCallback?.(testPod);

    expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "custom-finalizer-alias" });
    expect(mockLog.info).toHaveBeenCalledWith(
      "Executing finalize action with alias: custom-finalizer-alias",
    );
    expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
  });

  it("should use user-provided alias for finalizer with watch", async () => {
    const capability = new Capability(capabilityConfig);

    type WA = WatchLogAction<typeof V1Pod>;
    const mockWatchCallback = vi.fn<WA>(async (_update, _phase, logger) => {
      (logger ?? (Log as unknown as Logger)).info(
        "external api call (watch-create-alias): watch/callback",
      );
    }) as unknown as WA;

    type FA = FinalizeAction<typeof V1Pod>;
    const mockFinalizeCallback = vi.fn<FA>(async (_update, logger) => {
      (logger ?? (Log as unknown as Logger)).info("Finalize action log");
    }) as unknown as FA;

    capability
      .When(a.Pod)
      .IsCreatedOrUpdated()
      .Alias("custom-finalizer-alias")
      .Watch(mockWatchCallback)
      .Finalize(mockFinalizeCallback);

    const finalizeBinding = capability.bindings.find(b => b.finalizeCallback);

    const testPod = new V1Pod();
    await finalizeBinding?.finalizeCallback?.(testPod);

    expect(mockFinalizeCallback).toHaveBeenCalledWith(testPod, expect.anything());
    expect(mockLog.child).toHaveBeenCalledWith({ alias: "custom-finalizer-alias" });
    expect(mockLog.info).toHaveBeenCalledWith(
      "Executing finalize action with alias: custom-finalizer-alias",
    );
    expect(mockLog.info).toHaveBeenCalledWith("Finalize action log");
  });

  describe("when adding filters", () => {
    it("should add deletionTimestamp filter", () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .WithDeletionTimestamp()
        .Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      expect(capability.bindings[0].filters.deletionTimestamp).toBe(true);
    });

    it("should add name filter", () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .WithName("test-name")
        .Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      expect(capability.bindings[0].filters.name).toBe("test-name");
    });

    it("should add annotation filter", () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability
        .When(a.Pod)
        .IsCreatedOrUpdated()
        .WithAnnotation("test-key", "test-value")
        .Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      expect(capability.bindings[0].filters.annotations["test-key"]).toBe("test-value");
    });
  });

  describe("when binding to events", () => {
    it("should bind an update event", () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability.When(a.Pod).IsUpdated().InNamespace("default").Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      expect(capability.bindings[0].event).toBe(Event.UPDATE);
    });

    it("should bind a delete event", async () => {
      const capability = new Capability(capabilityConfig);

      type VA = ValidateAction<typeof V1Pod, V1Pod>;
      const mockValidateCallback = vi.fn<VA>(async (_req, logger) => {
        (logger ?? (Log as unknown as Logger)).info("Validate action log");
        return { allowed: true };
      }) as unknown as VA;

      capability.When(a.Pod).IsDeleted().InNamespace("default").Validate(mockValidateCallback);

      expect(capability.bindings).toHaveLength(1);
      expect(capability.bindings[0].event).toBe(Event.DELETE);
    });
  });

  it("should throw an error if neither matchedKind nor kind is provided", () => {
    const capability = new Capability(capabilityConfig);

    const mockModel: { name: string } = {
      name: "InvalidModel",
    };

    expect(() => {
      capability.When(mockModel as unknown as GenericClass);
    }).toThrowError(`Kind not specified for ${mockModel.name}`);
  });

  it("should create a new schedule and watch the schedule store when PEPR_WATCH_MODE is 'true'", () => {
    process.env.PEPR_WATCH_MODE = "true";

    const capability = new Capability(capabilityConfig);

    const mockSchedule: Schedule = {
      name: "test-schedule",
      every: 5,
      unit: "minutes",
      run: vi.fn(),
      startTime: new Date(),
      completions: 1,
    };

    capability.OnSchedule(mockSchedule);

    const scheduleStoreInstance = capability.getScheduleStore();
    expect(scheduleStoreInstance.onReady).toHaveBeenCalledWith(expect.any(Function));

    const onReadyCallback = (scheduleStoreInstance.onReady as Mock).mock.calls[0][0] as () => void;
    onReadyCallback();

    expect(OnSchedule).toHaveBeenCalledWith(mockSchedule);

    delete process.env.PEPR_WATCH_MODE;
  });

  it("should not create a new schedule or watch the schedule store when PEPR_WATCH_MODE is not set", () => {
    delete process.env.PEPR_WATCH_MODE;
    delete process.env.PEPR_MODE;

    const capability = new Capability(capabilityConfig);

    const mockSchedule: Schedule = {
      name: "test-schedule",
      every: 5,
      unit: "minutes",
      run: vi.fn(),
      startTime: new Date(),
      completions: 1,
    };

    capability.OnSchedule(mockSchedule);

    const scheduleStoreInstance = capability.getScheduleStore();
    expect(scheduleStoreInstance.onReady).not.toHaveBeenCalled();

    expect(OnSchedule).not.toHaveBeenCalled();
  });

  it("should add annotation with an empty value when no value is provided in WithAnnotation", () => {
    const capability = new Capability(capabilityConfig);

    capability.When(a.Pod).IsCreatedOrUpdated().WithAnnotation("test-annotation");

    expect(capability.bindings).toHaveLength(0);
  });
});
