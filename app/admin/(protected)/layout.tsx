import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/blocked-time", label: "Blocked Time" },
  { href: "/admin/forms", label: "Forms" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate — see app/admin/CLAUDE.md rule 1. This redirects to
  // /admin/login if there's no valid staff session; it is the real gate,
  // not a UX nicety layered on top of client-side checks.
  const session = await requireStaff();

  return (
    <div className="min-h-screen bg-silver-soft">
      <header className="border-b border-silver/50 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="font-display text-lg italic text-charcoal">Studio Admin</p>
          <p className="text-sm text-charcoal/60">
            {session.fullName} · {session.role}
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-card px-3 py-2 text-charcoal/70 hover:bg-white hover:text-teal-dark"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
