import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, localToday, parseDate } from "../src/date";
import type { DateFormat } from "../src/types";

afterEach(() => vi.useRealTimers());

describe("date handling", () => {
  it.each(["2026-09-28", "2026/09/28", "2026.09.28", " 2026-09-28 "])(
    "normalizes %s without timezone conversion",
    (value) => {
      expect(parseDate(value)).toBe("2026-09-28");
    },
  );

  it.each([
    "2000-02-29",
    "2024-02-29",
    "0001-01-01",
    "0099-12-31",
    "9999-12-31",
  ])("accepts valid calendar date %s", (value) => {
    expect(parseDate(value)).toBe(value);
  });

  it.each([
    "1900-02-29",
    "2100-02-29",
    "2025-02-29",
    "2026-04-31",
    "2026-00-10",
    "2026-13-10",
    "2026-01-00",
    "0000-01-01",
    "2026-09/28",
    "2026-9-28",
    "26-09-28",
    "2026-09-28T00:00:00Z",
    "",
  ])("rejects invalid calendar input %s", (value) => {
    expect(() => parseDate(value)).toThrow(/[\u4e00-\u9fff]/);
  });

  it.each([
    ["YYYY/MM/DD", "2026/09/28"],
    ["YYYY.MM.DD", "2026.09.28"],
    ["YYYY-MM-DD", "2026-09-28"],
    ["YY.MM.DD", "26.09.28"],
  ] as const)("formats %s correctly", (format, expected) => {
    expect(formatDate("2026-09-28", format)).toBe(expected);
  });

  it("does not format nonexistent dates or unknown formats", () => {
    expect(() => formatDate("2025-02-29", "YYYY/MM/DD")).toThrow();
    expect(() => formatDate("2026-09-28", "arbitrary" as DateFormat)).toThrow();
  });

  it("uses the local calendar day around midnight", () => {
    vi.useFakeTimers();
    // Construct a local date: this remains correct in any test machine timezone.
    vi.setSystemTime(new Date(2026, 0, 2, 0, 1));
    expect(localToday()).toBe("2026-01-02");
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59));
    expect(localToday()).toBe("2026-12-31");
  });
});
