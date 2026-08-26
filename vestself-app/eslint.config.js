export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly", navigator: "readonly",
        console: "readonly", setTimeout: "readonly", setInterval: "readonly", crypto: "readonly",
        FileReader: "readonly", Image: "readonly", Blob: "readonly", File: "readonly", URL: "readonly",
        location: "readonly", FormData: "readonly", fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
