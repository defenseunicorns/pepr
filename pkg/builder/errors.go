// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import "errors"

var (
	ErrInvalidExt  = errors.New("invalid extension")
	ErrCompileFail = errors.New("failed to compile")
)
