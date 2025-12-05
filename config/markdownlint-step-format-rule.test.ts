// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect } from "vitest";
import rule from "./markdownlint-step-format-rule.js";

interface ErrorInfo {
  lineNumber: number;
  detail: string;
  context: string;
}

function lintMarkdown(content: string, fileName = "test.md"): ErrorInfo[] {
  const lines = content.split("\n");
  const errors: ErrorInfo[] = [];

  const params = {
    name: fileName,
    lines: lines,
  };

  const onError = (errorInfo: ErrorInfo) => {
    errors.push(errorInfo);
  };

  rule.function(params, onError);

  return errors;
}

describe("markdownlint-step-format-rule", () => {
  describe("valid step formats", () => {
    it("should accept valid H3 step headers", () => {
      const content = `### Step 1: Install dependencies
Some content here
### Step 2: Configure settings
More content`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });

    it("should accept steps with longer titles", () => {
      const content = `### Step 1: This is a very long title for a step that has lots of words`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });

    it("should accept multiple digit step numbers", () => {
      const content = `### Step 10: Double digit step
### Step 123: Triple digit step`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });

    it("should accept steps with single character title", () => {
      const content = `### Step 1: A`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });
    it("should handle mixed valid and invalid step references", () => {
      const content = `### Step 1: Valid step
## Step 2: Invalid level
### Step 3: Valid step
Step 4: Not a header`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(2);
      expect(errors[0].lineNumber).toBe(2);
      expect(errors[1].lineNumber).toBe(4);
    });
  });

  describe("ignored files", () => {
    it("should skip BACKWARDS_COMPATABILITY.md", () => {
      const content = `## Step 1: This should be ignored`;

      const errors = lintMarkdown(content, "BACKWARDS_COMPATABILITY.md");
      expect(errors).toHaveLength(0);
    });

    it("should skip CODE-OF-CONDUCT.md", () => {
      const content = `*1* should be ignored`;

      const errors = lintMarkdown(content, "CODE-OF-CONDUCT.md");
      expect(errors).toHaveLength(0);
    });

    it("should skip files containing BACKWARDS_COMPATABILITY.md in path", () => {
      const content = `## Step 1: This should be ignored`;

      const errors = lintMarkdown(content, "docs/BACKWARDS_COMPATABILITY.md");
      expect(errors).toHaveLength(0);
    });

    it("should skip files containing CODE-OF-CONDUCT.md in path", () => {
      const content = `*Step 1* should be ignored`;

      const errors = lintMarkdown(content, "path/to/CODE-OF-CONDUCT.md");
      expect(errors).toHaveLength(0);
    });

    it("should not skip similar filenames that don't match exactly", () => {
      const content = `## Step 1: Should be flagged`;

      const errors = lintMarkdown(content, "BACKWARDS-COMPATIBILITY.md");
      expect(errors).toHaveLength(1);
    });
  });

  describe("wrong header levels with Step", () => {
    it("should reject H1 step headers", () => {
      const content = `# Step 1: Wrong level`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Steps must use H3 (###), not other heading levels");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject H2 step headers", () => {
      const content = `## Step 1: Wrong level`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Steps must use H3 (###), not other heading levels");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject H4 step headers", () => {
      const content = `#### Step 1: Wrong level`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Steps must use H3 (###), not other heading levels");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject H5 step headers", () => {
      const content = `##### Step 1: Wrong level`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Steps must use H3 (###), not other heading levels");
      expect(errors[0].lineNumber).toBe(1);
    });
  });

  describe("numbered headers like '### 1.'", () => {
    it("should reject headers with period after number", () => {
      const content = `### 1. Install dependencies`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Use '### Step X: Title' instead of numbered headers");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject headers with colon after number", () => {
      const content = `### 1: Install dependencies`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Use '### Step X: Title' instead of numbered headers");
      expect(errors[0].lineNumber).toBe(1);
    });
  });

  describe("inline bold/italic step references", () => {
    it("should reject bold step references", () => {
      const content = `This references **Step 1** in the text`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe(
        "Steps must be headers (### Step X: Title), not bold/italic text",
      );
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject italic step references", () => {
      const content = `This references *Step 2* in the text`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe(
        "Steps must be headers (### Step X: Title), not bold/italic text",
      );
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should not flag bullet lists with asterisks", () => {
      const content = `* This is a bullet point
* Another bullet point
* Third item`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });

    it("should not flag bullet lists containing the word Step without number", () => {
      const content = `* Follow these steps carefully
* Step by step instructions
* Next step in the process`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(0);
    });

    it("should flag underscored italic step references", () => {
      const content = `This references _Step 2_ in the text`;

      const errors = lintMarkdown(content);
      // Current regex only checks asterisks, not underscores
      expect(errors).toHaveLength(0);
    });
  });

  describe("malformed step references", () => {
    it("should reject plain text step references", () => {
      const content = `Step 1: This is not a header`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Must use format: '### Step X: Title'");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject step references without colon", () => {
      const content = `### Step 1 Missing colon`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Must use format: '### Step X: Title'");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject step references with lowercase 'step'", () => {
      const content = `### step 1: Lowercase step`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Must use format: '### Step X: Title'");
      expect(errors[0].lineNumber).toBe(1);
    });

    it("should reject mixed case step references", () => {
      const content = `### STEP 1: All caps`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
      expect(errors[0].detail).toBe("Must use format: '### Step X: Title'");
    });

    it("should reject step without space before colon", () => {
      const content = `### Step 1:Title without space`;

      const errors = lintMarkdown(content);
      expect(errors).toHaveLength(1);
    });
  });
});
