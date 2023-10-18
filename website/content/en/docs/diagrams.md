---
title: Mermaid Diagram Samples
description: Mermaid
---
<!-- 
In certain instances a markdown viewer may not display due to
the '---' frontmatter block above. If you're one of those edge
cases enclose the frontmatter at the top of this file entirely
within a comment block just like this comment.
-->

```mermaid
graph TD
  Start --> Need{"Hugo version >= 0.93.0"}
  Need -- No --> Off["Set params.mermaid.enable = true"]
  Off --> Author
  Need -- Yes --> Author[Insert mermaid codeblock]
```
