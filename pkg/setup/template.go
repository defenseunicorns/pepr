// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"fmt"
)

func tsconfigTemplate() []byte {
	return []byte(`{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@pepr": [".sdk"]
    }
  }
}
`)
}

func entryTemplate(name string) []byte {
	text := fmt.Sprintf("// Pepr Capability: %s\nimport Pepr from '@pepr';", name)

	// Return the text as a byte slice.
	return []byte(text)
}
