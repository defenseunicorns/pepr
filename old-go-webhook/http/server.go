// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package http provides a http server for the webhook.
package http

import (
	"fmt"
	"net/http"

	"github.com/defenseunicorns/pepr/pkg/webhook/hooks"
	"github.com/defenseunicorns/zarf/src/pkg/message"
)

// NewServer creates and return a http.Server.
func NewServer(port string) *http.Server {
	message.Debugf("http.NewServer(%s)", port)

	// Instances hooks
	podsMutation := hooks.BindHooks()

	// Routers
	ah := newAdmissionHandler()
	mux := http.NewServeMux()
	mux.Handle("/healthz", healthz())
	mux.Handle("/mutate", ah.Serve(podsMutation))

	return &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: mux,
	}
}
