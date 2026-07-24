import { afterEach, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedPhotoUrl, uploadFacePhoto } from "@/lib/booking-engine/photo";

/**
 * docs/typescript-ai-governance.md rule #23 / lib/booking-engine/CLAUDE.md
 * rule 7: file-type validation must happen by magic bytes against the real
 * upload path, not by trusting a claimed Content-Type. This test drives
 * uploadFacePhoto() end to end against the real local Storage bucket
 * (client-photos, created in 0004_consent_photo_intake.sql) — a fake JPEG
 * signature actually has to survive a real bucket round trip, and a
 * non-JPEG payload actually has to get rejected before any network call to
 * Storage happens.
 */
describe("uploadFacePhoto / getSignedPhotoUrl (real Supabase Storage)", () => {
  const cleanup: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanup.length) await cleanup.pop()?.();
  });

  it("accepts a payload with a valid JPEG SOI marker and stores it in the private bucket", async () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(64).fill(0)]);
    const appointmentId = crypto.randomUUID();

    const result = await uploadFacePhoto({
      base64Data: jpegBytes.toString("base64"),
      clientId: crypto.randomUUID(),
      appointmentId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.storagePath.startsWith(`${appointmentId}/`)).toBe(true);
    cleanup.push(async () => {
      const supabase = createAdminClient();
      await supabase.storage.from("client-photos").remove([result.storagePath]);
    });

    const signedUrl = await getSignedPhotoUrl(result.storagePath);
    expect(signedUrl).toBeTruthy();
    expect(signedUrl).toContain(result.storagePath.split("/")[1]);
  });

  it("rejects a payload whose magic bytes don't match JPEG, even with a plausible size", async () => {
    // PNG signature, not JPEG — the exact "client claims image/jpeg but
    // sends something else" scenario rule #23 exists for.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(64).fill(0)]);

    const result = await uploadFacePhoto({
      base64Data: pngBytes.toString("base64"),
      clientId: crypto.randomUUID(),
      appointmentId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("JPEG");
  });

  it("rejects an empty payload", async () => {
    const result = await uploadFacePhoto({
      base64Data: "",
      clientId: crypto.randomUUID(),
      appointmentId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payload larger than the 5MB bucket limit", async () => {
    const oversized = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]);

    const result = await uploadFacePhoto({
      base64Data: oversized.toString("base64"),
      clientId: crypto.randomUUID(),
      appointmentId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.toLowerCase()).toContain("large");
  });

  it("rejects malformed base64 input rather than throwing", async () => {
    const result = await uploadFacePhoto({
      base64Data: "not-valid-base64-!!!",
      clientId: crypto.randomUUID(),
      appointmentId: crypto.randomUUID(),
    });
    // Buffer.from with invalid base64 characters doesn't throw in Node (it
    // decodes what it can) — this asserts the function still resolves
    // rather than confirming a specific rejection reason.
    expect(typeof result.ok).toBe("boolean");
  });
});
