import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import type { CommandDef, CommandDialogProps } from "@lifeline/core";
import { Lightbulb } from "lucide-react";
import { ThoughtComposer } from "./components/ThoughtComposer";
import { captureThought } from "./data/repo";
import { THOUGHT_KINDS, THOUGHTS_HREF, isKind } from "./domain/types";

function CaptureThoughtDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New thought</DialogTitle>
        </DialogHeader>
        <ThoughtComposer autoFocus initial={initial} onKept={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const thoughtsCommands: CommandDef[] = [
  {
    id: "thoughts.capture",
    title: "New thought…",
    keywords: ["thought", "idea", "feeling", "reflection", "question", "mind", "jot"],
    icon: Lightbulb,
    dialog: CaptureThoughtDialog,
    capture: true,
    args: [
      { key: "text", label: "Text", kind: "longtext", required: true, hint: "The thought, in markdown. Its first line becomes its title." },
      { key: "kind", label: "Kind", kind: "select", options: THOUGHT_KINDS.map((k) => ({ value: k.value, label: k.label })), hint: "Optional: idea, feeling, reflection or question." },
      { key: "title", label: "Title", kind: "text", hint: "Optional; defaults to the first line." },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    returnsDocument: true,
    async invoke(a) {
      const t = await captureThought({ text: String(a.text), title: a.title as string | undefined, kind: isKind(a.kind) ? a.kind : undefined, tags: a.tags as string[] | undefined });
      return { message: `Kept the thought “${t.title}”`, id: t.id };
    },
  },
  { id: "thoughts.open", title: "Go to Thoughts", keywords: ["thoughts", "ideas", "stream", "mind"], icon: Lightbulb, run: ({ navigate }) => navigate(THOUGHTS_HREF) },
];
