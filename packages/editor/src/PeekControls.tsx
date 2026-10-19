import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, Textarea, toast } from "@lifeline/ui";
import { effectiveTags, extractProseTags, normalizeTag, patchDocument, useTagVocabulary, type Document } from "@lifeline/core";

/**
 * Small controls an App builds its editable Peek part from (ADR 0085). They
 * are not a form over Fields: each App picks the controls that fit its own
 * Fields and writes them through its own operations. Ids are made per Peek, so
 * they never collide with the Vault editor's form beneath it.
 */

/** One labelled control in a Peek part. */
export function PeekField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={htmlFor} className="text-muted-foreground text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Write a patch, telling the user when the store refused it. */
export function savePatch(id: string, patch: Record<string, unknown>): Promise<void> {
  return patchDocument(id, patch).then(
    () => undefined,
    (err: unknown) => void toast.error(`Couldn’t save — ${err instanceof Error ? err.message : String(err)}`),
  );
}

/**
 * A text kept locally while typed and handed to `onCommit` a moment after the
 * typing stops, on Enter, on leaving it, and when the Peek closes — so a
 * keystroke never waits on the store, and the live value shows again once it
 * changes elsewhere.
 */
export function DraftText({ label, value, onCommit, type = "text", multiline, placeholder }: { label: string; value: string; onCommit: (v: string) => void; type?: "text" | "url" | "date"; multiline?: boolean; placeholder?: string }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef({ draft, value, onCommit });
  latest.current = { draft, value, onCommit };
  const commit = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const { draft: d, value: v, onCommit: write } = latest.current;
    if (d !== null && d !== v) write(d);
    setDraft(null);
  };
  useEffect(() => () => commit(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (v: string) => {
    setDraft(v);
    if (timer.current) window.clearTimeout(timer.current);
    // A date is whole once picked; text waits for the typing to stop.
    timer.current = window.setTimeout(commit, type === "date" ? 0 : 800);
  };
  const shown = draft ?? value;
  return (
    <PeekField label={label} htmlFor={id}>
      {multiline ? (
        <Textarea id={id} rows={2} value={shown} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={commit} />
      ) : (
        <Input
          id={id}
          className="h-8 min-w-0"
          type={type}
          value={shown}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      )}
    </PeekField>
  );
}

const NONE = "__none__";

/** A single choice among an App's own options; "" is none (offered only when `optional`). */
export function ChoiceField({ label, value, options, onChange, optional }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (v: string) => void; optional?: boolean }) {
  const id = useId();
  return (
    <PeekField label={label} htmlFor={id}>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger id={id} aria-label={label} className="h-8 w-full min-w-0">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {(optional || !value) && <SelectItem value={NONE}>—</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PeekField>
  );
}

/** Other names the Document is linked by (CONTEXT.md "Alias"), written comma-separated. */
export function AliasesField({ doc }: { doc: Document }) {
  const aliases = Array.isArray(doc.aliases) ? (doc.aliases as string[]) : [];
  const parse = (t: string) => t.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <DraftText
      label="Aliases"
      value={aliases.join(", ")}
      placeholder="Other names, comma-separated"
      onCommit={(text) => {
        const next = parse(text);
        if (JSON.stringify(next) !== JSON.stringify(aliases)) void savePatch(doc.id, { aliases: next });
      }}
    />
  );
}

/** The Document's Tags: the ones given by hand edited, the ones written in its text shown beside. */
export function TagsField({ doc }: { doc: Document }) {
  const id = useId();
  const body = typeof doc.body === "string" ? doc.body : "";
  const proseTags = extractProseTags(body);
  const explicit = (Array.isArray(doc.tags) ? doc.tags : []).filter((t) => !proseTags.includes(t));
  const suggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <PeekField label="Tags" htmlFor={id}>
      <TagInput id={id} value={explicit} onChange={(next) => void savePatch(doc.id, { tags: effectiveTags(next, body) })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      {proseTags.length > 0 && <span className="text-muted-foreground min-w-0 text-xs">in text: {proseTags.map((t) => `#${t}`).join(" ")}</span>}
    </PeekField>
  );
}
