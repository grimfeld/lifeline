import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetTitle, cn, usePhone } from "@lifeline/ui";
import {
  ADD_FIELD_KINDS,
  FIELD_KINDS,
  addOption,
  allRoles,
  fieldSummary,
  hasFieldSettings,
  hasFoldOut,
  isChoiceKind,
  isLinkKind,
  kindLabel,
  knownField,
  knownFieldLocked,
  moveOption,
  optionUsage,
  pasteOptions,
  rekeyField,
  relabelField,
  removeOption,
  renameOption,
  roleDef,
  splitOptionLabels,
  type Document,
  type DocumentTypeDef,
  type FieldDraft,
  type FieldKind,
  type FieldKindChoice,
  type FieldReading,
  type KnownFieldChoice,
  type LinkTarget,
  type SummaryNames,
} from "@lifeline/core";
import { BadgeCheck, Plus, Settings2, Trash2, X } from "lucide-react";
import { ReorderItem, Reorderable } from "./Reorder";

/** Every Document of the type being edited (counted, never shown) — what the option editor counts per option. */
export const HeldDocuments = createContext<Document[]>([]);

/**
 * One Field of the Type editor: handle · Label · Kind · ⚙ · delete (spec #95).
 * ⚙ for kinds with settings and on any unsaved Field, which open in a fold-out
 * under the row; folded, the row shows a saved Field's key and their summary.
 * A phone gives it two lines: handle + Label; then Kind, ⚙, delete.
 */
