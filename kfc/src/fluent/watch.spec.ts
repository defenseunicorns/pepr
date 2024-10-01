/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import nock from "nock";
import { PassThrough } from "readable-stream";

import { K8s } from ".";
import { WatchEvent, kind } from "..";
import { WatchPhase } from "./types";
import { Watcher } from "./watch";

describe("Watcher", () => {
  const evtMock = jest.fn<(update: kind.Pod, phase: WatchPhase) => void>();
  const errMock = jest.fn<(err: Error) => void>();

  const setupAndStartWatcher = (eventType: WatchEvent, handler: (...args: any[]) => void) => {
    watcher.events.on(eventType, handler);
    watcher.start().catch(errMock);
  };

  let watcher: Watcher<typeof kind.Pod>;

  beforeEach(() => {
    jest.resetAllMocks();

    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .reply(200, {
        kind: "PodList",
        apiVersion: "v1",
        metadata: {
          resourceVersion: "10",
        },
        items: [createMockPod(`pod-0`, `1`)],
      });

    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .query({ watch: "true", resourceVersion: "10" })
      .reply(200, () => {
        const stream = new PassThrough();

        const resources = [
          { type: "ADDED", object: createMockPod(`pod-0`, `1`) },
          { type: "MODIFIED", object: createMockPod(`pod-0`, `2`) },
        ];

        resources.forEach(resource => {
          stream.write(JSON.stringify(resource) + "\n");
        });

        stream.end();

        return stream;
      });
  });

  afterEach(() => {
    watcher.close();
  });

  it("should watch named resources", done => {
    nock.cleanAll();
    nock("http://jest-test:8080")
      .get("/api/v1/namespaces/tester/pods")
      .query({ fieldSelector: "metadata.name=demo" })
      .reply(200, createMockPod(`demo`, `15`));

    nock("http://jest-test:8080")
      .get("/api/v1/namespaces/tester/pods")
      .query({
        watch: "true",
        fieldSelector: "metadata.name=demo",
        resourceVersion: "15",
      })
      .reply(200);

    watcher = K8s(kind.Pod, { name: "demo" }).InNamespace("tester").Watch(evtMock);

    setupAndStartWatcher(WatchEvent.CONNECT, () => {
      done();
    });
  });

  it("should handle resource version is too old", done => {
    nock.cleanAll();
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .reply(200, {
        kind: "PodList",
        apiVersion: "v1",
        metadata: {
          resourceVersion: "25",
        },
        items: [createMockPod(`pod-0`, `1`)],
      });
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .query({ watch: "true", resourceVersion: "25" })
      .reply(200, () => {
        const stream = new PassThrough();
        stream.write(
          JSON.stringify({
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
          }) + "\n",
        );

        stream.end();
        return stream;
      });

    watcher = K8s(kind.Pod).Watch(evtMock);

    setupAndStartWatcher(WatchEvent.OLD_RESOURCE_VERSION, res => {
      expect(res).toEqual("25");
      done();
    });
  });

  it("should call the event handler for each event", done => {
    watcher = K8s(kind.Pod).Watch((evt, phase) => {
      expect(evt.metadata?.name).toEqual(`pod-0`);
      expect(phase).toEqual(WatchPhase.Added);
      done();
    });

    watcher.start().catch(errMock);
  });

  it("should return the cache id", () => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
    });
    expect(watcher.getCacheID()).toEqual("d69b75a611");
  });

  it("should handle the CONNECT event", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
    });
    setupAndStartWatcher(WatchEvent.CONNECT, () => {
      done();
    });
  });

  it("should handle the DATA event", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
    });
    setupAndStartWatcher(WatchEvent.DATA, (pod, phase) => {
      expect(pod.metadata?.name).toEqual(`pod-0`);
      expect(phase).toEqual(WatchPhase.Added);
      done();
    });
  });

  it("should handle the NETWORK_ERROR event", done => {
    nock.cleanAll();
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .reply(200, {
        kind: "PodList",
        apiVersion: "v1",
        metadata: {
          resourceVersion: "45",
        },
        items: [createMockPod(`pod-0`, `1`)],
      });
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .query({ watch: "true", resourceVersion: "45" })
      .replyWithError("Something bad happened");

    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 1,
    });

    setupAndStartWatcher(WatchEvent.NETWORK_ERROR, error => {
      expect(error.message).toEqual(
        "request to http://jest-test:8080/api/v1/pods?watch=true&resourceVersion=45 failed, reason: Something bad happened",
      );
      done();
    });
  });

  it("should handle the RECONNECT event on an error", done => {
    nock.cleanAll();
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .reply(200, {
        kind: "PodList",
        apiVersion: "v1",
        metadata: {
          resourceVersion: "65",
        },
        items: [createMockPod(`pod-0`, `1`)],
      });
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .query({ watch: "true", resourceVersion: "65" })
      .replyWithError("Something bad happened");

    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 0.01,
    });

    setupAndStartWatcher(WatchEvent.RECONNECT, count => {
      expect(count).toEqual(1);
      done();
    });
  });

  it("should perform a resync after the resync interval", done => {
    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncDelaySec: 0.01,
      lastSeenLimitSeconds: 0.01,
    });

    setupAndStartWatcher(WatchEvent.RECONNECT, count => {
      expect(count).toEqual(1);
      done();
    });
  });

  it("should handle the GIVE_UP event", done => {
    nock.cleanAll();
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .reply(200, {
        kind: "PodList",
        apiVersion: "v1",
        metadata: {
          resourceVersion: "75",
        },
        items: [createMockPod(`pod-0`, `1`)],
      });
    nock("http://jest-test:8080")
      .get("/api/v1/pods")
      .query({ watch: "true", resourceVersion: "75" })
      .replyWithError("Something bad happened");

    watcher = K8s(kind.Pod).Watch(evtMock, {
      resyncFailureMax: 1,
      resyncDelaySec: 0.01,
      lastSeenLimitSeconds: 1,
    });

    setupAndStartWatcher(WatchEvent.GIVE_UP, error => {
      expect(error.message).toContain("Retry limit (1) exceeded, giving up");
      done();
    });
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
      name: name,
      resourceVersion: resourceVersion,
      uid: Math.random().toString(36).substring(7),
      // ... other metadata fields
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
    status: {
      // ... pod status
    },
  };
}
