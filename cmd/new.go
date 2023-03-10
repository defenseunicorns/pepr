// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"errors"

	"github.com/defenseunicorns/pepr/pkg/setup"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/cobra"
)

func init() {
	var dir string

	// newCmd represents the build command
	var newCmd = &cobra.Command{
		Use:   "new [CAPABILITY_NAME]",
		Short: "Generate a new Pepr capability with the given name.",
		Long:  ``,
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			name := args[0]

			if name == "" {
				message.Fatalf(errors.New("name is required"), "Failed to create capability.")
			}

			if err := setup.New(name, dir); err != nil {
				message.Fatalf(err, "Failed to create capability %s.", name)
			}
		},
	}

	newCmd.Flags().StringVarP(&dir, "dir", "d", "", "The directory to create the capability in. (default is the current directory).")
	rootCmd.AddCommand(newCmd)
}
