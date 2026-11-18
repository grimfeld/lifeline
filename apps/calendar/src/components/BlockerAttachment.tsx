import { Button, cn, linkStyle, toast } from "@lifeline/ui";
import { useDocument, type PeekProps } from "@lifeline/core";
import { DocLink } from "@lifeline/editor";
import { attachmentOf, liveAttachmentTo, SIDE_LABELS } from "../domain/attached";
import { detachBlocker } from "../data/attached";
import type { Event, TimeBlocker } from "../domain/types";

/**
 * An attached blocker's line in its Peek, above Core's list of its Fields:
 * "Before Dentist" linking to the Event, and Detach (CONTEXT.md "Attached
 * blocker"). Nothing for a plain blocker, nor for one whose Event is gone —
 * that one reads as plain.
 */
export function BlockerAttachment({ doc }: PeekProps) {
  const b = doc as TimeBlocker;
  // Live, by the same rule as `liveAttachment`: gone, the Event takes the line with it.
  const event = useDocument<Event>(attachmentOf(b)?.eventId);
  const attachment = liveAttachmentTo(attachmentOf(b), event);
  if (!attachment || !event) return null;

  const detach = async () => {
    try {
      const undo = await detachBlocker(b.id);
      toast.success(`${b.title} detached`, { action: { label: "Undo", onClick: () => void undo().catch((e: Error) => toast.error("Couldn't attach it again", { description: e.message })) } });
    } catch (e) {
      toast.error("Couldn't detach it", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1 text-sm break-words">
        {SIDE_LABELS[attachment.side]}{" "}
        <DocLink doc={event} className={cn(linkStyle, "font-semibold [overflow-wrap:anywhere]")}>
          {event.title}
        </DocLink>
      </p>
      <Button variant="outline" size="sm" onClick={() => void detach()}>
        Detach
      </Button>
    </div>
  );
}
