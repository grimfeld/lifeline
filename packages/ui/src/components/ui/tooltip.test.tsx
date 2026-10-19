import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Tip } from "./tooltip";
import { Button } from "./button";

describe("Tip", () => {
  it("names the Button with the tooltip's own text", () => {
    const html = renderToStaticMarkup(
      <Tip label="New folder">
        <Button size="icon">+</Button>
      </Tip>,
    );
    expect(html).toContain('aria-label="New folder"');
  });
});
