import { useNavigate } from "react-router";
import { type CardProps, type CardSettings, type CardSettingsSchema } from "@lifeline/core";
import { cn, colorVar } from "@lifeline/ui";
import { useCachedThreads, useListRefresh } from "../data/cache";
import { useMailboxes } from "../data/mailboxes";
import { ALL, INBOX, mailHref } from "../domain/types";
import { unavailableReason } from "../gmail/auth";
import { senders, when } from "../components/format";
import { SignInLine, useMailboxOptions } from "./UnreadCard";

export const latestMailSettings: CardSettingsSchema = {
  mailbox: { kind: "entity", label: "Mailbox", useOptions: useMailboxOptions, anyLabel: "All Mailboxes" },
  count: { kind: "number", label: "How many", default: 8, min: 1, max: 30 },
};

export function useLatestMailTitle(settings: CardSettings): string {
  const m = useMailboxes().find((x) => x.id === settings.mailbox);
  return m ? `Latest mail · ${m.title}` : "Latest mail";
}

/** Card: the newest Inbox Threads of one Mailbox or all; a row opens the Thread on the Mail screen. */
export function LatestMailCard({ settings }: CardProps) {
  const navigate = useNavigate();
  const reason = unavailableReason();
  const mailboxes = useMailboxes();
  const chosen = String(settings.mailbox ?? "");
  const shown = chosen ? mailboxes.filter((m) => m.id === chosen) : mailboxes;
  const ids = shown.map((m) => m.id);
  const threads = useCachedThreads(ids, INBOX).slice(0, Number(settings.count) || 8);
  const list = useListRefresh(shown, INBOX, !reason);
  const byId = new Map(mailboxes.map((m) => [m.id, m]));
  if (reason) return <p className="text-muted-foreground p-2 text-xs">{reason}</p>;
  if (mailboxes.length === 0) return <p className="text-muted-foreground p-2 text-xs">No Mailbox connected.</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto text-sm">
        {threads.length === 0 && <li className="text-muted-foreground px-1 py-2 text-xs">{list.loading ? "Reading…" : "Nothing in the Inbox."}</li>}
        {threads.map((t) => {
          const mb = byId.get(t.mailboxId);
          return (
            <li key={`${t.mailboxId}/${t.id}`}>
              <button
                type="button"
                className="hover:bg-accent/60 flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left"
                onClick={() => navigate(mailHref(chosen || ALL, t.id) + `&tm=${t.mailboxId}`)}
              >
                {!chosen && mb && <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: colorVar(mb.color) }} />}
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-baseline gap-2", t.unread && "font-medium")}>
                    <span className="truncate">{senders(t.from)}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">{when(t.date)}</span>
                  </span>
                  <span className="text-muted-foreground line-clamp-1 text-xs">{t.subject || "(no subject)"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-0.5 pt-1">
        {shown.filter((m) => list.signedOut.includes(m.id)).map((m) => (
          <SignInLine key={m.id} mailbox={m} />
        ))}
      </div>
    </div>
  );
}
