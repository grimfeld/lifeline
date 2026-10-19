import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { accountConflict, boundAccount, login, logout, pb, pendingWriteCount, switchAccount, syncNow, type AccountRef } from "@lifeline/core";
import { Loader2 } from "lucide-react";

/**
 * Why the sign-in dialog is open: asked for from a SyncBadge, or opened by
 * the shell on page load because the device is signed out while its local
 * data keeps every screen looking normal.
 */
type SignInReason = "asked" | "signed-out";

let reason: SignInReason | null = null;
const listeners = new Set<() => void>();
function setReason(r: SignInReason | null) {
  reason = r;
  listeners.forEach((l) => l());
}

/** Open the one sign-in dialog — every SyncBadge shares it. */
export function openSignIn(): void {
  setReason("asked");
}

/**
 * Sign-in and the account-switch confirm (ADR 0039), mounted once by the
 * shell. On page load a signed-out device (never signed in, signed out, or
 * its session expired) opens the sign-in with a notice, since nothing else
 * on screen says sync has stopped.
 */
export function AccountDialogs() {
  const open = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => reason,
  );
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  /** Set when the sign-in is a different Account than the one this device holds (ADR 0039). */
  const [conflict, setConflict] = useState<{ bound: AccountRef; current: AccountRef } | null>(null);

  useEffect(() => {
    if (pb.authStore.isValid) return;
    // An expired session still remembers who it was; else the Account this device's data belongs to.
    const last = (pb.authStore.record as { email?: string } | null)?.email;
    void boundAccount().then((b) => {
      const known = last || b?.email;
      if (known) setEm((e) => e || known);
      if (!pb.authStore.isValid) setReason("signed-out");
    });
  }, []);

  function close() {
    setReason(null);
  }

  async function submit() {
    setBusy(true);
    try {
      await login(em, pw);
      setPw("");
      const c = await accountConflict();
      if (c) {
        const pending = await pendingWriteCount();
        if (pending > 0) {
          logout();
          toast.error(`This device still has ${pending} unsynced change${pending === 1 ? "" : "s"} of ${c.bound.email || "another account"} — sign in as them and sync first`);
          return;
        }
        close();
        setConflict(c);
        return;
      }
      toast.success("Signed in");
      close();
      void syncNow();
    } catch {
      toast.error("Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function eraseAndSwitch() {
    setBusy(true);
    try {
      await switchAccount();
    } catch (err) {
      setBusy(false);
      toast.error(`Could not erase local data: ${(err as Error).message}`);
    }
  }

  function cancelSwitch() {
    logout();
    setConflict(null);
    toast("Signed out — this device keeps its data");
  }

  return (
    <>
      <Dialog open={!!open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{open === "signed-out" ? "You're signed out" : "Sign in"}</DialogTitle>
          </DialogHeader>
          {open === "signed-out" && (
            <p className="text-muted-foreground text-sm">
              What you see is this device's local copy. Changes stay here and nothing syncs until you sign in.
            </p>
          )}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" value={em} onChange={(e) => setEm(e.target.value)} autoFocus={!em} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-pw">Password</Label>
              <Input
                id="login-pw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                autoFocus={!!em}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {open === "signed-out" ? "Work locally" : "Cancel"}
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conflict} onOpenChange={(o) => !o && cancelSwitch()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch account?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This device holds the data of <b>{conflict?.bound.email || "another account"}</b>. Switching to{" "}
            <b>{conflict?.current.email}</b> erases everything stored here (it stays on the server) and downloads their data instead.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={cancelSwitch}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void eraseAndSwitch()}>
              {busy && <Loader2 className="animate-spin" />} Erase and switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
