import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const [{ data: today }, { data: pendingDeposits }, { data: incompleteForms }, { data: needsReview }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(name), clients(full_name)")
        .gte("starts_at", startOfToday.toISOString())
        .lt("starts_at", endOfToday.toISOString())
        .order("starts_at"),
      supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .eq("status", "deposit_pending")
        .order("starts_at"),
      supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .eq("status", "form_incomplete")
        .order("starts_at"),
      supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .eq("status", "needs_review")
        .order("starts_at"),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl italic text-charcoal">Today</h1>

      <Section title="Today's sessions" empty="No sessions scheduled today.">
        {(today ?? []).map((a) => (
          <AppointmentRow
            key={a.id}
            time={new Date(a.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            client={a.clients?.full_name}
            service={a.services?.name}
            status={a.status}
          />
        ))}
      </Section>

      <Section title="Needs review" empty="Nothing flagged for review.">
        {(needsReview ?? []).map((a) => (
          <AppointmentRow
            key={a.id}
            time={new Date(a.starts_at).toLocaleDateString()}
            client={a.clients?.full_name}
            status={a.status}
          />
        ))}
      </Section>

      <Section title="Pending deposits" empty="No pending deposits.">
        {(pendingDeposits ?? []).map((a) => (
          <AppointmentRow
            key={a.id}
            time={new Date(a.starts_at).toLocaleDateString()}
            client={a.clients?.full_name}
            status={a.status}
          />
        ))}
      </Section>

      <Section title="Incomplete forms" empty="No incomplete forms.">
        {(incompleteForms ?? []).map((a) => (
          <AppointmentRow
            key={a.id}
            time={new Date(a.starts_at).toLocaleDateString()}
            client={a.clients?.full_name}
            status={a.status}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <h2 className="mb-3 font-display text-lg text-charcoal">{title}</h2>
      {hasChildren ? (
        <div className="card divide-y divide-silver/30">{children}</div>
      ) : (
        <div className="card p-4 text-sm text-charcoal/50">{empty}</div>
      )}
    </section>
  );
}

function AppointmentRow({
  time,
  client,
  service,
  status,
}: {
  time: string;
  client?: string;
  service?: string;
  status: Parameters<typeof StatusBadge>[0]["status"];
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-charcoal">{client ?? "Unknown client"}</p>
        <p className="text-xs text-charcoal/50">
          {time}
          {service ? ` · ${service}` : ""}
        </p>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}
