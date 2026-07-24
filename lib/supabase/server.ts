import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger/logger";

/**
 * Server Component / Route Handler client — respects the signed-in staff
 * user's session and RLS policies. This is what admin pages/routes should
 * use for reads; use lib/supabase/admin.ts only for the specific writes
 * that legitimately need to bypass RLS (public booking flow).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component with no request context to
          // write to — safe to ignore since proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export type StaffSession = {
  id: string;
  role: "admin" | "staff";
  fullName: string;
};

/**
 * Verifies identity via getClaims() — this decodes and verifies the JWT
 * locally (cached JWKS for asymmetric-signing projects, the default for new
 * Supabase projects) rather than making a network call to the Auth server,
 * which getUser() does. Per current Supabase guidance: use getClaims() for
 * "protect this page/data" checks; reserve getUser() for when you need a
 * guaranteed-fresh user record from the Auth server itself; never rely on
 * getSession()'s embedded user object for authorization.
 *
 * Returns null rather than throwing, so callers decide how to respond
 * (redirect vs 401 JSON) — see requireStaff() / requireStaffApi() below.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;
  const userId = data.claims.sub;

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, role, full_name")
    .eq("id", userId)
    .single();

  if (appUserError || !appUser) return null;

  return { id: appUser.id, role: appUser.role, fullName: appUser.full_name };
}

/** For use in Server Components / layouts — redirects if not staff. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

/** For use in admin API routes — returns null on failure, caller returns 401/403. */
export async function requireStaffApi(): Promise<StaffSession | null> {
  return getStaffSession();
}

export async function requireAdminApi(): Promise<StaffSession | null> {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

/** Request metadata for audit logging — see lib/audit/log.ts. */
export async function getRequestAuditContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  };
}

// Kept as a named export so call sites that genuinely need a fresh,
// Auth-server-confirmed user record (rare — e.g. right after a sensitive
// action like a password change) don't have to reach past this module.
export async function getFreshUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    logger.warn("getUser() failed", { error: error.message });
    return null;
  }
  return data.user;
}
