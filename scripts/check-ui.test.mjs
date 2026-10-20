// node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { problemsIn } from "./check-ui.mjs";

const ids = (source) => problemsIn(source).map((p) => `${p.line}:${p.id}`);

test("a native date input is flagged", () => {
  assert.deepEqual(ids(`<input type="date" value={day} />`), ["1:native-date"]);
});

test("the kit's Input is a native input too, and datetime-local counts", () => {
  assert.deepEqual(ids(`<Input type="datetime-local" value={when} />`), ["1:native-date"]);
});

test("a tag over several lines is flagged on the line it opens", () => {
  assert.deepEqual(ids(`<div>\n  <Input\n    id="x"\n    type='date'\n  />\n</div>`), ["2:native-date"]);
});

test("a type that is an expression yielding date is flagged", () => {
  assert.deepEqual(ids(`<Input type={field.kind === "date" ? "date" : "text"} />`), ["1:native-date"]);
});

test("time inputs and other types stay allowed", () => {
  assert.deepEqual(ids(`<Input type="time" />\n<input type="number" />\n<Input type={t} />`), []);
});

test("CommitField type=\"date\" renders the kit picker, so it is allowed", () => {
  assert.deepEqual(ids(`<CommitField label="Day" type="date" value={d} onCommit={save} />`), []);
});

test("a ui-allow on the line above lets one through", () => {
  assert.deepEqual(ids(`{/* ui-allow: native-date — why */}\n<input type="date" />`), []);
});
