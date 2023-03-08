// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import (
	"os"
	"path/filepath"

	"github.com/evanw/esbuild/pkg/api"
)

// TranspileAndPack converts a source file to a Build Result.
func (b *Build) TranspileAndPack(path string) error {

	var loader api.Loader

	// Switch on file extension to determine the loader.
	switch ext := filepath.Ext(b.Path); ext {
	case ".ts":
		loader = api.LoaderTS
	case ".js":
		loader = api.LoaderJS
	default:
		return ErrInvalidExt
	}

	// Read the file contents.
	rawCode, err := os.ReadFile(b.Path)
	if err != nil {
		return err
	}

	// Compile the code with esbuild.
	b.Result = api.Transform(string(rawCode), api.TransformOptions{
		Loader: loader,
	})

	// Fail if there are any errors.
	if len(b.Result.Errors) > 0 {
		return ErrCompileFail
	}

	return nil
}
