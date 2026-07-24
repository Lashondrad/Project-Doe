import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // See tests/setup/server-only-stub.ts for why this alias exists.
      "server-only": fileURLToPath(new URL("./tests/setup/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    // Integration tests share one real Postgres instance and insert/clean up
    // real rows — running test files in parallel risks cross-file
    // interference (e.g. one file's exclusion-constraint probe racing
    // another file's availability window). Serial execution trades speed
    // for correctness, which is the right trade at this suite's size.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
