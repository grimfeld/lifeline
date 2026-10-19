import { useMemo } from "react";
import { Input, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@lifeline/ui";
import { familyLabel, type SourceItem } from "../domain/works";
import { SOURCE_KINDS, type SourceKind } from "../domain/types";

export const NEW_SOURCE = "__new__";

/** What the picker hands back: an existing Source's id, or a new one to make by title (and kind). */
export interface SourceChoice {
  id: string;
  newTitle: string;
  newKind: SourceKind | "";
}

export const emptyChoice: SourceChoice = { id: "", newTitle: "", newKind: "" };

/**
 * Pick the Source (ADR 0070): the ones I'm in now first — works in progress,
 * then the last taken from — then every Source by title, and "New source…"
 * by name alone. A required Source must cost one tap, not a search.
 */
export function SourcePicker({ current, all, value, onChange, id = "source-picker", nowCount = 5 }: { current: SourceItem[]; all: SourceItem[]; value: SourceChoice; onChange: (v: SourceChoice) => void; id?: string; nowCount?: number }) {
  const now = current.slice(0, nowCount);
  const nowIds = new Set(now.map((s) => s.id));
  const rest = useMemo(() => all.filter((s) => !nowIds.has(s.id)).sort((a, b) => a.title.localeCompare(b.title)), [all, nowIds]);
  const label = (s: SourceItem) => `${s.title}${s.creator ? ` — ${s.creator}` : ""}`;
  return (
    <div className="grid gap-2">
      <Select value={value.id || (value.newTitle || value.id === NEW_SOURCE ? NEW_SOURCE : "")} onValueChange={(v) => onChange(v === NEW_SOURCE ? { ...value, id: NEW_SOURCE } : { id: v, newTitle: "", newKind: "" })}>
        <SelectTrigger id={id} aria-label="Source" className="w-full min-w-0">
          <SelectValue placeholder="Pick a Source…" />
        </SelectTrigger>
        <SelectContent>
          {now.length > 0 && (
            <SelectGroup>
              <SelectLabel>Now</SelectLabel>
              {now.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {label(s)} <span className="text-muted-foreground text-xs">· {familyLabel(s.family)}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {now.length > 0 && rest.length > 0 && <SelectSeparator />}
          {rest.length > 0 && (
            <SelectGroup>
              <SelectLabel>Every Source</SelectLabel>
              {rest.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {label(s)} <span className="text-muted-foreground text-xs">· {familyLabel(s.family)}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectSeparator />
          <SelectItem value={NEW_SOURCE}>＋ New source…</SelectItem>
        </SelectContent>
      </Select>
      {value.id === NEW_SOURCE && (
        <div className="grid grid-cols-[1fr_9rem] gap-2">
          <Input autoFocus placeholder="Its name — “Hardcore History, ep. 68”" value={value.newTitle} onChange={(e) => onChange({ ...value, newTitle: e.target.value })} aria-label="New source name" className="min-w-0" />
          <Select value={value.newKind || "__none__"} onValueChange={(k) => onChange({ ...value, newKind: k === "__none__" ? "" : (k as SourceKind) })}>
            <SelectTrigger aria-label="New source kind" className="min-w-0">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Kind…</SelectItem>
              {SOURCE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
