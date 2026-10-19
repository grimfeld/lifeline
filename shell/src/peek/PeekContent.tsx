import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Field, TagInput, toast } from "@lifeline/ui";
import { DocumentEditor, FieldsForm, MarkdownView } from "@lifeline/editor";
import {
  effectiveTags,
  extractProseTags,
  fieldsOfDocument,
  normalizeTag,
  patchDocument,
  peekPartOf,
  templateStartsFor,
  useAllDocuments,
  useLinkIndex,
  useTagVocabulary,
  userFieldsOf,
  type Document,
  type DocumentTypeDef,
  type FieldDef,
} from "@lifeline/core";

/**
 * What a Peek shows between its header and its ways through (ADR 0085).
 *
 * - A **user-defined type**'s Document: Core's whole editable Peek — every
 *   Field (Aliases, Coordinates and Links included) and its Tags.
 * - A **built-in**'s: the owning App's part (`peekPartOf`: its editable one,
 *   else its read-only one, else Core's read-only list of the App's Fields),
 *   then the **user's own Fields** (`userFieldsOf`) beneath it, edited by Core.
 *   Core never draws a control for a Field the App defined.
 *
 * Then, for every Peek, the **body**: read, or — once the frame says
 * `writing` — written with the Vault's own editor. An empty body offers the
 * type's Templates either way; picked while reading, it asks the frame to
 * write (`onWrite`) and the Template fills the editor once it is there.
 */
export function PeekContent({ doc, def, writing = false, onWrite }: { doc: Document; def: DocumentTypeDef | undefined; writing?: boolean; onWrite?: () => void }) {
  const part = peekPartOf(def);
  /** A Template picked while reading, waiting for the editor to fill. */
  const [start, setStart] = useState<string | null>(null);
  const started = useCallback(() => setStart(null), []);
  const empty = !(typeof doc.body === "string" && doc.body.trim());
  return (
    <div className={writing ? "flex flex-1 flex-col gap-3" : "flex flex-col gap-3"}>
      {/* Keyed by the Document: following a link replaces the Peek's Document, and its staged edits must not carry over. */}
      {def && !def.builtIn ? (
        <UserTypePeek key={doc.id} doc={doc} def={def} />
      ) : (
        <>
          {part ? <part.Part doc={doc} /> : <ReadOnlyPeek doc={doc} def={def} />}
          {def && <UserFields key={doc.id} doc={doc} fields={userFieldsOf(def)} />}
        </>
      )}
      {def?.body !== "none" &&
        (writing ? (
          <BodyWriter key={doc.id} doc={doc} def={def} start={start} onStarted={started} />
        ) : (
          <>
            {empty && onWrite && (
              <TemplateStarts
                doc={doc}
                def={def}
                onPick={(body) => {
                  setStart(body);
                  onWrite();
                }}
              />
            )}
            <Body doc={doc} />
          </>
        ))}
    </div>
  );
}

/**
 * Edits staged in the Peek and written a moment after the typing stops (as the
 * Vault's editor does), so a keystroke never waits on the store's round trip;
 * the rest go out when the Peek closes or moves to another Document.
 */
function useStagedEdits(doc: Document) {
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<number | null>(null);
  const id = doc.id;
  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    patchDocument(id, patch).then(
      // Written: the Document now carries these, unless they were typed over meanwhile.
      () => setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k, v]) => patch[k] !== v))),
      (err: unknown) => {
        pending.current = { ...patch, ...pending.current };
        toast.error("Couldn’t save your change — it will be retried on your next one", { description: err instanceof Error ? err.message : String(err) });
      },
    );
  }, [id]);
  const stage = useCallback(
    (patch: Record<string, unknown>, immediate = false) => {
      pending.current = { ...pending.current, ...patch };
      setDraft((d) => ({ ...d, ...patch }));
      if (immediate) return flush();
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 500);
    },
    [flush],
  );
  useEffect(() => () => flush(), [flush]);
  return { values: { ...doc, ...draft } as Record<string, unknown>, stage };
}

/** Only the keys that changed, so a write never sends back what another device just changed elsewhere. */
function changed(fields: FieldDef[], before: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (next[f.key] !== before[f.key]) out[f.key] = next[f.key];
  return out;
}

