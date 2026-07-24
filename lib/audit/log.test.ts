import { describe, expect, it } from "vitest";
import { maskFinancialReference, redactSnapshot } from "./log";

describe("redactSnapshot", () => {
  it("redacts known-sensitive keys and passes everything else through", () => {
    const result = redactSnapshot({
      email: "client@example.com",
      status: "confirmed",
      full_name: "Jane Doe",
    });
    expect(result).toEqual({
      email: "[REDACTED]",
      status: "confirmed",
      full_name: "[REDACTED]",
    });
  });

  it("redacts sensitive keys inside nested objects", () => {
    const result = redactSnapshot({
      appointment: { status: "needs_review", answers: { pregnant_or_nursing: true } },
    });
    expect(result).toEqual({
      appointment: { status: "needs_review", answers: "[REDACTED]" },
    });
  });

  it("redacts sensitive keys inside arrays of objects", () => {
    const result = redactSnapshot([{ phone: "555-0100", id: "1" }, { phone: "555-0101", id: "2" }]);
    expect(result).toEqual([
      { phone: "[REDACTED]", id: "1" },
      { phone: "[REDACTED]", id: "2" },
    ]);
  });

  it("passes primitives through unchanged", () => {
    expect(redactSnapshot("confirmed")).toBe("confirmed");
    expect(redactSnapshot(42)).toBe(42);
    expect(redactSnapshot(null)).toBe(null);
    expect(redactSnapshot(true)).toBe(true);
  });

  it("truncates instead of recursing forever on deeply nested input", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 10; i++) deep = { nested: deep };
    const result = redactSnapshot(deep);
    // depth > 6 short-circuits to "[TRUNCATED]" rather than blowing the
    // stack or serializing an unbounded structure into a compliance record.
    expect(JSON.stringify(result)).toContain("[TRUNCATED]");
  });
});

describe("maskFinancialReference", () => {
  it("masks all but the last 4 characters", () => {
    expect(maskFinancialReference("pi_3Nx9ABCDEF123456")).toBe("****3456");
  });

  it("returns null for null/undefined input rather than throwing", () => {
    expect(maskFinancialReference(null)).toBe(null);
    expect(maskFinancialReference(undefined)).toBe(null);
  });

  it("masks a short reference entirely rather than leaking it", () => {
    expect(maskFinancialReference("abc")).toBe("****");
  });
});
