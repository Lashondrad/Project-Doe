# Original Project Spec (as provided)

This is the functional spec the app was built against. Referenced by `/CLAUDE.md` and `README.md`. Kept verbatim for traceability between the spec and what was actually built (see README §4-6 for what's done vs. deferred).

---

You are building a custom scheduler web app for a tattoo / PMU / brow tattoo business.

## Goal
Create a polished, mobile-first appointment scheduling system that allows clients to view services, book sessions, pay deposits if enabled, complete pre-screening forms, receive reminders, and manage appointments. Admin must be able to manage services, availability, bookings, client notes, policies, and calendar views.

## Branding
Luxury teal and silver color palette. Primary teal `#008C8C`, dark teal `#005F5F`, silver `#C0C0C0`, soft silver background `#F4F6F7`, charcoal text `#1F2933`. White cards with subtle silver borders. Clean, upscale, feminine, professional, tattoo-studio compliant, not childish.

## Build Style
Mobile-first. Simple enough for clients, powerful enough for business operations. Clean code, modular components, clear documentation. May later become SaaS for other tattoo artists.

## Core User Roles
1. Client
2. Artist/Admin
3. Optional Staff/Assistant role

## Client Features
View service menu; choose service; see duration/price/deposit/healing notes/eligibility; select date/time from available slots; enter name/phone/email; complete pre-screening questions; accept policies; pay deposit or mark pending; receive confirmation; reschedule/cancel based on rules; upload reference images; view appointment status.

## Admin Features
Dashboard (today's sessions, upcoming, pending deposits, incomplete forms); calendar day/week/month; add/edit/delete services; set duration/buffer/price/deposit/category; business hours; block time; manual appointments; edit client info; private client notes; track status (Requested, Confirmed, Deposit Pending, Form Incomplete, Completed, Cancelled, No Show); search clients; export data; manage policies; manage reminder templates.

## Service Types
Initial Session, Touch-Up, Color Boost, Consultation, Removal Consultation, Correction/Cover-Up Consultation, Training Session (future).

Each service needs: name, description, duration, price, deposit amount, buffer before/after, min advance booking time, max future booking window, required pre-screening form, required consent/policy agreement, aftercare instructions.

## Pre-Screening Form Fields
Pregnant or nursing; under 18; diabetes; blood thinners; keloid history; autoimmune condition; recent Botox/fillers; recent chemical peel/laser; skin irritation near treatment area; previous tattoo/PMU in treatment area; allergies; medications; consent to policies.

High-risk answers allow submission but flag as "Needs Review" instead of auto-confirming.

## Scheduling Rules
No double booking; respect business hours/blocked time/buffers/duration; prevent booking too close to now or too far out; allow admin override; handle timezone correctly; store dates consistently; prevent race conditions on concurrent bookings for the same slot.

## Database Models
Users, Clients, Services, Appointments, Availability, BlockedTime, Forms, FormResponses, Policies, Deposits/Payments, Notifications, Notes, AuditLog.

## Security
Admin routes protected; client data protected; input validation everywhere; no exposed secrets; environment variables; sanitize uploads; rate limiting on booking attempts; audit log for admin changes.

## Payments
Payment-ready architecture. Placeholder status fields if Stripe isn't integrated: Not Required, Pending, Paid, Refunded, Waived.

## Notifications
Reminder architecture for booking confirmation, deposit reminder, form completion reminder, 48-hour reminder, 24-hour reminder, aftercare follow-up. Placeholder functions if email/SMS isn't integrated, connectable later to Twilio/SendGrid/Resend.

## Pages
**Public:** Home/Booking Landing, Services, Book Appointment, Client Intake Form, Booking Confirmation, Reschedule/Cancel.
**Admin:** Login, Dashboard, Calendar, Appointments, Clients, Services, Availability, Blocked Time, Forms, Policies, Settings.

## UI Requirements
Teal buttons, silver borders, rounded cards, minimal luxury feel, clear error/loading/empty states, mobile responsive, accessibility-friendly contrast, large tap targets, phone-friendly calendar.

## Adversarial Testing Requirements
Double booking attempts; booking outside hours; booking during blocked time; booking with incomplete form; booking with risky medical answers; rescheduling into unavailable slot; canceling after cancellation window; invalid email/phone; empty required fields; timezone mismatch; admin deleting a service with future appointments; payment marked paid without appointment; client refreshing confirmation page multiple times; client using browser back button during booking; two users selecting the same time; very long names/messages; file upload abuse; unauthorized admin access; missing environment variables.

## Deliverables
Working app; clear file structure; database schema; setup instructions; seed data; admin test login; completed features list; unfinished placeholders list; known limitations; test checklist results.

## Build Phases
**Phase 1:** Core booking flow, services, availability, admin dashboard, appointment management.
**Phase 2:** Intake forms, risk flagging, policies, client notes.
**Phase 3:** Payments, email/SMS reminders, uploads, reports.
**Phase 4:** SaaS-ready multi-artist or multi-studio support.

Do not overcomplicate the first build. Prioritize a stable booking engine, clean admin controls, and client trust.
