// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
package main

import (
	"embed"

	"github.com/defenseunicorns/pepr/cmd"
	"github.com/defenseunicorns/pepr/pkg/setup"
)

//go:embed example.ts tsconfig.json .prettierrc .vscode/settings.json
var baseFiles embed.FS

//go:embed sdk/*
var sdkFiles embed.FS

func main() {
	// Store the embedded base files as a pointer for later use.
	setup.StoreBase(&baseFiles)
	// Store the embedded sdk files as a pointer for later use.
	setup.StoreSDK(&sdkFiles)

	// Execute the root command.
	cmd.Execute()
}
