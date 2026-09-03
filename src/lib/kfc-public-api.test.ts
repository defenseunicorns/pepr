import { describe, expect, it } from "vitest";
import {
  kind,
  WatchEvent,
  WatchPhase,
  type K8sInit,
  type KubernetesListObject,
  type WatchCfg,
  type Watcher,
  type WatcherType,
} from "kubernetes-fluent-client";

type PublicWatchTypes = {
  init: K8sInit<typeof kind.Pod, kind.Pod>;
  list: KubernetesListObject<kind.Pod>;
  config: WatchCfg;
  watcher: Watcher<typeof kind.Pod>;
  watcherType: WatcherType<typeof kind.Pod>;
};

const assertPublicWatchTypes = (types: Partial<PublicWatchTypes>): void => {
  void types;
};

describe("kubernetes-fluent-client public API", () => {
  it("exports Pepr's watcher runtime and type contracts from the package root", () => {
    assertPublicWatchTypes({
      config: {
        relistIntervalSec: 600,
        resyncFailureMax: 5,
      },
    });

    expect(WatchPhase.Added).toBe("ADDED");
    expect(WatchEvent.DATA).toBe("data");
  });
});
