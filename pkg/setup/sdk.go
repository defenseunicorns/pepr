// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"embed"
	"io/fs"
	"os"
	"path"
	"path/filepath"

	"github.com/defenseunicorns/zarf/src/pkg/utils"
)

var (
	sdkFiles  *embed.FS
	baseFiles *embed.FS
)

// StoreBase stores the base files in memory.
func StoreBase(files *embed.FS) {
	baseFiles = files
}

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

	// Check if the base files and SDK files are present.
	if baseFiles == nil || sdkFiles == nil {
		return ErrMissingSDKFiles
	}

	// Check if the .gitignore file exists.
	ignorePath := path.Join(base, ".gitignore")
	if utils.InvalidPath(ignorePath) {
		// Not found, so create it.
		if err := utils.WriteFile(ignorePath, gitIgnoreTemplate()); err != nil {
			return err
		}
	}

	// Writ the example.ts and tsconfig.json files to the base directory.
	if err := writeBaseFile(base, "example.ts"); err != nil {
		return err
	}

	if err := writeBaseFile(base, "tsconfig.json"); err != nil {
		return err
	}

	// Walk the directory tree and copy the files to the output directory.
	return fs.WalkDir(sdkFiles, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			// Create a corresponding directory in the output directory.
			outputSubdir := filepath.Join(base, path)
			return os.MkdirAll(outputSubdir, 0755)
		}

		// Read the file contents from the embedded filesystem.
		fileContents, err := sdkFiles.ReadFile(path)
		if err != nil {
			return err
		}

		// Write the file to the output directory.
		outputPath := filepath.Join(base, path)
		return os.WriteFile(outputPath, fileContents, 0644)
	})

}

func writeBaseFile(base, name string) error {
	b, err := baseFiles.ReadFile(name)
	if err != nil {
		return err
	}

	p := path.Join(base, name)
	if err := utils.WriteFile(p, b); err != nil {
		return err
	}

	return nil
}
