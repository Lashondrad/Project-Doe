import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Real-data fixture helpers for integration tests — every helper here
 * inserts an actual row via the secret-key admin client against the local
 * Supabase stack (see tests/setup/global-setup.ts). No mocking of Supabase
 * itself; the only thing "faked" is which values go into otherwise-real
 * inserts.
 *
 * Each helper returns the created row's id(s) so tests can clean up in an
 * `afterEach`/`afterAll` — deliberately no blanket TRUNCATE between tests,
 * since that would also wipe supabase/seed.sql's rows that other tests may
 * rely on (seeded services/forms/policies).
 */

export async function createStaffUser(overrides?: { role?: "admin" | "staff"; fullName?: string }) {
  const supabase = createAdminClient();
  const email = `test-staff-${crypto.randomUUID()}@example.test`;
  const password = "Test-Password-1234!";

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(`Failed to create test auth user: ${authError?.message}`);
  }

  const { error: appUserError } = await supabase.from("app_users").insert({
    id: authUser.user.id,
    role: overrides?.role ?? "staff",
    full_name: overrides?.fullName ?? "Test Staff",
  });
  if (appUserError) {
    throw new Error(`Failed to create test app_users row: ${appUserError.message}`);
  }

  return { id: authUser.user.id, email, password };
}

export async function deleteStaffUser(id: string) {
  const supabase = createAdminClient();
  await supabase.from("app_users").delete().eq("id", id);
  await supabase.auth.admin.deleteUser(id);
}

export async function createClient(overrides?: Partial<{
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      full_name: overrides?.fullName ?? "Test Client",
      email: overrides?.email ?? `test-client-${crypto.randomUUID()}@example.test`,
      phone: overrides?.phone ?? "555-0100",
      date_of_birth: overrides?.dateOfBirth ?? "1990-01-01",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create test client: ${error?.message}`);
  return data.id;
}

export async function deleteClient(id: string) {
  const supabase = createAdminClient();
  await supabase.from("clients").delete().eq("id", id);
}

export async function createService(overrides?: Partial<{
  name: string;
  durationMinutes: number;
  priceCents: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
}>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      name: overrides?.name ?? `Test Service ${crypto.randomUUID()}`,
      category: "consultation",
      duration_minutes: overrides?.durationMinutes ?? 60,
      price_cents: overrides?.priceCents ?? 10000,
      buffer_before_minutes: overrides?.bufferBeforeMinutes ?? 0,
      buffer_after_minutes: overrides?.bufferAfterMinutes ?? 0,
      min_advance_hours: overrides?.minAdvanceHours ?? 0,
      max_advance_days: overrides?.maxAdvanceDays ?? 365,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create test service: ${error?.message}`);
  return data.id;
}

export async function deleteService(id: string) {
  const supabase = createAdminClient();
  await supabase.from("services").delete().eq("id", id);
}

export async function createAppointment(params: {
  clientId: string;
  serviceId: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  bufferStartsAt?: Date;
  bufferEndsAt?: Date;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      client_id: params.clientId,
      service_id: params.serviceId,
      staff_id: params.staffId,
      starts_at: params.startsAt.toISOString(),
      ends_at: params.endsAt.toISOString(),
      buffer_starts_at: (params.bufferStartsAt ?? params.startsAt).toISOString(),
      buffer_ends_at: (params.bufferEndsAt ?? params.endsAt).toISOString(),
    })
    .select("id")
    .single();
  return { data, error };
}

export async function deleteAppointment(id: string) {
  const supabase = createAdminClient();
  await supabase.from("appointments").delete().eq("id", id);
}
