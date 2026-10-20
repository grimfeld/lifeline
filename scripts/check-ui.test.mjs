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

test("time inputs and other types stay allowed", () => {
  assert.deepEqual(rules(`<Input type="time" />\n<input type="number" />\n<Input type={t} />`), []);
});

test("CommitField type=\"date\" renders the kit picker, so it is allowed", () => {
  assert.deepEqual(rules(`<CommitField label="Day" type="date" value={d} onCommit={save} />`), []);
});

test("a ui-allow on the line above lets one through", () => {
  assert.deepEqual(rules(`{/* ui-allow: native-date — why */}\n<input type="date" />`), []);
});
