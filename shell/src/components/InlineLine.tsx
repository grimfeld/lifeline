import { useMemo, useState, type ReactNode } from "react";
import { CommandGroup, CommandItem, toast } from "@lifeline/ui";
import {
  appById,
  applySuggestion,
  dateReader,
  invokeCommand,
  isInvocable,
  readInlineLine,
  todayStr,
  useAllDocuments,
  useTagVocabulary,
  type InlineCommand,
  type InlinePart,
  type InlineReading,
} from "@lifeline/core";
import { CornerDownLeft, Terminal } from "lucide-react";
import { useDateLanguage } from "../settings/dateLanguage";

/**
 * The palette's inline mode (ADR 0091): mounted only while the query holds a
 * `!`, so the Documents and Tags it suggests from are loaded only then. When
 * the line carries a `!` mark it replaces the search (`children`) with what the
 * reader understood — a preview row Enter acts on, then the suggestions for
 * the word under the caret. A bare `!` at the caret offers the Commands above
 * the search, which still runs: "Super !" is text.
 */

/** Rows the palette's filter ranks above any match (CommandPalette's INLINE_MARK). */
export interface InlineLineProps {
  line: string;
  cursor: number;
  commands: readonly InlineCommand[];
  mark: string;
  /** Put a new line in the input, the caret at `cursor`. */
  onLine: (line: string, cursor: number) => void;
  /** Open the Command's dialog, or run its `run`: Enter on a line it cannot run headless. */
  onOpen: (c: InlineCommand) => void;
  /** A headless run succeeded: the palette closes. */
  onDone: () => void;
  children: ReactNode;
}

const bare = (title: string) => title.replace(/…$/, "");

function partText({ arg, text }: InlinePart, content: string | undefined): string {
  // Content, a Tag and a day read from `/` say themselves.
  if (arg.key === content || text.startsWith("#") || arg.kind === "date" || arg.kind === "time") return text;
  return `${arg.label}: ${text}`;
}

/** What Enter will do with this reading, in words; undefined when it runs. */
function gap(r: InlineReading): string | undefined {
  const c = r.command;
  if (!c) return undefined;
  if (r.problems.length) return r.problems.join(" · ");
  if (r.ambiguous.length) return r.ambiguous.map((a) => `Several Documents are called “${a.value}”`).join(" · ");
  if (r.missing.length) return `Missing ${r.missing.map((a) => a.label.toLowerCase()).join(", ")}`;
  return undefined;
}

/** Whether Enter has anything to do: a second `!` stops it, and so does a headless-only Command with no dialog to fall back on. */
function canEnter(r: InlineReading): boolean {
  const c = r.command;
  if (!c) return false;
  if (r.problems.some((p) => p.startsWith("One line runs one Command"))) return false;
  return r.ready || !!c.dialog || (!!c.run && !isInvocable(c));
}

export function InlineLine({ line, cursor, commands, mark, onLine, onOpen, onDone, children }: InlineLineProps) {
  const docs = useAllDocuments();
  const vocab = useTagVocabulary();
  const prefer = useDateLanguage();
  const [refusal, setRefusal] = useState<{ line: string; message: string } | null>(null);
  // `/` reads dates against today, every language at once, `prefer` settling a word two disagree on.
  const today = todayStr();
  const dates = useMemo(() => dateReader({ today, prefer }), [today, prefer]);
  const reading = useMemo(
    () => readInlineLine({ line, cursor, commands, lookup: { documents: docs, tags: vocab.map((v) => v.tag) }, dates }),
    [line, cursor, commands, docs, vocab, dates],
  );

  async function enter() {
    const c = reading.command;
    if (!c || !canEnter(reading)) return;
    if (!reading.ready) return onOpen(c);
    try {
      const result = await invokeCommand(c, reading.args);
      onDone();
      toast.success(result.message);
    } catch (e) {
      setRefusal({ line, message: e instanceof Error ? e.message : String(e) });
    }
  }

  const suggestionRows = reading.suggestions.map((s, i) => (
    <CommandItem
      key={`suggest-${i}-${s.insert}`}
      value={`inline suggestion ${i} ${s.insert}`}
      keywords={[mark]}
      onSelect={() => {
        const next = applySuggestion(line, s);
        onLine(next.line, next.cursor);
      }}
    >
      <span className="min-w-0 flex-1 truncate">{s.label}</span>
      {s.detail && <span className="text-muted-foreground shrink-0 text-xs">{s.kind === "command" ? (appById(s.detail)?.title ?? s.detail) : s.detail}</span>}
    </CommandItem>
  ));

  if (!reading.inline) {
    return (
      <>
        {suggestionRows.length > 0 && <CommandGroup heading="Commands for !">{suggestionRows}</CommandGroup>}
        {children}
      </>
    );
  }

  const c = reading.command;
  const content = c?.args?.find((a) => a.kind === "text")?.key ?? c?.args?.find((a) => a.kind === "longtext")?.key;
  const preview = c ? [bare(c.title), ...reading.parts.map((p) => partText(p, content))].join(" · ") : undefined;
  const note = refusal?.line === line ? refusal.message : gap(reading);
  const willOpen = c && !reading.ready && canEnter(reading);
  // While the caret sits on a mark being typed, its suggestions lead: Enter picks one. Otherwise Enter acts on the line.
  const [first] = reading.suggestions;
  const marking =
    !!first &&
    first.kind !== "argument" &&
    !(first.kind === "command" && c) &&
    !reading.suggestions.some((s) => line.slice(s.from, s.to) === s.insert);

  const previewRow = c && (
    <CommandItem
      key="inline-preview"
      value="inline preview"
      keywords={[mark]}
      disabled={!canEnter(reading)}
      onSelect={() => void enter()}
      data-testid="inline-preview"
    >
      {c.icon ? <c.icon /> : <Terminal />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{preview}</span>
        {note && (
          <span role={refusal?.line === line ? "alert" : undefined} className={refusal?.line === line ? "text-destructive block text-xs break-words" : "text-muted-foreground block text-xs break-words"}>
            {note}
            {willOpen && " — Enter opens its dialog"}
          </span>
        )}
      </span>
      {canEnter(reading) && <CornerDownLeft className="text-muted-foreground shrink-0" />}
    </CommandItem>
  );

  return (
    <CommandGroup heading={c ? appById(c.appId)?.title : "Command"}>
      {!c && reading.problems.length > 0 && <div className="text-muted-foreground px-2 py-1.5 text-xs break-words">{reading.problems.join(" · ")}</div>}
      {marking ? (
        <>
          {suggestionRows}
          {previewRow}
        </>
      ) : (
        <>
          {previewRow}
          {suggestionRows}
        </>
      )}
    </CommandGroup>
  );
}
