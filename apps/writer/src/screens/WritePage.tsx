import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, toast } from "@lifeline/ui";
import { DocumentEditor, MarkdownView } from "@lifeline/editor";
import { documentType, putDocument, useDocument, useLinkIndex } from "@lifeline/core";
import { Camera, History, RotateCcw, Trash2, X } from "lucide-react";
import { deleteVersion, deleteWriting, restore, setStatus, snapshot, useVersions } from "../data";
import { STATUSES, WRITING, WRITINGS_HREF, wordCount, type Version, type Writing } from "../types";

/**
 * The Writer's pad (CONTEXT.md "Writer's pad"): the generic editor over a
 * Writing plus Versions — take a snapshot on purpose, compare one side by
 * side with the current text, restore as a new edit.
 */
export function WritePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const writing = useDocument<Writing>(id);
  const index = useLinkIndex();
  const versions = useVersions(id);
  const [showVersions, setShowVersions] = useState(false);
  const [compare, setCompare] = useState<Version | null>(null);
  const [label, setLabel] = useState("");
  const def = useMemo(() => documentType(WRITING), []);
  const compared = compare ? (versions.find((v) => v.id === compare.id) ?? null) : null;

  if (!writing) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Writing not found.</div>;
  const words = wordCount(writing.body);

  async function take() {
    await snapshot(writing!, label);
    setLabel("");
    setShowVersions(true);
    toast.success("Version saved");
  }

  const toolbar = (
    <>
      <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">{words} words</span>
      <Select value={writing.status || "draft"} onValueChange={(v) => void setStatus(writing.id, v as Writing["status"])}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="h-8" onClick={() => void take()} title="Save a version of the current text">
        <Camera /> Version
      </Button>
      <Button size="icon" variant="ghost" className={cn("size-8", showVersions && "bg-accent")} onClick={() => setShowVersions((v) => !v)} title="Versions">
        <History />
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", compared && "basis-1/2")}>
        <DocumentEditor
          key={writing.id}
          doc={writing}
          def={def}
          index={index}
          showPanel={false}
          toolbar={toolbar}
          allowGuarded
          autoFocus
          onDeleted={() => navigate(WRITINGS_HREF)}
          save={(next) => putDocument(next as Writing)}
          remove={() => deleteWriting(writing.id)}
        />
      </div>
      {compared && (
        <div className="flex min-h-0 basis-1/2 flex-col border-l">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <History className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">{compared.label || "Version"}</span>
            <span className="text-muted-foreground text-xs">{new Date(compared.takenAt).toLocaleString()} · {compared.words} words</span>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => void restore(writing, compared).then(() => toast.success("Restored as a new edit"))}>
                <RotateCcw /> Restore
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setCompare(null)}>
                <X />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <MarkdownView body={compared.body} index={index} />
          </div>
        </div>
      )}
      {showVersions && (
        <aside className="flex w-64 shrink-0 flex-col border-l">
          <div className="flex items-center gap-1 border-b px-3 py-2 text-sm font-medium">
            Versions <span className="text-muted-foreground text-xs">· {versions.length}</span>
          </div>
          <div className="flex gap-1 border-b p-2">
            <Input className="h-7 text-xs" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void take()} />
            <Button size="sm" className="h-7" onClick={() => void take()}>
              <Camera />
            </Button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {versions.length === 0 && <li className="text-muted-foreground px-3 py-4 text-xs">No versions yet. Press the camera to keep the current text.</li>}
            {versions.map((v) => (
              <li key={v.id} className={cn("group flex items-start gap-1 border-b px-3 py-1.5 text-sm", compared?.id === v.id && "bg-accent/50")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setCompare(compared?.id === v.id ? null : v)}>
                  <div className="truncate font-medium">{v.label || "Version"}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(v.takenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {v.words} w
                  </div>
                </button>
                <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => void deleteVersion(v.id)} title="Delete version">
                  <Trash2 className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
