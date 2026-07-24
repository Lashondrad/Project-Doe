import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import type { Json, UserRole } from "@/types/database.types";

/**
 * COMPLIANCE AUDIT LOGGER — SOC 2 / HIPAA-aligned.
 *
 * This is the ONLY way admin mutations should be recorded (see root
 * CLAUDE.md rule 6, app/api/CLAUDE.md rule 6). Distinct from lib/logger,
 * which is for operational/debug logging — this is the permanent,
 * append-only compliance record of who did what to what.
 *
 * Guarantees this module provides:
 *   1. Every entry captures actor, role, action, entity, category,
 *      severity, IP, and user agent — the minimum field set an auditor
 *      will ask for.
 *   2. before/after snapshots are redacted here, before they ever reach
 *      the database — never pass raw client PII/PHI-adjacent fields
 *      (medical form answers, full names, emails, phone, notes body) into
 *      `before`/`after`. Pass IDs and non-sensitive metadata only, or use
 *      `redactSnapshot()` explicitly on anything that might contain them.
 *   3. The audit_log table itself is DB-enforced append-only (see
 *      supabase/migrations/0003_audit_compliance.sql) — even a bug in this
 *      file can't result in a silently edited or deleted entry.
 *   4. Financial actions (payment status changes, deposit records) are
 *      logged with category "financial" and provider references are
 *      masked — never log a raw payment provider reference/token in full.
 */

export type AuditCategory =
  | "data_access"
  | "data_modification"
  | "authentication"
  | "financial"
  | "admin_action";

export type AuditSeverity = "info" | "warning" | "critical";

// Mirrors the redaction concerns in lib/logger/logger.ts but scoped to what
// is allowed to persist in a `before`/`after` snapshot. Snapshots should
// generally be IDs + non-sensitive status/enum fields, not full records —
// this list is a backstop, not the primary control.
const SNAPSHOT_REDACT_KEYS = new Set([
  "email",
  "phone",
  "full_name",
  "date_of_birth",
  "answers",
  "flagged_fields",
  "client_message",
  "body",
  "aftercare_instructions",
  "facePhotoBase64",
  "storage_path", // not the image itself, but no reason a storage path needs to be in a snapshot either
]);

export function redactSnapshot(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((v) => redactSnapshot(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SNAPSHOT_REDACT_KEYS.has(key) ? "[REDACTED]" : redactSnapshot(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** Masks a payment provider reference to its last 4 characters, e.g. for Stripe payment_intent IDs in logs/audit trail. Never store or log raw card data anywhere in this app — Stripe (Phase 3) handles PAN data entirely off our servers. */
export function maskFinancialReference(reference: string | null | undefined): string | null {
  if (!reference) return null;
  if (reference.length <= 4) return "****";
  return `****${reference.slice(-4)}`;
}

export type AuditLogEntry = {
  /** null for actions with no authenticated staff actor (e.g. a public client booking). audit_log.actor_id is an FK to app_users — never pass a non-app_users ID here. */
  actorId: string | null;
  actorRole?: UserRole;
  action: string; // e.g. "service.update", "appointment.cancel", "payment.status_change"
  category: AuditCategory;
  severity?: AuditSeverity; // defaults to "info"
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("audit_log").insert({
    actor_id: entry.actorId, // nullable FK — null is valid and expected for unauthenticated actions
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    category: entry.category,
    severity: entry.severity ?? "info",
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    // redactSnapshot rebuilds its input from plain objects/arrays/primitives
    // only, so its output is always JSON-safe — the cast reflects that
    // construction, not an assumption about the caller's input shape.
    before: entry.before !== undefined ? (redactSnapshot(entry.before) as Json) : null,
    after: entry.after !== undefined ? (redactSnapshot(entry.after) as Json) : null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });

  if (error) {
    // An audit write failure must be loud — this is a compliance-relevant
    // gap, not an ordinary error. It still must not block the admin action
    // that triggered it (a 500 over a missed log entry would be worse), but
    // this needs to reach whoever monitors severity:"critical" logs.
    logger.error("audit_log write failed", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      dbError: error.message,
    });
  }
}

/** Convenience helper for API routes: pull IP + user agent from a Request. */
export function auditContextFromRequest(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  };
}
