module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "deps",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
  ignores: [
    // prevent header-max-length error on long, dependabot-gen'd commits titles
    //  https://github.com/dependabot/dependabot-core/issues/2445
    (message) => /^chore: bump .+ from .+ to .+$/m.test(message)
  ],
};
