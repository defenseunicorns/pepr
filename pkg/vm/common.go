// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// vm package contains the v8go wrapper for running JavaScript code in Zarf.
package vm

import (
	"fmt"

	"github.com/defenseunicorns/pepr/pkg/builder"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	v8 "rogchap.com/v8go"
)

// New creates a new Script object from a file path.
func New(b *builder.Build) *Script {
	return &Script{
		path: b.Path,
		code: string(b.Result.Code),
	}
}

func (s *Script) Run(payload []byte) (*v8.Value, func(), error) {
	iso := v8.NewIsolate()
	ctx := v8.NewContext(iso)

	// Compile the script.
	script, err := iso.CompileUnboundScript(s.code, s.path, v8.CompileOptions{CachedData: s.cache})
	if err != nil {
		return nil, iso.Dispose, err
	}

	logFn := v8.NewFunctionTemplate(iso, func(info *v8.FunctionCallbackInfo) *v8.Value {
		if args := info.Args(); len(args) > 0 {
			for _, input := range args {
				message.Info(input.String())
			}
		}

		return nil
	})

	console := v8.NewObjectTemplate(iso)
	console.Set("log", logFn, v8.ReadOnly)

	consoleObj, _ := console.NewInstance(ctx)

	global := ctx.Global()

	global.Set("console", consoleObj)
	global.Set("__pepr_payload", string(payload))

	// Run the script.
	_, err = script.Run(ctx)
	if err != nil {
		return nil, ctx.Close, err
	}

	out, err := ctx.RunScript("transform(__pepr_payload)", "main.js")
	if err != nil {
		fmt.Println(err)
	}

	// Cache the script.
	if s.cache == nil {
		s.cache = script.CreateCodeCache()
	}

	return out, ctx.Close, nil
}
