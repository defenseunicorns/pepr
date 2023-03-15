// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest } from "@k8s";
import { CapabilityCfg, HookPhase, MutateBinding } from "./types";

/**
 * A capability is a unit of functionality that can be registered with the Pepr runtime.
 */
export class Capability implements CapabilityCfg {
  private _name: string;
  private _description: string;
  private _namespaces?: string[] | undefined;
  // Currently everything is considered a mutation
  private _mutateOrValidate = HookPhase.mutate;

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get namespaces(): string[] {
    return this._namespaces || [];
  }

  get mutateOrValidate(): HookPhase {
    return this._mutateOrValidate;
  }

  constructor(cfg: CapabilityCfg) {
    this._name = cfg.name;
    this._description = cfg.description;
    this._namespaces = cfg.namespaces;
  }

  From(kind: string) {
    return this;
  }

  IsCreated() {
    return this;
  }

  Mutate(binding: (request: AdmissionRequest) => void) {}

  When(kind: string) {
    return this;
  }

  OnCreate(kind: string) {
    return this;
  }

  RegisterCreate(binding: (request: AdmissionRequest) => void) {}

  RegisterUpdate(binding: MutateBinding) {}

  RegisterDelete(binding: MutateBinding) {}
}
