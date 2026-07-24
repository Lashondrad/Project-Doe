import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Root CLAUDE.md: "Age is a hard gate, not a soft flag... enforced twice
 * independently: the clients_must_be_18_or_older CHECK constraint (0004
 * migration) and create_booking()'s explicit check." create_booking()
 * itself doesn't exist in this repo yet (see repo-organization notes), so
 * this test proves the half of the guarantee that does exist right now: the
 * DB CHECK constraint rejects an under-18 client at the schema level,
 * independent of any application code.
 */
describe("clients.date_of_birth 18+ CHECK constraint (0004_consent_photo_intake.sql)", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  it("rejects a client whose date of birth is under 18 years ago", async () => {
    const supabase = createAdminClient();
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setUTCFullYear(seventeenYearsAgo.getUTCFullYear() - 17);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: "Underage Test Client",
        email: `underage-${crypto.randomUUID()}@example.test`,
        phone: "555-0100",
        date_of_birth: seventeenYearsAgo.toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514"); // check_violation
    expect(data).toBeNull();
  });

  it("rejects a client whose date of birth is exactly one day short of 18", async () => {
    const supabase = createAdminClient();
    const almostEighteen = new Date();
    almostEighteen.setUTCFullYear(almostEighteen.getUTCFullYear() - 18);
    almostEighteen.setUTCDate(almostEighteen.getUTCDate() + 1); // one day short of the 18-year mark

    const { error } = await supabase.from("clients").insert({
      full_name: "One Day Short Client",
      email: `almost18-${crypto.randomUUID()}@example.test`,
      phone: "555-0100",
      date_of_birth: almostEighteen.toISOString().slice(0, 10),
    });

    expect(error?.code).toBe("23514");
  });

  it("accepts a client who turns 18 exactly today", async () => {
    const supabase = createAdminClient();
    const eighteenToday = new Date();
    eighteenToday.setUTCFullYear(eighteenToday.getUTCFullYear() - 18);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: "Exactly 18 Today Client",
        email: `exactly18-${crypto.randomUUID()}@example.test`,
        phone: "555-0100",
        date_of_birth: eighteenToday.toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data) cleanup.push(async () => void (await supabase.from("clients").delete().eq("id", data.id)));
  });
});
