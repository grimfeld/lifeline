import { useState } from "react";
import { Button, Input, Textarea, toast } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { clip } from "../data";

/** Capture Card: source + pasted text, Clip. */
export function QuickClipCard(_: CardProps) {
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  async function submit() {
    if (!text.trim()) return;
    const c = await clip({ source, text });
    toast.success(`Clipped “${c.title}”`);
    setSource("");
    setText("");
  }
  return (
    <div className="flex h-full flex-col gap-1">
      <Input className="h-7 text-xs" placeholder="Source URL or name" value={source} onChange={(e) => setSource(e.target.value)} />
      <Textarea className="min-h-0 flex-1 resize-none text-xs" placeholder="Paste text… (⌘↵ to clip)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void submit()} />
      <Button size="sm" className="h-7 self-end" onClick={() => void submit()} disabled={!text.trim()}>
        Clip
      </Button>
    </div>
  );
}
