import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, email, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl italic text-charcoal">Clients</h1>
      {(!clients || clients.length === 0) && (
        <div className="card p-8 text-center text-charcoal/50">No clients yet.</div>
      )}
      {clients && clients.length > 0 && (
        <div className="card divide-y divide-silver/30">
          {clients.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <p className="text-sm font-medium text-charcoal">{c.full_name}</p>
              <p className="text-xs text-charcoal/50">{c.email} · {c.phone}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-charcoal/40">
        Search, client notes, and data export are planned for the next build pass.
      </p>
    </div>
  );
}
