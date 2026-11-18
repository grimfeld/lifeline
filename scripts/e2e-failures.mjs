// The failing cases of a Playwright run, as the Markdown the nightly e2e workflow puts in
// its issue (.github/workflows/e2e.yml, ADR 0129).
//
//   node scripts/e2e-failures.mjs <run-url> <report.json>...   prints the issue's Markdown
//
// Each report is a shard's `json` reporter output (shell/e2e-results.json in CI). A case
// counts as failing when Playwright's verdict is "unexpected": it failed every try. A case
// that passed on retry ("flaky") is listed apart, since it does not turn the run red.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Every { file, line, title, project, status } in a Playwright json report. */
export function cases(report) {
  const out = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? [])
        out.push({ file: spec.file ?? suite.file, line: spec.line, title: [...titles, spec.title].join(" › "), project: t.projectName, status: t.status });
    // A file's suite has the file name as its title: leave it out of the case's title.
    for (const child of suite.suites ?? []) walk(child, child.title === child.file || !child.title ? titles : [...titles, child.title]);
  };
  for (const s of report.suites ?? []) walk(s, []);
  return out;
}

/** "file:line title" lines grouped by file, each with the projects it failed in. */
function list(found) {
  const byCase = new Map();
  for (const c of found) {
    const key = `${c.file}:${c.line} ${c.title}`;
    byCase.set(key, [...(byCase.get(key) ?? []), c.project]);
  }
  const byFile = new Map();
  for (const [key, projects] of byCase) {
    const file = key.slice(0, key.indexOf(":"));
    byFile.set(file, [...(byFile.get(file) ?? []), `  - \`${key.slice(0, key.indexOf(" "))}\` ${key.slice(key.indexOf(" ") + 1)} (${[...new Set(projects)].sort().join(", ")})`]);
  }
  return [...byFile].sort(([a], [b]) => a.localeCompare(b)).flatMap(([file, lines]) => [`- \`${file}\``, ...lines]);
}

/** The Markdown naming the failing (and flaky) cases of these reports, linking the run. */
export function summary(reports, runUrl) {
  const all = reports.flatMap(cases);
  const failed = all.filter((c) => c.status === "unexpected");
  const flaky = all.filter((c) => c.status === "flaky");
  const lines = [`The nightly e2e run failed: ${runUrl}`, ""];
  if (failed.length) lines.push(`**Failing cases** (${failed.length}):`, "", ...list(failed));
  else lines.push("No case failed in the reports: the run broke before or around the tests (setup, a server, a timeout). Read the run's log.");
  if (flaky.length) lines.push("", `**Passed only on retry** (${flaky.length}):`, "", ...list(flaky));
  return lines.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [runUrl, ...files] = process.argv.slice(2);
  if (!runUrl) {
    console.error("usage: node scripts/e2e-failures.mjs <run-url> <report.json>...");
    process.exit(2);
  }
  console.log(summary(files.map((f) => JSON.parse(readFileSync(f, "utf8"))), runUrl));
}
