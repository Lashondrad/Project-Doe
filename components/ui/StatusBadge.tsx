import type { AppointmentStatus } from "@/types/database.types";

/**
 * Renders all seven appointment_status values distinctly (color + label),
 * per app/admin/CLAUDE.md rule 5 — don't invent ad hoc statuses here that
 * don't exist in the DB enum.
 */
const STATUS_STYLES: Record<AppointmentStatus, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-silver/20 text-charcoal" },
  confirmed: { label: "Confirmed", className: "bg-teal/15 text-teal-dark" },
  deposit_pending: { label: "Deposit Pending", className: "bg-amber-100 text-amber-800" },
  form_incomplete: { label: "Form Incomplete", className: "bg-orange-100 text-orange-800" },
  needs_review: { label: "Needs Review", className: "bg-red-100 text-red-700" },
  completed: { label: "Completed", className: "bg-teal-dark/15 text-teal-dark" },
  cancelled: { label: "Cancelled", className: "bg-charcoal/10 text-charcoal/50" },
  no_show: { label: "No Show", className: "bg-red-50 text-red-500" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
