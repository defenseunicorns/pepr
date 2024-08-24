import { jest, describe, beforeEach, afterEach, it, expect } from "@jest/globals";
import { StreamProcessor } from "./stream-processor";
import { Binding, Event } from "./types";
import { WatchServiceClient } from "./apiv1_grpc_pb";
import * as grpc from "@grpc/grpc-js";
import { kind } from "kubernetes-fluent-client";

jest.mock("./apiv1_grpc_pb", () => {
  const mockWatchServiceClient = {
    watch: jest.fn(),
  };
  return {
    WatchServiceClient: jest.fn(() => mockWatchServiceClient),
  };
});

jest.mock("@grpc/grpc-js", () => ({
  credentials: {
    createInsecure: jest.fn(),
  },
}));

describe("StreamProcessor", () => {
  let streamProcessor: StreamProcessor;
  let mockWatchClient: jest.Mocked<WatchServiceClient>;

  beforeEach(() => {
    // Re-mock WatchServiceClient for each test to reset state
    jest.mock("./apiv1_grpc_pb", () => {
      const mockWatchServiceClient = {
        watch: jest.fn(),
      };
      return {
        WatchServiceClient: jest.fn(() => mockWatchServiceClient),
      };
    });
    mockWatchClient = new WatchServiceClient(
      "localhost:50051",
      grpc.credentials.createInsecure(),
    ) as jest.Mocked<WatchServiceClient>;

    streamProcessor = new StreamProcessor();
    streamProcessor["client"] = mockWatchClient; // Inject the mocked client
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should configure the WatchRequest correctly", () => {
    const binding: Binding = {
      model: kind.Pod,
      event: Event.Any,
      kind: { kind: "Pod", version: "v1", group: "core" },
      filters: { namespaces: ["default"], labels: {}, annotations: {}, name: "bleg" },
    };

    streamProcessor.configure(binding);

    expect(streamProcessor.getResource()).toBe("Pod");
    expect(streamProcessor.getVersion()).toBe("v1");
    expect(streamProcessor.getGroup()).toBe("core");
    expect(streamProcessor.getNamespace()).toBe("default");
  });
});
