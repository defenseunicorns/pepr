// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// vm package contains the v8go wrapper for running JavaScript code in Pepr.
package vm

import (
	"github.com/defenseunicorns/pepr/pkg/builder"
	"rogchap.com/v8go"
)

// New creates a new Script object from a file path.
func New(b *builder.Build) *Script {
	return &Script{
		path: b.Path,
		code: string(b.Transpiled),
	}
}

func (s *Script) Run() (*v8go.Value, func(), error) {
	ctx := v8go.NewContext()

	// Compile the script.
	script, err := ctx.Isolate().CompileUnboundScript(s.code, s.path, v8go.CompileOptions{CachedData: s.cache})
	if err != nil {
		return nil, ctx.Close, err
	}

	// Run the script.
	out, err := script.Run(ctx)
	if err != nil {
		return nil, ctx.Close, err
	}

	// Cache the script.
	if s.cache == nil {
		s.cache = script.CreateCodeCache()
	}

	return out, ctx.Close, nil
}
