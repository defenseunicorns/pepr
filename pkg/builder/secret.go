// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import (
	"fmt"

	"github.com/defenseunicorns/zarf/src/pkg/message"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

func (b *Build) CreateSecret() error {
	// Calculate a name based on the hash.
	name := fmt.Sprintf("data-%x", b.Hash)

	// Create a new secret for the compressed config data.
	secret := corev1.Secret{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "Secret",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: "pepr-system",
		},
		Data: map[string][]byte{
			"hash": b.Hash[:],
			"sig":  {},
			"data": b.Compressed,
		},
	}

	// Marshal the K8s object into YAML.
	out, err := yaml.Marshal(secret)
	if err != nil {
		return err
	}

	message.Debugf("Secret generated:\n\n%s\n", string(out))

	// Store the secret data in the final output
	b.Output[OutSecret] = out

	return nil
}
