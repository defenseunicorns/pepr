// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import "errors"

var (
	ErrMissingSDKFiles  = errors.New("missing sdk files")
	ErrCapabilityExists = errors.New("capability already exists")
)
