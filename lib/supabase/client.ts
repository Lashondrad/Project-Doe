"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Browser client — uses the publishable key (formerly "anon" key) + RLS.
 * Note: this file intentionally does NOT import lib/env.ts, which is
 * marked `server-only` and would break the client bundle. NEXT_PUBLIC_*
 * vars are inlined at build time regardless, so the duplication here is
 * small and deliberate rather than a DRY violation worth fixing.
 *
 * Used only for reading auth state client-side; the actual sign-in call is
 * routed through app/api/auth/login (server-side, rate-limited) rather than
 * called directly from this client — see app/admin/login/page.tsx.
 *
 * Do NOT use this to fetch client PII or form responses directly from a
 * Client Component (see app/admin/CLAUDE.md rule 3) — fetch those
 * server-side and pass down.
 */
export function createBrowserSupabaseClient() {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, publishableKey);
}
