import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { ExternalLink, Sparkles } from "lucide-react";
import { WORK_TYPES } from "../domain/workTypes";
import type { LookupSettings } from "../domain/types";
import { saveLookupSettings, useWorks, useLookupSettings } from "../data/repo";
import { describeLookup } from "../data/lookup";
import { applyPick, enrichable, enrichAll, type EnrichProgress, type NeedsPick } from "../data/enrichActions";
import { Cover } from "./Cover";

type KeyField = "rawgKey";

const KEYS: { field: KeyField; label: string; hint: string; href: string; optional?: boolean }[] = [
  { field: "rawgKey", label: "RAWG API key", hint: "Games. Free personal key.", href: "https://rawg.io/apidocs" },
];

/** One "needs a pick" row of Enrich all: the item, a candidates select, Apply. */
function PickRow({ entry, onApplied }: { entry: NeedsPick; onApplied: () => void }) {
  const [key, setKey] = useState(entry.hits[0]?.externalKey ?? "");
  const [busy, setBusy] = useState(false);
  const hit = entry.hits.find((h) => h.externalKey === key);
  async function apply() {
    if (!hit) return;
    setBusy(true);
    try {
      await applyPick(entry.item, hit);
      toast.success(`${entry.item.title} — filled`);
      onApplied();
    } catch (e) {
      toast.error((e as Error).message || "Could not apply");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="grid gap-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Cover item={entry.item} className="h-10 w-7 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{entry.item.title}</span>
          <span className="text-muted-foreground block truncate text-xs">{[entry.item.creator, entry.item.year || ""].filter(Boolean).join(" · ") || "—"}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Candidates for ${entry.item.title}`}>
            <SelectValue placeholder="Pick a candidate…" />
          </SelectTrigger>
          <SelectContent>
            {entry.hits.map((h) => (
              <SelectItem key={h.externalKey} value={h.externalKey}>
                {[h.title, h.creator, h.year || ""].filter(Boolean).join(" · ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!hit || busy} onClick={() => void apply()}>
          Apply
        </Button>
      </div>
    </li>
  );
}

/**
 * Lookup settings: the four provider keys (synced in `media_settings`), the
 * provider line per medium, and "Enrich all" — walks items without an
 * external key or cover, auto-applies only confident matches, and lists the
 * rest for a manual pick (ADR 0006 amendment, metadata lookups).
 */
export function LookupSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const settings = useLookupSettings();
  const items = useWorks();
  const [draft, setDraft] = useState<Record<KeyField, string>>({ rawgKey: "" });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<EnrichProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [needsPick, setNeedsPick] = useState<NeedsPick[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Load the saved keys into the draft whenever the dialog opens (or they sync in).
  useEffect(() => {
    if (open) setDraft({ rawgKey: settings.rawgKey });
    // Only on open / settings change; typing edits the draft.
  }, [open, settings]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const dirty = KEYS.some((k) => draft[k.field].trim() !== settings[k.field]);
  const effective: Partial<LookupSettings> = { ...settings, ...Object.fromEntries(KEYS.map((k) => [k.field, draft[k.field].trim()])) };
  const candidates = enrichable(items, effective);

  async function save() {
    setSaving(true);
    try {
      await saveLookupSettings(draft);
      toast.success("Lookup settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function runEnrich() {
    if (dirty) await save();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRunning(true);
    setNeedsPick([]);
    setProgress({ done: 0, total: candidates.length, applied: 0, failed: 0 });
    try {
      const res = await enrichAll(items, effective, setProgress, ctl.signal);
      setNeedsPick(res.needsPick);
      if (!ctl.signal.aborted) toast.success(`Enriched ${res.applied} of ${res.total}${res.needsPick.length ? ` — ${res.needsPick.length} need a pick` : ""}${res.failed ? ` · ${res.failed} failed` : ""}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Arcade lookup settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3">
            {KEYS.map((k) => (
              <div key={k.field} className="grid gap-1">
                <Label htmlFor={`lk-${k.field}`}>
                  {k.label}
                  {k.optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
                </Label>
                <Input id={`lk-${k.field}`} type="password" autoComplete="off" spellCheck={false} value={draft[k.field]} onChange={(e) => setDraft((d) => ({ ...d, [k.field]: e.target.value }))} placeholder="Paste key…" />
                <p className="text-muted-foreground text-xs">
                  {k.hint}{" "}
                  <a href={k.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                    Get a key <ExternalLink className="size-3" />
                  </a>
                </p>
              </div>
            ))}
            <div className="flex justify-end">
              <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
                Save keys
              </Button>
            </div>
          </div>

          <section className="grid gap-1 border-t pt-3" aria-label="Providers per medium">
            <h3 className="text-sm font-medium">Providers</h3>
            <ul className="grid gap-0.5 text-xs">
              {WORK_TYPES.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t.plural}</span>
                  <span className="text-right">{describeLookup(t.id, effective)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-2 border-t pt-3" aria-label="Enrich all">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Enrich all</h3>
                <p className="text-muted-foreground text-xs">
                  {candidates.length} item{candidates.length === 1 ? "" : "s"} without an external key or cover, on a medium with a provider. Exact title{" "}
                  (+year) matches are applied; the rest are listed for a pick.
                </p>
              </div>
              {running ? (
                <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                  Stop
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={candidates.length === 0} onClick={() => void runEnrich()}>
                  <Sparkles /> Enrich all
                </Button>
              )}
            </div>
            {progress && (
              <p className="text-xs tabular-nums" aria-live="polite">
                {progress.done} / {progress.total} · {progress.applied} applied{progress.failed ? ` · ${progress.failed} failed` : ""}
                {running ? "…" : ""}
              </p>
            )}
            {needsPick.length > 0 && (
              <div className="grid gap-1.5">
                <h4 className="text-muted-foreground text-xs font-medium">Needs a pick · {needsPick.length}</h4>
                <ul className="grid gap-1.5">
                  {needsPick.map((e) => (
                    <PickRow key={e.item.id} entry={e} onApplied={() => setNeedsPick((l) => l.filter((x) => x.item.id !== e.item.id))} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
