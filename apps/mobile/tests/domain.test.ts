import { describe, expect, it } from "vitest";
import { rankPartners } from "../src/domain/matching";
import { parseStaffRequest } from "../src/domain/parser";
import { safeValidateParseResult } from "../src/domain/validation";
import { TEST_PARTNERS } from "./fixtures/partners";

describe("parse output validator", () => {
  it("accepts a structured parse and rejects invalid counts", () => {
    const parsed = parseStaffRequest("1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden");
    expect(safeValidateParseResult(parsed).success).toBe(true);
    expect(parsed.bookings[0].confidence.count).toBe(0.95);
    expect(safeValidateParseResult({ ...parsed, bookings: [{ ...parsed.bookings[0], count: 0 }] }).success).toBe(false);
    const multiRole = parseStaffRequest("Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area.");
    expect(multiRole.bookings).toHaveLength(2);
    expect(multiRole.bookings.every((booking) => booking.date && booking.timeStart && booking.timeEnd && booking.location)).toBe(true);
    expect(parseStaffRequest("1 chef, 1 November").bookings[0].date).toBe("2026-11-01");
    expect(parseStaffRequest("1 chef, 1 January").bookings[0].date).toBe("2027-01-01");
    expect(parseStaffRequest("Tandoor chef, 25 October").bookings[0].count).toBe(1);
    expect(parseStaffRequest("2 chefs, 6 PM to 11 PM").bookings[0].timeStart).toBe("18:00");
    const ambiguous = parseStaffRequest("Need someone for tomorrow evening.");
    expect(ambiguous.followUpQuestions.length).toBeGreaterThan(0);
    expect(parseStaffRequest("Deep cleaning crew of 3 for Sunday morning, Pitampura outlet.", new Date("2026-10-25T12:00:00+05:30")).bookings[0].count).toBe(3);
    expect(parseStaffRequest("Waiter, 28 se 30 October, shaam 6 baje se, Karol Bagh.", new Date("2026-10-25T12:00:00+05:30")).bookings[0].dateEnd).toBe("2026-10-30");
  });
});

describe("partner matching scorer", () => {
  it("ranks a close, available subcategory match above a weaker match", () => {
    const booking = parseStaffRequest("2 Chinese chefs for Saturday 6 PM to 11 PM, Connaught Place").bookings[0];
    const ranked = rankPartners(booking, TEST_PARTNERS);
    expect(ranked).toHaveLength(5);
    expect(ranked[0].subcategories).toContain("Chinese Chef");
    expect(ranked[0].components.subcategoryFit).toBe(1);
    expect(ranked[0].reason.length).toBeGreaterThan(0);
  });
});
