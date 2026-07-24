import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Root CLAUDE.md: "marketing_consent is the only category ever allowed to
 * be required = false... don't work around them by inserting a new
 * category." Both CHECK constraints from 0004_consent_photo_intake.sql are
 * exercised directly here — this is exactly the kind of dark-pattern-proof
 * schema design the migration's own comments describe, verified against a
 * real Postgres instance rather than assumed from reading the SQL.
 */
describe("policies category/required CHECK constraints (0004_consent_photo_intake.sql)", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  it("rejects marketing_consent marked required (must stay optional)", async () => {
    const supabase = createAdminClient();
    const { error } = await supabase.from("policies").insert({
      title: "Bad Marketing Policy",
      body: "test",
      category: "marketing_consent",
      required: true,
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects a non-marketing category marked optional (must stay required)", async () => {
    const supabase = createAdminClient();
    for (const category of ["studio_policy", "medical_consent", "photo_release"] as const) {
      const { error } = await supabase.from("policies").insert({
        title: `Bad ${category} Policy`,
        body: "test",
        category,
        required: false,
      });
      expect(error?.code, `category=${category} required=false should be rejected`).toBe("23514");
    }
  });

  it("accepts marketing_consent as optional", async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("policies")
      .insert({ title: "Marketing Opt-In", body: "test", category: "marketing_consent", required: false })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) cleanup.push(async () => void (await supabase.from("policies").delete().eq("id", data.id)));
  });

  it("accepts every non-marketing category as required", async () => {
    const supabase = createAdminClient();
    for (const category of ["studio_policy", "medical_consent", "photo_release"] as const) {
      const { data, error } = await supabase
        .from("policies")
        .insert({ title: `${category} policy`, body: "test", category, required: true })
        .select("id")
        .single();
      expect(error, `category=${category} required=true should succeed`).toBeNull();
      if (data) cleanup.push(async () => void (await supabase.from("policies").delete().eq("id", data.id)));
    }
  });
});
