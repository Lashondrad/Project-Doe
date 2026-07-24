import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Slot availability computation. This is ADVISORY for the UI only — the
 * database exclusion constraint on `appointments` is the final authority at
 * booking time. A slot returned here can still be rejected as SLOT_UNAVAILABLE
 * if another client books it first (see lib/booking-engine/CLAUDE.md rule 2).
 *
 * All internal math is done with plain UTC Date arithmetic. Studio timezone
 * conversion happens only when formatting for display (see lib/timezone.ts).
 */

export type Slot = {
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
};

export type AvailabilityResult =
  | { status: "ok"; slots: Slot[] }
  | { status: "no_rules_configured" }
  | { status: "closed"; reason: string };

const SLOT_GRANULARITY_MINUTES = 15;

export async function getAvailableSlots(params: {
  serviceId: string;
  staffId: string;
  /** yyyy-mm-dd in the studio's local timezone */
  date: string;
  studioTimezoneOffsetMinutes: number; // e.g. -300 for US Central during CDT; loaded from settings
}): Promise<AvailabilityResult> {
  const supabase = createAdminClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .eq("id", params.serviceId)
    .eq("active", true)
    .single();

  if (serviceError || !service) {
    return { status: "closed", reason: "Service not found or inactive." };
  }

  const weekday = new Date(`${params.date}T00:00:00Z`).getUTCDay();

  const { data: overrides } = await supabase
    .from("availability_overrides")
    .select("*")
    .eq("staff_id", params.staffId)
    .eq("date", params.date)
    .maybeSingle();

  if (overrides?.is_closed) {
    return { status: "closed", reason: overrides.note ?? "Closed on this date." };
  }

  const { data: rules } = await supabase
    .from("availability_rules")
    .select("*")
    .eq("staff_id", params.staffId)
    .eq("weekday", weekday)
    .eq("active", true);

  if (!rules || rules.length === 0) {
    // Explicit "not configured" result, per lib/booking-engine/CLAUDE.md rule 5 —
    // never silently default to "always open."
    return { status: "no_rules_configured" };
  }

  const firstRule = rules[0];
  if (!firstRule) {
    return { status: "no_rules_configured" };
  }
  const windowStart = overrides?.start_time ?? firstRule.start_time;
  const windowEnd = overrides?.end_time ?? firstRule.end_time;

  const dayStartUtc = localTimeToUtc(params.date, windowStart, params.studioTimezoneOffsetMinutes);
  const dayEndUtc = localTimeToUtc(params.date, windowEnd, params.studioTimezoneOffsetMinutes);

  const { data: blocked } = await supabase
    .from("blocked_time")
    .select("starts_at, ends_at")
    .eq("staff_id", params.staffId)
    .lt("starts_at", dayEndUtc.toISOString())
    .gt("ends_at", dayStartUtc.toISOString());

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("buffer_starts_at, buffer_ends_at")
    .eq("staff_id", params.staffId)
    .not("status", "in", "(cancelled,no_show)")
    .lt("buffer_starts_at", dayEndUtc.toISOString())
    .gt("buffer_ends_at", dayStartUtc.toISOString());

  const busyRanges: Array<[Date, Date]> = [
    ...(blocked ?? []).map((b): [Date, Date] => [new Date(b.starts_at), new Date(b.ends_at)]),
    ...(existingAppointments ?? []).map(
      (a): [Date, Date] => [new Date(a.buffer_starts_at), new Date(a.buffer_ends_at)]
    ),
  ];

  const totalDurationMs =
    (service.duration_minutes + service.buffer_before_minutes + service.buffer_after_minutes) *
    60_000;

  const minStart = new Date(Date.now() + service.min_advance_hours * 3_600_000);
  const maxStart = new Date(Date.now() + service.max_advance_days * 86_400_000);

  const slots: Slot[] = [];
  const stepMs = SLOT_GRANULARITY_MINUTES * 60_000;

  for (
    let candidateStart = new Date(dayStartUtc);
    candidateStart.getTime() + totalDurationMs <= dayEndUtc.getTime();
    candidateStart = new Date(candidateStart.getTime() + stepMs)
  ) {
    if (candidateStart < minStart || candidateStart > maxStart) continue;

    const bufferStart = new Date(
      candidateStart.getTime() - service.buffer_before_minutes * 60_000
    );
    const serviceEnd = new Date(candidateStart.getTime() + service.duration_minutes * 60_000);
    const bufferEnd = new Date(serviceEnd.getTime() + service.buffer_after_minutes * 60_000);

    const overlaps = busyRanges.some(
      ([busyStart, busyEnd]) => bufferStart < busyEnd && bufferEnd > busyStart
    );
    if (overlaps) continue;

    slots.push({ startsAt: candidateStart.toISOString(), endsAt: serviceEnd.toISOString() });
  }

  return { status: "ok", slots };
}

function localTimeToUtc(date: string, time: string, offsetMinutes: number): Date {
  // date: "yyyy-mm-dd", time: "HH:mm:ss" in studio-local time.
  // offsetMinutes: studio local offset from UTC (e.g. US Central standard = -360).
  const naiveUtc = new Date(`${date}T${time}Z`);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}
