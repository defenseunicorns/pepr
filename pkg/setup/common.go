// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"embed"
	"os"
	"path"
	"regexp"
	"strings"

	"github.com/defenseunicorns/zarf/src/pkg/utils"
)

var (
	sdkFiles *embed.FS
)

func New(name, base string) error {
	// Convert the name to all lowercase and replace spaces with dashes.
	namePath := sanitizeString(name)
	p := path.Join(base, namePath)

	// Ensure the capability doesn't already exist.
	if _, err := os.Stat(p); !os.IsNotExist(err) {
		return ErrCapabilityExists
	}

	// Ensure the directory exists.
	if err := utils.CreateDirectory(base, 0755); err != nil {
		return err
	}

	// Create the tsconfig.json file if it doesn't exist.
	tsconfigPath := path.Join(base, "tsconfig.json")
	if _, err := os.Stat(tsconfigPath); os.IsNotExist(err) {
		if err := utils.WriteFile(tsconfigPath, tsconfigTemplate()); err != nil {
			return err
		}
	}

	// Copy the sdkFiles to the base directory.
	if err := writeSDK(base); err != nil {
		return err
	}

	// Create the capability directory exists.
	if err := utils.CreateDirectory(p, 0755); err != nil {
		return err
	}

	entryPath := path.Join(p, "index.ts")
	entryTs := entryTemplate(name)
	if err := utils.WriteFile(entryPath, entryTs); err != nil {
		return err
	}

	return nil
}

func StoreSDK(files *embed.FS) {
	sdkFiles = files
}

// sanitizeString converts a string to lowercase and replaces all non-alphanumeric characters with dashes.
func sanitizeString(input string) string {
	lower := strings.ToLower(input)
	stripped := regexp.MustCompile(`[^a-z0-9_]+`).ReplaceAllString(lower, "-")
	return strings.Trim(stripped, "-")
}
