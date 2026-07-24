import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";

/**
 * SECRET KEY CLIENT — bypasses RLS entirely (BYPASSRLS Postgres attribute).
 * See lib/env.ts for the key-naming migration note (secret key replaces the
 * legacy service_role key).
 *
 * Import this ONLY from:
 *   - app/api/** route handlers
 *   - server actions
 *   - server-only lib files (this folder)
 *
 * Never import from a "use client" component or anything that could end up
 * in a client bundle. The `server-only` import above throws a build error
 * if this file is accidentally pulled into client code — do not remove it.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
