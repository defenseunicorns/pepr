// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// vm package contains the v8go wrapper for running JavaScript code in Zarf.
package vm

import v8 "rogchap.com/v8go"

// Script represents a bundle of JavaScript code that has been compiled
type Script struct {
	path  string
	code  string
	cache *v8.CompilerCachedData
}
