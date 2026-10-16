import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, cn, toast } from "@lifeline/ui";
import { MarkdownView } from "@lifeline/editor";
import type { Document, LinkIndex } from "@lifeline/core";
import { Camera, RotateCcw, Trash2 } from "lucide-react";
import { deleteVersion, restore, snapshot, useVersions } from "./data";
import { VERSIONED, wordCount, type Version } from "./types";

/**
 * Versions in the Vault (ADR 0045): the pad's one non-generic feature, kept as
 * a document panel — Core's mechanism for an App hanging something on an open
 * Document. It renders for a Writing and returns null for everything else, so
 * it costs other types nothing. Below `md` the Vault's panel is already a right
 * sheet, which is the drawer shape the pad's own Versions list had.
 *
 * The panel carries the actions as well as the list, so no new Core surface is
 * needed for "take a version".
 */
export function VersionsPanel({ doc, index }: { doc: Document; index: LinkIndex }) {
  // An Essay's or a Chapter's (ADR 0068): the two kinds of prose that *are* the thing.
  const writing = (VERSIONED as readonly string[]).includes(doc.type) ? (doc as Document & { body: string }) : undefined;
  const versions = useVersions(writing?.id);
  const [label, setLabel] = useState("");
  const [compare, setCompare] = useState<Version | null>(null);
  if (!writing) return null;

  async function take() {
    await snapshot(writing!, label);
    setLabel("");
    toast.success("Version saved");
  }

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1 text-sm font-medium">
        Versions <span className="text-muted-foreground text-xs">· {versions.length}</span>
        {/* The pad kept a running word count in its toolbar; prose wants one. */}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">{wordCount(writing.body ?? "")} words</span>
      </div>
      <div className="mb-1 flex gap-1">
        <Input className="h-8 text-xs" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void take()} />
        <Button size="sm" className="h-8" onClick={() => void take()} title="Save a version of the current text">
          <Camera />
        </Button>
      </div>
      <ul className="text-sm">
        {versions.length === 0 && <li className="text-muted-foreground py-2 text-xs">No versions yet. Press the camera to keep the current text.</li>}
        {versions.map((v) => (
          <li key={v.id} className="group flex items-start gap-1 border-b py-1.5 last:border-b-0">
            <button className="min-w-0 flex-1 text-left" onClick={() => setCompare(v)}>
              <div className="truncate font-medium">{v.label || "Version"}</div>
              <div className="text-muted-foreground text-xs">
                {new Date(v.takenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {v.words} w
              </div>
            </button>
            <Button size="icon" variant="ghost" className="size-6 md:opacity-0 md:group-hover:opacity-100" onClick={() => void deleteVersion(v.id)} title="Delete version">
              <Trash2 className="size-3" />
            </Button>
          </li>
        ))}
      </ul>
      <CompareDialog writing={writing} version={compare} index={index} onClose={() => setCompare(null)} />
    </div>
  );
}

/**
 * A Version beside the current text: two columns on the desktop, stacked on a
 * phone. The pad compared inside its own page; a 16rem panel cannot hold two
 * texts, so the Vault compares over the editor instead (ADR 0045).
 */
function CompareDialog({ writing, version, index, onClose }: { writing: Document & { body: string }; version: Version | null; index: LinkIndex; onClose: () => void }) {
  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] gap-2 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {version?.label || "Version"}
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {version ? `${new Date(version.takenAt).toLocaleString()} · ${version.words} words` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className={cn("grid min-h-0 gap-3 overflow-y-auto md:grid-cols-2")}>
          <section className="min-w-0">
            <h3 className="text-muted-foreground mb-1 text-xs font-medium">This version</h3>
            {version && <MarkdownView body={version.body} index={index} />}
          </section>
          <section className="min-w-0 max-md:border-t max-md:pt-3 md:border-l md:pl-3">
            <h3 className="text-muted-foreground mb-1 text-xs font-medium">Current text</h3>
            <MarkdownView body={writing.body ?? ""} index={index} />
          </section>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (!version) return;
              // Restore is a new edit, not a rewind: `restore` snapshots the current text first.
              void restore(writing, version).then(() => {
                toast.success("Restored as a new edit");
                onClose();
              });
            }}
          >
            <RotateCcw /> Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
