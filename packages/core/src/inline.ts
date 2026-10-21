import { isInvocable, linkCandidates, type LinkableDocument, type OwnedCommand } from "./commands";
import type { CommandArg } from "./manifest";
import { normalizeTag } from "./tags";

/**
 * The inline line reader (ADR 0091): one line typed in the palette, read into
 * one Command and its arguments. `!` marks the Command, `#` an option or Tag,
 * `@` a link, `key:` any argument; unmarked words are the content (the first
 * text argument) and quotes turn marks off. A mark counts only when a letter
 * follows it straight away, so "Super !" stays text. Nothing is guessed: what
 * the line does not mark stays content, and what a mark cannot settle is
 * reported (missing, ambiguous, a problem) rather than picked.
 *
 * The grammar comes from each Command's argument signature, so no App writes a
 * parser; Apps only add option keywords (`FieldOption.keywords`). Pure: no
 * React, no store — the palette passes what it has loaded as `lookup`.
 *
 * `/` (a date or time) plugs in through `dates`: without a date reader `/` is
 * no mark. The `args` are the raw values `readCommandArgs` reads, and serve as
 * a dialog's initial values when Enter cannot run the Command headless.
 */

export type InlineCommand = OwnedCommand;

/** What a date reader makes of the words after `/`: the moment, how many characters it read, and how to show it. */
export interface InlineDateReading {
  date?: string;
  time?: string;
  /** Characters read after the `/`. */
  length: number;
  label: string;
}

/** The `/` mark's reader, plugged in by the caller (English, French…). */
export interface InlineDateReader {
  read(rest: string): InlineDateReading | undefined;
  suggest(partial: string): { insert: string; label: string }[];
}

export interface InlineLookup {
  /** Tags in use, most used first: what `#` suggests for a Tag argument. */
  tags?: readonly string[];
  /** Documents an `@` link may name, already gated to the Workspace. */
  documents?: readonly LinkableDocument[];
}

export interface InlineLineInput {
  line: string;
  /** Where the caret is; suggestions are for the word under it. Defaults to the end. */
  cursor?: number;
  commands: readonly InlineCommand[];
  lookup?: InlineLookup;
  dates?: InlineDateReader;
}

export type InlineMarkKind = "command" | "option" | "tag" | "link" | "argument" | "date";

/** A stretch of the line and what it was read as. */
export interface InlineSpan {
  kind: InlineMarkKind | "content" | "problem";
  start: number;
  end: number;
}

/** One understood argument, for the preview, in the order the line gives them. */
export interface InlinePart {
  arg: CommandArg;
  text: string;
}

/** What may replace the word under the caret: `insert` takes `from`–`to`. */
export interface InlineSuggestion {
  kind: InlineMarkKind;
  label: string;
  detail?: string;
  insert: string;
  from: number;
  to: number;
}

/** An `@` that names several Documents: the dialog settles it. */
export interface InlineAmbiguity {
  arg: CommandArg;
  value: string;
  ids: string[];
}

export interface InlineReading {
  /** The line carries a `!` mark: the palette reads it instead of searching. */
  inline: boolean;
  command?: InlineCommand;
  args: Record<string, unknown>;
  parts: InlinePart[];
  missing: CommandArg[];
  ambiguous: InlineAmbiguity[];
  problems: string[];
  spans: InlineSpan[];
  suggestions: InlineSuggestion[];
  /** The Command can run headless as read: nothing missing, ambiguous or wrong. */
  ready: boolean;
  /** The line names a second Command: it runs one, so Enter has nothing to do (the problem says which). */
  secondCommand: boolean;
}

interface Token {
  start: number;
  end: number;
  raw: string;
}

const LETTER = /\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const KEY = /^(\p{L}[\p{L}\p{N}_-]*):/u;

