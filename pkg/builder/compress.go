// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// builder package contains the esbuild wrapper for building Pepr capabilities.
package builder

import (
	"bytes"
	"compress/gzip"
	"crypto/sha1"
)

// Compress compresses the build result using gzip.
func (b *Build) Compress() error {
	var buf bytes.Buffer

	// Create a new gzip writer.
	writer := gzip.NewWriter(&buf)

	// Write the byte array to the gzip writer.
	_, err := writer.Write(b.Result.Code)
	if err != nil {
		return err
	}

	// Close the gzip writer to finalize the archive.
	if err := writer.Close(); err != nil {
		return err
	}

	// Write the compressed bytes to the build object and calculate the hash.
	b.Compressed = buf.Bytes()
	b.Hash = sha1.Sum(b.Compressed)

	return nil
}
