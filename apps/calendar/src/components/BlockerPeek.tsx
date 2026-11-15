import { Button, toast } from "@lifeline/ui";
import { fieldsOfDocument, pushPeek, useDocument, userFieldsOf, documentTypeSync, type Document, type PeekProps } from "@lifeline/core";
import { attachmentOf } from "../domain/attached";
import { detachBlocker } from "../data/attached";
import { EVENT_TYPE, TIME_BLOCKER_TYPE, type Event, type TimeBlocker } from "../domain/types";

/** The fields a Time blocker's Peek lists: its own, bar the attachment, which has a line of its own. */
const HIDDEN = new Set(["attachedTo", "side"]);

/**
 * The Calendar App's part of a Time blocker's Peek: its fields listed, and,
 * for an attached one, "Before Dentist" linking to the Event with Detach
 * (CONTEXT.md "Attached blocker"). A blocker whose Event is gone reads as
 * plain: no line, no Detach.
 */
export function BlockerPeek({ doc }: PeekProps) {
  const b = doc as TimeBlocker;
  const link = attachmentOf(b);
  const event = useDocument<Event>(link?.eventId);
  const def = documentTypeSync(TIME_BLOCKER_TYPE);
  const mine = new Set(userFieldsOf(def).map((f) => f.key));
  const fields = fieldsOfDocument(doc, def).filter((f) => !mine.has(f.key) && !HIDDEN.has(f.key) && filled(doc, f.key));
  const attached = link && event && event.type === EVENT_TYPE ? { ...link, title: event.title } : null;

  const detach = async () => {
    try {
      const undo = await detachBlocker(b.id);
      toast.success(`${b.title} detached`, { action: { label: "Undo", onClick: () => void undo().catch((e: Error) => toast.error("Couldn't attach it again", { description: e.message })) } });
    } catch (e) {
      toast.error("Couldn't detach it", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {attached && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm break-words">
            {attached.side === "before" ? "Before" : "After"}{" "}
            <Button variant="link" className="h-auto min-w-0 shrink justify-start p-0 text-left align-baseline font-semibold whitespace-normal [overflow-wrap:anywhere]" onClick={() => pushPeek(attached.eventId)}>
              {attached.title}
            </Button>
          </p>
          <Button variant="outline" size="sm" onClick={() => void detach()}>
            Detach
          </Button>
        </div>
      )}
      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {fields.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 break-words">{format((doc as Document)[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
      {doc.tags && doc.tags.length > 0 && <div className="text-muted-foreground text-xs">{doc.tags.map((t) => `#${t}`).join(" ")}</div>}
    </div>
  );
}

const filled = (doc: Document, key: string) => {
  const v = doc[key];
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
};

function format(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
