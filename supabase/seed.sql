-- ============================================================================
-- seed.sql — example data for local development / demoing.
-- Run after migrations: supabase db reset (applies migrations + this seed)
-- ============================================================================

-- NOTE: app_users.id must reference a real row in auth.users. Create the
-- admin login first via Supabase Auth (dashboard or CLI) — see README
-- "Admin Test Login" — then run:
--   insert into app_users (id, role, full_name)
--   values ('<the-auth-user-uuid>', 'admin', 'Studio Owner');

insert into services (name, category, description, duration_minutes, price_cents, deposit_cents, buffer_before_minutes, buffer_after_minutes, min_advance_hours, max_advance_days, requires_prescreening, requires_policy_agreement, aftercare_instructions, active) values
('Initial Brow PMU', 'initial_session', 'Full microblading/powder brow session for first-time clients.', 120, 45000, 10000, 15, 30, 48, 60, true, true, 'Keep dry for 7 days. Apply healing balm as provided. Avoid sun exposure and makeup on the area for 10 days.', true),
('Brow Touch-Up (4-6 weeks)', 'touch_up', 'Follow-up touch-up session within the standard healing window.', 60, 15000, 5000, 15, 15, 48, 60, true, true, 'Keep dry for 5 days. Apply healing balm as provided.', true),
('Annual Color Boost', 'color_boost', 'Color refresh for clients 6+ months out from initial or last touch-up.', 45, 20000, 5000, 15, 15, 48, 90, true, true, 'Keep dry for 5 days. Apply healing balm as provided.', true),
('Free Consultation', 'consultation', 'In-person consultation to discuss goals, eligibility, and pricing.', 30, 0, 0, 10, 10, 24, 45, false, true, 'N/A', true),
('Removal Consultation', 'removal_consultation', 'Assessment for laser/saline removal candidacy.', 30, 5000, 0, 10, 10, 24, 45, true, true, 'N/A', true),
('Cover-Up Consultation', 'correction_cover_up_consultation', 'Assessment for correcting or covering existing work.', 45, 5000, 0, 15, 15, 48, 45, true, true, 'N/A', true);

-- ----------------------------------------------------------------------------
-- FORMS
-- Medical pre-screening and previous-ink history are deliberately separate
-- forms/categories (form_category), even though the booking UI presents
-- medical pre-screening bundled with the consent step per studio direction.
-- The "under 18" and "consent to policies" questions that used to live here
-- are gone — age is now a hard DB-level gate (clients_must_be_18_or_older,
-- create_booking's P1004 check) and consent is its own explicit checkbox
-- per policy category below, not a form field.
-- ----------------------------------------------------------------------------
insert into forms (name, category, version, is_active, fields) values
('Medical Pre-Screening', 'medical_prescreening', 1, true, '[
  {"key": "pregnant_or_nursing", "label": "Are you currently pregnant or nursing?", "type": "yes_no", "highRiskIf": true},
  {"key": "diabetes", "label": "Do you have diabetes?", "type": "yes_no", "highRiskIf": true},
  {"key": "blood_thinners", "label": "Are you currently taking blood thinners?", "type": "yes_no", "highRiskIf": true},
  {"key": "keloid_history", "label": "Do you have a history of keloid scarring?", "type": "yes_no", "highRiskIf": true},
  {"key": "autoimmune_condition", "label": "Do you have an autoimmune condition?", "type": "yes_no", "highRiskIf": true},
  {"key": "recent_botox_fillers", "label": "Have you had Botox or fillers in the last 4 weeks?", "type": "yes_no", "highRiskIf": true},
  {"key": "recent_peel_laser", "label": "Have you had a chemical peel or laser treatment in the last 4 weeks?", "type": "yes_no", "highRiskIf": true},
  {"key": "skin_irritation", "label": "Do you have any skin irritation near the treatment area?", "type": "yes_no", "highRiskIf": true},
  {"key": "allergies", "label": "List any known allergies.", "type": "text"},
  {"key": "medications", "label": "List any medications you are currently taking.", "type": "text"}
]'::jsonb),
('Previous Ink History', 'ink_history', 1, true, '[
  {"key": "has_previous_tattoo_or_pmu", "label": "Have you had a previous tattoo or PMU procedure?", "type": "yes_no"},
  {"key": "previous_location", "label": "Where on your body was it (if applicable)?", "type": "text"},
  {"key": "previous_when", "label": "Approximately when was it done?", "type": "text"},
  {"key": "previous_studio_artist", "label": "Studio or artist name, if known.", "type": "text"},
  {"key": "previous_reactions", "label": "Did you have any reactions or complications?", "type": "yes_no"},
  {"key": "previous_reactions_detail", "label": "If yes, please describe.", "type": "text"},
  {"key": "is_same_treatment_area", "label": "Is this previous work in the same area you are booking for today?", "type": "yes_no"}
]'::jsonb);

-- ----------------------------------------------------------------------------
-- POLICIES — one row per consent category. studio_policy, medical_consent,
-- and photo_release are all `required = true` (enforced further by the
-- marketing_consent_must_be_optional / non_marketing_consent_must_be_required
-- CHECK constraints in 0004). marketing_consent is the sole optional one.
-- ----------------------------------------------------------------------------
insert into policies (title, body, category, required, version, is_active) values
(
  'Studio Policies',
  'By booking, you confirm the information you provide is accurate to the best of your knowledge. Deposits are non-refundable but transferable to a rescheduled date with at least 48 hours notice. Cancellations within 24 hours of your appointment forfeit the deposit. Results vary by skin type, aftercare compliance, and individual healing. You must be 18 or older to book any service at this studio.',
  'studio_policy', true, 1, true
),
(
  'Informed Consent for Permanent Makeup Procedure',
  'Permanent makeup (PMU) is a form of cosmetic tattooing that implants pigment into the upper layers of the skin using a needle. As with any skin procedure, it carries inherent risks including but not limited to infection, allergic reaction, scarring, asymmetry, color changes over time, and unsatisfactory results. Numbing agents may be used; some clients experience temporary swelling, redness, or tenderness following the procedure. I confirm that I have disclosed my full and accurate medical history in the questions below, understand the risks described above, and voluntarily consent to the procedure being performed.',
  'medical_consent', true, 1, true
),
(
  'Photo Release — Reference Photo',
  'As part of your intake, a current, no-makeup photo of the treatment area will be taken here in the studio''s booking system, using your device''s camera at the time of booking (not uploaded from your photo library). This photo is used for your medical record, to document your skin/brow condition prior to the procedure, and to support the studio''s quality and safety review process. It will be retained as part of your permanent client record. This consent covers that internal medical-record use only — it does not authorize any external, promotional, or portfolio use, which is covered separately below and is entirely optional.',
  'photo_release', true, 1, true
),
(
  'Optional: Portfolio & Marketing Use',
  'I agree that the studio may additionally use my before/after or reference photos in its portfolio, website, social media, or other marketing materials. This is entirely optional and separate from the required photo release above — declining this will not affect your ability to book or receive services.',
  'marketing_consent', false, 1, true
);
