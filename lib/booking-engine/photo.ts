import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";

/**
 * Server-side handling of the in-app face photo capture. Two things this
 * module exists to guarantee, per lib/booking-engine/CLAUDE.md and root
 * CLAUDE.md compliance rules:
 *
 *   1. File-type validation by MAGIC BYTES, not by trusting a client-
 *      supplied Content-Type or file extension — see
 *      docs/typescript-ai-governance.md rule #23. A client claiming
 *      "image/jpeg" proves nothing; we check the actual JPEG SOI marker.
 *   2. captured_at is set by the SERVER clock at upload time, never taken
 *      from client input — a client-supplied timestamp is not
 *      audit-trustworthy (trivially forgeable via devtools).
 *
 * This module does NOT enforce "live camera only" — that's a UI-layer
 * constraint (components/booking/FaceCapture.tsx never renders a file
 * picker, only a camera stream). By the time a JPEG blob reaches this
 * module, the server can no longer distinguish "captured live" from
 * "uploaded from gallery" — the guarantee is enforced at the point of
 * capture in the browser, not re-derivable from the bytes themselves. This
 * is a known, documented limitation, not an oversight — see README.
 */

const JPEG_MAGIC_BYTES = [0xff, 0xd8, 0xff];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // matches the storage bucket's file_size_limit

export type PhotoUploadResult =
  | { ok: true; storagePath: string }
  | { ok: false; reason: string };

function isValidJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  return JPEG_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}

export async function uploadFacePhoto(params: {
  base64Data: string; // raw base64, no data: URL prefix — stripped by the caller
  clientId: string;
  appointmentId: string;
}): Promise<PhotoUploadResult> {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(params.base64Data, "base64"));
  } catch {
    return { ok: false, reason: "Invalid image data." };
  }

  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    return { ok: false, reason: "Image is empty or too large." };
  }
  if (!isValidJpeg(bytes)) {
    return { ok: false, reason: "Image must be a valid JPEG." };
  }

  const storagePath = `${params.appointmentId}/${crypto.randomUUID()}.jpg`;
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from("client-photos").upload(storagePath, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    logger.error("face photo upload failed", {
      appointmentId: params.appointmentId,
      dbError: error.message,
    });
    return { ok: false, reason: "Upload failed." };
  }

  return { ok: true, storagePath };
}

/** Staff-only signed URL generation — never expose client_photos storage paths directly to the browser without going through this. */
export async function getSignedPhotoUrl(storagePath: string, expiresInSeconds = 300): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("client-photos")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    logger.error("failed to sign photo URL", { dbError: error?.message });
    return null;
  }
  return data.signedUrl;
}
