// node --test scripts/*.test.mjs (part of `pnpm check`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSource, kitImports } from "./check-ui.mjs";

const rules = (source) => checkSource(source).map((p) => `${p.line}:${p.r.id}`);

test("kitImports reads the local names, across lines, aliases and type imports", () => {
  const names = kitImports(`import { cn, Badge, Checkbox as Tick,\n  type ButtonProps } from "@lifeline/ui";\nimport { Star } from "lucide-react";`);
  assert.deepEqual([...names].sort(), ["Badge", "ButtonProps", "Tick"]);
});

test("a size or height class on any kit component the file imports", () => {
  const src = `import { Badge, TabsTrigger } from "@lifeline/ui";\n<Badge className="h-5" />\n<TabsTrigger className="flex size-8" value="a" />`;
  assert.deepEqual(rules(src), ["2:control-size", "3:control-size"]);
});

test("Button and the other kit controls, imported or not", () => {
  assert.deepEqual(rules(`<Button className="size-7" aria-label="x" />\n<Input className="h-10" />`), ["1:control-size", "2:control-size"]);
});

test("the same class on a component from elsewhere passes", () => {
  assert.deepEqual(rules(`import { Star } from "lucide-react";\n<Star className="size-4" />\n<Badge className="h-5" />`), []);
});

test("layout components a size class legitimately sizes pass", () => {
  const src = `import { Card, CardContent, SheetContent, Page, MapView, Separator } from "@lifeline/ui";\n<Card className="h-40" />\n<CardContent className="h-[300px]" />\n<SheetContent className="h-[80vh]" />\n<Page className="h-full" />\n<MapView className="h-64" />\n<Separator className="h-4" />`;
  assert.deepEqual(rules(src), []);
});

test("classes that are not a size, and size props, pass", () => {
  const src = `import { Badge } from "@lifeline/ui";\n<Badge className="w-full shrink-0" />\n<Badge size="sm" className="h-full" />`;
  assert.deepEqual(rules(src), []);
});

test("ui-allow lets a real exception through", () => {
  const src = `import { Badge } from "@lifeline/ui";\n// ui-allow: control-size — a measured chart legend\n<Badge className="h-3" />`;
  assert.deepEqual(rules(src), []);
});

test("a tag spanning lines is read whole", () => {
  const src = `import { Checkbox } from "@lifeline/ui";\n<Checkbox\n  checked\n  className="size-5"\n/>`;
  assert.deepEqual(rules(src), ["2:control-size"]);
});

test("a native date input is flagged", () => {
  assert.deepEqual(rules(`<input type="date" value={day} />`), ["1:native-date"]);
});

test("the kit's Input is a native input too, and datetime-local counts", () => {
  assert.deepEqual(rules(`<Input type="datetime-local" value={when} />`), ["1:native-date"]);
});

test("a tag over several lines is flagged on the line it opens", () => {
  assert.deepEqual(rules(`<div>\n  <Input\n    id="x"\n    type='date'\n  />\n</div>`), ["2:native-date"]);
});

test("a type that is an expression yielding date is flagged", () => {
  assert.deepEqual(rules(`<Input type={field.kind === "date" ? "date" : "text"} />`), ["1:native-date"]);
});

test("a time input is native-time's (TimeField), not native-date's; other types stay allowed", () => {
  assert.deepEqual(rules(`<Input type="time" />\n<input type="number" />\n<Input type={t} />`), ["1:native-time"]);
});

test("CommitField type=\"date\" renders the kit picker, so it is allowed", () => {
  assert.deepEqual(rules(`<CommitField label="Day" type="date" value={d} onCommit={save} />`), []);
});

test("a ui-allow on the line above lets one through", () => {
  assert.deepEqual(rules(`{/* ui-allow: native-date — why */}\n<input type="date" />`), []);
});

test("tip-double-label: an aria-label on the element a Tip names is written twice", () => {
  assert.deepEqual(rules(`<Tip label="Delete">\n  <Button size="icon" aria-label="Delete" />\n</Tip>`), ["2:tip-double-label"]);
  assert.deepEqual(rules(`<Tip label={t("x")}><button type="button" aria-label="x" /></Tip>`), ["1:tip-double-label"]);
});

test("tip-double-label: Tip alone, or an aria-label outside a Tip, passes", () => {
  assert.deepEqual(rules(`<Tip label="Delete"><Button size="icon" /></Tip>\n<Button size="icon" aria-label="Edit" />`), []);
});

test("tip-double-label: an aria-label further down inside the Tip is not the named element", () => {
  assert.deepEqual(rules(`<Tip label="More"><Button size="icon"><Icon aria-label="x" /></Button></Tip>`), []);
});

test("raw-button-type: a raw <button> without type is flagged", () => {
  assert.deepEqual(rules(`<button className="x" onClick={go}>Go</button>`), ["1:raw-button-type"]);
  assert.deepEqual(rules(`<button\n  className="x"\n>Go</button>`), ["1:raw-button-type"]);
});

test("raw-button-type: with type, with spread props, or the kit Button, passes", () => {
  assert.deepEqual(rules(`<button type="button">Go</button>\n<button {...props}>Go</button>\n<Button>Go</Button>`), []);
});

test("toast-raw-error: toast.error with just err.message is flagged", () => {
  assert.deepEqual(rules(`toast.error(err.message);\ntoast.error(e.message, { id: 1 });\ntoast.error(res.error?.message)`), ["1:toast-raw-error", "2:toast-raw-error", "3:toast-raw-error"]);
});

test("toast-raw-error: a sentence around the message, or a plain string, passes", () => {
  assert.deepEqual(rules("toast.error(`Could not save: ${err.message}`);\ntoast.error(\"Could not save\");\ntoast.error(err instanceof Error ? err.message : \"Could not save\");"), []);
});

test("box-radius: a padded layout box with rounded-md border is flagged", () => {
  assert.deepEqual(rules(`<li className="grid gap-1.5 rounded-md border p-2">`), ["1:box-radius"]);
  assert.deepEqual(rules(`<div className={cn("rounded-md border p-4", className)}>`), ["1:box-radius"]);
});

test("box-radius: rounded-lg boxes, controls, and unpadded or tiny-padded chips pass", () => {
  const src = `<div className="rounded-lg border p-2">\n<button type="button" className="rounded-md border p-2">x</button>\n<div className="rounded-md border px-2 py-1">\n<div className="rounded-md border p-0.5 shadow-sm">\n<div className="rounded-md py-1 border-l-2">`;
  assert.deepEqual(rules(src), []);
});
