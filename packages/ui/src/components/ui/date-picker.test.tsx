import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DatePicker, DatePickerButton, DatePickerPanel } from "./date-picker";

const noop = () => {};
const today = new Date(2026, 9, 20);

describe("DatePicker's trigger", () => {
  it("shows the stored day, formatted", () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-10-20" onChange={noop} locale="en-GB" />);
    expect(html).toContain("Tue 20 Oct 2026");
  });

  it("reads 'No date' when an optional field is empty", () => {
    const html = renderToStaticMarkup(<DatePicker value="" onChange={noop} />);
    expect(html).toContain("No date");
  });

  it("carries the field's id, name, description, invalid state and disabled", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        id="exp"
        value=""
        onChange={noop}
        aria-label="Expires"
        aria-describedby="exp-hint"
        aria-invalid
        disabled
      />,
    );
    expect(html).toContain('id="exp"');
    expect(html).toContain('aria-label="Expires, No date"');
    expect(html).toContain('aria-describedby="exp-hint"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<button[^>]* disabled=""/);
  });

  it("names the day it holds after its label, so a screen reader hears both", () => {
    const named = (value: string, props: Partial<React.ComponentProps<typeof DatePicker>> = {}) =>
      /aria-label="([^"]*)"/.exec(renderToStaticMarkup(<DatePicker value={value} onChange={noop} locale="en-GB" aria-label="From" {...props} />))?.[1];
    expect(named("2026-10-20")).toBe("From, Tue 20 Oct 2026");
    expect(named("")).toBe("From, No date");
    expect(named("", { required: true })).toBe("From, Pick a day");
    expect(named("", { placeholder: "From" })).toBe("From, No date");
    expect(named("", { placeholder: "Unassigned" })).toBe("From, Unassigned");
  });

  it("matches its neighbours' height through size", () => {
    expect(renderToStaticMarkup(<DatePicker value="" onChange={noop} size="sm" />)).toMatch(/<button[^>]*data-size="sm"/);
  });
});

describe("DatePicker's popover panel", () => {
  const panel = (props: Partial<React.ComponentProps<typeof DatePickerPanel>> = {}) =>
    renderToStaticMarkup(<DatePickerPanel value="2026-10-20" onPick={noop} today={today} {...props} />);

  it("starts the week on Monday", () => {
    // October 2026 begins on a Thursday: the grid's first cell is Monday 28 September.
    const first = /data-day="([\d-]+)"/.exec(panel())?.[1];
    expect(first).toBe("2026-09-28");
  });

  it("disables the days outside min and max", () => {
    const html = panel({ min: "2026-10-10", max: "2026-10-25" });
    expect(html).toMatch(/data-day="2026-10-09"[^>]*data-disabled="true"/);
    expect(html).not.toMatch(/data-day="2026-10-10"[^>]*data-disabled/);
    expect(html).toMatch(/data-day="2026-10-26"[^>]*data-disabled="true"/);
  });

  it("offers Today only when today may be picked", () => {
    expect(panel()).toContain(">Today<");
    expect(panel({ max: "2026-10-19" })).not.toContain(">Today<");
  });

  it("offers Clear on an optional field holding a day, never on a required one", () => {
    expect(panel()).toContain(">Clear<");
    expect(panel({ value: "" })).not.toContain(">Clear<");
    expect(panel({ required: true })).not.toContain(">Clear<");
  });

  const firstDay = (html: string) => /data-day="([\d-]+)"/.exec(html)?.[1];

  it("opens an empty field on today's month when today may be picked", () => {
    // October 2026's grid starts on Monday 28 September.
    expect(firstDay(panel({ value: "", min: "2026-10-01", max: "2026-10-31" }))).toBe("2026-09-28");
  });

  it("opens an empty field on min's month when min is after today", () => {
    // December 2026's grid starts on Monday 30 November.
    expect(firstDay(panel({ value: "", min: "2026-12-05" }))).toBe("2026-11-30");
  });

  it("opens an empty field on max's month when max is before today, even with a min", () => {
    // August 2026's grid starts on Monday 27 July.
    expect(firstDay(panel({ value: "", max: "2026-08-15" }))).toBe("2026-07-27");
    expect(firstDay(panel({ value: "", min: "2026-01-10", max: "2026-08-15" }))).toBe("2026-07-27");
  });

  it("opens a field holding a day on that day's month", () => {
    expect(firstDay(panel({ value: "2026-12-24", min: "2026-01-01" }))).toBe("2026-11-30");
  });

  it("has month and year dropdowns running 1900 to ten years ahead", () => {
    const html = panel();
    expect(html).toContain('<option value="1900"');
    expect(html).toContain('<option value="2036"');
    expect(html).not.toContain('<option value="2037"');
    expect(panel({ startYear: 1500 })).toContain('<option value="1500"');
  });
});

describe("DatePickerButton", () => {
  it("is an icon button named by its label, so a Phone dock keeps it icon-sized", () => {
    const html = renderToStaticMarkup(<DatePickerButton aria-label="Jump to date" value="2026-10-20" onPick={noop} locale="en-GB" />);
    expect(html).toMatch(/<button[^>]*aria-label="Jump to date, Tue 20 Oct 2026"/);
    expect(html).toMatch(/<button[^>]*data-size="icon/);
    // No text of its own: the day is in its name only.
    expect(html).toMatch(/<\/svg><\/button>$/);
  });
});
