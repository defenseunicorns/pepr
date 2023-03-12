// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// vm package contains the v8go wrapper for running JavaScript code in Pepr.
package vm

import "rogchap.com/v8go"

type Script struct {
	path  string
	code  string
	cache *v8go.CompilerCachedData
}
