import js from "@eslint/js";
import globals from "globals";

export default [
  {
    files: ["torn-fly-cash-reminder.user.js"],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.browser },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { caughtErrors: "none" }],
      eqeqeq: ["error", "smart"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "prefer-const": "error",
      "no-var": "error",
      "no-restricted-properties": ["error",
        { property: "innerHTML", message: "Build DOM with el()/textContent instead." },
        { property: "outerHTML", message: "Build DOM with el()/textContent instead." },
        { property: "insertAdjacentHTML", message: "Build DOM with el()/textContent instead." }],
      "no-restricted-globals": ["error",
        { name: "fetch", message: "This script must make no network requests (Torn rules)." },
        { name: "XMLHttpRequest", message: "This script must make no network requests (Torn rules)." },
        { name: "WebSocket", message: "This script must make no network requests (Torn rules)." }],
    },
  },
];
