import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, DateTimeField, GeoField, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, Textarea } from "@lifeline/ui";
import { displayTitle, documentType, geocode, isLinkTarget, roleDef, readGeo, singularOf, suggestAddresses, useAllDocuments, useDocumentTypes, writeGeo, type DocumentTypeDef, type FieldDef } from "@lifeline/core";

const NONE = "__none__";

export type FieldValues = Record<string, unknown>;

/**
 * The generic form over a Document type's Fields (CONTEXT.md "Field"): every
 * kind gets a control; guarded fields are shown disabled unless `allowGuarded`
 * (the owning App's own forms set it). Values are the flat row values.
 */
export function FieldsForm({
  def,
  fields,
  value,
  onChange,
  allowGuarded,
  columns = 2,
  idPrefix = "field-",
}: {
  def: Pick<DocumentTypeDef, "fields">;
  /** Subset to render (defaults to all visible fields). */
  fields?: FieldDef[];
  value: FieldValues;
  onChange: (next: FieldValues) => void;
  allowGuarded?: boolean;
  columns?: 1 | 2;
  /** Prefix of the controls' ids — another form on the page (a Peek over the Vault's editor) needs its own. */
  idPrefix?: string;
}) {
  const latest = useRef(value);
  latest.current = value;
  const set = (key: string, v: unknown) => {
    latest.current = { ...latest.current, [key]: v };
    onChange(latest.current);
  };
  const list = (fields ?? def.fields).filter((f) => !f.hidden);
  if (list.length === 0) return null;
  return (
    <div className={columns === 2 ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
      {list.map((f) => (
        <div key={f.key} className={`grid gap-1 ${f.kind === "longtext" ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={`${idPrefix}${f.key}`} className="text-muted-foreground text-xs">
            {f.label}
            {f.guarded && !allowGuarded && <span className="ml-1 opacity-60" title="Guarded: only its App changes this">🔒</span>}
          </Label>
          <FieldControl def={f} id={`${idPrefix}${f.key}`} value={value[f.key]} all={value} disabled={!!f.guarded && !allowGuarded} onChange={(v) => set(f.key, v)} onSet={set} />
        </div>
      ))}
    </div>
  );
}

export function FieldControl({
  def,
  id = `field-${def.key}`,
  value,
  all,
  disabled,
  onChange,
  onSet,
}: {
  def: FieldDef;
  /** The control's id, for its label. */
  id?: string;
  value: unknown;
  all: FieldValues;
  disabled?: boolean;
  onChange: (v: unknown) => void;
  onSet: (key: string, v: unknown) => void;
}) {
  switch (def.kind) {
    case "text":
    case "url":
      return <Input id={id} className="h-8" type={def.kind === "url" ? "url" : "text"} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "longtext":
      return <Textarea id={id} rows={3} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return (
        <Input id={id} className="h-8" type="number" disabled={disabled} value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      );
    case "boolean":
      return (
        <div className="flex h-8 items-center">
          <Checkbox id={id} disabled={disabled} checked={!!value} onCheckedChange={(c) => onChange(c === true)} />
        </div>
      );
    case "date":
      return <Input id={id} className="h-8" type="date" disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return <DateTimeField id={id} disabled={disabled} startYear={1500} value={toLocalInput(value)} onChange={(v) => onChange(v ? new Date(v).toISOString() : "")} />;
    case "geo": {
      const address = typeof all.address === "string" ? all.address : "";
      return (
        <GeoField
          id={id}
          value={readGeo(value)}
          onChange={(c) => onChange(writeGeo(c))}
          query={address}
          geocode={geocode}
          suggest={suggestAddresses}
          onPickAddress={(label) => {
            if (!address.trim()) onSet("address", label);
          }}
        />
      );
    }
    case "list":
      return <ListInput id={id} value={value} disabled={disabled} onChange={onChange} />;
    case "select":
      return (
        <Select value={value === undefined || value === null || value === "" ? NONE : String(value)} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
          <SelectTrigger id={id} className="h-8 w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <TagInput
          id={id}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(next) => onChange(next)}
          suggestions={(def.options ?? []).map((o) => o.value)}
          placeholder="Add…"
        />
      );
    case "link":
      return <LinkField id={id} linkType={def.linkType} linkRole={def.linkRole} value={value} disabled={disabled} onChange={onChange} />;
    case "links":
      return <LinksField id={id} linkType={def.linkType} linkRole={def.linkRole} value={value} disabled={disabled} onChange={onChange} />;
    case "json":
      return <Input id={id} className="h-8 font-mono text-xs" disabled readOnly value={value === undefined || value === null ? "" : JSON.stringify(value)} />;
  }
}

function toLocalInput(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A Link field: pick one Document (of the declared type, or any linkable type) by title. */
/**
 * A `list` field as comma-separated text. The text is the input's own while
 * it has focus — the parsed array only reaches the Document on the editor's
 * debounce — so a trailing ", " survives typing and a save never snaps the
 * caret; on blur the text settles to the parsed form.
 */
function ListInput({ id, value, disabled, onChange }: { id: string; value: unknown; disabled?: boolean; onChange: (v: string[]) => void }) {
  const joined = Array.isArray(value) ? value.map(String).join(", ") : String(value ?? "");
  const [text, setText] = useState(joined);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(joined);
  }, [joined]);
  const parse = (t: string) => t.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <Input
      id={id}
      className="h-8"
      disabled={disabled}
      placeholder="comma-separated"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(parse(text).join(", "));
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

/** "a" or "an" before a type or Role name — "an Author", "a Book". */
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** The linkable Documents a Link field may point at, sorted by title. */
function useLinkOptions(linkType: string | string[] | undefined, linkRole?: string) {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  const allowed = useMemo(() => (linkType === undefined ? null : new Set(Array.isArray(linkType) ? linkType : [linkType])), [linkType]);
  const options = useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    return docs
      .filter((d) => isLinkTarget({ linkType, linkRole }, d, defs.get(d.type)))
      .map((d) => { const def = defs.get(d.type); return { value: d.id, label: displayTitle(d, def), type: def ? singularOf(def) : d.type }; })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, types, linkType, linkRole]);
  // A Role (ADR 0069) names its wearers itself — "Pick an Author" — though they come in several types.
  const role = linkRole ? roleDef(linkRole) : undefined;
  const single = allowed && allowed.size === 1 ? [...allowed][0] : undefined;
  const singularLabel = role ? role.label : single ? (() => { const d = documentType(single); return d ? singularOf(d) : single; })() : undefined;
  return { options, many: role ? new Set(options.map((o) => o.type)).size > 1 : allowed === null || allowed.size > 1, singularLabel };
}

/** A `links` field (ADR 0052): the chosen Documents as removable chips, and a picker to add one more. */
function LinksField({ id, linkType, linkRole, value, disabled, onChange }: { id: string; linkType?: string | string[]; linkRole?: string; value: unknown; disabled?: boolean; onChange: (v: unknown) => void }) {
  const { options, many, singularLabel } = useLinkOptions(linkType, linkRole);
  const ids = Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === "string" && value ? [value] : [];
  const byId = new Map(options.map((o) => [o.value, o]));
  const rest = options.filter((o) => !ids.includes(o.value));
  return (
    <div className="grid gap-1">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ids.map((x) => (
            <span key={x} className="bg-muted inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs">
              {byId.get(x)?.label ?? x}
              {!disabled && (
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${byId.get(x)?.label ?? x}`} onClick={() => onChange(ids.filter((y) => y !== x))}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <Select value={NONE} onValueChange={(v) => v !== NONE && onChange([...ids, v])} disabled={disabled || rest.length === 0}>
        <SelectTrigger id={id} className="h-8 w-full">
          <SelectValue placeholder={singularLabel ? `Add ${article(singularLabel)} ${singularLabel}` : "Add a Document"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {rest.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label} {many && <span className="text-muted-foreground text-xs">· {o.type}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LinkField({ id, linkType, linkRole, value, disabled, onChange }: { id: string; linkType?: string | string[]; linkRole?: string; value: unknown; disabled?: boolean; onChange: (v: unknown) => void }) {
  const { options, many, singularLabel } = useLinkOptions(linkType, linkRole);
  const current = typeof value === "string" ? value : Array.isArray(value) ? String(value[0] ?? "") : "";
  return (
    <Select value={current || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className="h-8 w-full">
        <SelectValue placeholder={singularLabel ? `Pick ${article(singularLabel)} ${singularLabel}` : "Pick a Document"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label} {many && <span className="text-muted-foreground text-xs">· {o.type}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
