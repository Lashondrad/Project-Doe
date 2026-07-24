/**
 * HAND-WRITTEN placeholder types — regenerate with `npm run supabase:types`
 * after your first real migration against a live Supabase project to catch
 * any drift (see README "Unfinished Placeholders" / step 7 of setup).
 *
 * Reconstructed from supabase/migrations/0001_init.sql, 0003_audit_compliance.sql,
 * and 0004_consent_photo_intake.sql — kept in sync with those by hand until
 * codegen takes over.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          date_of_birth: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone: string;
          date_of_birth: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      client_notes: {
        Row: {
          id: string;
          client_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          name: string;
          category: Database["public"]["Enums"]["service_category"];
          description: string;
          duration_minutes: number;
          price_cents: number;
          deposit_cents: number;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
          min_advance_hours: number;
          max_advance_days: number;
          requires_prescreening: boolean;
          requires_policy_agreement: boolean;
          aftercare_instructions: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: Database["public"]["Enums"]["service_category"];
          description?: string;
          duration_minutes: number;
          price_cents: number;
          deposit_cents?: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          min_advance_hours?: number;
          max_advance_days?: number;
          requires_prescreening?: boolean;
          requires_policy_agreement?: boolean;
          aftercare_instructions?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      availability_rules: {
        Row: {
          id: string;
          staff_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          staff_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["availability_rules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "availability_rules_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_overrides: {
        Row: {
          id: string;
          staff_id: string;
          date: string;
          is_closed: boolean;
          start_time: string | null;
          end_time: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          staff_id: string;
          date: string;
          is_closed?: boolean;
          start_time?: string | null;
          end_time?: string | null;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["availability_overrides"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "availability_overrides_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_time: {
        Row: {
          id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocked_time"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "blocked_time_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          client_id: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          buffer_starts_at: string;
          buffer_ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          is_manual: boolean;
          reference_images: string[];
          client_message: string | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          buffer_starts_at: string;
          buffer_ends_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          is_manual?: boolean;
          reference_images?: string[];
          client_message?: string | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_manage_tokens: {
        Row: {
          token: string;
          appointment_id: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          token?: string;
          appointment_id: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointment_manage_tokens"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "appointment_manage_tokens_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      forms: {
        Row: {
          id: string;
          name: string;
          category: Database["public"]["Enums"]["form_category"];
          version: number;
          is_active: boolean;
          fields: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: Database["public"]["Enums"]["form_category"];
          version?: number;
          is_active?: boolean;
          fields: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["forms"]["Insert"]>;
        Relationships: [];
      };
      form_responses: {
        Row: {
          id: string;
          form_id: string;
          appointment_id: string;
          answers: Json;
          flagged_high_risk: boolean;
          flagged_fields: string[];
          submitted_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          appointment_id: string;
          answers: Json;
          flagged_high_risk?: boolean;
          flagged_fields?: string[];
          submitted_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["form_responses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "forms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "form_responses_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      policies: {
        Row: {
          id: string;
          title: string;
          body: string;
          category: Database["public"]["Enums"]["policy_category"];
          required: boolean;
          version: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          category: Database["public"]["Enums"]["policy_category"];
          required?: boolean;
          version?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["policies"]["Insert"]>;
        Relationships: [];
      };
      policy_agreements: {
        Row: {
          id: string;
          policy_id: string;
          appointment_id: string;
          agreed_at: string;
          ip_address: string | null;
        };
        Insert: {
          id?: string;
          policy_id: string;
          appointment_id: string;
          agreed_at?: string;
          ip_address?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["policy_agreements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "policy_agreements_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_agreements_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          appointment_id: string;
          amount_cents: number;
          status: Database["public"]["Enums"]["payment_status"];
          provider: string;
          provider_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          amount_cents: number;
          status?: Database["public"]["Enums"]["payment_status"];
          provider?: string;
          provider_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          appointment_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          channel: Database["public"]["Enums"]["notification_channel"];
          status: Database["public"]["Enums"]["notification_status"];
          scheduled_for: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          channel: Database["public"]["Enums"]["notification_channel"];
          status?: Database["public"]["Enums"]["notification_status"];
          scheduled_for: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["user_role"] | null;
          action: string;
          category: Database["public"]["Enums"]["audit_category"];
          severity: Database["public"]["Enums"]["audit_severity"];
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          action: string;
          category: Database["public"]["Enums"]["audit_category"];
          severity?: Database["public"]["Enums"]["audit_severity"];
          entity_type: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        // audit_log is DB-enforced append-only (0003_audit_compliance.sql) —
        // UPDATE/DELETE are rejected by triggers regardless of what the type
        // system allows, but keep Update narrow here as a client-side hint.
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "app_users";
            referencedColumns: ["id"];
          },
        ];
      };
      client_photos: {
        Row: {
          id: string;
          client_id: string;
          appointment_id: string;
          storage_path: string;
          capture_method: Database["public"]["Enums"]["photo_capture_method"];
          captured_at: string;
          photo_consent_agreement_id: string;
          marketing_consent_agreement_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          appointment_id: string;
          storage_path: string;
          capture_method?: Database["public"]["Enums"]["photo_capture_method"];
          captured_at?: string;
          photo_consent_agreement_id: string;
          marketing_consent_agreement_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_photos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "client_photos_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_photos_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_photos_photo_consent_agreement_id_fkey";
            columns: ["photo_consent_agreement_id"];
            isOneToOne: false;
            referencedRelation: "policy_agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_photos_marketing_consent_agreement_id_fkey";
            columns: ["marketing_consent_agreement_id"];
            isOneToOne: false;
            referencedRelation: "policy_agreements";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "admin" | "staff";
      appointment_status:
        | "requested"
        | "confirmed"
        | "deposit_pending"
        | "form_incomplete"
        | "needs_review"
        | "completed"
        | "cancelled"
        | "no_show";
      payment_status: "not_required" | "pending" | "paid" | "refunded" | "waived";
      service_category:
        | "initial_session"
        | "touch_up"
        | "color_boost"
        | "consultation"
        | "removal_consultation"
        | "correction_cover_up_consultation"
        | "training_session";
      notification_type:
        | "booking_confirmation"
        | "deposit_reminder"
        | "form_reminder"
        | "reminder_48h"
        | "reminder_24h"
        | "aftercare_followup";
      notification_channel: "email" | "sms";
      notification_status: "pending" | "sent" | "failed" | "skipped_not_configured";
      policy_category: "studio_policy" | "medical_consent" | "photo_release" | "marketing_consent";
      form_category: "medical_prescreening" | "ink_history";
      photo_capture_method: "live_camera";
      photo_purpose: "audit_medical_record" | "portfolio_marketing";
      audit_category: "data_access" | "data_modification" | "authentication" | "financial" | "admin_action";
      audit_severity: "info" | "warning" | "critical";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience aliases — most call sites import these rather than reaching
// into Database["public"]["Enums"] directly.
export type UserRole = Database["public"]["Enums"]["user_role"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type NotificationType = Database["public"]["Enums"]["notification_type"];
export type NotificationChannel = Database["public"]["Enums"]["notification_channel"];
export type NotificationStatus = Database["public"]["Enums"]["notification_status"];
export type PolicyCategory = Database["public"]["Enums"]["policy_category"];
export type FormCategory = Database["public"]["Enums"]["form_category"];
export type PhotoCaptureMethod = Database["public"]["Enums"]["photo_capture_method"];
export type PhotoPurpose = Database["public"]["Enums"]["photo_purpose"];
export type AuditCategory = Database["public"]["Enums"]["audit_category"];
export type AuditSeverity = Database["public"]["Enums"]["audit_severity"];
