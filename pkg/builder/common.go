// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

const (
	OutSecret = "secret.yaml"
)

// New creates a new Build object from a file path.
func New(path string) *Build {
	return &Build{
		Path:   path,
		Output: make(map[string][]byte),
	}
}
