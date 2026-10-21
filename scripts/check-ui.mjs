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
import { pathToFileURL } from "node:url";

const SCOPE = /^(apps\/[^/]+\/src|shell\/src|packages\/(?!ui\/)[^/]+\/src)\/.+\.tsx$/;
const SKIP = /\.(test|spec)\.tsx$|\/e2e\//;
const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
/** Kit controls by name, imported from @lifeline/ui or not. */
const KIT_CONTROLS = new Set(["Button", "Input", "SelectTrigger", "Textarea"]);
/**
 * Kit components a size class legitimately sizes: boxes the page lays out (a Card,
 * a Page, a Sheet's or Dialog's content, a map), not controls with a size of their own.
 */
const KIT_LAYOUT = /^(?:Card\w*|Page\w*|EmptyState|\w*Content|\w*(?:Header|Footer|Title|Description)|\w*(?:List|Group)|Command|Tabs|Separator|MapView|GraphView|GeoField|PhoneDock\w*|Field|Label|Toaster)$/;
const SIZE_CLASS = /className=[^>]*?(?<=[\s"'`{])(?:size|h)-(?:\d|\[)/;

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
    id: "native-time",
    heading: "Components",
    test: /\btype=\{?\s*["'`]time["'`]/,
    message: "the browser's time input — use TimeField from @lifeline/ui (CommitField type=\"time\" in a Peek)",
  },
  {
    id: "hand-listbox",
    heading: "Components",
    test: /\brole=["'{`]*listbox\b/,
    message: "hand-rolled role=\"listbox\" — use Combobox from @lifeline/ui",
  },
  {
    id: "toast-raw-error",
    heading: "Forms and feedback",
    // The argument is nothing but `<path>.message`; a template or a fallback around it passes.
    test: /\btoast\.error\(\s*[A-Za-z_$][\w$]*(?:\??\.[\w$]+)*\??\.message\s*[,)]/,
    message: "toast.error with a raw Error.message alone — say what failed, in a sentence a person understands (`Could not save: ${e.message}`)",
  },
];

/** The local names of the components a file imports from @lifeline/ui. */
export function kitImports(source) {
  const names = new Set();
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@lifeline\/ui["']/g)) {
    for (const part of m[1].split(",")) {
      const local = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop();
      if (/^[A-Z]/.test(local ?? "")) names.add(local);
    }
  }
  return names;
}

/** Whether a tag (`<Name …>`) is a kit control: sized by its props, never by a class. */
const isKitControl = (tag, kit) => {
  const name = /^<([\w.]+)/.exec(tag)?.[1] ?? "";
  return KIT_CONTROLS.has(name) || (kit.has(name) && !KIT_LAYOUT.test(name));
};

/**
 * Element rules: run on a whole JSX opening tag that starts on a checked line; `before` is
 * the source just ahead of it (three lines), `kit` the names the file imports from @lifeline/ui.
 */
const ELEMENT_RULES = [
  {
    id: "control-size",
    heading: "Sizes",
    test: (tag, _before, kit) => isKitControl(tag, kit) && SIZE_CLASS.test(tag),
    message: "size or height class on a kit control — use its size prop (Button icon, icon-sm, icon-xs, sm, xs, lg, touch; SelectTrigger size=\"sm\")",
  },
  {
    id: "icon-label",
    heading: "Icons",
    // <Tip label> names the Button it wraps (through a trigger, too).
    test: (tag, before) => /^<Button\b/.test(tag) && /\bsize=["']icon/.test(tag) && !/\baria-label(?:ledby)?=/.test(tag) && !/<Tip\b[^>]*\blabel=/.test(before),
    message: "icon-only Button without aria-label (or a <Tip label> around it)",
  },
  {
    id: "native-date",
    heading: "Forms and feedback",
    // ADR 0087. `type` as a literal or an expression that can yield one; time inputs stay native.
    test: (tag) => /^<(?:Input|input)\b/.test(tag) && /\btype=(?:\{[^}]*)?["'`](?:date|datetime-local)["'`]/.test(tag),
    message: "native date/datetime-local input — use DatePicker or DateTimeField (or CommitField type=\"date\") from @lifeline/ui",
  },
  {
    id: "icon-title",
    heading: "Components",
    test: (tag) => /^<Button\b/.test(tag) && /\bsize=["']icon/.test(tag) && /(?<![\w-])title=/.test(tag),
    message: "title= on an icon Button — wrap it in <Tip label> (Tooltip), which names it too",
  },
  {
    id: "tip-double-label",
    heading: "Components",
    // The tag is the Tip's direct child: its opening tag is the last thing before it.
    test: (tag, before) => /\baria-label=/.test(tag) && /<Tip\b[^<]*\blabel=[^<]*>\s*$/.test(before),
    message: "aria-label inside <Tip label> — Tip already sets the accessible name; write it once, on the Tip",
  },
  {
    id: "raw-button-type",
    heading: "Components",
    // Spread props may carry the type.
    test: (tag) => /^<button\b/.test(tag) && !/\btype=/.test(tag) && !/\{\.\.\./.test(tag),
    message: "raw <button> without type — add type=\"button\" (a raw button is for a whole row or tile; otherwise use Button)",
  },
  {
    id: "box-radius",
    heading: "Layout",
    // Narrowest pattern with no false positives: a container tag (never a button/control), padded
    // like a box (p-2 and up). Chips, floating toolbars and unpadded wrappers can't be told from
    // boxes by class alone, so they are left alone.
    test: (tag) =>
      /^<(?:div|li|section|article|aside|ul)\b/.test(tag) && /(?<![\w-])rounded-md(?![\w-])/.test(tag) && /(?<![\w:-])border(?![\w-])/.test(tag) && /(?<![\w-])p-(?:[2-9]|\d{2}|\[)/.test(tag),
    message: "boxes are rounded-lg border, not rounded-md (rounded-md is for controls); a Card is Card",
  },
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });

/** Map of file → Set of line numbers to check (null = every line). */
function changedLines(all) {
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

/** JSX opening tags starting with a capital letter, plus `<input>`, `<button>` and box tags: [line index, tag text, the three lines before it]. */
function openingTags(lines) {
  const tags = [];
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/<(?:[A-Z][\w.]*|input\b|button\b|div\b|li\b|section\b|article\b|aside\b|ul\b)/g)) {
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

/** The problems in one file's source, on the lines `checked(index)` accepts: [{ line, r }]. */
export function checkSource(source, checked = () => true) {
  const lines = source.split(/\r?\n/);
  const kit = kitImports(source);
  const problems = [];
  lines.forEach((line, i) => {
    if (!checked(i)) return;
    for (const r of LINE_RULES) if (r.test.test(line) && !allowed(lines, i, r.id)) problems.push({ line: i + 1, r });
  });
  for (const [i, tag, before] of openingTags(lines)) {
    if (!checked(i)) continue;
    for (const r of ELEMENT_RULES) if (r.test(tag, before, kit) && !allowed(lines, i, r.id)) problems.push({ line: i + 1, r });
  }
  return problems;
}

function main() {
  const all = process.argv.includes("--all");
  const problems = [];
  for (const [file, only] of changedLines(all)) {
    const checked = (i) => only === null || only.has(i + 1);
    for (const p of checkSource(readFileSync(file, "utf8"), checked)) problems.push({ file, ...p });
  }
  for (const { file, line, r } of problems) console.log(`${file}:${line}  ${r.id}  ${r.message}  (CODING_STANDARDS.md § UI › ${r.heading})`);
  if (problems.length) {
    console.log(`\n${problems.length} UI problem${problems.length === 1 ? "" : "s"}. A real exception carries \`ui-allow: <rule> — why\` on the line or the one above.`);
    process.exit(1);
  }
  console.log(all ? "check-ui: every line clean" : "check-ui: added lines clean");
}

// Run as a script; imported (check-ui.test.mjs), it only exports.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
