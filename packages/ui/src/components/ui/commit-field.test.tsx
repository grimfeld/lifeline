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
});
