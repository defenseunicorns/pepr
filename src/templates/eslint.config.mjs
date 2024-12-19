import template from "./eslint.config.template.mjs";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      parserOptions: {
        project: [ "src/templates/tsconfig.json" ]
      }
    }
  },
  template
];
