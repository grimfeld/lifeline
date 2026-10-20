import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommitField } from "./commit-field";

describe("CommitField", () => {
  it("edits a date with the kit's Date picker, labelled by the field", () => {
    const html = renderToStaticMarkup(<CommitField type="date" label="Expires" value="" onCommit={() => {}} hint="Check by" />);
    expect(html).toContain('data-slot="date-picker"');
    expect(html).not.toContain('type="date"');
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(new RegExp(`<button[^>]*id="${id}"[^>]*aria-describedby="${id}-hint"`));
    expect(html).toContain("No date");
  });

  it("asks for a day, not 'No date', when the date is required", () => {
    const html = renderToStaticMarkup(<CommitField type="date" label="Day" value="" onCommit={() => {}} required />);
    expect(html).toContain("Pick a day");
  });

  it("edits a time with the kit's Time field, labelled by the field, never the browser's time input", () => {
    const html = renderToStaticMarkup(<CommitField type="time" label="Starts" value="09:05" onCommit={() => {}} hint="Local time" />);
    expect(html).toContain('data-slot="time-field"');
    expect(html).not.toContain('type="time"');
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*aria-describedby="${id}-hint"`));
    expect(html).toMatch(/role="combobox"/);
  });

  it("edits a date and time as the kit's Date picker beside the kit's Time field", () => {
    const html = renderToStaticMarkup(
      <CommitField type="datetime-local" label="When it happened" value="2026-10-18T09:05" onCommit={() => {}} required />,
    );
    expect(html).not.toContain('type="datetime-local"');
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(new RegExp(`<button[^>]*id="${id}"[^>]*data-slot="date-picker"`));
    expect(html).not.toContain('type="time"');
    expect(html).toMatch(/<input[^>]*role="combobox"[^>]*aria-label="Time"/);
    expect(html).toContain('data-slot="time-field"');
  });
});
