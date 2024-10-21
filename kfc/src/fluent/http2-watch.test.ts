/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import http2 from "http2";
import { Watcher } from "./watch";
import { WatchEvent, kind } from "..";
import { WatchPhase } from "./types";
import { K8s } from ".";

jest.mock("http2");

describe("Watcher HTTP2", () => {
  let watcher: Watcher<typeof kind.Pod>;
  let mockClient: jest.Mocked<http2.ClientHttp2Session>;
  let mockReq: jest.Mocked<http2.ClientHttp2Stream>;
  const evtMock = jest.fn<(update: kind.Pod, phase: WatchPhase) => void>();
  const errMock = jest.fn<(err: Error) => void>();

  const setupAndStartWatcher = (eventType: WatchEvent, handler: (...args: any[]) => void) => {
    watcher.events.on(eventType, handler);
    watcher.start().catch(errMock);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // http2.client
    mockClient = {
      request: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<http2.ClientHttp2Session>;

    // http2.request stream
    mockReq = {
      on: jest.fn(),
      end: jest.fn(),
      setEncoding: jest.fn(),
    } as unknown as jest.Mocked<http2.ClientHttp2Stream>;

    // http2.connect function to return the mocked client session
    (http2.connect as jest.Mock).mockReturnValue(mockClient);
  });

  afterEach(() => {
    watcher.close();
  });

  it("should watch named resources", done => {
    const pod = createMockPod("pod-1", "1");
    const response = { type: "ADDED", object: pod };

    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
    });

    mockReq.on.mockImplementation((event, callback) => {
      switch (event) {
        case "response":
          callback(
            { ":status": 200 } as http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
            0,
          );
          break;
        case "data":
          setTimeout(() => {
            (callback as (chunk: Buffer) => void)(Buffer.from(JSON.stringify(response)));
          }, 10);
          break;
        case "end":
          setTimeout(() => {
            (callback as () => void)();
            done();
          }, 20);
          break;
        case "error":
          errMock(new Error("HTTP2 connection error"));
          break;
      }
      return mockReq;
    });

    mockClient.request.mockReturnValue(mockReq);

    setupAndStartWatcher(WatchEvent.CONNECT, () => {
      setupAndStartWatcher(WatchEvent.DATA, (receivedPod, phase) => {
        expect(receivedPod.metadata?.name).toBe("pod-1");
        expect(receivedPod.metadata?.resourceVersion).toBe("1");
        expect(phase).toBe(WatchPhase.Added);
        done();
      });
    });
  });

  it("should handle resource version is too old", done => {
    const errorResponse = {
      type: "ERROR",
      object: {
        kind: "Status",
        apiVersion: "v1",
        metadata: {},
        status: "Failure",
        message: "too old resource version: 123 (391079)",
        reason: "Gone",
        code: 410,
      },
    };

    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
    });

    mockReq.on.mockImplementation((event, callback) => {
      switch (event) {
        case "response":
          callback(
            { ":status": 200 } as http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
            0,
          );
          break;
        case "data":
          setTimeout(() => {
            (callback as (chunk: Buffer) => void)(Buffer.from(JSON.stringify(errorResponse)));
          }, 10);
          break;
        case "end":
          setTimeout(() => {
            (callback as () => void)();
            done();
          }, 20);
          break;
        case "error":
          errMock(new Error("HTTP2 connection error"));
          break;
      }
      return mockReq;
    });

    mockClient.request.mockReturnValue(mockReq);

    setupAndStartWatcher(WatchEvent.OLD_RESOURCE_VERSION, res => {
      expect(res).toEqual("123");
      done();
    });
  });

  it("should call the event handler for each event", done => {
    const pod = createMockPod("pod-0", "1");
    const response = { type: "ADDED", object: pod };

    watcher = K8s(kind.Pod).Watch(
      (evt, phase) => {
        expect(evt.metadata?.name).toEqual("pod-0");
        expect(phase).toEqual(WatchPhase.Added);
      },
      { useHTTP2: true },
    );

    mockReq.on.mockImplementation((event, callback) => {
      switch (event) {
        case "response":
          callback(
            { ":status": 200 } as http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
            0,
          );
          break;
        case "data":
          setTimeout(() => {
            (callback as (chunk: Buffer) => void)(Buffer.from(JSON.stringify(response)));
          }, 10);
          break;
        case "end":
          setTimeout(() => {
            (callback as () => void)();
          }, 20);
          break;
        case "error":
          errMock(new Error("HTTP2 connection error"));
          break;
      }
      return mockReq;
    });

    mockClient.request.mockReturnValue(mockReq);

    watcher.start().catch(errMock);
    done();
  });

  it("should return the cache id", () => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
      useHTTP2: true,
    });
    expect(watcher.getCacheID()).toEqual("d69b75a611");
  });

  it("should handle the CONNECT event", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
      useHTTP2: true,
    });
    setupAndStartWatcher(WatchEvent.CONNECT, () => {});
    done();
  });

  it("should handle the DATA event", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
      useHTTP2: true,
    });
    setupAndStartWatcher(WatchEvent.DATA, (pod, phase) => {
      expect(pod.metadata?.name).toEqual("pod-0");
      expect(phase).toEqual(WatchPhase.Added);
    });
    done();
  });

  it("should handle the NETWORK_ERROR event", done => {
    const errorMessage = "Something bad happened";
    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
      resyncDelaySec: 1,
    });

    mockReq.on.mockImplementation((event, callback) => {
      if (event === "response") {
        callback(
          { ":status": 200 } as http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
          0,
        );
      } else if (event === "error") {
        (callback as (err: Error) => void)(new Error(errorMessage));
      }
      return mockReq;
    });

    mockClient.request.mockReturnValue(mockReq);

    setupAndStartWatcher(WatchEvent.NETWORK_ERROR, error => {
      expect(error.message).toEqual(errorMessage);
    });

    watcher.start().catch(errMock);
    done();
  });

  it("should handle the RECONNECT event on an error", done => {
    const errorMessage = "Something bad happened";

    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
      resyncDelaySec: 0.01,
    });

    let reconnectCount = 0;

    mockReq.on.mockImplementation((event, callback) => {
      if (event === "response") {
        callback(
          { ":status": 200 } as http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader,
          0,
        );
      } else if (event === "error") {
        reconnectCount += 1;
        (callback as (err: Error) => void)(new Error(errorMessage));
      }
      return mockReq;
    });

    mockClient.request.mockReturnValue(mockReq);

    setupAndStartWatcher(WatchEvent.RECONNECT, count => {
      expect(count).toEqual(reconnectCount);
    });

    watcher.start().catch(errMock);
    done();
  });
  it("should perform a resync after the resync interval", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
      resyncDelaySec: 1,
    });
    watcher.start().catch(errMock);
    done();
  });
  it("should handle the GIVE_UP event", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      useHTTP2: true,
      lastSeenLimitSeconds: 0.01,
      resyncDelaySec: 0.01,
      resyncFailureMax: 1,
    });
    setupAndStartWatcher(WatchEvent.GIVE_UP, () => {
      expect(errMock).toBeCalled();
    });
    watcher.start().catch(errMock);
    done();
  });
});

/**
 * Creates a mock pod object
 *
 * @param name The name of the pod
 * @param resourceVersion The resource version of the pod
 * @returns A mock pod object
 */
function createMockPod(name: string, resourceVersion: string): kind.Pod {
  return {
    kind: "Pod",
    apiVersion: "v1",
    metadata: {
      name,
      resourceVersion,
      uid: "abc-123-xyz",
    },
    spec: {
      containers: [
        {
          name: "nginx",
          image: "nginx:1.14.2",
          ports: [
            {
              containerPort: 80,
              protocol: "TCP",
            },
          ],
        },
      ],
    },
    status: {},
  };
}
