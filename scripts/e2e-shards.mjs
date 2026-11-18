// Splits the e2e gate across runners by running time, not by case count (#564).
//
//   node scripts/e2e-shards.mjs plan <n> <list.json> <durations.json>
//       prints the GitHub Actions matrix: {"include":[{"shard":1,"files":"<patterns>"},…]}
//   node scripts/e2e-shards.mjs durations <report.json>...
//       prints the seconds each spec file took, for shell/e2e/durations.json
//
// Playwright's own --shard gives each runner the same number of cases, in file order, so
// slow files that sit together in the alphabet land on one runner and it finishes minutes
// after the others. Here each spec file goes, slowest first, to the runner with the least
// work so far. A file's time comes from shell/e2e/durations.json (refreshed from an
// integration run's reports); a file it doesn't know yet counts as its cases times the
// median seconds per case.
//
// <list.json> is `playwright test --list --reporter=json` for the projects the run takes;
// a report is the `json` reporter's output (shell/e2e-results.json in CI). Setup files
// (seed) are left out: every runner runs them as its cases' dependency.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Every test in a Playwright json report (or --list output) as { file, seconds }. */
function tests(report) {
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? [])
        out.push({ file: spec.file ?? suite.file, seconds: (t.results ?? []).reduce((s, r) => s + (r.duration ?? 0), 0) / 1000 });
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites ?? []) walk(s);
  return out.filter((t) => !/\.setup\.[cm]?[jt]s$/.test(t.file));
}

/** The number of cases in each spec file of a --list report. */
export function caseCounts(list) {
  const counts = {};
  for (const t of tests(list)) counts[t.file] = (counts[t.file] ?? 0) + 1;
  return counts;
}

/** Seconds each spec file took across these reports, every try and project counted, rounded. */
export function fileSeconds(reports) {
  const seconds = {};
  for (const t of reports.flatMap(tests)) seconds[t.file] = (seconds[t.file] ?? 0) + t.seconds;
  return Object.fromEntries(Object.keys(seconds).sort().map((f) => [f, Math.round(seconds[f])]));
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/**
 * `counts` (file → cases) split into `n` lists of files whose known or estimated seconds
 * are as even as a greedy split gets: the slowest file first, each to the lightest list.
 * Ties go by file name, so the same inputs always give the same split. Lists may be empty
 * when there are fewer files than runners.
 */
export function plan(counts, durations, n) {
  const known = Object.keys(counts).filter((f) => durations[f] > 0);
  const perCase = median(known.map((f) => durations[f] / counts[f])) || 10;
  const cost = (f) => (durations[f] > 0 ? durations[f] : counts[f] * perCase);
  const files = Object.keys(counts).sort((a, b) => cost(b) - cost(a) || a.localeCompare(b));
  const shards = Array.from({ length: n }, () => ({ seconds: 0, files: [] }));
  for (const f of files) {
    const lightest = shards.reduce((min, s) => (s.seconds < min.seconds ? s : min));
    lightest.files.push(f);
    lightest.seconds += cost(f);
  }
  return shards.map((s) => s.files.sort());
}

/**
 * A file as a Playwright CLI filter that matches it and no other: the CLI reads a file
 * argument as a regular expression searched anywhere in the path, so `people.spec.ts`
 * alone would also run `peek-people.spec.ts`.
 */
export const pattern = (file) => `/${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

/** The matrix for `plan`: one entry per runner with cases, its files as CLI filters. */
export function matrix(counts, durations, n) {
  const include = plan(counts, durations, n)
    .filter((files) => files.length)
    .map((files, i) => ({ shard: i + 1, files: files.map(pattern).join(" ") }));
  return { include };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, ...args] = process.argv.slice(2);
  const read = (f) => JSON.parse(readFileSync(f, "utf8"));
  if (command === "plan" && args.length === 3) {
    const [n, list, durations] = args;
    console.log(JSON.stringify(matrix(caseCounts(read(list)), read(durations), Number(n))));
  } else if (command === "durations" && args.length) {
    console.log(JSON.stringify(fileSeconds(args.map(read)), null, 2));
  } else {
    console.error("usage: node scripts/e2e-shards.mjs plan <n> <list.json> <durations.json>\n       node scripts/e2e-shards.mjs durations <report.json>...");
    process.exit(2);
  }
}
