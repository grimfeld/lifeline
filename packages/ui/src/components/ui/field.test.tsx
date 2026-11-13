import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("can keep its label for screen readers only, still naming the control, with its error", () => {
    const html = renderToStaticMarkup(
      <Field label="Name" hideLabel error="Name can't be empty.">
        <Input value="" readOnly />
      </Field>,
    );
    const label = /<label[^>]*>Name<\/label>/.exec(html)?.[0] ?? "";
    expect(label).toMatch(/class="[^"]*\bsr-only\b/);
    const id = /for="([^"]+)"/.exec(label)?.[1];
    expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*aria-describedby="${id}-error"[^>]*aria-invalid="true"`));
    expect(html).toContain(`id="${id}-error"`);
  });

  it("shows its label by default", () => {
    const html = renderToStaticMarkup(
      <Field label="Name">
        <Input value="" readOnly />
      </Field>,
    );
    expect(/<label[^>]*>/.exec(html)?.[0]).not.toMatch(/\bsr-only\b/);
  });
});
