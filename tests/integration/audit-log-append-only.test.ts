import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/log";

/**
 * supabase/migrations/0003_audit_compliance.sql: audit_log rows cannot be
 * UPDATEd or DELETEd by anyone, including admins — enforced by a trigger
 * (trg_audit_log_no_update/delete) plus a belt-and-suspenders REVOKE. This
 * test writes a real row via the actual writeAuditLog() the app uses, then
 * tries to mutate it directly with the secret-key admin client (which
 * bypasses RLS entirely) — proving the trigger, not RLS, is what's actually
 * stopping the mutation.
 */
describe("audit_log is append-only (0003_audit_compliance.sql)", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  async function writeTestEntry() {
    const supabase = createAdminClient();
    await writeAuditLog({
      actorId: null,
      action: "test.audit_log_append_only",
      category: "admin_action",
      entityType: "test_entity",
      entityId: crypto.randomUUID(),
      before: { email: "should-be-redacted@example.com", status: "before" },
      after: { status: "after" },
    });

    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "test.audit_log_append_only")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) throw new Error(`Failed to read back written audit_log row: ${error?.message}`);
    return data;
  }

  it("redacts sensitive before/after fields before the row ever reaches the DB", async () => {
    const row = await writeTestEntry();
    // No app-level cleanup possible (append-only) — this row is permanent
    // test residue in the local dev DB, same as any other audit trail entry.
    expect((row.before as Record<string, unknown>).email).toBe("[REDACTED]");
    expect((row.before as Record<string, unknown>).status).toBe("before");
    expect((row.after as Record<string, unknown>).status).toBe("after");
  });

  it("rejects a direct UPDATE against a written row, even via the secret-key admin client", async () => {
    const row = await writeTestEntry();
    const supabase = createAdminClient();

    // audit_log's Update type is `never` by design (types/database.types.ts)
    // — the type system already refuses to let real app code construct this
    // call. This line exists specifically to prove the DB trigger itself
    // (not just TypeScript) rejects the mutation, so it deliberately steps
    // around that guard rather than removing it.
    // @ts-expect-error see comment above
    const { error } = await supabase.from("audit_log").update({ action: "tampered" }).eq("id", row.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("immutable");

    const { data: reread } = await supabase.from("audit_log").select("action").eq("id", row.id).single();
    expect(reread?.action).toBe("test.audit_log_append_only");
  });

  it("rejects a direct DELETE against a written row, even via the secret-key admin client", async () => {
    const row = await writeTestEntry();
    const supabase = createAdminClient();

    const { error } = await supabase.from("audit_log").delete().eq("id", row.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("immutable");

    const { data: reread } = await supabase.from("audit_log").select("id").eq("id", row.id).maybeSingle();
    expect(reread?.id).toBe(row.id);
  });
});
