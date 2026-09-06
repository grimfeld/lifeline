import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { basePath, useIsMobile } from "@lifeline/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  cn,
  colorVar,
  toast,
} from "@lifeline/ui";
import { AlertTriangle, Inbox, LogIn, LogOut, MoreHorizontal, Plus, RefreshCw, Search, Settings2, Star, Tag, Trash2, X } from "lucide-react";
import { searchThreads, useCachedLabels, useCachedThread, useCachedThreads, useLastRead, useListRefresh } from "../data/cache";
import { connectMailbox, removeMailbox, signIn, signOut, useMailboxes } from "../data/mailboxes";
import { ALL, ALL_LABELS, INBOX, MAILBOX, type Label, type Mailbox, type Thread } from "../domain/types";
import { unavailableReason, useSignedIn } from "../gmail/auth";
import { ago } from "../components/format";
import { LoadMore, ThreadList } from "../components/ThreadList";
import { ThreadView } from "../components/ThreadView";

/**
 * The Mail screen (ADR 0047): a Mailbox switcher (each address, and All),
 * a Label rail, the Thread list and the open Thread. On the phone the list
 * and the Thread are two steps.
 */
export function MailScreen() {
  const reason = unavailableReason();
  const mailboxes = useMailboxes();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const mobile = useIsMobile();

  const mailboxId = params.get("mailbox") || ALL;
  const threadId = params.get("thread") || undefined;
  const threadMailboxId = params.get("tm") || (mailboxId !== ALL ? mailboxId : undefined);
  const [labelId, setLabelId] = useState(INBOX);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ q: string; threads: Thread[]; loading: boolean; error: string | null } | null>(null);

  const current = mailboxes.find((m) => m.id === mailboxId);
  const shown: Mailbox[] = useMemo(() => (mailboxId === ALL ? mailboxes : current ? [current] : []), [mailboxId, mailboxes, current]);
  const shownIds = useMemo(() => shown.map((m) => m.id), [shown]);
  const labels = useCachedLabels(mailboxId === ALL ? undefined : mailboxId);
  const rail: Label[] = mailboxId === ALL ? ALL_LABELS : labels;
  useEffect(() => {
    if (!rail.some((l) => l.id === labelId)) setLabelId(INBOX);
  }, [rail, labelId]);

  const cached = useCachedThreads(shownIds, labelId);
  const list = useListRefresh(shown, labelId, !reason && !search);
  const lastRead = useLastRead(shownIds);
  const threads = search ? search.threads : cached;

  const threadMailbox = mailboxes.find((m) => m.id === threadMailboxId);
  const openThread = useCachedThread(threadMailbox?.id, threadId);

  const select = (mb: string) => {
    setSearch(null);
    setQuery("");
    setParams({ mailbox: mb });
  };
  const open = (t: Thread) => setParams({ mailbox: mailboxId, thread: t.id, tm: t.mailboxId });
  const close = () => setParams({ mailbox: mailboxId });

  async function runSearch() {
    const q = query.trim();
    if (!q) return setSearch(null);
    setSearch({ q, threads: [], loading: true, error: null });
    try {
      const results = await Promise.all(shown.map((m) => searchThreads(m, q).catch((e: Error) => ({ threads: [] as Thread[], error: e.message }))));
      const all = results.flatMap((r) => r.threads).sort((a, b) => b.date.localeCompare(a.date));
      const errors = results.map((r) => ("error" in r ? r.error : null)).filter(Boolean);
      setSearch({ q, threads: all, loading: false, error: errors.length ? String(errors[0]) : null });
    } catch (e) {
      setSearch({ q, threads: [], loading: false, error: (e as Error).message });
    }
  }

  async function connect() {
    try {
      const { mailbox, created } = await connectMailbox();
      toast.success(created ? `Connected ${mailbox.address}` : `${mailbox.title} signed in`);
      select(mailbox.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (reason) {
    return (
      <div className="grid gap-3 p-1">
        <h1 className="text-lg font-semibold">Mail</h1>
        <div className="text-muted-foreground flex items-start gap-2 rounded-md border p-4 text-sm">
          <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
          <span>{reason}</span>
        </div>
      </div>
    );
  }

  const showThread = !!(threadMailbox && openThread);
  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="flex items-center gap-1 border-b px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <Search className="text-muted-foreground size-4 shrink-0" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Gmail — from:, newer_than:2d, “exact words”" className="h-8 border-0 shadow-none focus-visible:ring-0" />
        {(query || search) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setSearch(null);
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </form>
      {search ? (
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-1 text-xs">
          {search.loading ? "Searching…" : `${search.threads.length} result${search.threads.length === 1 ? "" : "s"} for “${search.q}”`}
          {search.error && <span className="text-destructive">· {search.error}</span>}
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-1 text-xs">
          <span className="truncate">
            {list.loading ? "Reading…" : lastRead ? `read ${ago(lastRead)}` : "not read yet"}
            {list.error && <span className="text-destructive"> · {list.error}</span>}
          </span>
          <Button variant="ghost" size="icon" className="ml-auto size-6" aria-label="Refresh" onClick={() => void list.refresh()} disabled={list.loading}>
            <RefreshCw className={cn("size-3.5", list.loading && "animate-spin")} />
          </Button>
        </div>
      )}
      {list.signedOut.length > 0 && !search && (
        <div className="grid gap-1 border-b px-3 py-2">
          {list.signedOut.map((id) => {
            const m = mailboxes.find((x) => x.id === id);
            return m ? <SignedOutRow key={id} mailbox={m} /> : null;
          })}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ThreadList
          threads={threads}
          mailboxes={mailboxes}
          showMailbox={mailboxId === ALL}
          selectedId={threadId}
          onOpen={open}
          footer={!search && list.more ? <LoadMore onClick={() => void list.loadMore()} loading={list.loading} /> : undefined}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Mail</h1>
        <div className="flex flex-wrap items-center gap-1">
          <MailboxTab active={mailboxId === ALL} onClick={() => select(ALL)} label="All" />
          {mailboxes.map((m) => (
            <MailboxTab key={m.id} active={mailboxId === m.id} onClick={() => select(m.id)} label={m.title} color={colorVar(m.color)} mailbox={m} />
          ))}
        </div>
        <span className="flex-1" />
        {current && <MailboxMenu mailbox={current} onRemoved={() => select(ALL)} />}
        <Button variant="outline" size="sm" onClick={() => void connect()}>
          <Plus className="size-4" /> Connect a Mailbox
        </Button>
        <Button variant="ghost" size="sm" title="Mailboxes Base" onClick={() => navigate(basePath(MAILBOX))}>
          <Settings2 className="size-4" />
        </Button>
      </div>
      {mailboxes.length === 0 ? (
        <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          No Mailbox yet. Connect a Gmail address — Lifeline reads it live and stores no password or token.
        </div>
      ) : mobile ? (
        <div className="min-h-0 flex-1 rounded-md border">
          {showThread ? (
            <ThreadView mailbox={threadMailbox} thread={openThread} onBack={close} onGone={close} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <LabelRail labels={rail} labelId={labelId} onPick={setLabelId} horizontal />
              {listPane}
            </div>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[10rem_minmax(18rem,26rem)_1fr] rounded-md border">
          <LabelRail labels={rail} labelId={labelId} onPick={setLabelId} />
          <div className="min-h-0 border-r">{listPane}</div>
          <div className="min-h-0">
            {showThread ? (
              <ThreadView mailbox={threadMailbox} thread={openThread} onGone={close} />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Pick a thread.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MailboxTab({ active, onClick, label, color, mailbox }: { active: boolean; onClick: () => void; label: string; color?: string; mailbox?: Mailbox }) {
  const signedIn = useSignedIn(mailbox?.address);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-sm", active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50")}
      title={mailbox ? `${mailbox.address}${signedIn ? "" : " · signed out"}` : "Every signed-in Mailbox"}
    >
      {color && <span className={cn("size-2 rounded-full", !signedIn && "opacity-30")} style={{ background: color }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function SignedOutRow({ mailbox }: { mailbox: Mailbox }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="size-2 rounded-full opacity-40" style={{ background: colorVar(mailbox.color) }} />
      <span className="text-muted-foreground truncate">{mailbox.title} is signed out on this device</span>
      <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={() => signIn(mailbox).catch((e: Error) => toast.error(e.message))}>
        Sign in
      </Button>
    </div>
  );
}

function MailboxMenu({ mailbox, onRemoved }: { mailbox: Mailbox; onRemoved: () => void }) {
  const signedIn = useSignedIn(mailbox.address);
  const [confirm, setConfirm] = useState(false);
  return (
    <DropdownMenu onOpenChange={() => setConfirm(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Mailbox menu">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {signedIn ? (
          <DropdownMenuItem onSelect={() => signOut(mailbox)}>
            <LogOut className="size-4" /> Sign out on this device
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => void signIn(mailbox).catch((e: Error) => toast.error(e.message))}>
            <LogIn className="size-4" /> Sign in
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {confirm ? (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => void removeMailbox(mailbox).then(onRemoved).catch((e: Error) => toast.error(e.message))}
          >
            <Trash2 className="size-4" /> Really remove “{mailbox.title}”
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirm(true);
            }}
          >
            <Trash2 className="size-4" /> Remove Mailbox (Gmail untouched)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LABEL_ICON: Record<string, typeof Inbox> = { INBOX: Inbox, STARRED: Star, TRASH: Trash2 };

function LabelRail({ labels, labelId, onPick, horizontal }: { labels: Label[]; labelId: string; onPick: (id: string) => void; horizontal?: boolean }) {
  return (
    <nav className={cn(horizontal ? "flex gap-1 overflow-x-auto border-b px-2 py-1.5" : "grid content-start gap-0.5 overflow-y-auto border-r p-1.5")} aria-label="Labels">
      {labels.map((l) => {
        const Icon = LABEL_ICON[l.id] ?? Tag;
        const active = l.id === labelId;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onPick(l.id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm", active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50")}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{l.name}</span>
            {l.id === INBOX && l.threadsUnread ? <span className="text-muted-foreground ml-auto text-xs">{l.threadsUnread}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
