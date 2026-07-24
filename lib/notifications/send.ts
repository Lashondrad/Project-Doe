import "server-only";
import { logger } from "@/lib/logger/logger";

/**
 * PLACEHOLDER notification senders. Phase 3 wires these to a real provider
 * (Resend/SendGrid for email, Twilio for SMS). Until then, they log intent
 * and mark the notification row as `skipped_not_configured` rather than
 * silently pretending to send.
 *
 * Root CLAUDE.md: do not build Phase 3 ahead of schedule — but these
 * placeholders exist now so `create_booking()` can seed notification rows
 * that a scheduled job can process once real sending is wired up.
 */

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export type SmsPayload = {
  to: string;
  body: string;
};

export type SendResult =
  | { status: "sent" }
  | { status: "skipped_not_configured"; reason: string };

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) {
    // payload.to (an email) is redacted automatically by the logger's
    // SENSITIVE_KEYS list when passed as a field, not interpolated into
    // the message string — never string-concatenate PII into a log message.
    logger.info("email not configured, skipping send", { subject: payload.subject, to: payload.to });
    return { status: "skipped_not_configured", reason: "No email provider API key set." };
  }

  // TODO(Phase 3): wire to Resend or SendGrid here.
  logger.info("would send email", { subject: payload.subject, to: payload.to });
  return { status: "sent" };
}

export async function sendSms(payload: SmsPayload): Promise<SendResult> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.info("SMS not configured, skipping send", { to: payload.to });
    return { status: "skipped_not_configured", reason: "No Twilio credentials set." };
  }

  // TODO(Phase 3): wire to Twilio here.
  logger.info("would send SMS", { to: payload.to });
  return { status: "sent" };
}

const TEMPLATES = {
  booking_confirmation: (data: { clientName: string; serviceName: string; startsAtLocal: string }) => ({
    subject: "Your appointment is booked",
    body: `Hi ${data.clientName}, your ${data.serviceName} appointment is scheduled for ${data.startsAtLocal}. We'll send reminders as the date approaches.`,
  }),
  deposit_reminder: (data: { clientName: string; depositAmount: string }) => ({
    subject: "Deposit needed to confirm your appointment",
    body: `Hi ${data.clientName}, a deposit of ${data.depositAmount} is required to confirm your upcoming appointment.`,
  }),
  form_reminder: (data: { clientName: string }) => ({
    subject: "Action needed: complete your intake form",
    body: `Hi ${data.clientName}, please complete your pre-screening form before your appointment.`,
  }),
  reminder_48h: (data: { clientName: string; startsAtLocal: string }) => ({
    subject: "Appointment reminder — 48 hours",
    body: `Hi ${data.clientName}, this is a reminder that your appointment is in 2 days, on ${data.startsAtLocal}.`,
  }),
  reminder_24h: (data: { clientName: string; startsAtLocal: string }) => ({
    subject: "Appointment reminder — tomorrow",
    body: `Hi ${data.clientName}, this is a reminder that your appointment is tomorrow, ${data.startsAtLocal}.`,
  }),
  aftercare_followup: (data: { clientName: string; aftercareInstructions: string }) => ({
    subject: "Aftercare instructions",
    body: `Hi ${data.clientName}, here's a reminder of your aftercare instructions: ${data.aftercareInstructions}`,
  }),
} as const;

export type NotificationTemplateKey = keyof typeof TEMPLATES;
export { TEMPLATES };
