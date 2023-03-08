// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"errors"

	"github.com/defenseunicorns/pepr/pkg/builder"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/cobra"
)

// buildCmd represents the build command
var buildCmd = &cobra.Command{
	Use:   "build [PATH]",
	Short: "Build Pepr capabilties in the given path for deployment. This should be a Javascript or Typescript file.",
	Long:  ``,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		path := args[0]

		// Create a new Build
		b := builder.New(path)

		// Convert all the code from JS/TS to a single JS output
		if err := b.TranspileAndPack(path); err != nil {
			if errors.Is(err, builder.ErrInvalidExt) {
				message.Fatalf(err, "Invalid file extension. Only .js and .ts files are supported.")
			}

			if errors.Is(err, builder.ErrCompileFail) {
				message.Fatalf(err, "Failed to compile the code at %s.", path)
			}

			message.Fatalf(err, "Failed to build the capabilites at %s (%s)", path, err)
		}

		message.Debugf("Successfully built the capabilities at %s:\n\n%s", path, string(b.Result.Code))

		if err := b.Compress(); err != nil {
			message.Fatalf(err, "Failed to compress the compiled capability definitions.")
		}

		if err := b.CreateSecret(); err != nil {
			message.Fatalf(err, "Failed to create the Kubernetes secret for the compressed capability definitions.")
		}

	},
}

func init() {
	rootCmd.AddCommand(buildCmd)
}