/** Core's whole Peek of a user-defined type's Document: its Fields and Tags edited in place, a worn Role's Fields shown (they are the Role's App's), the body read. */
function UserTypePeek({ doc, def }: { doc: Document; def: DocumentTypeDef }) {
  const { values, stage } = useStagedEdits(doc);
  const own = userFieldsOf(def);
  const ownKeys = new Set(own.map((f) => f.key));
  const roleFields = fieldsOfDocument(doc, def).filter((f) => !ownKeys.has(f.key));
  const body = typeof doc.body === "string" ? doc.body : "";
  const proseTags = extractProseTags(body);
  const explicitTags = (Array.isArray(values.tags) ? (values.tags as string[]) : []).filter((t) => !proseTags.includes(t));
  const suggestions = useTagVocabulary().map((v) => v.tag);
  // Its own ids: a Peek may sit over the Vault's editor, whose form uses the plain `field-` ids.
  const idPrefix = useId();
  return (
    <div className="flex flex-col gap-3">
      <FieldsForm def={{ fields: own }} value={values} columns={1} idPrefix={idPrefix} onChange={(next) => stage(changed(own, values, next))} />
      <Field label="Tags" hint={proseTags.length > 0 ? `in text: ${proseTags.map((t) => `#${t}`).join(" ")}` : undefined}>
        <TagInput
          value={explicitTags}
          onChange={(next) => stage({ tags: effectiveTags(next, body) }, true)}
          suggestions={suggestions}
          normalize={normalizeTag}
          placeholder="Add tag…"
        />
      </Field>
      <FieldList doc={doc} fields={roleFields} />
    </div>
  );
}

/** The user's own Fields on a built-in type, beneath the App's part. */
function UserFields({ doc, fields }: { doc: Document; fields: FieldDef[] }) {
  const { values, stage } = useStagedEdits(doc);
  const idPrefix = useId();
  if (!fields.some((f) => !f.hidden)) return null;
  return (
    <section aria-label="Your fields" className="grid gap-2 border-t pt-3">
      <FieldsForm def={{ fields }} value={values} columns={1} idPrefix={idPrefix} onChange={(next) => stage(changed(fields, values, next))} />
    </section>
  );
}

/** Core's read-only Peek for a built-in whose App brings no part: the App's own Fields listed, the Tags, the body read. */
function ReadOnlyPeek({ doc, def }: { doc: Document; def: DocumentTypeDef | undefined }) {
  const mine = new Set(userFieldsOf(def).map((f) => f.key));
  const fields = fieldsOfDocument(doc, def).filter((f) => !mine.has(f.key));
  const body = typeof doc.body === "string" ? doc.body : "";
  return (
    <div className="flex flex-col gap-3">
      <FieldList doc={doc} fields={fields} />
      {doc.tags && doc.tags.length > 0 && <div className="text-muted-foreground text-xs">{doc.tags.map((t) => `#${t}`).join(" ")}</div>}
      {!hasValues(doc, fields) && !body && mine.size === 0 && <p className="text-muted-foreground text-sm">Nothing more to show here.</p>}
    </div>
  );
}

const filled = (doc: Document, f: FieldDef) => !f.hidden && doc[f.key] !== undefined && doc[f.key] !== null && doc[f.key] !== "";
const hasValues = (doc: Document, fields: FieldDef[]) => fields.some((f) => filled(doc, f));

/** Fields shown, not edited: the filled ones, label beside value. */
function FieldList({ doc, fields }: { doc: Document; fields: FieldDef[] }) {
  const list = fields.filter((f) => filled(doc, f));
  if (list.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {list.map((f) => (
        <div key={f.key} className="contents">
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 break-words">{formatValue(doc[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

const dayOf = (doc: Document) => (doc.type === "daily" ? doc.title : null);

/** The body, read: nothing in it changes until the user asks to write (ADR 0085). */
function Body({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const body = typeof doc.body === "string" ? doc.body : "";
  if (!body) return null;
  return <MarkdownView body={body} index={index} compact docDate={dayOf(doc)} origin={doc.id} />;
}

/**
 * The body, written with the Vault's own editor (ADR 0085): wikilinks,
 * completion, Daylog blocks, saved as the Vault saves and undone with its
 * history. Only the body and its Tags are written, so a Field edited above a
 * moment ago is never sent back as it was.
 */
function BodyWriter({ doc, def, start, onStarted }: { doc: Document; def: DocumentTypeDef | undefined; start: string | null; onStarted: () => void }) {
  const index = useLinkIndex();
  const id = doc.id;
  const save = useCallback((next: Document) => patchDocument(id, { body: next.body, tags: next.tags }), [id]);
  const empty = !(typeof doc.body === "string" && doc.body.trim());
  const section = useRef<HTMLElement>(null);
  const latest = useRef(doc);
  latest.current = doc;
  // A Template picked while reading: written once the editor is up (it loads
  // lazily), so the editor takes it as a change of its own and Undo empties it.
  useEffect(() => {
    if (start === null) return;
    let frame = 0;
    let tries = 0;
    const apply = () => {
      if (!section.current?.querySelector(".cm-content") && ++tries < 300) return void (frame = requestAnimationFrame(apply));
      onStarted();
      void startFrom(latest.current, start);
    };
    apply();
    return () => cancelAnimationFrame(frame);
  }, [start, onStarted]);
  return (
    <section ref={section} aria-label="Body" className="flex min-h-64 flex-1 flex-col border-t">
      {empty && start === null && <TemplateStarts doc={doc} def={def} onPick={(body) => void startFrom(doc, body)} />}
      <DocumentEditor doc={doc} def={def} index={index} docDate={dayOf(doc)} bodyOnly autoFocus save={save} />
    </section>
  );
}

/** Fill an empty body from a Template, its Tags with it. */
function startFrom(doc: Document, body: string): Promise<unknown> {
  return patchDocument(doc.id, { body, tags: effectiveTags(doc.tags, body) }).catch((err: unknown) =>
    toast.error("Couldn’t start from that Template", { description: err instanceof Error ? err.message : String(err) }),
  );
}

/**
 * An empty body offers the type's Templates (CONTEXT.md "Template"): picking
 * one fills the body once — the editor takes it as a change of its own, so
 * Undo empties it again — and the offer is gone with the emptiness.
 */
function TemplateStarts({ doc, def, onPick }: { doc: Document; def: DocumentTypeDef | undefined; onPick: (body: string) => void }) {
  const docs = useAllDocuments();
  const starts = useMemo(() => templateStartsFor(doc, def, docs), [doc, def, docs]);
  if (starts.length === 0) return null;
  const pick = onPick;
  return (
    <div role="group" aria-label="Start from a Template" className="flex flex-wrap items-center gap-2 pt-3">
      <span className="text-muted-foreground text-xs">Start from</span>
      {starts.map((t) => (
        <Button key={t.id || "default"} size="sm" variant="outline" className="max-w-full min-w-0" onClick={() => pick(t.body)}>
          <span className="truncate">{t.title}</span>
        </Button>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
