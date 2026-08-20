import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { COLOR_SLOTS, DEFAULT_REFRESH, colorVar, type Source, type SourceKind } from "../domain/types";
import { normalizeEmbedUrl } from "../domain/url";
import {
  addCalendarSub,
  addEmbed,
  addFeed,
  addLiveValue,
  updateCalendarSub,
  updateEmbed,
  updateFeed,
  updateLiveValue,
} from "../data/repo";
import { invalidateSource } from "../data/cache";

export const KIND_LABEL: Record<SourceKind, string> = { embed: "embed", feed: "feed", ical: "calendar subscription", value: "live value" };
const URL_PLACEHOLDER: Record<SourceKind, string> = {
  embed: "https://grafana.example.com/d/abc",
  feed: "https://example.com/feed.xml",
  ical: "https://calendar.google.com/calendar/ical/…/basic.ics",
  value: "https://api.example.com/weather?q=Paris",
};

function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
function headersText(h?: Record<string, string>): string {
  return Object.entries(h ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** One dialog for every Source kind (ADR 0016/0017): shared fields + the kind's own. */
export function SourceDialog({
  open,
  onOpenChange,
  kind,
  source,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SourceKind;
  /** Present = edit mode (its kind wins over `kind`). */
  source?: Source;
  onSaved?: (id: string) => void;
}) {
  const k: SourceKind = source?.kind ?? kind;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [refresh, setRefresh] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [headers, setHeaders] = useState("");
  const [showHeaders, setShowHeaders] = useState(false);
  const [color, setColor] = useState<string>("blue");
  const [mode, setMode] = useState<"json" | "regex">("json");
  const [path, setPath] = useState("");
  const [unit, setUnit] = useState("");
  const [prefix, setPrefix] = useState("");
  const [decimals, setDecimals] = useState("");
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(source?.title ?? "");
    setUrl(source?.url ?? "");
    setRefresh(source?.refreshMinutes ? String(source.refreshMinutes) : "");
    setTags(source?.tags ?? []);
    setHeaders(headersText(source?.headers));
    setShowHeaders(!!source?.headers && Object.keys(source.headers).length > 0);
    setColor(source?.kind === "ical" ? source.color : "blue");
    setMode(source?.kind === "value" ? source.mode : "json");
    setPath(source?.kind === "value" ? source.path : "");
    setUnit(source?.kind === "value" ? (source.unit ?? "") : "");
    setPrefix(source?.kind === "value" ? (source.prefix ?? "") : "");
    setDecimals(source?.kind === "value" && source.decimals !== null ? String(source.decimals) : "");
  }, [open, source]);

  async function submit() {
    const u = normalizeEmbedUrl(url);
    if (!u) return void toast.error("Enter an http(s) URL");
    const refreshMinutes = refresh.trim() === "" ? null : Number(refresh);
    if (refreshMinutes !== null && !(refreshMinutes > 0)) return void toast.error("Refresh must be a positive number of minutes");
    if (k === "value" && mode === "regex" && !path.trim()) return void toast.error("A regex is required");
    const base = { name, url: u, tags, refreshMinutes, headers: showHeaders ? parseHeaders(headers) : null };
    let id: string;
    try {
      if (k === "embed") {
        if (source?.kind === "embed") (await updateEmbed(source, base), (id = source.id));
        else id = await addEmbed(base);
      } else if (k === "feed") {
        if (source?.kind === "feed") (await updateFeed(source, base), (id = source.id));
        else id = await addFeed(base);
      } else if (k === "ical") {
        if (source?.kind === "ical") (await updateCalendarSub(source, { ...base, color }), (id = source.id));
        else id = await addCalendarSub({ ...base, color });
      } else {
        const v = { ...base, mode, path, unit, prefix, decimals: decimals.trim() === "" ? null : Number(decimals) };
        if (source?.kind === "value") (await updateLiveValue(source, v), (id = source.id));
        else id = await addLiveValue(v);
      }
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    if (source) await invalidateSource(source.id);
    toast.success(source ? `${cap(KIND_LABEL[k])} updated` : `${cap(KIND_LABEL[k])} added`);
    onOpenChange(false);
    onSaved?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{source ? `Edit ${KIND_LABEL[k]}` : `New ${KIND_LABEL[k]}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="src-url">URL</Label>
            <Input id="src-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={URL_PLACEHOLDER[k]} autoFocus inputMode="url" onKeyDown={(e) => e.key === "Enter" && void submit()} />
            {k === "embed" && <p className="text-muted-foreground text-xs">Shown as-is in a frame. Pages that refuse to be framed stay blank — use “Open” for those.</p>}
            {k === "ical" && <p className="text-muted-foreground text-xs">Events appear read-only on the calendar, week and schedule in this colour. Nothing is copied.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="src-name">Name</Label>
            <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={k === "value" ? "Outside temp" : "My source"} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>

          {k === "ical" && (
            <div className="grid gap-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SLOTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    className={`size-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: colorVar(c) }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {k === "value" && (
            <>
              <div className="grid grid-cols-[8rem_1fr] gap-3">
                <div className="grid gap-2">
                  <Label>Read as</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "json" | "regex")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON path</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="src-path">{mode === "json" ? "Path" : "Regex (first group)"}</Label>
                  <Input id="src-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder={mode === "json" ? "main.temp" : "Temp: ([\\d.]+)"} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="src-prefix">Prefix</Label>
                  <Input id="src-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="€" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="src-unit">Unit</Label>
                  <Input id="src-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="°C" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="src-dec">Decimals</Label>
                  <Input id="src-dec" type="number" min={0} max={6} value={decimals} onChange={(e) => setDecimals(e.target.value)} placeholder="as-is" />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="src-refresh">{k === "embed" ? "Reload every (min)" : "Refresh every (min)"}</Label>
              <Input id="src-refresh" type="number" min={1} step={1} value={refresh} onChange={(e) => setRefresh(e.target.value)} placeholder={k === "embed" ? "never" : String(DEFAULT_REFRESH[k])} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="src-tags">Tags</Label>
              <TagInput id="src-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} />
            </div>
          </div>

          {k !== "embed" &&
            (showHeaders ? (
              <div className="grid gap-2">
                <Label htmlFor="src-headers">Request headers (one per line, “Name: value”)</Label>
                <Textarea id="src-headers" value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder="Authorization: Bearer …" className="min-h-16 font-mono text-xs" />
                <p className="text-muted-foreground text-xs">Stored with the source in your own PocketBase.</p>
              </div>
            ) : (
              <button type="button" className="text-muted-foreground w-fit text-xs underline-offset-2 hover:underline" onClick={() => setShowHeaders(true)}>
                Needs an API key or header?
              </button>
            ))}
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()}>{source ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
