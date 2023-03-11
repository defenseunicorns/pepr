// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Capability } from "./register";

export class State {
  private _state: Capability[];

  constructor() {
    // Establish the initial state
    this._state = [];
  }

  register(capability: Capability) {
    // Add the capability to the state and return the index
    return this._state.push(capability) - 1;
  }
}
