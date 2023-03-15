// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"fmt"
)

func gitIgnoreTemplate() []byte {
	text := "# Ignore the sdk folder, use `pepr setup` command to recreate\nsdk/\n"
	return []byte(text)
}

func entryTemplate(name string) []byte {
	text := fmt.Sprintf("// Pepr Capability: %s\nimport Pepr from '@pepr';", name)
	return []byte(text)
}
