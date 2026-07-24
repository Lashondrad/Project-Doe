import { execFileSync } from "node:child_process";

/**
 * Vitest globalSetup — does NOT start/stop the local Supabase stack itself
 * (that's `npm run db:start` / `db:stop`, run explicitly by the dev or by
 * CI, so stack lifecycle is visible in its own log output rather than
 * buried inside a test run). This only reads the running stack's real
 * connection info via `supabase status` and exports it as the same env vars
 * the app's own lib/env.ts expects — so tests exercise the exact client
 * factories the app uses, against a real Postgres/Auth/Storage instance,
 * never a mock.
 *
 * Fails fast with a clear message if the stack isn't up — per this
 * project's own "no silent fallback" rule (lib/booking-engine/CLAUDE.md #5),
 * applied here to test tooling: don't let tests quietly run against nothing
 * and fail with confusing connection-refused errors one file at a time.
 */
export default function globalSetup() {
  let statusJson: string;
  try {
    statusJson = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Local Supabase stack isn't running. Run `npm run db:start` first (requires Docker) — " +
        "these tests hit a real Postgres/Auth/Storage instance, not a mock."
    );
  }

  const status = JSON.parse(statusJson) as Record<string, string>;

  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
  process.env.SUPABASE_SECRET_KEY = status.SECRET_KEY;
  process.env.SUPABASE_TEST_DB_URL = status.DB_URL;
}
