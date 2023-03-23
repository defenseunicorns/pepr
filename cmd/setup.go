// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"github.com/defenseunicorns/pepr/pkg/setup"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/cobra"
)

func init() {
	var dir string
	var setupCmd = &cobra.Command{
		Use:   "setup",
		Short: "Setup the Pepr environment for development.",
		Run: func(cmd *cobra.Command, args []string) {
			if err := setup.SyncSDK(dir); err != nil {
				message.Fatalf(err, "Failed to finish env setup.")
			}
		},
	}

	setupCmd.Flags().StringVarP(&dir, "dir", "d", "", "The directory to setup the pepr env in. (default is the current directory).")
	rootCmd.AddCommand(setupCmd)
}
