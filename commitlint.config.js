module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    // prevent header-max-length error on long, dependabot-gen'd commits titles
    //  https://github.com/dependabot/dependabot-core/issues/2445
    (message) => /^chore: bump .+ from .+ to .+$/m.test(message)
  ],
};
