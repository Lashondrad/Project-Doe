/**
 * Pure function: form answers -> risk flag result. No I/O.
 * Must be called SERVER-SIDE on submission (client-side running of this same
 * logic is fine for UX hinting, but never trusted — see
 * lib/booking-engine/CLAUDE.md rule 4).
 *
 * A field is high-risk if its schema definition marks `high_risk_if` and the
 * client's answer matches that trigger value. Per spec: a high-risk answer
 * never blocks submission — it flags the resulting appointment as
 * "needs_review" instead of auto-confirming.
 */

export type FormFieldDef = {
  key: string;
  label: string;
  type: "yes_no" | "text";
  /** For yes_no fields: which boolean value is the risk trigger. Omit for non-risk fields. */
  highRiskIf?: boolean;
};

export type FormAnswer = {
  key: string;
  value: boolean | string;
};

export type RiskFlagResult = {
  flagged: boolean;
  flaggedFields: string[];
};

export function evaluateRisk(fields: FormFieldDef[], answers: FormAnswer[]): RiskFlagResult {
  const answerByKey = new Map(answers.map((a) => [a.key, a.value]));
  const flaggedFields: string[] = [];

  for (const field of fields) {
    if (field.highRiskIf === undefined) continue;
    const answer = answerByKey.get(field.key);
    if (typeof answer === "boolean" && answer === field.highRiskIf) {
      flaggedFields.push(field.key);
    }
  }

  return { flagged: flaggedFields.length > 0, flaggedFields };
}

/**
 * Default pre-screening field set matching the spec. Seeded into the `forms`
 * table (see supabase/seed.sql) — this constant exists mainly for reference
 * and for the seed script, not for the app to import at runtime (the live
 * schema is data-driven from the `forms.fields` jsonb column so admins can
 * reconfigure it without a deploy).
 */
export const DEFAULT_PRESCREENING_FIELDS: FormFieldDef[] = [
  { key: "pregnant_or_nursing", label: "Are you currently pregnant or nursing?", type: "yes_no", highRiskIf: true },
  { key: "diabetes", label: "Do you have diabetes?", type: "yes_no", highRiskIf: true },
  { key: "blood_thinners", label: "Are you currently taking blood thinners?", type: "yes_no", highRiskIf: true },
  { key: "keloid_history", label: "Do you have a history of keloid scarring?", type: "yes_no", highRiskIf: true },
  { key: "autoimmune_condition", label: "Do you have an autoimmune condition?", type: "yes_no", highRiskIf: true },
  { key: "recent_botox_fillers", label: "Have you had Botox or fillers in the last 4 weeks?", type: "yes_no", highRiskIf: true },
  { key: "recent_peel_laser", label: "Have you had a chemical peel or laser treatment in the last 4 weeks?", type: "yes_no", highRiskIf: true },
  { key: "skin_irritation", label: "Do you have any skin irritation near the treatment area?", type: "yes_no", highRiskIf: true },
  { key: "allergies", label: "List any known allergies.", type: "text" },
  { key: "medications", label: "List any medications you're currently taking.", type: "text" },
];

/**
 * Previous-ink questionnaire — a standalone form category (form_category
 * 'ink_history'), deliberately separate from medical pre-screening per
 * studio direction. Never triggers a risk flag on its own (see
 * create_booking()'s ink-history insert, which always passes
 * flagged_high_risk = false) — it's history, not a safety screen.
 */
export const DEFAULT_INK_HISTORY_FIELDS: FormFieldDef[] = [
  { key: "has_previous_tattoo_or_pmu", label: "Have you had a previous tattoo or PMU procedure?", type: "yes_no" },
  { key: "previous_location", label: "Where on your body was it (if applicable)?", type: "text" },
  { key: "previous_when", label: "Approximately when was it done?", type: "text" },
  { key: "previous_studio_artist", label: "Studio or artist name, if known.", type: "text" },
  { key: "previous_reactions", label: "Did you have any reactions or complications?", type: "yes_no" },
  { key: "previous_reactions_detail", label: "If yes, please describe.", type: "text" },
  { key: "is_same_treatment_area", label: "Is this previous work in the same area you're booking for today?", type: "yes_no" },
];
