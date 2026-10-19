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

/** Set when the sign-in is a different Account than the one this device holds (ADR 0039); the confirm is AccountDialogs's. */
let conflict: { bound: AccountRef; current: AccountRef } | null = null;
const conflictListeners = new Set<() => void>();
function setConflict(c: typeof conflict) {
  conflict = c;
  conflictListeners.forEach((l) => l());
}

/**
 * Signing in by email and password, wherever the form stands: the shell's
 * dialog, or the Handoff page's own step. The email starts as the Account
 * this device last knew. `onSignedIn` runs only when the sign-in holds; a
 * different Account than the device's goes to the switch confirm.
 */
export function useSignIn(onSignedIn?: () => void) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pb.authStore.isValid) return;
    // An expired session still remembers who it was; else the Account this device's data belongs to.
    const last = (pb.authStore.record as { email?: string } | null)?.email;
    if (last) setEmail((e) => e || last);
    else void boundAccount().then((b) => b?.email && setEmail((e) => e || b.email));
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await login(email, password);
      setPassword("");
      const c = await accountConflict();
      if (c) {
        const pending = await pendingWriteCount();
        if (pending > 0) {
          logout();
          toast.error(`This device still has ${pending} unsynced change${pending === 1 ? "" : "s"} of ${c.bound.email || "another account"} — sign in as them and sync first`);
          return;
        }
        setReason(null);
        setConflict(c);
        return;
      }
      toast.success("Signed in");
      onSignedIn?.();
      void syncNow();
    } catch {
      toast.error("Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return { email, setEmail, password, setPassword, busy, submit };
}

/** The email and password fields of a sign-in; Enter in the password submits. */
export function SignInFields({ form, idPrefix = "login" }: { form: ReturnType<typeof useSignIn>; idPrefix?: string }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input id={`${idPrefix}-email`} type="email" value={form.email} onChange={(e) => form.setEmail(e.target.value)} autoFocus={!form.email} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-pw`}>Password</Label>
        <Input
          id={`${idPrefix}-pw`}
          type="password"
          value={form.password}
          onChange={(e) => form.setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void form.submit()}
          autoFocus={!!form.email}
        />
      </div>
    </div>
  );
}

/** Pages that ask for sign-in themselves, so the shell's on-load notice stays away: the Handoff page (ADR 0080). */
function asksForSignInItself(pathname: string): boolean {
  return pathname === "/handoff";
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
  const confirm = useSyncExternalStore(
    (cb) => (conflictListeners.add(cb), () => conflictListeners.delete(cb)),
    () => conflict,
  );
  const form = useSignIn(() => setReason(null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pb.authStore.isValid || asksForSignInItself(window.location.pathname)) return;
    void boundAccount().then(() => {
      if (!pb.authStore.isValid) setReason("signed-out");
    });
  }, []);

  function close() {
    setReason(null);
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
          <SignInFields form={form} />
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {open === "signed-out" ? "Work locally" : "Cancel"}
            </Button>
            <Button disabled={form.busy} onClick={() => void form.submit()}>
              {form.busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && cancelSwitch()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch account?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This device holds the data of <b>{confirm?.bound.email || "another account"}</b>. Switching to{" "}
            <b>{confirm?.current.email}</b> erases everything stored here (it stays on the server) and downloads their data instead.
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
