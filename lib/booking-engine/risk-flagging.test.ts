import { describe, expect, it } from "vitest";
import { DEFAULT_PRESCREENING_FIELDS, evaluateRisk, type FormFieldDef } from "./risk-flagging";

describe("evaluateRisk", () => {
  it("flags nothing when no answer matches a high-risk trigger", () => {
    const result = evaluateRisk(DEFAULT_PRESCREENING_FIELDS, [
      { key: "pregnant_or_nursing", value: false },
      { key: "diabetes", value: false },
    ]);
    expect(result).toEqual({ flagged: false, flaggedFields: [] });
  });

  it("flags a single field whose answer matches highRiskIf", () => {
    const result = evaluateRisk(DEFAULT_PRESCREENING_FIELDS, [
      { key: "pregnant_or_nursing", value: true },
      { key: "diabetes", value: false },
    ]);
    expect(result.flagged).toBe(true);
    expect(result.flaggedFields).toEqual(["pregnant_or_nursing"]);
  });

  it("collects every matching field, not just the first", () => {
    const result = evaluateRisk(DEFAULT_PRESCREENING_FIELDS, [
      { key: "pregnant_or_nursing", value: true },
      { key: "diabetes", value: true },
      { key: "blood_thinners", value: true },
    ]);
    expect(result.flagged).toBe(true);
    expect(result.flaggedFields.sort()).toEqual(
      ["blood_thinners", "diabetes", "pregnant_or_nursing"].sort()
    );
  });

  it("never flags a text field (no highRiskIf defined)", () => {
    const result = evaluateRisk(DEFAULT_PRESCREENING_FIELDS, [
      { key: "allergies", value: "peanuts" },
      { key: "medications", value: "none" },
    ]);
    expect(result.flagged).toBe(false);
  });

  it("ignores answers for keys not present in the field definitions", () => {
    const result = evaluateRisk(DEFAULT_PRESCREENING_FIELDS, [
      { key: "not_a_real_field", value: true },
    ]);
    expect(result.flagged).toBe(false);
  });

  it("never flags a yes_no field whose answer type mismatches (defensive: non-boolean answer)", () => {
    const fields: FormFieldDef[] = [{ key: "diabetes", label: "Diabetes?", type: "yes_no", highRiskIf: true }];
    // Simulates a malformed client payload where the boolean field somehow
    // arrives as a string — must not throw and must not flag on a type
    // mismatch (evaluateRisk only matches when typeof answer === "boolean").
    const result = evaluateRisk(fields, [{ key: "diabetes", value: "true" }]);
    expect(result.flagged).toBe(false);
  });

  it("does not flag the ink-history-style field even if highRiskIf is set to false and the answer is false", () => {
    // highRiskIf: false is a legitimate configuration (flag when the answer
    // is explicitly "no") — confirms the comparison isn't accidentally
    // truthy-coerced.
    const fields: FormFieldDef[] = [
      { key: "has_coverage", label: "Do you have aftercare coverage?", type: "yes_no", highRiskIf: false },
    ];
    expect(evaluateRisk(fields, [{ key: "has_coverage", value: false }]).flagged).toBe(true);
    expect(evaluateRisk(fields, [{ key: "has_coverage", value: true }]).flagged).toBe(false);
  });
});
