// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// setup package generates the boilerplate for a new capability or set of capabilities.
package setup

import (
	"fmt"
)

func gitIgnoreTemplate() []byte {
	text := `# Gitignore created by Pepr
# Ignore the sdk folder, use "pepr setup" command to recreate
sdk/

# Ignore node_modules directory
node_modules/

# Ignore compiled JavaScript files
*.js

# Ignore source map files
*.map

# Ignore TypeScript declaration files
*.d.ts

# Ignore editor-specific files
.vscode/
.idea/

# Ignore OS-specific files
.DS_Store
Thumbs.db
`
	return []byte(text)
}

func entryTemplate(name string) []byte {
	text := fmt.Sprintf("// Pepr Capability: %s\nimport Pepr from '@pepr';", name)
	return []byte(text)
}
