// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Package hooks provides HTTP handlers for the mutating webhook.
package hooks

import (
	"github.com/defenseunicorns/pepr/pkg/webhook/operations"
	"github.com/defenseunicorns/zarf/src/pkg/message"
	v1 "k8s.io/api/admission/v1"
)

func update(r *v1.AdmissionRequest) (*operations.Result, error) {
	message.Debugf("hooks.update(*v1.AdmissionRequest) - %#v , %s/%s: %#v", r.Kind, r.Namespace, r.Name, r.Operation)
	var patchOperations []operations.PatchOperation

	// todo: parse r.Object.Raw and add patchOperations to it

	return &operations.Result{
		Allowed:  true,
		PatchOps: patchOperations,
	}, nil
}
