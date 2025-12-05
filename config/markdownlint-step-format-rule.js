const IGNORED_FILES = ["BACKWARDS_COMPATABILITY.md", "CODE-OF-CONDUCT.md"];

module.exports = {
  names: ["step-format"],
  description: "All step references must follow '### Step X: Title' format",
  tags: ["headers", "steps"],
  function: function rule(params, onError) {
    const fileName = params.name;

    // Skip ignored files
    const shouldIgnore = IGNORED_FILES.some(
      ignoredFile => fileName.endsWith(ignoredFile) || fileName.includes(ignoredFile),
    );
    if (shouldIgnore) return;

    // Strict valid step format with capital 'S'
    const validStepRegex = /^###\s+Step\s+\d+:\s+.+$/;

    // Inline bold/italic like "*Step 1*" — but NOT bullet lists
    const inlineStepRegex = /(\*{1,2})(?!\s)([^*]*\bStep\s+\d+\b[^*]*)\1/;

    params.lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const lineNumber = index + 1;

      // Valid header — skip checks
      if (validStepRegex.test(trimmedLine)) return;

      // Wrong header levels with Step — only H3 allowed
      if (/^#{1,2}\s+Step\s+\d+/.test(trimmedLine) || /^#{4,6}\s+Step\s+\d+/.test(trimmedLine)) {
        onError({
          lineNumber,
          detail: "Steps must use H3 (###), not other heading levels",
          context: trimmedLine,
        });
        return;
      }

      // Numbered headers like "### 1." — forbidden
      if (/^###\s+\d+(\.|:)/.test(trimmedLine)) {
        onError({
          lineNumber,
          detail: "Use '### Step X: Title' instead of numbered headers",
          context: trimmedLine,
        });
        return;
      }

      // Inline bold/italic step references — not allowed
      if (inlineStepRegex.test(trimmedLine)) {
        onError({
          lineNumber,
          detail: "Steps must be headers (### Step X: Title), not bold/italic text",
          context: trimmedLine,
        });
        return;
      }

      // Generic malformed step references
      if (/\bstep\s+\d+\b/i.test(trimmedLine)) {
        onError({
          lineNumber,
          detail: "Must use format: '### Step X: Title'",
          context: trimmedLine,
        });
        return;
      }
    });
  },
};
