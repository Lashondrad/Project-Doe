/**
 * Age calculation. This is UX only — the actual 18+ gate is enforced twice
 * server-side (create_booking()'s explicit check, and the
 * clients_must_be_18_or_older CHECK constraint as a second independent
 * guarantee). Never treat a client-side pass here as authoritative; see
 * root CLAUDE.md rule 7 (server-side re-validation is mandatory) and
 * lib/booking-engine/CLAUDE.md.
 */
export function calculateAge(dateOfBirth: string, asOf: Date = new Date()): number {
  const dob = new Date(dateOfBirth + "T00:00:00Z");
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = asOf.getUTCDate() - dob.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}

export const MINIMUM_BOOKING_AGE = 18;

export function meetsMinimumAge(dateOfBirth: string, asOf: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, asOf) >= MINIMUM_BOOKING_AGE;
}
