module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    // prevent header-max-length error on long dependabot commits
    //  https://github.com/dependabot/dependabot-core/issues/2445
    (message) => /^.+: bump .+ from .+ to .+\.$/m.test(message)
  ],
};
