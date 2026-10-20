import { describe, expect, it } from "vitest"

import { withDay } from "./date-time-value"

// 20 Oct 2026, 14:37 local.
const now = new Date(2026, 9, 20, 14, 37)

describe("withDay: the moment a Date and time field holds once a day is picked", () => {
  it("fills in the time now when no time is set yet", () => {
    expect(withDay("2026-10-18", "", { now })).toBe("2026-10-18T14:37")
  })

  it("keeps the time already set when only the day changes", () => {
    expect(withDay("2026-10-18", "09:05", { now })).toBe("2026-10-18T09:05")
  })

  it("fills in now for today when capped at now", () => {
    expect(withDay("2026-10-20", "", { now, max: "2026-10-20T14:37" })).toBe("2026-10-20T14:37")
  })

  it("never fills a time later than the cap", () => {
    expect(withDay("2026-10-20", "", { now, max: "2026-10-20T08:00" })).toBe("2026-10-20T08:00")
  })

  it("brings a kept time back to the cap on the cap's day", () => {
    expect(withDay("2026-10-20", "23:15", { now, max: "2026-10-20T14:37" })).toBe("2026-10-20T14:37")
  })

  it("leaves the cap alone on an earlier day", () => {
    expect(withDay("2026-10-19", "23:15", { now, max: "2026-10-20T14:37" })).toBe("2026-10-19T23:15")
    expect(withDay("2026-10-19", "", { now, max: "2026-10-20T08:00" })).toBe("2026-10-19T14:37")
  })

  it("pads single-digit hours and minutes", () => {
    expect(withDay("2026-01-02", "", { now: new Date(2026, 0, 2, 7, 4) })).toBe("2026-01-02T07:04")
  })

  it("holds nothing when the day is cleared", () => {
    expect(withDay("", "09:05", { now })).toBe("")
  })
})
