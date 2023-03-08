// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import (
	"github.com/evanw/esbuild/pkg/api"
)

type Build struct {
	Path       string
	Result     api.TransformResult
	Compressed []byte
	Hash       [20]byte
	Output     map[string][]byte
}
