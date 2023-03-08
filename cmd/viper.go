// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package cmd contains the CLI commands for pepr.
package cmd

import (
	"os"

	"github.com/defenseunicorns/zarf/src/pkg/message"
	"github.com/spf13/viper"
)

const (
	// Root config keys
	V_LOG_LEVEL = "log_level"
)

func initViper() {
	// Already initialized by some other command
	if v != nil {
		return
	}

	v = viper.New()

	// Specify an alternate config file
	cfgFile := os.Getenv("PEPR_CONFIG")

	// Don't forget to read config either from cfgFile or from home directory!
	if cfgFile != "" {
		// Use config file from the flag.
		v.SetConfigFile(cfgFile)
	} else {
		// Search config paths in the current directory and $HOME/.zarf.
		v.AddConfigPath(".")
		v.AddConfigPath("$HOME/.pepr")
		v.SetConfigName("pepr-config")
	}

	// E.g. PEPR_LOG_LEVEL=debug
	v.SetEnvPrefix("pepr")
	v.AutomaticEnv()

	// Optional, so ignore errors
	err := v.ReadInConfig()

	if err != nil {
		// Config file not found; ignore
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			message.Error(err, "Failed to read config file")
		}
	} else {
		message.Notef("Using config file %s", v.ConfigFileUsed())
	}
}
