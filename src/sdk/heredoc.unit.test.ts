import { describe, expect, it } from "vitest";
import { heredoc } from "./heredoc";

describe("heredoc", () => {
  it("trims head/tail empty lines & de-indents", () => {
    const actual = heredoc`
      ---
      indented:
        like:
        - yaml
    `;
    const expected = `---
indented:
  like:
  - yaml`;

    expect(actual).toBe(expected);
  });
});
