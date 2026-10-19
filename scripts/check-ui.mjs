#!/usr/bin/env node
// The mechanical half of CODING_STANDARDS.md § UI (ADR 0079): checks the
// lines a change adds to screen code — `.tsx` outside the kit itself.
//
//   node scripts/check-ui.mjs          lines added since the merge base with origin/master
//   node scripts/check-ui.mjs --all    every line (the cleanup backlog)
//
// CHECK_UI_BASE overrides the base ref. A line a rule must let through carries
// `ui-allow: <rule>` and the reason, on that line or the one above.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const SCOPE = /^(apps\/[^/]+\/src|shell\/src|packages\/(?!ui\/)[^/]+\/src)\/.+\.tsx$/;
const SKIP = /\.(test|spec)\.tsx$|\/e2e\//;
const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const KIT_CONTROLS = /^<(Button|Input|SelectTrigger|Textarea)\b/;

/** Line rules: a regex over one source line. */
const LINE_RULES = [
  {
    id: "raw-colour",
    heading: "Colour",
    test: new RegExp(`\\b(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|shadow)-(?:${PALETTE})-\\d{2,3}\\b|-\\[(?:#|var\\(--chart-)`),
    message: "raw palette colour or arbitrary colour — use a token (text-success, text-warning, text-destructive…) or a slot class (bg-slot-blue)",
  },
  {
    id: "text-size",
    heading: "Type",
    test: /\btext-\[\d/,
    message: "arbitrary text size — use the scale (text-2xs, text-xs, text-sm…)",
  },
  {
    id: "class-template",
    heading: "Classes",
    test: /className=\{`/,
    message: "template-literal className — compose with cn()",
  },
  {
    id: "browser-dialog",
    heading: "Deleting",
    test: /\bwindow\.(?:confirm|prompt|alert)\(|(?<![\w.])(?:confirm|prompt|alert)\(/,
    message: "browser dialog — delete with an Undo toast; confirm only what Undo can't bring back, in an AlertDialog",
  },
  {
    id: "kit-bypass",
    heading: "Components",
    test: /from\s+["'](?:radix-ui|@radix-ui\/[^"']+|sonner|cmdk|vaul)["']/,
    message: "UI library imported directly — import it from @lifeline/ui",
  },
  {
    id: "sm-breakpoint",
    heading: "Layout",
    test: /(?<![\w-])sm:(?!max-w-)/,
    message: "layout switches at md (the phone line); sm: is only for dialog widths",
  },
  {
    id: "page-title",
    heading: "Type",
    test: /<h1\b/,
    message: "page title outside the kit — use PageHeader from @lifeline/ui",
  },
  {
    id: "phone-hook",
    heading: "Layout",
    test: /\buseIsMobile\b/,
    message: "useIsMobile is deprecated — use usePhone() from @lifeline/ui",
  },
  {
    id: "hand-listbox",
    heading: "Components",
    test: /\brole=["'{`]*listbox\b/,
    message: "hand-rolled role=\"listbox\" — use Combobox from @lifeline/ui",
  },
];

/** Element rules: run on a whole JSX opening tag that starts on a checked line; `before` is the source just ahead of it (three lines). */
const ELEMENT_RULES = [
  {
    id: "control-size",
    heading: "Sizes",
    test: (tag) => KIT_CONTROLS.test(tag) && /className=[^>]*?(?<=[\s"'`{])(?:size|h)-(?:\d|\[)/.test(tag),
    message: "size or height class on a kit control — use its size prop (icon, icon-sm, icon-xs, sm, xs, lg; SelectTrigger size=\"sm\")",
  },
  {
    id: "icon-label",
    heading: "Icons",
    // <Tip label> names the Button it wraps (through a trigger, too).
    test: (tag, before) => /^<Button\b/.test(tag) && /\bsize=["']icon/.test(tag) && !/\baria-label(?:ledby)?=/.test(tag) && !/<Tip\b[^>]*\blabel=/.test(before),
    message: "icon-only Button without aria-label (or a <Tip label> around it)",
  },
  {
    id: "icon-title",
    heading: "Components",
    test: (tag) => /^<Button\b/.test(tag) && /\bsize=["']icon/.test(tag) && /(?<![\w-])title=/.test(tag),
    message: "title= on an icon Button — wrap it in <Tip label> (Tooltip), which names it too",
  },
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const all = process.argv.includes("--all");

/** Map of file → Set of line numbers to check (null = every line). */
function changedLines() {
  const files = new Map();
  if (all) {
    for (const f of git("ls-files").split("\n")) if (SCOPE.test(f) && !SKIP.test(f)) files.set(f, null);
    return files;
  }
  const baseRef = process.env.CHECK_UI_BASE ?? "origin/master";
  let base = git("merge-base", baseRef, "HEAD").trim();
  // On the base branch itself, check the newest commit.
  if (base === git("rev-parse", "HEAD").trim()) base = git("rev-parse", "HEAD~1").trim();
  let file = null;
  for (const line of git("diff", "-U0", "--no-color", base, "--", "*.tsx").split("\n")) {
    if (line.startsWith("+++ ")) {
      const f = line.slice(4).replace(/^b\//, "");
      file = SCOPE.test(f) && !SKIP.test(f) && existsSync(f) ? f : null;
      if (file && !files.has(file)) files.set(file, new Set());
    } else if (file && line.startsWith("@@")) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = 0; i < count; i++) files.get(file).add(start + i);
    }
  }
  return files;
}

const allowed = (lines, i, id) => [lines[i], lines[i - 1] ?? ""].some((l) => new RegExp(`ui-allow:\\s*${id}\\b`).test(l));

/** JSX opening tags starting with a capital letter: [line index, tag text, the three lines before it]. */
function openingTags(lines) {
  const tags = [];
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/<[A-Z][\w.]*/g)) {
      let text = lines[i].slice(m.index);
      let depth = 0;
      let j = i;
      let end = -1;
      for (;;) {
        depth = 0; // each pass rescans the whole tag so far
        for (let k = 0; k < text.length; k++) {
          const c = text[k];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === ">" && depth === 0 && text[k - 1] !== "=") {
            end = k;
            break;
          }
        }
        if (end >= 0 || j + 1 >= lines.length || j - i > 40) break;
        j++;
        text += " " + lines[j];
      }
      const before = [...lines.slice(Math.max(0, i - 3), i), lines[i].slice(0, m.index)].join(" ");
      tags.push([i, end >= 0 ? text.slice(0, end + 1) : text, before]);
    }
  }
  return tags;
}

const problems = [];
for (const [file, only] of changedLines()) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const checked = (i) => only === null || only.has(i + 1);
  lines.forEach((line, i) => {
    if (!checked(i)) return;
    for (const r of LINE_RULES) if (r.test.test(line) && !allowed(lines, i, r.id)) problems.push({ file, line: i + 1, r });
  });
  for (const [i, tag, before] of openingTags(lines)) {
    if (!checked(i)) continue;
    for (const r of ELEMENT_RULES) if (r.test(tag, before) && !allowed(lines, i, r.id)) problems.push({ file, line: i + 1, r });
  }
}

for (const { file, line, r } of problems) console.log(`${file}:${line}  ${r.id}  ${r.message}  (CODING_STANDARDS.md § UI › ${r.heading})`);
if (problems.length) {
  console.log(`\n${problems.length} UI problem${problems.length === 1 ? "" : "s"}. A real exception carries \`ui-allow: <rule> — why\` on the line or the one above.`);
  process.exit(1);
}
console.log(all ? "check-ui: every line clean" : "check-ui: added lines clean");
