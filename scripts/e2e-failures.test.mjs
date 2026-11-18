// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cases, summary } from "./e2e-failures.mjs";

const report = (tests) => ({
  suites: [
    {
      title: "people.spec.ts",
      file: "people.spec.ts",
      specs: [{ title: "adds a person", file: "people.spec.ts", line: 12, tests: tests.add }],
      suites: [{ title: "Households", file: "people.spec.ts", specs: [{ title: "docks", file: "people.spec.ts", line: 70, tests: tests.dock }] }],
    },
  ],
});

test("cases reads every test with its describe titles, file and line", () => {
  const got = cases(report({ add: [{ projectName: "desktop", status: "expected" }], dock: [{ projectName: "mobile", status: "unexpected" }] }));
  assert.deepEqual(got, [
    { file: "people.spec.ts", line: 12, title: "adds a person", project: "desktop", status: "expected" },
    { file: "people.spec.ts", line: 70, title: "Households › docks", project: "mobile", status: "unexpected" },
  ]);
});

test("summary names each failing case once, with the projects it failed in, and links the run", () => {
  const a = report({ add: [{ projectName: "desktop", status: "unexpected" }], dock: [{ projectName: "mobile", status: "flaky" }] });
  const b = report({ add: [{ projectName: "mobile", status: "unexpected" }], dock: [] });
  const md = summary([a, b], "https://example.test/run/1");
  assert.match(md, /https:\/\/example\.test\/run\/1/);
  assert.match(md, /\*\*Failing cases\*\* \(2\)/);
  assert.match(md, /- `people\.spec\.ts`\n {2}- `people\.spec\.ts:12` adds a person \(desktop, mobile\)/);
  assert.match(md, /\*\*Passed only on retry\*\* \(1\):\n\n- `people\.spec\.ts`\n {2}- `people\.spec\.ts:70` Households › docks \(mobile\)/);
});

test("a red run with no failing case in its reports says to read the log", () => {
  assert.match(summary([report({ add: [{ projectName: "desktop", status: "expected" }], dock: [] })], "u"), /Read the run's log/);
});
