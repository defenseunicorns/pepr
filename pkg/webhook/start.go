// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package webhook holds the mutating webhook server.
package webhook

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	agentHttp "github.com/defenseunicorns/pepr/pkg/webhook/http"
	"github.com/defenseunicorns/zarf/src/pkg/message"
)

// Heavily influenced by https://github.com/douglasmakey/admissioncontroller and
// https://github.com/slackhq/simple-kubernetes-webhook

const (
	httpPort = "8443"
	tlsCert  = "/etc/certs/tls.crt"
	tlsKey   = "/etc/certs/tls.key"
)

// StartWebhook launches the mutating webhook in the cluster.
func StartWebhook() {
	server := agentHttp.NewServer(httpPort)
	go func() {
		if err := server.ListenAndServeTLS(tlsCert, tlsKey); err != nil && err != http.ErrServerClosed {
			message.Fatal(err, "Failed to start webhook server")
		}
	}()

	message.Infof("listening on http port %s", httpPort)

	// Listen for the shutdown signal.
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	message.Infof("shutting down webhook server")
	if err := server.Shutdown(context.Background()); err != nil {
		message.Fatal(err, "Failed to shutdown webhook server")
	}
}
