// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import (
	"path/filepath"

	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/evanw/esbuild/pkg/api"
)

// TranspileAndPack converts a source file to a Build Result.
func (b *Build) TranspileAndPack(path string) error {

	// Get the path to the tsconfig.json file.
	tsconfigPath := filepath.Join(filepath.Dir(b.Path), "..", "tsconfig.json")

	// Perform transpile -> bundle -> minify (whitspace).
	out := api.Build(api.BuildOptions{
		Bundle:           true,
		MinifyWhitespace: true,
		EntryPoints:      []string{b.Path},
		Loader: map[string]api.Loader{
			".js": api.LoaderJS,
			".ts": api.LoaderTS,
		},
		// Platform: api.PlatformNode,
		Tsconfig: tsconfigPath,
	})

	// Fail if there are any errors.
	if len(out.Errors) > 0 {
		message.Debug(out)
		return ErrCompileFail
	}

	// Fail if there are no output files.
	if len(out.OutputFiles) < 1 {
		return ErrCompileFail
	}

	// Store the contents of esbuild.
	b.Transpiled = out.OutputFiles[0].Contents

	// There should be content from the build.
	if len(b.Transpiled) < 100 {
		return ErrCompileFail
	}

	return nil
}
