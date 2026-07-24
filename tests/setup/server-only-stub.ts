// Vitest/Vite has no equivalent of Next.js's webpack alias that silently
// empties out the real "server-only" package inside server bundles — so the
// real package (which unconditionally throws on import) breaks any test
// that imports server-only application code. This stub is wired in via
// vitest.config.ts's resolve.alias for the test run only; it does not
// change what ships to Next.js's actual client/server bundles.
export {};
