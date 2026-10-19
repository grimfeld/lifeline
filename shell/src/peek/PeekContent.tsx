import { useCallback, useEffect, useRef, useState } from "react";
import { Label, TagInput, toast } from "@lifeline/ui";
import { FieldsForm, MarkdownView } from "@lifeline/editor";
import {
  effectiveTags,
  extractProseTags,
  fieldsOfDocument,
  normalizeTag,
  patchDocument,
  peekPartOf,
  useLinkIndex,
  useTagVocabulary,
  userFieldsOf,
  type Document,
  type DocumentTypeDef,
  type FieldDef,
} from "@lifeline/core";

/** Ids of the Peek's own controls: a Peek may sit over the Vault's editor, whose form uses the plain `field-` ids. */
const ID_PREFIX = "peek-field-";

/**
 * What a Peek shows between its header and its ways through (ADR 0085).
 *
 * - A **user-defined type**'s Document: Core's whole editable Peek — every
 *   Field (Aliases, Coordinates and Links included) and its Tags.
 * - A **built-in**'s: the owning App's part (`peekPartOf`: its editable one,
 *   else its read-only one, else Core's read-only list of the App's Fields),
 *   then the **user's own Fields** (`userFieldsOf`) beneath it, edited by Core.
 *   Core never draws a control for a Field the App defined.
 */
export function PeekContent({ doc, def }: { doc: Document; def: DocumentTypeDef | undefined }) {
  // Keyed by the Document: following a link replaces the Peek's Document, and its staged edits must not carry over.
  if (def && !def.builtIn) return <UserTypePeek key={doc.id} doc={doc} def={def} />;
  const part = peekPartOf(def);
  return (
    <div className="flex flex-col gap-3">
      {part ? <part.Part doc={doc} /> : <ReadOnlyPeek doc={doc} def={def} />}
      {def && <UserFields key={doc.id} doc={doc} fields={userFieldsOf(def)} />}
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
        toast.error(`Couldn’t save — ${err instanceof Error ? err.message : String(err)}. It will be retried on your next change.`);
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
  return (
    <div className="flex flex-col gap-3">
      <FieldsForm def={{ fields: own }} value={values} columns={1} idPrefix={ID_PREFIX} onChange={(next) => stage(changed(own, values, next))} />
      <div className="grid gap-1">
        <Label htmlFor={`${ID_PREFIX}tags`} className="text-muted-foreground text-xs">
          Tags
        </Label>
        <TagInput
          id={`${ID_PREFIX}tags`}
          value={explicitTags}
          onChange={(next) => stage({ tags: effectiveTags(next, body) }, true)}
          suggestions={suggestions}
          normalize={normalizeTag}
          placeholder="Add tag…"
        />
        {proseTags.length > 0 && <span className="text-muted-foreground text-xs">in text: {proseTags.map((t) => `#${t}`).join(" ")}</span>}
      </div>
      <FieldList doc={doc} fields={roleFields} />
      <Body doc={doc} />
    </div>
  );
}

/** The user's own Fields on a built-in type, beneath the App's part. */
function UserFields({ doc, fields }: { doc: Document; fields: FieldDef[] }) {
  const { values, stage } = useStagedEdits(doc);
  if (!fields.some((f) => !f.hidden)) return null;
  return (
    <section aria-label="Your fields" className="grid gap-2 border-t pt-3">
      <FieldsForm def={{ fields }} value={values} columns={1} idPrefix={ID_PREFIX} onChange={(next) => stage(changed(fields, values, next))} />
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
      <Body doc={doc} />
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

/** The body, read (writing it in the Peek is the frame's, ADR 0085). */
function Body({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const body = typeof doc.body === "string" ? doc.body : "";
  if (!body) return null;
  return <MarkdownView body={body} index={index} compact docDate={doc.type === "daily" ? doc.title : null} origin={doc.id} />;
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
