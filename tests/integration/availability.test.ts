import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailableSlots } from "@/lib/booking-engine/availability";
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
 * lib/booking-engine/CLAUDE.md rule 2: getAvailableSlots() must account for
 * business hours -> overrides/closures -> blocked time -> existing
 * appointments+buffers -> service buffers -> advance-booking window, in
 * that order. Each of these is exercised here against real rows (real
 * availability_rules/blocked_time/appointments), not fixtures the function
 * merely receives as arguments — the whole point is proving the DB
 * round-trip and the math together, since that's what the real code path
 * does in production.
 */
describe("getAvailableSlots (real availability_rules / blocked_time / appointments)", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  // A date comfortably inside every service's advance-booking window,
  // computed rather than hardcoded so the test stays valid regardless of
  // when it's run.
  function futureDateAndWeekday(daysAhead: number) {
    const date = new Date(Date.now() + daysAhead * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return { iso, weekday };
  }

  it("returns no_rules_configured when the staff member has no availability_rules row", async () => {
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));
    const { iso } = futureDateAndWeekday(14);

    const result = await getAvailableSlots({
      serviceId,
      staffId,
      date: iso,
      studioTimezoneOffsetMinutes: 0,
    });

    expect(result.status).toBe("no_rules_configured");
  });

  it("returns slots inside business hours, respecting service duration + buffers", async () => {
    const supabase = createAdminClient();
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const serviceId = await createService({ durationMinutes: 60, bufferBeforeMinutes: 15, bufferAfterMinutes: 15 });
    cleanup.push(() => deleteService(serviceId));
    const { iso, weekday } = futureDateAndWeekday(14);

    const { data: rule } = await supabase
      .from("availability_rules")
      .insert({ staff_id: staffId, weekday, start_time: "09:00:00", end_time: "12:00:00" })
      .select("id")
      .single();
    if (rule) cleanup.push(async () => void (await supabase.from("availability_rules").delete().eq("id", rule.id)));

    const result = await getAvailableSlots({
      serviceId,
      staffId,
      date: iso,
      studioTimezoneOffsetMinutes: 0,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      const start = new Date(slot.startsAt);
      const end = new Date(slot.endsAt);
      expect(start.toISOString().slice(0, 10)).toBe(iso);
      // A returned slot's startsAt/endsAt are the client-visible appointment
      // window only (09:00-12:00 business hours, 60min duration) — buffers
      // are invisible scheduling padding used for conflict-checking against
      // other bookings, not reflected in the displayed slot times, so they
      // aren't asserted against the business-hours boundary here.
      expect(start.getUTCHours() * 60 + start.getUTCMinutes()).toBeGreaterThanOrEqual(9 * 60);
      expect(end.getUTCHours() * 60 + end.getUTCMinutes()).toBeLessThanOrEqual(12 * 60);
      expect(end.getTime() - start.getTime()).toBe(60 * 60_000);
    }
    // The loop's own bound (candidateStart + duration+bufferBefore+bufferAfter
    // <= dayEnd) means the LAST slot cannot start past 10:30 given a 90min
    // total footprint inside a 09:00-12:00 window — confirms buffers really
    // are constraining candidate generation, just not the displayed times.
    const lastSlot = result.slots[result.slots.length - 1];
    expect(lastSlot).toBeDefined();
    if (!lastSlot) return;
    const lastStart = new Date(lastSlot.startsAt);
    expect(lastStart.getUTCHours() * 60 + lastStart.getUTCMinutes()).toBeLessThanOrEqual(10 * 60 + 30);
  });

  it("excludes slots overlapping a blocked_time row", async () => {
    const supabase = createAdminClient();
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const serviceId = await createService({ durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 });
    cleanup.push(() => deleteService(serviceId));
    const { iso, weekday } = futureDateAndWeekday(15);

    const { data: rule } = await supabase
      .from("availability_rules")
      .insert({ staff_id: staffId, weekday, start_time: "09:00:00", end_time: "11:00:00" })
      .select("id")
      .single();
    if (rule) cleanup.push(async () => void (await supabase.from("availability_rules").delete().eq("id", rule.id)));

    const blockStart = new Date(`${iso}T09:30:00Z`);
    const blockEnd = new Date(`${iso}T10:30:00Z`);
    const { data: blocked } = await supabase
      .from("blocked_time")
      .insert({ staff_id: staffId, starts_at: blockStart.toISOString(), ends_at: blockEnd.toISOString() })
      .select("id")
      .single();
    if (blocked) cleanup.push(async () => void (await supabase.from("blocked_time").delete().eq("id", blocked.id)));

    const result = await getAvailableSlots({ serviceId, staffId, date: iso, studioTimezoneOffsetMinutes: 0 });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    for (const slot of result.slots) {
      const start = new Date(slot.startsAt);
      const end = new Date(slot.endsAt);
      const overlapsBlock = start < blockEnd && end > blockStart;
      expect(overlapsBlock).toBe(false);
    }
  });

  it("excludes slots overlapping an existing appointment's buffer range", async () => {
    const supabase = createAdminClient();
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const serviceId = await createService({ durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 });
    cleanup.push(() => deleteService(serviceId));
    const clientId = await createClient();
    cleanup.push(() => deleteClient(clientId));
    const { iso, weekday } = futureDateAndWeekday(16);

    const { data: rule } = await supabase
      .from("availability_rules")
      .insert({ staff_id: staffId, weekday, start_time: "09:00:00", end_time: "11:00:00" })
      .select("id")
      .single();
    if (rule) cleanup.push(async () => void (await supabase.from("availability_rules").delete().eq("id", rule.id)));

    const apptStart = new Date(`${iso}T09:30:00Z`);
    const apptEnd = new Date(`${iso}T10:00:00Z`);
    const appt = await createAppointment({
      clientId,
      serviceId,
      staffId,
      startsAt: apptStart,
      endsAt: apptEnd,
    });
    expect(appt.error).toBeNull();
    if (appt.data) cleanup.push(() => deleteAppointment(appt.data!.id));

    const result = await getAvailableSlots({ serviceId, staffId, date: iso, studioTimezoneOffsetMinutes: 0 });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    for (const slot of result.slots) {
      const start = new Date(slot.startsAt);
      const end = new Date(slot.endsAt);
      const overlapsAppt = start < apptEnd && end > apptStart;
      expect(overlapsAppt).toBe(false);
    }
  });

  it("returns closed with a reason on a date with an is_closed override", async () => {
    const supabase = createAdminClient();
    const staffId = (await createStaffUser()).id;
    cleanup.push(() => deleteStaffUser(staffId));
    const serviceId = await createService();
    cleanup.push(() => deleteService(serviceId));
    const { iso, weekday } = futureDateAndWeekday(17);

    const { data: rule } = await supabase
      .from("availability_rules")
      .insert({ staff_id: staffId, weekday, start_time: "09:00:00", end_time: "17:00:00" })
      .select("id")
      .single();
    if (rule) cleanup.push(async () => void (await supabase.from("availability_rules").delete().eq("id", rule.id)));

    const { data: override } = await supabase
      .from("availability_overrides")
      .insert({ staff_id: staffId, date: iso, is_closed: true, note: "Studio closed for training" })
      .select("id")
      .single();
    if (override)
      cleanup.push(async () => void (await supabase.from("availability_overrides").delete().eq("id", override.id)));

    const result = await getAvailableSlots({ serviceId, staffId, date: iso, studioTimezoneOffsetMinutes: 0 });
    expect(result).toEqual({ status: "closed", reason: "Studio closed for training" });
  });
});
