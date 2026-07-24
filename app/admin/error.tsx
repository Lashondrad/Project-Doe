"use client";

/**
 * Error boundary for /admin/**. Kept separate from the public error
 * boundary (app/(public)/error.tsx) because admin errors often relate to
 * data mutations an admin needs to know didn't silently succeed — the
 * messaging here is deliberately more specific about "nothing was saved"
 * than the public-facing version.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-card border border-red-200 bg-red-50 p-8 text-center">
      <h1 className="mb-2 font-display text-xl text-charcoal">Something went wrong</h1>
      <p className="mb-1 max-w-md text-sm text-charcoal/70">
        This screen couldn&apos;t load. If you were in the middle of saving something, it was not
        saved — please retry.
      </p>
      <p className="mb-6 text-xs text-charcoal/40">
        Reference: <span className="font-mono">{error.digest ?? "n/a"}</span>
      </p>
      <button onClick={reset} className="btn-secondary">
        Try again
      </button>
    </div>
  );
}
