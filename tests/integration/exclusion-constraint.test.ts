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
 * Root CLAUDE.md rule 1: "The database is the source of truth for booking
 * safety, not application code." This test never calls any app-layer
 * booking function (there isn't one yet — see repo-organization notes) — it
 * inserts directly against `appointments` via the real Postgres exclusion
 * constraint defined in supabase/migrations/0001_init.sql, proving the DB
 * itself rejects an overlapping booking regardless of what application code
 * does or doesn't check first.
 */
describe("appointments double-booking exclusion constraint", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  it("rejects a second appointment that overlaps an existing one for the same staff", async () => {
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));

    const start = new Date(Date.now() + 7 * 86_400_000);
    start.setUTCHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);

    const first = await createAppointment({
      clientId,
      serviceId,
      staffId,
      startsAt: start,
      endsAt: end,
    });
    expect(first.error).toBeNull();
    expect(first.data?.id).toBeTruthy();
    if (first.data) cleanup.push(() => deleteAppointment(first.data!.id));

    const overlapStart = new Date(start.getTime() + 30 * 60_000); // starts mid-way through the first
    const overlapEnd = new Date(overlapStart.getTime() + 60 * 60_000);

    const second = await createAppointment({
      clientId,
      serviceId,
      staffId,
      startsAt: overlapStart,
      endsAt: overlapEnd,
    });

    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("23P01"); // Postgres exclusion_violation
    expect(second.data).toBeNull();
  });

  it("allows a second, non-overlapping appointment for the same staff", async () => {
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));

    const start = new Date(Date.now() + 8 * 86_400_000);
    start.setUTCHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);

    const first = await createAppointment({ clientId, serviceId, staffId, startsAt: start, endsAt: end });
    expect(first.error).toBeNull();
    if (first.data) cleanup.push(() => deleteAppointment(first.data!.id));

    const secondStart = new Date(end.getTime() + 60_000); // starts 1 min after the first ends
    const secondEnd = new Date(secondStart.getTime() + 60 * 60_000);
    const second = await createAppointment({
      clientId,
      serviceId,
      staffId,
      startsAt: secondStart,
      endsAt: secondEnd,
    });
    expect(second.error).toBeNull();
    if (second.data) cleanup.push(() => deleteAppointment(second.data!.id));
  });

  it("allows overlapping ranges for two different staff members", async () => {
    const staffA = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffA));
    const staffB = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffB));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));

    const start = new Date(Date.now() + 9 * 86_400_000);
    start.setUTCHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);

    const a = await createAppointment({ clientId, serviceId, staffId: staffA, startsAt: start, endsAt: end });
    expect(a.error).toBeNull();
    if (a.data) cleanup.push(() => deleteAppointment(a.data!.id));

    const b = await createAppointment({ clientId, serviceId, staffId: staffB, startsAt: start, endsAt: end });
    expect(b.error).toBeNull();
    if (b.data) cleanup.push(() => deleteAppointment(b.data!.id));
  });

  it("a cancelled appointment does not block a new overlapping booking (exclusion constraint's own WHERE clause)", async () => {
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));
    const supabase = createAdminClient();

    const start = new Date(Date.now() + 10 * 86_400_000);
    start.setUTCHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);

    const first = await createAppointment({ clientId, serviceId, staffId, startsAt: start, endsAt: end });
    expect(first.error).toBeNull();
    if (first.data) cleanup.push(() => deleteAppointment(first.data!.id));

    const { error: cancelError } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", first.data!.id);
    expect(cancelError).toBeNull();

    const second = await createAppointment({ clientId, serviceId, staffId, startsAt: start, endsAt: end });
    expect(second.error).toBeNull();
    if (second.data) cleanup.push(() => deleteAppointment(second.data!.id));
  });
});
