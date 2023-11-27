// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s } from "kubernetes-fluent-client";
import { WatchPhase } from "kubernetes-fluent-client/dist/fluent/types";

import { WatchCfg } from "kubernetes-fluent-client/dist/fluent/watch";
import { Capability } from "./capability";
import Log from "./logger";
import { ignoreNSBreach, bindingAndCapabilityNSOverlap } from "./helpers"
import { Binding, Event } from "./types";


export function setupWatch(capabilities: Capability[], ignoreNamespaces: string[]) {
  // capabilities
  //   .flatMap(c => c.bindings)
  //   .filter(binding => binding.isWatch)
  //   .forEach(runBinding);

    capabilities.forEach(capability => {
      capability.bindings.forEach(binding => {
        if (binding.isWatch) {
          runBinding(binding, ignoreNamespaces, capability.namespaces);
        }
      });
    });

}

async function runBinding(binding: Binding, ignoreNamespaces: string[] = [], capabilityNamespaces: string[]) {

  // check that binding is allowed to watch based on namespace criteria 
  let namespaceError = generateWatchNamespaceError(ignoreNamespaces, capabilityNamespaces, binding.filters.namespaces)
  
  if(namespaceError === "") {
      // check if binding.filters.namespaces are in capabilityNamespaces
  // Map the event to the watch phase
  const eventToPhaseMap = {
    [Event.Create]: [WatchPhase.Added],
    [Event.Update]: [WatchPhase.Modified],
    [Event.CreateOrUpdate]: [WatchPhase.Added, WatchPhase.Modified],
    [Event.Delete]: [WatchPhase.Deleted],
    [Event.Any]: [WatchPhase.Added, WatchPhase.Modified, WatchPhase.Deleted],
  };

  // Get the phases to match, default to any
  const phaseMatch: WatchPhase[] = eventToPhaseMap[binding.event] || eventToPhaseMap[Event.Any];

  const watchCfg: WatchCfg = {
    retryMax: 3,
    retryDelaySec: 5,
    retryFail(e) {
      // If failure continues, log and exit
      Log.error(e, "Watch failed after 3 attempts, giving up");
      process.exit(1);
    },
  };

  // Watch the resource
  await K8s(binding.model, binding.filters).Watch((obj, type) => {
    // If the type matches the phase, call the watch callback
    if (phaseMatch.includes(type)) {
      try {
        // This may be a promise, but we don't need to wait for it
        void binding.watchCallback?.(obj, type);
      } catch (e) {
        // Errors in the watch callback should not crash the controller
        Log.error(e, "Error executing watch callback");
      }
    }
  }, watchCfg);
  } else {
    Log.error(new Error('Refusing to watch resource'), namespaceError)
  }

}

function generateWatchNamespaceError(ignoredNamespaces: string[], bindingNamespaces: string[], capabilityNamespaces: string[]){
  let err = ""

  // check if binding uses an ignored namespace
  if(ignoreNSBreach(ignoredNamespaces, bindingNamespaces)) {
    err += "Binding uses an ignored namespace."
  }

  // ensure filter namespaces are part of capability namespaces
  if(bindingAndCapabilityNSOverlap(bindingNamespaces, capabilityNamespaces)) {
    err += "Binding uses namespace not governed by capability."
  }

  return err 
}