export function FieldRow({
  row,
  reading,
  handle,
  open,
  focus,
  names,
  linkTypes,
  refusals,
  onToggle,
  onChange,
  onRemove,
}: {
  row: FieldDraft;
  /** Whether it is a Known field (ADR 0078), and the note its row carries. */
  reading: FieldReading;
  /** The drag handle (#101), first on the Label's line. */
  handle: ReactNode;
  open: boolean;
  /** Just added: the label takes the focus. */
  focus?: boolean;
  names: SummaryNames;
  linkTypes: DocumentTypeDef[];
  /** Kinds this saved Field's held values wouldn't fit, each with why (kindRefusals). */
  refusals: Partial<Record<FieldKind, string>>;
  onToggle: () => void;
  onChange: (d: FieldDraft) => void;
  onRemove: () => void;
}) {
  // A Known field added from the menu or saved has its key and kind locked: no fold-out, the Kind shown but not changed (ADR 0078).
  // A plain Field being typed whose key happens to match one keeps its key box, and says what it will be.
  const known = knownFieldLocked(row, reading);
  const settings = hasFoldOut(row, known);
  const summary = hasFieldSettings(row.kind) ? fieldSummary(row, names) : "";
  // Focused once the menu that added it has let go of the focus (it would pull an autoFocus back).
  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => labelRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [focus]);
  return (
    <div className="grid min-w-0 gap-1 rounded-md border p-1 md:border-0 md:p-0">
      <div className="grid grid-cols-[minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1 md:grid-cols-[minmax(0,1fr)_11.5rem_1.75rem_1.75rem]">
        <div className="col-span-3 flex min-w-0 items-center gap-1 md:col-span-1">
          {handle}
          <Input ref={labelRef} className="h-8 min-w-0 flex-1" placeholder="Label" aria-label="Field label" value={row.label} onChange={(e) => onChange(relabelField(row, e.target.value, known))} />
        </div>
        <Select value={row.kind} disabled={known} onValueChange={(v) => onChange({ ...row, kind: v as FieldKind })}>
          <SelectTrigger className="h-8 w-full min-w-0" aria-label="Field kind" title={known ? "A Known field's kind is locked" : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* geo is added only as the Coordinates Known field; a Field that already is one keeps it. */}
            {FIELD_KINDS.filter((k) => k !== "geo" || row.kind === "geo").map((k) => {
              // A kind the held values don't fit is off, its reason on hover and in the item (a phone has no hover).
              const why = refusals[k];
              return (
                <SelectItem key={k} value={k} disabled={!!why} title={why} className="data-disabled:pointer-events-auto">
                  {why ? (
                    <span className="grid min-w-0">
                      <span>{kindLabel(k)}</span>
                      <span className="text-muted-foreground text-[10px] whitespace-normal">{why}</span>
                    </span>
                  ) : (
                    kindLabel(k)
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {settings ? (
          <Button size="icon" variant={open ? "secondary" : "ghost"} className="size-7" onClick={onToggle} aria-label="Field settings" aria-expanded={open} title={summary || "Key"}>
            <Settings2 className="size-3.5" />
          </Button>
        ) : known ? (
          <span className="text-primary flex size-7 items-center justify-center" title="Known field — Lifeline acts on it; its key and kind are locked" aria-label="Known field">
            <BadgeCheck className="size-4" />
          </span>
        ) : (
          <span />
        )}
        <Button size="icon" variant="ghost" className="size-7" onClick={onRemove} aria-label="Remove field">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {reading.note && (
        <p className={cn("min-w-0 px-1 text-[10px]", reading.known ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
          {reading.known && <span className="text-foreground font-medium">{known ? "Known field · " : `Will be the ${knownField(reading.known).label} Known field · `}</span>}
          {reading.note}
        </p>
      )}
      {/* Folded: a saved Field's key (story 13 — seen without a fold-out), then its settings' summary. */}
      {!open && (row.saved || summary) && (
        <div className="text-muted-foreground flex min-w-0 items-center gap-2 px-1 text-[10px]">
          {row.saved && (
            <code className="min-w-0 truncate" title={`Key “${row.key}” — fixed once saved`}>
              {row.key}
            </code>
          )}
          {summary && (
            <button type="button" className="min-w-0 truncate text-left" onClick={onToggle}>
              {summary}
            </button>
          )}
        </div>
      )}
      {settings && open && <FieldSettings row={row} linkTypes={linkTypes} onChange={onChange} />}
    </div>
  );
}

/** A Field's fold-out: its key (editable until saved), then a Choice's options or a Link's target. */
function FieldSettings({ row, linkTypes, onChange }: { row: FieldDraft; linkTypes: DocumentTypeDef[]; onChange: (d: FieldDraft) => void }) {
  return (
    <div className="bg-muted/40 grid min-w-0 gap-2 rounded-md p-2">
      {row.saved ? (
        <p className="text-muted-foreground text-[10px]">
          Key <code className="text-foreground">{row.key}</code> — fixed once saved; rename its label instead.
        </p>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <Label className="shrink-0 text-xs">Key</Label>
          <Input className="h-7 min-w-0 flex-1" placeholder="key" aria-label="Field key" value={row.key} onChange={(e) => onChange(rekeyField(row, e.target.value))} />
          <span className="text-muted-foreground hidden shrink-0 text-[10px] md:inline">Fixed once saved</span>
        </div>
      )}
      {isChoiceKind(row.kind) && <OptionList row={row} onChange={onChange} />}
      {isLinkKind(row.kind) && <LinkTargetPicker target={row.target} linkTypes={linkTypes} onChange={(target) => onChange({ ...row, target })} />}
    </div>
  );
}

/** One entry of the "+ Field" menu. */
interface AddFieldEntry {
  id: string;
  choice: FieldKindChoice | KnownFieldChoice;
  pick: () => void;
}

/**
 * "+ Field": first the Known fields this type may still add (ADR 0078), then
 * the plain kinds, each with what it unlocks (spec #95). A menu on
 * the desk; on a phone a sheet from the bottom, its rows full width (ADR 0064).
 */
export function AddFieldMenu({ known, onPick }: { known: KnownFieldChoice[]; onPick: (pick: FieldKind | KnownFieldChoice) => void }) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const sections: { title: string; entries: AddFieldEntry[] }[] = [
    { title: "Known fields", entries: known.map((k) => ({ id: k.id, choice: k, pick: () => onPick(k) })) },
    { title: "Kinds", entries: ADD_FIELD_KINDS.map((c) => ({ id: c.kind, choice: c, pick: () => onPick(c.kind) })) },
  ].filter((s) => s.entries.length > 0);
  // Headed only when there are Known fields to tell apart from the kinds.
  const headed = sections.length > 1;
  // The entries, once: each section's heading and items, wrapped by the sheet or the menu.
  const entries = (heading: (title: string, n: number) => ReactNode, item: (e: AddFieldEntry, body: ReactNode) => ReactNode) =>
    sections.map((s, n) => (
      <Fragment key={s.title}>
        {headed && heading(s.title, n)}
        {s.entries.map((e) =>
          item(
            e,
            <span className="grid min-w-0 gap-0.5 text-left">
              <span className="text-sm">{e.choice.label}</span>
              <span className="text-muted-foreground text-[11px] leading-snug">{e.choice.note}</span>
            </span>,
          ),
        )}
      </Fragment>
    ));
  const trigger = (
    <Button size="sm" variant="outline" className="justify-self-start" onClick={phone ? () => setOpen(true) : undefined}>
      <Plus /> Field
    </Button>
  );
  if (phone)
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" aria-describedby={undefined} onCloseAutoFocus={(e) => e.preventDefault()}>
            <SheetTitle>Add a Field</SheetTitle>
            <div className="grid min-w-0 overflow-y-auto p-2">
              {entries(
                (title, n) => (
                  <p className={cn("text-muted-foreground px-2 text-xs font-medium", n > 0 ? "mt-1 border-t pt-2" : "pt-1")}>{title}</p>
                ),
                (e, body) => (
                  <button key={e.id} type="button" className="hover:bg-accent min-w-0 rounded-md px-2 py-2" onClick={() => (setOpen(false), e.pick())}>
                    {body}
                  </button>
                ),
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" onCloseAutoFocus={(e) => e.preventDefault()}>
        {entries(
          (title, n) => (
            <>
              {n > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-muted-foreground text-xs">{title}</DropdownMenuLabel>
            </>
          ),
          (e, body) => (
            <DropdownMenuItem key={e.id} className="items-start py-1.5" onSelect={e.pick}>
              {body}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A Choice's options, one line each: only the label is edited; the value is set
 * when added (CONTEXT.md "Choice (field)"). Typed like a list (spec #95): Enter
 * adds the next, Backspace on an empty one removes it, a pasted list splits into
 * one option each. An option Documents hold shows how many and can't be removed.
 */
function OptionList({ row, onChange }: { row: FieldDraft; onChange: (d: FieldDraft) => void }) {
  const held = useContext(HeldDocuments);
  const usage = useMemo(() => optionUsage(row.key, held), [row.key, held]);
  // The "used by" column is there only when some option is held, so the labels line up either way.
  const anyUsed = row.options.some((o) => usage[o.value]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // The option to focus once the change that adds or removes it has rendered.
  const [focusAt, setFocusAt] = useState<number | null>(null);
  useEffect(() => {
    if (focusAt === null) return;
    const el = inputs.current[focusAt];
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
    setFocusAt(null);
  }, [focusAt]);
  const add = (at: number) => {
    onChange(addOption(row, "", at));
    setFocusAt(at);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      add(i + 1);
    } else if (e.key === "Backspace" && row.options[i].label === "" && !usage[row.options[i].value]) {
      e.preventDefault();
      onChange(removeOption(row, i));
      if (row.options.length > 1) setFocusAt(Math.max(0, i - 1));
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    const labels = splitOptionLabels(e.clipboardData.getData("text"));
    if (labels.length < 2) return;
    e.preventDefault();
    onChange(pasteOptions(row, i, labels));
    setFocusAt(i + labels.length - (row.options[i].label.trim() ? 0 : 1));
  };
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs">Options</Label>
      <Reorderable ids={row.options.map((_, i) => i)} onMove={(from, to) => onChange(moveOption(row, from, to))}>
        {row.options.map((o, i) => {
          const used = usage[o.value] ?? 0;
          return (
            // Keyed by place, not value: an unsaved option's value follows its label as it's typed.
            <ReorderItem key={i} id={i} label={o.label || "option"} className="flex min-w-0 items-center gap-1">
              {(handle) => (
                <>
                  {handle}
                  <Input
                    ref={(el) => void (inputs.current[i] = el)}
                    className="h-7 min-w-0 flex-1"
                    placeholder="Option"
                    aria-label="Option label"
                    value={o.label}
                    onChange={(e) => onChange(renameOption(row, i, e.target.value))}
                    onKeyDown={(e) => onKey(e, i)}
                    onPaste={(e) => onPaste(e, i)}
                  />
                  {/* The stored value, in a fixed column so the labels line up. */}
                  <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-[10px] md:w-32" title={o.value ? `Stored as “${o.value}”` : undefined}>
                    {o.value}
                  </span>
                  {anyUsed && (
                    <span className="text-muted-foreground w-14 shrink-0 truncate text-right text-[10px]" title={used ? `${used} Document${used === 1 ? "" : "s"} hold this option` : undefined}>
                      {used > 0 && `used by ${used}`}
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    disabled={used > 0}
                    onClick={() => onChange(removeOption(row, i))}
                    aria-label={used ? `Used by ${used} — can't be removed` : "Remove option"}
                    title={used ? `Used by ${used} Document${used === 1 ? "" : "s"} — can't be removed` : undefined}
                  >
                    <X className="size-3.5" />
                  </Button>
                </>
              )}
            </ReorderItem>
          );
        })}
      </Reorderable>
      <Button size="sm" variant="ghost" className="h-7 justify-self-start" onClick={() => add(row.options.length)}>
        <Plus /> Option
      </Button>
    </div>
  );
}

/** A Link's target: Any, one or several types, or a Role (ADR 0069). */
function LinkTargetPicker({ target, linkTypes, onChange }: { target: LinkTarget; linkTypes: DocumentTypeDef[]; onChange: (t: LinkTarget) => void }) {
  const roles = allRoles();
  const chosen = target.to === "types" ? target.types : [];
  // The types it names come first (seen without scrolling), as they were when the fold-out opened — even ones the list doesn't offer (internal, gone).
  const [first] = useState(chosen);
  const label = (id: string) => linkTypes.find((t) => t.id === id)?.label ?? id;
  const offered = [...first, ...linkTypes.map((t) => t.id).filter((id) => !first.includes(id))].map((id) => ({ id, label: label(id) }));
  const roleIds = [...roles.map((r) => r.id), ...(target.to === "role" && !roles.some((r) => r.id === target.role) ? [target.role] : [])];
  const pickMode = (v: string) => onChange(v === "types" ? { to: "types", types: chosen } : v === "role" ? { to: "role", role: target.to === "role" ? target.role : (roles[0]?.id ?? "") } : { to: "any" });
  const tick = (id: string, on: boolean) => onChange({ to: "types", types: on ? [...chosen, id] : chosen.filter((x) => x !== id) });
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs">Links to</Label>
      <Select value={target.to} onValueChange={pickMode}>
        <SelectTrigger className="h-8 w-full min-w-0 md:w-48" aria-label="Links to">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any type</SelectItem>
          <SelectItem value="types">Types</SelectItem>
          {roleIds.length > 0 && <SelectItem value="role">A Role</SelectItem>}
        </SelectContent>
      </Select>
      {target.to === "types" && (
        <div className="grid max-h-48 min-w-0 gap-1 overflow-y-auto py-1 md:grid-cols-2">
          {offered.map((t) => (
            <label key={t.id} className="flex min-w-0 items-start gap-2 text-xs">
              <Checkbox className="mt-px shrink-0" checked={chosen.includes(t.id)} onCheckedChange={(c) => tick(t.id, c === true)} />
              <span className="min-w-0">{t.label}</span>
            </label>
          ))}
        </div>
      )}
      {target.to === "role" && (
        <Select value={target.role} onValueChange={(role) => onChange({ to: "role", role })}>
          <SelectTrigger className="h-8 w-full min-w-0 md:w-48" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleIds.map((id) => (
              <SelectItem key={id} value={id}>
                {roleDef(id)?.label ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {target.to === "role" && <span className="text-muted-foreground text-[10px]">Documents of its home type, and any Document wearing it.</span>}
    </div>
  );
}
