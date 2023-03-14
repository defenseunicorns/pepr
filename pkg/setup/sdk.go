// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/defenseunicorns/zarf/src/pkg/utils"
)

var (
	sdkFiles *embed.FS
)

// StoreSDK stores the SDK files in memory.
func StoreSDK(files *embed.FS) {
	sdkFiles = files
}

// SyncSDK copies the SDK to the base directory.
func SyncSDK(base string) error {
	// Ensure the base directory exists.
	if err := utils.CreateDirectory(base, 0755); err != nil {
		return err
	}

	// Check if the .gitignore file exists.
	ignorePath := path.Join(base, ".gitignore")
	if utils.InvalidPath(ignorePath) {
		// Not found, so create it.
		if err := utils.WriteFile(ignorePath, gitIgnoreTemplate()); err != nil {
			return err
		}
	}

	if sdkFiles == nil {
		return ErrMissingSDKFiles
	}

	// Walk the directory tree and copy the files to the output directory.
	return fs.WalkDir(sdkFiles, "sdk", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if path == "sdk" {
			// Skip the root directory.
			return nil
		}

		// Remove the first directory from the path, respecting the OS path separator.
		prefix := fmt.Sprintf("sdk%c", filepath.Separator)
		strippedPath := strings.TrimPrefix(path, prefix)

		if d.IsDir() {
			// Create a corresponding directory in the output directory.
			outputSubdir := filepath.Join(base, strippedPath)
			return os.MkdirAll(outputSubdir, 0755)
		}

		// Read the file contents from the embedded filesystem.
		fileContents, err := sdkFiles.ReadFile(path)
		if err != nil {
			return err
		}

		// Write the file to the output directory.
		outputPath := filepath.Join(base, strippedPath)
		return os.WriteFile(outputPath, fileContents, 0644)
	})

}
