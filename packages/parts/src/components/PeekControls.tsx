import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Input, Label, Textarea } from "@lifeline/ui";
import { MarksControls } from "./Marks";

/**
 * The controls a family App draws in its editable Peek (ADR 0085): each edits
 * one of the App's own plain Fields in place and writes it a moment after the
 * typing stops (as the Vault's editor does), and whatever is still unwritten
 * goes out when the Peek closes or moves on. Guarded Fields get no control
 * here — they move through the App's operations.
 */

/**
 * A typed value staged before it is written: `delay` ms after the last
 * keystroke, or — with `delay: null`, for a write that does more than store
 * (finding or creating an Artist by name) — only on leaving the control.
 * Either way it is written when the control goes away.
 */
export function useDraft(value: string, commit: (next: string) => void, delay: number | null = 500) {
  const [text, setText] = useState(value);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Another device or screen changed it: show that, unless the user is mid-edit.
  useEffect(() => {
    if (pending.current === null) setText(value);
  }, [value]);

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next !== null) commitRef.current(next);
  }, []);
  useEffect(() => flush, [flush]);

  const change = useCallback(
    (next: string) => {
      setText(next);
      pending.current = next;
      if (delay === null) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    [delay, flush],
  );
  return { text, change, flush };
}

/** A label over its control, sized for a Peek's narrow column. */
export function PeekField({ id, label, children }: { id?: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={id} className="text-muted-foreground min-w-0 text-xs">
        <span className="truncate">{label}</span>
      </Label>
      {children}
    </div>
  );
}

export function PeekInput({
  id,
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  delay,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "number" | "url";
  placeholder?: string;
  delay?: number | null;
}) {
  const { text, change, flush } = useDraft(value, onCommit, delay);
  return (
    <PeekField id={id} label={label}>
      <Input id={id} type={type} value={text} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={flush} />
    </PeekField>
  );
}

/** A number Field: blank reads and writes as 0, the family's "unknown". */
export function PeekNumber({ id, label, value, onCommit }: { id: string; label: ReactNode; value: number; onCommit: (next: number) => void }) {
  return <PeekInput id={id} label={label} type="number" value={value ? String(value) : ""} onCommit={(s) => onCommit(Number(s) || 0)} />;
}

export function PeekTextarea({ id, label, value, onCommit, placeholder }: { id: string; label: ReactNode; value: string; onCommit: (next: string) => void; placeholder?: string }) {
  const { text, change, flush } = useDraft(value, onCommit);
  return (
    <PeekField id={id} label={label}>
      <Textarea id={id} rows={3} value={text} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={flush} />
    </PeekField>
  );
}

/** A work's plain Fields as the family Apps share them (Library, Cinema, Discotheque, Arcade). */
export interface PeekWork {
  id: string;
  year: number;
  size: number;
  reason: string;
  coverUrl: string;
  liked?: boolean;
  rating?: number;
}

/**
 * A family work's own plain Fields, edited in its Peek: who made it (the App's
 * control — the Library's Authors are links, the others' a name), Year, the
 * medium's size, the Marks where the App keeps them, the Reason and the cover.
 */
export function WorkPeekFields({
  work,
  onPatch,
  creator,
  sizeUnit,
  marks,
}: {
  work: PeekWork;
  onPatch: (patch: Partial<PeekWork> & Record<string, unknown>) => void;
  /** The App's control for who made it. */
  creator: ReactNode;
  /** "pages", "minutes", "tracks"… */
  sizeUnit: string;
  /** The heart and the stars, for an App that keeps the Marks on its works. */
  marks?: boolean;
}) {
  const id = (key: string) => `peek-work-${key}`;
  return (
    <div className="grid gap-3">
      {creator}
      <div className="grid grid-cols-2 gap-2">
        <PeekNumber id={id("year")} label="Year" value={work.year} onCommit={(year) => onPatch({ year })} />
        <PeekNumber id={id("size")} label={<span className="capitalize">{sizeUnit}</span>} value={work.size} onCommit={(size) => onPatch({ size })} />
      </div>
      {marks && <MarksControls liked={!!work.liked} rating={work.rating ?? 0} onChange={onPatch} />}
      <PeekTextarea id={id("reason")} label="Reason" value={work.reason} placeholder="Who recommended it, or what made you want it." onCommit={(reason) => onPatch({ reason })} />
      <PeekInput id={id("coverUrl")} label="Cover URL" type="url" value={work.coverUrl} placeholder="https://…" onCommit={(coverUrl) => onPatch({ coverUrl })} />
    </div>
  );
}
