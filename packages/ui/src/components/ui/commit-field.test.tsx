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

  it("edits a date and time as the kit's Date picker beside a native time input", () => {
    const html = renderToStaticMarkup(
      <CommitField type="datetime-local" label="When it happened" value="2026-10-18T09:05" onCommit={() => {}} required />,
    );
    expect(html).not.toContain('type="datetime-local"');
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(new RegExp(`<button[^>]*id="${id}"[^>]*data-slot="date-picker"`));
    expect(html).toMatch(/<input[^>]*type="time"[^>]*value="09:05"/);
    expect(html).toMatch(/<input[^>]*aria-label="Time"/);
  });
});
