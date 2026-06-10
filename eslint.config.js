import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "companion/dist/**",
      "coverage/**",
      "dist/**",
      "docs/superpowers/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/essential"],
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off",
      "preserve-caught-error": "off",
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
    },
  },
];
