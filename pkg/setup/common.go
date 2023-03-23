// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"path"
	"regexp"
	"strings"

	"github.com/defenseunicorns/zarf/src/pkg/utils"
)

func New(name, base string) error {
	p := getPath(base, name)

	// Ensure the capability doesn't already exist.
	if !utils.InvalidPath(p) {
		return ErrCapabilityExists
	}

	// Create the directory.
	if err := utils.CreateDirectory(base, 0755); err != nil {
		return err
	}

	// Copy the sdk to the base directory.
	if err := SyncSDK(base); err != nil {
		return err
	}

	// Create the capability directory.
	if err := utils.CreateDirectory(p, 0755); err != nil {
		return err
	}

	// Create the entry file.
	entryPath := path.Join(p, "index.ts")
	if err := utils.WriteFile(entryPath, entryTemplate(name)); err != nil {
		return err
	}

	return nil
}

// sanitizeString converts a string to lowercase and replaces all non-alphanumeric characters with dashes.
func sanitizeString(input string) string {
	lower := strings.ToLower(input)
	stripped := regexp.MustCompile(`[^a-z0-9_]+`).ReplaceAllString(lower, "-")
	return strings.Trim(stripped, "-")
}

// getPath returns the path to the capability directory.
func getPath(base, name string) string {
	// Convert the name to all lowercase and replace spaces with dashes.
	namePath := sanitizeString(name)
	return path.Join(base, namePath)
}
