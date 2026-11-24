// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { hubTakesEscape } from "./escape";

let hub: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = `
    <div id="hub">
      <section id="page" tabindex="-1">
        <div data-page-bar><button id="close">Close Settings</button></div>
        <div id="content">
          <p id="text" tabindex="-1">Text</p>
          <input id="field" />
          <textarea id="area"></textarea>
          <div id="editor" contenteditable="true"></div>
          <button id="cell" role="checkbox">Done</button>
          <button id="select" role="combobox">Pick</button>
          <a id="link" href="/x">Link</a>
        </div>
      </section>
    </div>
    <div role="dialog"><button id="peek">In a Peek</button></div>`;
  hub = document.getElementById("hub")!;
});
const at = (id: string) => document.getElementById(id);

describe("hubTakesEscape", () => {
  it("takes it on the page itself, on nothing in particular and on a bar's own buttons", () => {
    expect(hubTakesEscape(at("page"), hub)).toBe(true);
    expect(hubTakesEscape(at("text"), hub)).toBe(true);
    expect(hubTakesEscape(document.body, hub)).toBe(true);
    expect(hubTakesEscape(at("close"), hub)).toBe(true);
  });

  it("leaves it to a field being typed in", () => {
    for (const id of ["field", "area", "editor"]) expect(hubTakesEscape(at(id), hub), id).toBe(false);
  });

  it("leaves it to a control in the content: a cell's checkbox or select, a link", () => {
    for (const id of ["cell", "select", "link"]) expect(hubTakesEscape(at(id), hub), id).toBe(false);
  });

  it("leaves it to what sits outside the Hub: a dialog, a Peek, the palette", () => {
    expect(hubTakesEscape(at("peek"), hub)).toBe(false);
  });
});
