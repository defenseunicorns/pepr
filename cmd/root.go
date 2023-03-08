// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"os"

	"github.com/defenseunicorns/zarf/src/config"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	logLevel string

	// Viper instance used by the cmd package
	v *viper.Viper
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "pepr",
	Short: "A brief description of your application",
	Long:  ``,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		// Don't add the logo to the help command
		if cmd.Parent() == nil {
			config.SkipLogFile = true
		}
		cliSetup()
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	// Initialize viper
	initViper()

	// Bind root viper entries to cobra flags
	v.SetDefault(V_LOG_LEVEL, "info")

	// Bind root cobra flags
	rootCmd.PersistentFlags().StringVarP(&logLevel, "log-level", "l", v.GetString(V_LOG_LEVEL), "Log level when running Zarf. Valid options are: warn, info, debug, trace")
}

func cliSetup() {
	match := map[string]message.LogLevel{
		"warn":  message.WarnLevel,
		"info":  message.InfoLevel,
		"debug": message.DebugLevel,
		"trace": message.TraceLevel,
	}

	// No log level set, so use the default
	if logLevel != "" {
		if lvl, ok := match[logLevel]; ok {
			message.SetLogLevel(lvl)
			message.Debug("Log level set to " + logLevel)
		} else {
			message.Warn("Invalid log level. Valid options are: warn, info, debug, trace.")
		}
	}
}
