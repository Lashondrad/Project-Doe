import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

function localSupabaseEnv(): Record<string, string> {
  let statusJson: string;
  try {
    statusJson = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Local Supabase stack isn't running. Run `npm run db:start` first (requires Docker) — " +
        "E2E tests boot a real Next.js server against a real local Supabase instance, not a mock."
    );
  }
  const status = JSON.parse(statusJson) as Record<string, string>;
  function required(key: string): string {
    const value = status[key];
    if (!value) throw new Error(`\`supabase status -o json\` didn't include ${key}`);
    return value;
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: required("API_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required("PUBLISHABLE_KEY"),
    SUPABASE_SECRET_KEY: required("SECRET_KEY"),
  };
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shares one real Supabase/Next server; keep runs deterministic
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build+start, not `next dev` — E2E should exercise real
    // hydration/behavior, and dev-mode's HMR client adds a persistent
    // websocket connection that (at least in this environment) can prevent
    // the page from ever finishing hydration, which has nothing to do with
    // whether the app itself works correctly for a real user.
    command: "npm run build && npm run start -- --port 3100",
    // There's no page at "/" yet (no public booking flow built — see
    // README's Unfinished Placeholders), so it 404s. /admin/login always
    // exists and Playwright's readiness probe accepts 2xx/3xx, so it's a
    // reliable "the server is actually up" signal independent of that gap.
    url: "http://127.0.0.1:3100/admin/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: localSupabaseEnv(),
  },
});
