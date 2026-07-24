/**
 * Operational/debug logger — the ONE approved `console.*` call site in the
 * codebase (see eslint.config.mjs's per-file override of `no-console`, and
 * root CLAUDE.md rule 8). Distinct from lib/audit/log.ts, which is the
 * permanent compliance record — this is short-retention and fine to be
 * verbose.
 *
 * Structured JSON output. Automatically redacts PII/PHI-adjacent field
 * values by key name (SENSITIVE_KEYS below) — pass PII as a field
 * (`{ to: email }`), never interpolate it into the message string, since
 * only field values go through redaction.
 */

type LogFields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "email",
  "to",
  "phone",
  "fullName",
  "full_name",
  "dateOfBirth",
  "date_of_birth",
  "answers",
  "flaggedFields",
  "flagged_fields",
  "clientMessage",
  "client_message",
  "body",
  "aftercareInstructions",
  "aftercare_instructions",
  "facePhotoBase64",
  "storagePath",
  "storage_path",
  "password",
  "token",
  "ipAddress",
  "ip_address",
  "address",
  "notes",
]);

function redact(fields: LogFields | undefined): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : value;
  }
  return out;
}

function emit(level: Level, message: string, fields?: LogFields): void {
  const entry = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...redact(fields),
  });

  switch (level) {
    case "debug":
      console.debug(entry);
      break;
    case "info":
      console.info(entry);
      break;
    case "warn":
      console.warn(entry);
      break;
    case "error":
      console.error(entry);
      break;
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
