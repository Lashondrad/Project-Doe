import "server-only";

/**
 * Central env accessor — throws a clear error naming the missing variable
 * at import time, rather than letting `undefined` silently flow into a
 * Supabase client constructor (see root CLAUDE.md's env-var test case and
 * README's Test Checklist: "Missing environment variables" row).
 *
 * Supabase key naming migration: prefer the new publishable/secret vars,
 * fall back to the legacy anon/service_role vars if that's all that's set.
 * Both work simultaneously during Supabase's migration window (legacy keys
 * phased out through end of 2026) — do not remove the fallback, and do not
 * add new code that only supports the legacy names. See root CLAUDE.md
 * "Current Standards" and .env.example.
 */

function requireVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireVarWithFallback(
  primaryName: string,
  primaryValue: string | undefined,
  legacyName: string,
  legacyValue: string | undefined
): string {
  if (primaryValue) return primaryValue;
  if (legacyValue) return legacyValue;
  throw new Error(`Missing required environment variable: ${primaryName} (or legacy fallback ${legacyName})`);
}

export const env = {
  supabaseUrl: requireVar("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: requireVarWithFallback(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
  supabaseSecretKey: requireVarWithFallback(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
} as const;
