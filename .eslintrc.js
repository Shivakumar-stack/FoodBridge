module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: "eslint:recommended",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  globals: {
    authService: "readonly",
    apiService: "readonly",
    donationService: "readonly",
    contactService: "readonly",
    ui: "readonly",
    navigation: "readonly",
    AuthGuard: "readonly",
    L: "readonly",
    io: "readonly",
    formValidation: "readonly",
    Chart: "readonly",
  },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["frontend/dashboard-unified/**/*.js"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    {
      files: ["frontend/utils/services.js"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  ],
};
