import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeField } from "./time-field";

const noop = () => {};

describe("TimeField", () => {
  it("shows the stored time in the locale's clock", () => {
    expect(renderToStaticMarkup(<TimeField value="21:30" onChange={noop} locale="en-GB" />)).toContain('value="21:30"');
    expect(renderToStaticMarkup(<TimeField value="21:30" onChange={noop} locale="en-US" />)).toContain('value="9:30 PM"');
  });

  it("is a combobox carrying the field's id, name, description, invalid state and disabled", () => {
    const html = renderToStaticMarkup(
      <TimeField id="start" value="" onChange={noop} aria-label="Start" aria-describedby="start-hint" aria-invalid disabled />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('id="start"');
    expect(html).toContain('aria-label="Start"');
    expect(html).toContain('aria-describedby="start-hint"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<input[^>]* disabled=""/);
  });
});
