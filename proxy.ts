import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (exported function
 * `proxy`, not `middleware`; runs on the Node.js runtime by default now,
 * not Edge-only). This file replaces what used to be middleware.ts.
 *
 * IMPORTANT — per current Supabase guidance: proxy is a network boundary,
 * not an authorization system. It refreshes the session cookie and does a
 * cheap redirect for unauthenticated users, but it is NOT the security
 * boundary. Every admin Server Component/route still calls requireStaff()/
 * requireStaffApi() independently (see lib/supabase/server.ts), and RLS is
 * the final backstop. Never remove those checks on the assumption that
 * proxy already handled it.
 *
 * Uses getClaims() to verify the session — this verifies the JWT locally
 * (via cached JWKS for asymmetric-signing projects) rather than making a
 * network round-trip to the Auth server on every request, which getUser()
 * does. Never trust getSession() alone for authorization decisions; it
 * reads from storage without revalidating.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add logic between createServerClient and getClaims() — a mistake
  // here can cause hard-to-debug random logouts (session cookie desync).
  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsData?.claims);

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = request.nextUrl.pathname === "/admin/login";

  if (isAdminRoute && !isLoginRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isLoginRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // Must return supabaseResponse as-is (or copy its cookies onto a new
  // response) — creating a fresh NextResponse.next() here would drop the
  // refreshed session cookie and desync the browser/server session.
  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
