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
	// The pepr sdk sits in ~/.pepr/sdk
	dir = path.Join(os.Getenv("HOME"), ".pepr", "sdk")
)

func New(name, base string) error {
	// Ensure the directory exists.
	if err := utils.CreateDirectory(dir, 0755); err != nil {
		return err
	}

	// Copy the sdkFiles to the new directory.
	if err := writeSDK(); err != nil {
		return err
	}

	// Convert the name to all lowercase and replace spaces with dashes.
	name = sanitizeString(name)

	// Create the new capability.
	p := path.Join(base, name)

	// Ensure the capability directory exists.
	if err := utils.CreateDirectory(p, 0755); err != nil {
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
