import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from "@lifeline/ui";
import { login, logout, syncNow, useAuth, useSyncState } from "@lifeline/core";
import { Cloud, CloudOff, Loader2, RefreshCw, User } from "lucide-react";

const LABELS: Record<string, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
  unauthenticated: "Not signed in",
  error: "Sync error",
};

export function SyncBadge() {
  const { state, pending } = useSyncState();
  const { loggedIn, email } = useAuth();
  const [open, setOpen] = useState(false);
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await login(em, pw);
      toast.success("Signed in");
      setOpen(false);
      void syncNow();
    } catch {
      toast.error("Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const Icon =
    state === "syncing" ? Loader2 : state === "idle" && loggedIn ? Cloud : CloudOff;

  return (
    <>
      <button
        className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs"
        onClick={() => (loggedIn ? void syncNow() : setOpen(true))}
        title={loggedIn ? "Sync now" : "Sign in to sync"}
      >
        <Icon className={state === "syncing" ? "size-3.5 animate-spin" : "size-3.5"} />
        <span className="truncate">
          {loggedIn ? (LABELS[state] ?? state) : "Sign in to sync"}
          {pending > 0 && ` · ${pending} pending`}
        </span>
        {loggedIn && <RefreshCw className="text-muted-foreground ml-auto size-3" />}
      </button>
      {loggedIn && (
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={em}
                onChange={(e) => setEm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-pw">Password</Label>
              <Input
                id="login-pw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
