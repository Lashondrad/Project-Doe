import nextConfig from "eslint-config-next";

// eslint-config-next's default export is already a flat config array as of
// Next 16 (built on typescript-eslint) — no FlatCompat/.extends() shim
// needed. Running it back through @eslint/eslintrc's legacy translator
// crashes ("Converting circular structure to JSON") because the plugin
// objects it now ships (eslint-plugin-react in particular) are flat-native
// and self-referential in a way the legacy schema validator doesn't expect.
const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      "no-console": "error",
    },
  },
  {
    // Sole exception: the structured logger is the one approved console.*
    // call site in the codebase — see lib/logger/logger.ts for why.
    files: ["lib/logger/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;
