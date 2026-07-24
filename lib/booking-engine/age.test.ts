import { describe, expect, it } from "vitest";
import { calculateAge, meetsMinimumAge, MINIMUM_BOOKING_AGE } from "./age";

describe("calculateAge", () => {
  it("computes a whole-years age when the birthday has already passed this year", () => {
    expect(calculateAge("2000-01-01", new Date("2026-07-24T00:00:00Z"))).toBe(26);
  });

  it("has not yet incremented age when the birthday hasn't occurred yet this year", () => {
    expect(calculateAge("2000-12-31", new Date("2026-07-24T00:00:00Z"))).toBe(25);
  });

  it("turns the new age exactly on the birthday itself", () => {
    expect(calculateAge("2000-07-24", new Date("2026-07-24T00:00:00Z"))).toBe(26);
  });

  it("is one day short of the new age the day before the birthday", () => {
    expect(calculateAge("2000-07-24", new Date("2026-07-23T00:00:00Z"))).toBe(25);
  });
});

describe("meetsMinimumAge", () => {
  it("is false for someone who turns 18 tomorrow", () => {
    const asOf = new Date("2026-07-24T00:00:00Z");
    const dobTurningTomorrow = "2008-07-25";
    expect(meetsMinimumAge(dobTurningTomorrow, asOf)).toBe(false);
  });

  it("is true the exact day someone turns 18", () => {
    const asOf = new Date("2026-07-24T00:00:00Z");
    const dobTurning18Today = "2008-07-24";
    expect(meetsMinimumAge(dobTurning18Today, asOf)).toBe(true);
  });

  it("uses 18 as the configured minimum", () => {
    expect(MINIMUM_BOOKING_AGE).toBe(18);
  });
});
