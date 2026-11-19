import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatHuman, todayStr, useLinkIndex, timelineOf, type Document } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { agoOf, lastTimeOf } from "../domain/lastTime";
import { Section } from "../components/Section";

/**
 * Last time (ADR 0131): the newest thing they told me, above the Timeline: the
 * newest Exchange or Event reaching them (a Household's included) that has text,
 * with its kind, day and how long ago. The text is clamped to four lines, with
 * More when it is longer. Absent when nothing has text.
 */
export function LastTimeSection({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const today = todayStr();
  const last = useMemo(() => lastTimeOf(timelineOf(index, doc.id), (id) => index.byId.get(id), today), [index, doc.id, today]);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);

  // Whether the clamp hides anything: measured while clamped, so More shows only for text that needs it.
  useLayoutEffect(() => {
    const el = text.current;
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 1);
  }, [last?.text, open]);

  if (!last) return null;
  return (
    <Section title="Last time">
      <div className="grid min-w-0 gap-1 rounded-lg border p-3">
        <p className="text-muted-foreground min-w-0 text-xs break-words">
          <span className="text-foreground font-medium">{last.title ? `${last.label} · ${last.title}` : last.label}</span> · {formatHuman(last.day)} · {agoOf(last.daysAgo)}
        </p>
        <p ref={text} className={open ? "min-w-0 text-sm break-words whitespace-pre-line" : "line-clamp-4 min-w-0 text-sm break-words whitespace-pre-line"}>
          {last.text}
        </p>
        {(clipped || open) && (
          <Button variant="ghost" size="sm" className="justify-self-start" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Less" : "More"}
          </Button>
        )}
      </div>
    </Section>
  );
}
