import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { logout, pendingWriteCount, switchAccount, syncNow, useAuth, useSyncState } from "@lifeline/core";
import { Cloud, CloudOff, Loader2, RefreshCw, Trash2, User } from "lucide-react";
import { openSignIn } from "./AccountDialogs";

const LABELS: Record<string, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
  unauthenticated: "Not signed in",
  error: "Sync error",
};

/**
 * Sync state, sign-in, sign-out and erase (the sign-in itself is AccountDialogs's). `compact` is the Rail's cell: the
 * state as one icon that syncs (or asks to sign in) on click — the account
 * rows live in Settings, where the full badge is.
 */
export function SyncBadge({ compact = false }: { compact?: boolean } = {}) {
  const { state, pending, error } = useSyncState();
  const { loggedIn, email } = useAuth();
  const [busy, setBusy] = useState(false);
  /** The explicit "wipe this device" confirm; carries the unpushed-write count it would lose. */
  const [erase, setErase] = useState<{ pending: number } | null>(null);

  async function eraseAndSwitch() {
    setBusy(true);
    try {
      await switchAccount();
    } catch (err) {
      setBusy(false);
      toast.error(`Could not erase local data: ${(err as Error).message}`);
    }
  }

  /**
   * A device that pulled everything before Accounts existed (ADR 0039) still
   * holds every row it got, bound to whoever signed in first afterwards, and
   * no conflict ever surfaces to offer the erase. This is the way out: wipe
   * the device, sign in stays, the next sync pulls only this Account's rows.
   */
  async function askErase() {
    setErase({ pending: await pendingWriteCount() });
  }

  const Icon =
    state === "syncing" ? Loader2 : state === "idle" && loggedIn ? Cloud : CloudOff;

  return (
    <>
      <button
        className={
          compact
            ? "hover:bg-accent/50 text-muted-foreground relative flex size-9 items-center justify-center rounded-md"
            : "hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
        }
        onClick={() => (loggedIn ? void syncNow() : openSignIn())}
        title={
          (loggedIn ? (state === "error" && error ? `Sync error: ${error}\nClick to retry` : `${LABELS[state] ?? state} — sync now`) : "Sign in to sync") +
          (pending > 0 ? ` (${pending} pending)` : "")
        }
      >
        <Icon className={`${compact ? "size-4" : "size-3.5"} ${state === "syncing" ? "animate-spin" : ""} ${state === "error" ? "text-destructive" : ""}`} />
        {compact && pending > 0 && <span className="bg-primary absolute top-1.5 right-1.5 size-1.5 rounded-full" />}
        <span className={compact ? "sr-only" : "truncate"}>
          {loggedIn ? (LABELS[state] ?? state) : "Sign in to sync"}
          {pending > 0 && ` · ${pending} pending`}
        </span>
        {loggedIn && !compact && <RefreshCw className="text-muted-foreground ml-auto size-3" />}
      </button>
      {loggedIn && !compact && (
        <button
          className="hover:bg-accent/50 text-muted-foreground flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs"
          onClick={() => {
            logout();
            toast("Signed out — working locally");
          }}
        >
          <User className="size-3" />
          <span className="truncate">{email} · sign out</span>
        </button>
      )}
      {!compact && (
        <button
          className="hover:bg-accent/50 text-muted-foreground flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs"
          onClick={() => void askErase()}
          title="Delete everything stored on this device and download this account's data again"
        >
          <Trash2 className="size-3" />
          <span className="truncate">Erase local data…</span>
        </button>
      )}

      <Dialog open={!!erase} onOpenChange={(o) => !o && setErase(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Erase this device's data?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Everything stored on this device is deleted and the app reloads.
            {loggedIn ? (
              <>
                {" "}
                Anything already synced stays on the server and comes back for <b>{email}</b> on the next sync.
              </>
            ) : (
              <> You are not signed in: nothing comes back until you sign in and sync.</>
            )}
          </p>
          {!!erase?.pending && (
            <p className="text-destructive text-sm">
              {erase.pending} local change{erase.pending === 1 ? "" : "s"} never reached the server and will be lost. If they
              are edits to records that belong to another account, they never can.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setErase(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void eraseAndSwitch()}>
              {busy && <Loader2 className="animate-spin" />} Erase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
