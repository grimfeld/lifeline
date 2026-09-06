import { useEffect, useState } from "react";
import { openExternal } from "@lifeline/core";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
  toast,
} from "@lifeline/ui";
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Inbox, Mail, MailOpen, Paperclip, Star, Tag, Trash2 } from "lucide-react";
import { archive, loadThread, moveToInbox, setLabel, setRead, setStarred, trash, useCachedLabels, useCachedMessages } from "../data/cache";
import { handoffOf } from "../domain/handoff";
import { INBOX, TRASH, gmailThreadUrl, type Mailbox, type Message, type Thread } from "../domain/types";
import { useSignedIn } from "../gmail/auth";
import { bytes, partyLine, whenFull } from "./format";
import { KeepMenu } from "./KeepMenu";
import { MessageBody } from "./MessageBody";

/**
 * One open Thread: its Messages (the newest unfolded), the triage verbs
 * (CONTEXT.md "Triage") and Keep. Opening it reads the Messages from Gmail
 * into the cache and marks the Thread read, as any mail client does.
 */
export function ThreadView({ mailbox, thread, onBack, onGone }: { mailbox: Mailbox; thread: Thread; onBack?: () => void; onGone?: () => void }) {
  const signedIn = useSignedIn(mailbox.address);
  const messages = useCachedMessages(mailbox.id, thread.id);
  const labels = useCachedLabels(mailbox.id).filter((l) => l.type === "user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadThread(mailbox, thread.id)
      .then(() => {
        if (!cancelled && thread.unread) return setRead(mailbox, thread.id, true);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailbox.id, thread.id, signedIn]);

  const act = (label: string, fn: () => Promise<void>, leaves = false) => () =>
    fn()
      .then(() => {
        toast.success(label);
        if (leaves) onGone?.();
      })
      .catch((e: Error) => toast.error(e.message));

  const inInbox = thread.labelIds.includes(INBOX);
  const inTrash = thread.labelIds.includes(TRASH);
  const url = gmailThreadUrl(mailbox.address, thread.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        {onBack && (
          <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        {inInbox ? (
          <Button variant="ghost" size="sm" title="Archive" onClick={act("Archived", () => archive(mailbox, thread.id), true)} disabled={!signedIn}>
            <Archive className="size-4" /> Archive
          </Button>
        ) : (
          !inTrash && (
            <Button variant="ghost" size="sm" title="Move to Inbox" onClick={act("Moved to Inbox", () => moveToInbox(mailbox, thread.id))} disabled={!signedIn}>
              <Inbox className="size-4" /> To Inbox
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="sm"
          title={thread.unread ? "Mark read" : "Mark unread"}
          onClick={act(thread.unread ? "Marked read" : "Marked unread", () => setRead(mailbox, thread.id, thread.unread))}
          disabled={!signedIn}
        >
          {thread.unread ? <MailOpen className="size-4" /> : <Mail className="size-4" />}
          {thread.unread ? "Read" : "Unread"}
        </Button>
        <Button variant="ghost" size="sm" title={thread.starred ? "Unstar" : "Star"} onClick={act(thread.starred ? "Unstarred" : "Starred", () => setStarred(mailbox, thread.id, !thread.starred))} disabled={!signedIn}>
          <Star className={cn("size-4", thread.starred && "fill-yellow-400 text-yellow-500")} /> {thread.starred ? "Starred" : "Star"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!signedIn || labels.length === 0} title={labels.length ? "Labels" : "No labels in this Mailbox"}>
              <Tag className="size-4" /> Label
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Labels</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {labels.map((l) => {
              const on = thread.labelIds.includes(l.id);
              return (
                <DropdownMenuItem
                  key={l.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    void act(on ? `Removed “${l.name}”` : `Labelled “${l.name}”`, () => setLabel(mailbox, thread.id, l.id, !on))();
                  }}
                >
                  <Checkbox checked={on} className="pointer-events-none" /> {l.name}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {!inTrash ? (
          <Button variant="ghost" size="sm" title="Trash (Gmail keeps it thirty days)" onClick={act("Trashed", () => trash(mailbox, thread.id), true)} disabled={!signedIn}>
            <Trash2 className="size-4" /> Trash
          </Button>
        ) : (
          <Button variant="ghost" size="sm" title="Back to Inbox" onClick={act("Moved to Inbox", () => moveToInbox(mailbox, thread.id))} disabled={!signedIn}>
            <ArchiveRestore className="size-4" /> Restore
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" title="Open in Gmail — reply, forward, everything Mail does not do" onClick={() => openExternal(url).catch((e: Error) => toast.error(e.message))}>
          <ExternalLink className="size-4" /> Gmail
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-3">
          <h2 className="text-lg leading-tight font-semibold">{thread.subject || "(no subject)"}</h2>
          {!signedIn && <p className="text-muted-foreground mt-1 text-xs">{mailbox.title} is signed out on this device — showing what was read last.</p>}
          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </div>
        {messages.length === 0 && (
          <p className="text-muted-foreground px-4 py-6 text-sm">{loading ? "Reading…" : signedIn ? "No messages." : "Not read on this device yet. Sign in to read it."}</p>
        )}
        <div className="grid gap-3 p-3">
          {messages.map((m, i) => (
            <MessageCard key={m.id} message={m} mailbox={mailbox} open={i === messages.length - 1 || messages.length <= 3} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ message: m, mailbox, open: initiallyOpen }: { message: Message; mailbox: Mailbox; open: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => setOpen(initiallyOpen), [initiallyOpen, m.id]);
  return (
    <div className="rounded-lg border">
      <button type="button" className="hover:bg-accent/40 flex w-full items-start gap-2 px-3 py-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{m.from.name || m.from.address}</span>
            <span className="text-muted-foreground truncate text-xs">{m.from.name && m.from.name !== m.from.address ? m.from.address : ""}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">{whenFull(m.date)}</span>
          </div>
          {open ? (
            <div className="text-muted-foreground text-xs">
              {m.to.length > 0 && <div className="truncate">to {m.to.map(partyLine).join(", ")}</div>}
              {m.cc.length > 0 && <div className="truncate">cc {m.cc.map(partyLine).join(", ")}</div>}
            </div>
          ) : (
            <div className="text-muted-foreground line-clamp-1 text-xs">{m.snippet}</div>
          )}
        </div>
        {m.attachments.length > 0 && <Paperclip className="text-muted-foreground mt-1 size-3.5 shrink-0" />}
      </button>
      {open && (
        <div className="grid gap-2 border-t pb-3">
          <MessageBody message={m} />
          {m.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-3 text-xs">
              {m.attachments.map((a) => (
                <li key={a.id} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1" title="Attachments open in Gmail">
                  <Paperclip className="size-3" /> {a.filename} <span className="text-muted-foreground">{bytes(a.size)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end px-3">
            <KeepMenu handoff={() => handoffOf(m, mailbox.address)} />
          </div>
        </div>
      )}
    </div>
  );
}
