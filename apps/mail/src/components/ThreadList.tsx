import type { ReactNode } from "react";
import { Button, cn, colorVar, toast } from "@lifeline/ui";
import { Paperclip, Star } from "lucide-react";
import { setStarred } from "../data/cache";
import type { Mailbox, Thread } from "../domain/types";
import { senders, when } from "./format";

export function ThreadList({
  threads,
  mailboxes,
  showMailbox,
  selectedId,
  onOpen,
  footer,
}: {
  threads: Thread[];
  mailboxes: Mailbox[];
  /** Under All: a dot in the Mailbox's colour on every row. */
  showMailbox: boolean;
  selectedId?: string;
  onOpen: (t: Thread) => void;
  footer?: ReactNode;
}) {
  const byId = new Map(mailboxes.map((m) => [m.id, m]));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {threads.length === 0 && <li className="text-muted-foreground px-3 py-6 text-center text-sm">Nothing here.</li>}
        {threads.map((t) => {
          const mb = byId.get(t.mailboxId);
          const selected = t.id === selectedId;
          return (
            <li key={`${t.mailboxId}/${t.id}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(t)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(t)}
                className={cn("hover:bg-accent/60 flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left", selected && "bg-accent", t.unread && "font-medium")}
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0"
                  title={t.starred ? "Unstar" : "Star"}
                  aria-label={t.starred ? "Unstar" : "Star"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mb) void setStarred(mb, t.id, !t.starred).catch((err: Error) => toast.error(err.message));
                  }}
                >
                  <Star className={cn("size-4", t.starred ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground/50 hover:text-muted-foreground")} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {showMailbox && mb && <span className="size-2 shrink-0 self-center rounded-full" style={{ background: colorVar(mb.color) }} title={mb.title} />}
                    <span className={cn("truncate text-sm", !t.unread && "text-muted-foreground")}>{senders(t.from)}</span>
                    {t.messageCount > 1 && <span className="text-muted-foreground text-xs">{t.messageCount}</span>}
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">{when(t.date)}</span>
                  </div>
                  <div className="truncate text-sm">{t.subject || "(no subject)"}</div>
                  <div className="text-muted-foreground line-clamp-1 text-xs font-normal">{t.snippet}</div>
                </div>
                {t.labelIds.includes("HAS_ATTACHMENT") && <Paperclip className="text-muted-foreground mt-1 size-3.5 shrink-0" />}
              </div>
            </li>
          );
        })}
      </ul>
      {footer && <div className="border-t p-2">{footer}</div>}
    </div>
  );
}

export function LoadMore({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button variant="ghost" size="sm" className="w-full" onClick={onClick} disabled={loading}>
      {loading ? "Loading…" : "Older"}
    </Button>
  );
}
