// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/defenseunicorns/pepr/pkg/builder"
	"github.com/defenseunicorns/pepr/pkg/vm"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/cobra"
)

var (
	payloadPath string
)

func init() {
	// buildCmd represents the run command
	var runCmd = &cobra.Command{
		Use:   "run [PATH]",
		Short: "Single-run execution of a Pepr capability and a JSON payload, useful for testing. Outputs the result to stdout.",
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

			script := vm.New(b)

			payload, err := os.ReadFile(payloadPath)
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					message.Fatalf(err, "The payload file at %s does not exist.", payloadPath)
				}

				message.Fatalf(err, "Failed to read the payload file at %s.", payloadPath)
			}

			val, _, err := script.Run(payload)
			if err != nil {
				message.Fatalf(err, "Failed to run the capability at %s against the payload %s.", path, payloadPath)
			}

			message.Infof("Successfully ran the capability at %s against the payload %s:\n\n%s", path, payloadPath, val)
			fmt.Fprintf(os.Stdout, val.String())
		},
	}

	runCmd.PersistentFlags().StringVarP(&payloadPath, "payload", "p", "", "JSON payload to inject into the capability.")
	runCmd.MarkPersistentFlagRequired("payload")

	rootCmd.AddCommand(runCmd)
}
