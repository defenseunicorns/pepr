// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"github.com/spf13/cobra"

	"github.com/defenseunicorns/pepr/pkg/webhook"
)

var internalCmd = &cobra.Command{
	Use:    "internal",
	Short:  "Internal commands for Pepr",
	Hidden: true,
}

// buildCmd represents the build command
var internalStartWebhook = &cobra.Command{
	Use:   "start-webhook",
	Short: "Start the webhook server",
	Run: func(cmd *cobra.Command, args []string) {
		webhook.StartWebhook()
	},
}

func init() {
	rootCmd.AddCommand(internalCmd)
	internalCmd.AddCommand(internalStartWebhook)
}
