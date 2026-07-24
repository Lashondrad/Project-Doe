import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAppointment,
  createClient,
  createService,
  createStaffUser,
  deleteAppointment,
  deleteClient,
  deleteService,
  deleteStaffUser,
} from "../setup/fixtures";

/**
 * app/admin/CLAUDE.md rule 4: "Deleting a service with future appointments
 * is blocked, not silently allowed" — via `appointments.service_id
 * references services(id) on delete restrict` in
 * supabase/migrations/0001_init.sql. This proves the FK actually rejects
 * the hard delete at the DB level (not just that the admin UI happens to
 * not expose a delete button — there's no admin CRUD UI yet at all, so this
 * is the only guarantee that currently exists).
 */
describe("services delete-restrict when referenced by an appointment", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  it("rejects a hard delete of a service with a future appointment", async () => {
    const supabase = createAdminClient();
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const serviceId = await createService();

    const start = new Date(Date.now() + 20 * 86_400_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const appt = await createAppointment({ clientId, serviceId, staffId, startsAt: start, endsAt: end });
    expect(appt.error).toBeNull();

    const { error: deleteError } = await supabase.from("services").delete().eq("id", serviceId);
    expect(deleteError).not.toBeNull();
    expect(deleteError?.code).toBe("23503"); // foreign_key_violation

    // Cleanup in dependency order: appointment first, then the service can
    // actually be deleted — proving the restriction lifts once the
    // referencing row is gone, not just that delete always fails.
    if (appt.data) await deleteAppointment(appt.data.id);
    const { error: secondAttempt } = await supabase.from("services").delete().eq("id", serviceId);
    expect(secondAttempt).toBeNull();
  });

  it("allows deactivating (active = false) instead of deleting", async () => {
    const supabase = createAdminClient();
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));

    const { error } = await supabase.from("services").update({ active: false }).eq("id", serviceId);
    expect(error).toBeNull();

    const { data } = await supabase.from("services").select("active").eq("id", serviceId).single();
    expect(data?.active).toBe(false);
  });
});
