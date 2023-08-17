const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
  {
    files: ["**/*.{ts,tsx}"],
    ...iTwinPlugin.configs.jsdocConfig,
  },
  {
    rules: {
        "nonblock-statement-body-position": "off",
    }
  }
];