/** Words split on spaces; a quote, wherever it opens in a word, runs to its closing quote. */
function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (/\s/.test(line[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < line.length && !/\s/.test(line[i])) {
      if (line[i] === '"') {
        const close = line.indexOf('"', i + 1);
        i = close < 0 ? line.length : close + 1;
      } else i++;
    }
    out.push({ start, end: i, raw: line.slice(start, i) });
  }
  return out;
}

function unquote(s: string): string {
  if (!s.startsWith('"')) return s;
  return s.endsWith('"') && s.length > 1 ? s.slice(1, -1) : s.slice(1);
}

/** How an inserted value is written: quoted when it holds a space. */
function quoted(s: string): string {
  return /\s/.test(s) ? `"${s}"` : s;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/…$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

const fold = (s: string) => s.trim().toLowerCase();

/** A mark at the start of a word: the character after it must be a letter (a digit too for `/`; a quote opens a value). */
function markOf(raw: string, dates: boolean): "!" | "#" | "@" | "/" | undefined {
  const c = raw[0];
  const next = raw[1] ?? "";
  if (c === "!" && LETTER.test(next)) return "!";
  if ((c === "#" || c === "@") && (LETTER.test(next) || next === '"')) return c;
  if (c === "/" && dates && LETTER_OR_DIGIT.test(next)) return "/";
  return undefined;
}

// ── The Command ───────────────────────────────────────────────────────────

/** How well a Command answers `!q`: a whole word of its name scores 80 or more, a start of one less. */
function commandScore(c: InlineCommand, q: string): number {
  const title = slug(c.title);
  const words = title.split("-");
  const keywords = (c.keywords ?? []).map(slug);
  const suffix = c.id.slice(c.id.lastIndexOf(".") + 1);
  let score = 0;
  if (q === "") score = 1;
  else if (q === c.id.toLowerCase() || q === title) score = 100;
  else if (q === suffix || words.includes(q) || keywords.includes(q)) score = 80;
  else if (title.startsWith(q)) score = 60;
  else if (words.some((w) => w.startsWith(q))) score = 50;
  else if (keywords.some((k) => k.startsWith(q)) || c.id.startsWith(q)) score = 40;
  else if (title.includes(q)) score = 20;
  if (score === 0) return 0;
  // Capture first, as the palette ranks; then the Command the word covers most of.
  return score + (c.capture ? 5 : 0) + (q.length / title.length) * 4;
}

function rankCommands(commands: readonly InlineCommand[], q: string) {
  return commands
    .map((c) => ({ c, score: commandScore(c, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title));
}

/** The name a picked Command is written with: its title as a word, unless another Command shares it. */
function commandName(c: InlineCommand, commands: readonly InlineCommand[]): string {
  const name = slug(c.title);
  return commands.some((o) => o !== c && (slug(o.title) === name || o.id === name)) ? c.id : name;
}

function resolveCommand(commands: readonly InlineCommand[], q: string): InlineCommand | undefined {
  const [first, second] = rankCommands(commands, q);
  if (!first || first.score < 80) return undefined;
  return second && second.score === first.score ? undefined : first.c;
}

// ── Arguments ─────────────────────────────────────────────────────────────

const isTags = (a: CommandArg) => a.kind === "list" && a.key === "tags";
const hasOptions = (a: CommandArg) => (a.kind === "select" || a.kind === "multiselect") && !!a.options?.length;

function optionMatches(o: { value: string; label: string; keywords?: string[] }, q: string): boolean {
  const f = fold(q);
  return fold(o.value) === f || fold(o.label) === f || slug(o.label) === f || (o.keywords ?? []).some((k) => fold(k) === f);
}

function argByName(args: CommandArg[], name: string): CommandArg | undefined {
  const f = fold(name);
  return args.find((a) => fold(a.key) === f || slug(a.label) === f || fold(a.label).replace(/\s+/g, "") === f);
}

export function readInlineLine(input: InlineLineInput): InlineReading {
  const { line, commands } = input;
  const cursor = input.cursor ?? line.length;
  const docs = input.lookup?.documents ?? [];
  const tokens = tokenize(line);
  const reading: InlineReading = {
    inline: false,
    args: {},
    parts: [],
    missing: [],
    ambiguous: [],
    problems: [],
    spans: [],
    suggestions: [],
    ready: false,
    secondCommand: false,
  };

  const commandTokens = tokens.filter((t) => markOf(t.raw, false) === "!");
  if (commandTokens.length === 0) {
    // A bare `!` under the caret offers the Commands, though the line is no mark yet ("Super !" stays text).
    reading.suggestions = suggest(input, tokens, cursor, undefined, reading);
    return reading;
  }
  reading.inline = true;
  const [first, ...extra] = commandTokens;
  const command = resolveCommand(commands, fold(first.raw.slice(1)));
  reading.command = command;
  if (!command) reading.problems.push(`No Command is called “${first.raw}”`);
  for (const t of extra) reading.problems.push(`One line runs one Command: “${t.raw}” is a second`);
  reading.secondCommand = extra.length > 0;

  const args = command?.args ?? [];
  const values: Record<string, unknown> = {};
  const content: string[] = [];
  let contentAt = -1;
  const filled = (a: CommandArg) => values[a.key] !== undefined;
  const put = (a: CommandArg, value: string, text: string) => {
    if (a.kind === "list" || a.kind === "multiselect") {
      values[a.key] = [...((values[a.key] as string[] | undefined) ?? []), value];
    } else if (filled(a)) {
      reading.problems.push(`${a.label} is given twice`);
      return;
    } else values[a.key] = value;
    reading.parts.push({ arg: a, text });
  };
  const span = (kind: InlineSpan["kind"], t: { start: number; end: number }) => reading.spans.push({ kind, start: t.start, end: t.end });

  /** An `@` (or a link's `key:`) value among the link arguments `among`. */
  const link = (among: CommandArg[], value: string) => {
    const want = fold(value);
    const hits = among
      .filter((a) => !filled(a))
      .map((a) => ({ a, docs: linkCandidates(a, docs).filter((d) => d.id === value || fold(d.title) === want) }))
      .filter((h) => h.docs.length > 0);
    if (among.length === 0) return void reading.problems.push(`${command!.title.replace(/…$/, "")} takes no link`);
    if (hits.length === 0) {
      const what = among.length === 1 ? among[0].label.toLowerCase() : "Document";
      return void reading.problems.push(`No ${what} is called “${value}”`);
    }
    if (hits.length > 1) return void reading.problems.push(`“${value}” fits ${hits.map((h) => h.a.label).join(" and ")}: say which with key:`);
    const [{ a, docs: found }] = hits;
    if (found.length > 1) {
      values[a.key] = undefined;
      reading.ambiguous.push({ arg: a, value, ids: found.map((d) => d.id) });
      reading.parts.push({ arg: a, text: `${value}? (${found.length} Documents)` });
      return;
    }
    put(a, found[0].id, found[0].title);
  };

  const option = (value: string) => {
    const fits = args.filter((a) => hasOptions(a) && a.options!.some((o) => optionMatches(o, value)));
    if (fits.length > 1) return void reading.problems.push(`#${value} fits ${fits.map((a) => a.label).join(" and ")}: say which with key:`);
    if (fits.length === 1) {
      const o = fits[0].options!.find((x) => optionMatches(x, value))!;
      return put(fits[0], o.value, o.label);
    }
    const tags = args.find(isTags);
    const tag = normalizeTag(value);
    if (tags && tag) return put(tags, tag, `#${tag}`);
    reading.problems.push(`No option or Tag is called #${value}`);
  };

  let skipTo = -1;
  for (const t of tokens) {
    if (t.start < skipTo) continue;
    const mark = markOf(t.raw, !!input.dates);
    const body = unquote(t.raw.slice(1));
    if (t.raw.startsWith('"')) {
      if (contentAt < 0) contentAt = reading.parts.length;
      content.push(unquote(t.raw));
      span("content", t);
    } else if (mark === "!") {
      span(t === first && command ? "command" : "problem", t);
    } else if (!command || !command.args) {
      // Nothing to fill: the rest of the line is the Command's business once its dialog opens.
    } else if (mark === "#") {
      span("option", t);
      option(body);
    } else if (mark === "@") {
      span("link", t);
      link(args.filter((a) => a.kind === "link"), body);
    } else if (mark === "/" && input.dates) {
      const got = input.dates.read(line.slice(t.start + 1));
      if (!got) {
        reading.problems.push(`“${t.raw}” is not a date or time`);
        span("problem", t);
        continue;
      }
      const end = t.start + 1 + got.length;
      skipTo = end;
      span("date", { start: t.start, end });
      const dateArg = args.find((a) => a.kind === "date" && !filled(a));
      const timeArg = args.find((a) => a.kind === "time" && !filled(a));
      if ((got.date && !dateArg) || (got.time && !timeArg)) reading.problems.push(`${command.title.replace(/…$/, "")} takes no ${got.date && !dateArg ? "date" : "time"}`);
      else {
        if (got.date) values[dateArg!.key] = got.date;
        if (got.time) values[timeArg!.key] = got.time;
        reading.parts.push({ arg: (dateArg ?? timeArg)!, text: got.label });
      }
    } else if (!t.raw.includes("://") && KEY.test(t.raw) && argByName(args, KEY.exec(t.raw)![1])) {
      const name = KEY.exec(t.raw)![1];
      const a = argByName(args, name)!;
      const value = unquote(t.raw.slice(name.length + 1));
      span("argument", t);
      if (value === "") continue;
      if (a.kind === "link") link([a], value);
      else if (hasOptions(a)) {
        const o = a.options!.find((x) => optionMatches(x, value));
        if (o) put(a, o.value, o.label);
        else reading.problems.push(`${a.label}: no option “${value}”`);
      } else put(a, value, value);
    } else {
      if (contentAt < 0) contentAt = reading.parts.length;
      content.push(t.raw);
      span("content", t);
    }
  }

  if (command?.args) {
    const target = args.filter((a) => a.kind === "text").concat(args.filter((a) => a.kind === "longtext")).find((a) => !filled(a));
    if (content.length) {
      const text = content.join(" ");
      if (target) {
        values[target.key] = text;
        reading.parts.splice(contentAt, 0, { arg: target, text });
      } else reading.problems.push(`${command.title.replace(/…$/, "")} takes no content: “${text}”`);
    }
    for (const [k, v] of Object.entries(values)) if (v !== undefined) reading.args[k] = v;
    reading.missing = args.filter((a) => a.required && reading.args[a.key] === undefined && !reading.ambiguous.some((x) => x.arg === a));
  }
  reading.ready = !!command && isInvocable(command) && reading.missing.length === 0 && reading.ambiguous.length === 0 && reading.problems.length === 0;
  reading.suggestions = suggest(input, tokens, cursor, command, reading);
  return reading;
}

// ── Suggestions at the caret ──────────────────────────────────────────────

const LIMIT = 8;

function suggest(input: InlineLineInput, tokens: Token[], cursor: number, command: InlineCommand | undefined, reading: InlineReading): InlineSuggestion[] {
  const token = tokens.find((t) => t.start <= cursor && cursor <= t.end) ?? { start: cursor, end: cursor, raw: "" };
  const { from, to } = { from: token.start, to: token.end };
  const mark = markOf(token.raw, !!input.dates) ?? (token.raw === "!" ? "!" : undefined);
  const args = command?.args ?? [];
  const given = (a: CommandArg) => reading.args[a.key] !== undefined;

  if (mark === "!") {
    const q = fold(token.raw.slice(1));
    return rankCommands(input.commands, q).map(({ c }) => ({
      kind: "command" as const,
      label: c.title,
      detail: c.appId,
      insert: `!${commandName(c, input.commands)}`,
      from,
      to,
    }));
  }
  if (!command?.args || token.raw.startsWith('"')) return [];
  const partial = fold(unquote(token.raw.slice(1)));
  const near = (s: string, q: string) => fold(s).startsWith(q) || fold(s).includes(q);
  const byStart = <T,>(list: T[], key: (x: T) => string, q: string) =>
    list.filter((x) => near(key(x), q)).sort((a, b) => Number(fold(key(b)).startsWith(q)) - Number(fold(key(a)).startsWith(q)));

  if (mark === "#" || token.raw === "#") {
    const options = args
      .filter((a) => hasOptions(a) && (a.kind === "multiselect" || !given(a)))
      .flatMap((a) => a.options!.filter((o) => [o.value, o.label, ...(o.keywords ?? [])].some((s) => near(s, partial))).map((o) => ({ a, o })))
      .map(({ a, o }) => ({ kind: "option" as const, label: o.label, detail: a.label, insert: `#${quoted(o.value)}`, from, to }));
    const tags = args.some(isTags)
      ? byStart([...(input.lookup?.tags ?? [])], (t) => t, partial).map((t) => ({ kind: "tag" as const, label: `#${t}`, detail: "Tag", insert: `#${t}`, from, to }))
      : [];
    return [...options, ...tags].slice(0, LIMIT);
  }
  const linkSuggestions = (among: CommandArg[], q: string, prefix: string) =>
    among
      .filter((a) => !given(a))
      .flatMap((a) => byStart(linkCandidates(a, input.lookup?.documents ?? []), (d) => d.title, q).map((d) => ({ a, d })))
      .slice(0, LIMIT)
      .map(({ a, d }) => ({ kind: "link" as const, label: d.title, detail: a.label, insert: `${prefix}${quoted(d.title)}`, from, to }));
  if (mark === "@" || token.raw === "@") return linkSuggestions(args.filter((a) => a.kind === "link"), partial, "@");
  if (mark === "/" && input.dates) return input.dates.suggest(token.raw.slice(1)).map((s) => ({ kind: "date" as const, ...s, insert: `/${s.insert}`, from, to }));

  const key = KEY.exec(token.raw);
  const a = key ? argByName(args, key[1]) : undefined;
  if (key && a) {
    const value = fold(unquote(token.raw.slice(key[1].length + 1)));
    if (a.kind === "link") return linkSuggestions([a], value, `${key[1]}:`);
    if (hasOptions(a))
      return a.options!.filter((o) => near(o.label, value) || near(o.value, value)).map((o) => ({ kind: "option" as const, label: o.label, detail: a.label, insert: `${key[1]}:${quoted(o.value)}`, from, to }));
    return [];
  }
  // A plain word, or none yet: the arguments still to give, by name.
  const q = fold(token.raw);
  return args
    .filter((x) => x.kind !== "rows" && !given(x) && (q === "" || fold(x.key).startsWith(q) || slug(x.label).startsWith(q)))
    .filter(() => q === "" || !token.raw.includes(":"))
    .map((x) => ({ kind: "argument" as const, label: `${x.key}:`, detail: x.label, insert: `${x.key}:`, from, to }));
}

/** The line with a suggestion put in place, and where the caret goes: after it, past a space unless it ends on `:`. */
export function applySuggestion(line: string, s: InlineSuggestion): { line: string; cursor: number } {
  const after = line.slice(s.to);
  const gap = s.insert.endsWith(":") || after.startsWith(" ") ? "" : " ";
  const head = line.slice(0, s.from) + s.insert + gap;
  return { line: head + after, cursor: head.length + (gap === "" && after.startsWith(" ") && !s.insert.endsWith(":") ? 1 : 0) };
}
