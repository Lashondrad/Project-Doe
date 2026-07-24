import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function AdminAppointmentsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, services(name), clients(full_name, email, phone)")
    .order("starts_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl italic text-charcoal">Appointments</h1>

      {error && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load appointments.
        </div>
      )}

      {!error && (!appointments || appointments.length === 0) && (
        <div className="card p-8 text-center text-charcoal/50">
          No appointments yet. Once clients start booking, they&apos;ll appear here.
        </div>
      )}

      {appointments && appointments.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-silver-soft text-left text-xs uppercase tracking-wide text-charcoal/50">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver/30">
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-charcoal/70">
                    {new Date(a.starts_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal">{a.clients?.full_name}</td>
                  <td className="px-4 py-3 text-charcoal/70">{a.services?.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-charcoal/70">{a.payment_status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
