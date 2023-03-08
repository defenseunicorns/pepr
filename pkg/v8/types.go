// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// v8 package contains the v8go wrapper for running JavaScript code in Zarf.
package v8

import "rogchap.com/v8go"

type Script struct {
	path  string
	code  string
	cache *v8go.CompilerCachedData
}
