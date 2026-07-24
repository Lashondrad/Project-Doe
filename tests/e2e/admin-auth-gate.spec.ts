import { expect, test } from "@playwright/test";

/**
 * Real end-to-end coverage of the ONE thing that's actually fully built and
 * wired end-to-end right now: the admin auth gate. This drives a real
 * Next.js server (playwright.config.ts's webServer) against a real local
 * Supabase Auth instance — no mocked session, no stubbed middleware.
 *
 * Deliberately NOT covered here: logging in successfully, the booking flow,
 * or anything past the login page. `app/api/auth/login` (the route
 * app/admin/login/page.tsx posts to) and the entire public booking flow
 * don't exist in this repo yet — see the repo-organization notes. Faking a
 * signed-in session by hand-constructing @supabase/ssr cookies would
 * produce a test that looks like it covers login without actually
 * exercising it, which is worse than not having the test. Once
 * app/api/auth/login exists, extend this file with a real
 * fill-the-form-and-submit flow instead of adding fixture cookies.
 */

const PROTECTED_ADMIN_ROUTES = [
  "/admin",
  "/admin/dashboard",
  "/admin/calendar",
  "/admin/availability",
  "/admin/appointments",
  "/admin/clients",
  "/admin/blocked-time",
  "/admin/forms",
  "/admin/policies",
  "/admin/settings",
];

test.describe("unauthenticated admin access", () => {
  for (const route of PROTECTED_ADMIN_ROUTES) {
    test(`${route} redirects to /admin/login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/admin\/login$/);
    });
  }

  test("visiting the same route twice doesn't loop or error (idempotent redirect)", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("/admin/login page", () => {
  test("renders without requiring auth, with the expected form fields", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("submitting the form calls /api/auth/login and surfaces a failure rather than a silent hang", async ({
    page,
  }) => {
    // app/api/auth/login doesn't exist yet, so this currently exercises the
    // client's own error handling (network/404 branch in
    // app/admin/login/page.tsx) rather than a real auth outcome — that's
    // the honest current behavior, not a workaround. Once the route exists,
    // this test should be replaced with a real success-path login.
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill("staff@example.test");
    await page.locator('input[type="password"]').fill("whatever-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator("text=/went wrong|Network error/i")).toBeVisible({ timeout: 10_000 });
    // Must not have silently redirected to the dashboard on a failed/missing login.
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
