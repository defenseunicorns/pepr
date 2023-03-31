// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package hooks provides HTTP handlers for the mutating webhook.
package hooks

import (
	"github.com/defenseunicorns/pepr/pkg/webhook/operations"
)

// BindHooks creates a new instance of the mutation hook.
func BindHooks() operations.Hook {
	return operations.Hook{
		Create: create,
		Update: update,
		Delete: delete,
	}
}
