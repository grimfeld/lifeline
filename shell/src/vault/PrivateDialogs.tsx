import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import {
  closePrivateDialog,
  disablePrivate,
  login,
  PRIVATE_FOLDER,
  setPrivatePassword,
  unlockPrivate,
  useAuth,
  usePrivateDialogRequest,
  usePrivateGate,
  type PrivateDialogKind,
} from "@lifeline/core";

/**
 * The Private folder's dialogs (ADR 0038), mounted once by the shell and
 * opened from anywhere through Core's `openPrivateDialog`: set up (choose a
 * password), unlock, change the password, turn the gate off — and, behind
 * "Forgot?", a reset that asks for the account password instead (online),
 * which loses nothing because nothing is encrypted.
 */
export function PrivateDialogs() {
  const kind = usePrivateDialogRequest();
  const gate = usePrivateGate();
  // A request that no longer fits the state (unlock when nothing is set up) becomes the one that does.
  const effective: PrivateDialogKind | null = kind === null ? null : kind === "setup" && gate.configured ? "unlock" : kind !== "setup" && !gate.configured ? "setup" : kind;
  const close = () => closePrivateDialog();
  return (
    <>
      <SetupDialog open={effective === "setup"} onClose={close} />
      <UnlockDialog open={effective === "unlock"} onClose={close} />
      <ChangeDialog open={effective === "change"} onClose={close} />
      <DisableDialog open={effective === "disable"} onClose={close} />
    </>
  );
}

function PasswordPair({ onChange, autoFocus }: { onChange: (pw: string | null) => void; autoFocus?: boolean }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  useEffect(() => onChange(a && a === b ? a : null), [a, b, onChange]);
  return (
    <div className="grid gap-2">
      <Input autoFocus={autoFocus} type="password" placeholder="Password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" />
      <Input type="password" placeholder="Again" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
      {a && b && a !== b && <p className="text-destructive text-xs">The two do not match.</p>}
    </div>
  );
}

function SetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!pw) return;
    setBusy(true);
    try {
      await setPrivatePassword(pw);
      toast.success(`${PRIVATE_FOLDER} is set up — and unlocked for now`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set up private notes</DialogTitle>
          <DialogDescription>
            Notes in the <b>{PRIVATE_FOLDER}</b> folder stay out of sight — tree, search, links, graph — until you unlock them. A gate against eyes at your device, not encryption. A folder already
            named {PRIVATE_FOLDER} is adopted as is.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <PasswordPair onChange={setPw} autoFocus />
          <DialogFooter className="mt-3">
            <Button type="submit" disabled={!pw || busy}>
              Set password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [forgot, setForgot] = useState(false);
  useEffect(() => {
    if (!open) {
      setPw("");
      setWrong(false);
      setForgot(false);
    }
  }, [open]);
  async function submit() {
    if (!pw) return;
    setBusy(true);
    try {
      const ok = await unlockPrivate(pw);
      setWrong(!ok);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  }
  if (forgot) return <ResetDialog open={open} onClose={onClose} />;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Unlock private notes</DialogTitle>
          <DialogDescription>They lock again after ten idle minutes, or when the app reloads.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input autoFocus type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          {wrong && <p className="text-destructive mt-1 text-xs">Wrong password.</p>}
          {/* ui-allow: sm-breakpoint — the kit DialogFooter turns to a row at sm; this keeps its buttons apart there */}
          <DialogFooter className="mt-3 sm:justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setForgot(true)}>
              Forgot?
            </Button>
            <Button type="submit" disabled={!pw || busy}>
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Forgot the password: prove the account instead (online), then choose a new one. */
function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email } = useAuth();
  const [account, setAccount] = useState("");
  const [proved, setProved] = useState(false);
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function prove() {
    if (!email || !account) return;
    setBusy(true);
    try {
      await login(email, account);
      setProved(true);
    } catch {
      toast.error("Could not confirm the account password (are you online?)");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!pw) return;
    setBusy(true);
    try {
      await setPrivatePassword(pw);
      toast.success("Password replaced — private notes unlocked");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset the private notes password</DialogTitle>
          <DialogDescription>{proved ? "Choose the new password." : `Confirm the account password for ${email ?? "your account"} first (needs the network). Nothing is lost — the notes are not encrypted.`}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (proved ? submit() : prove());
          }}
        >
          {proved ? (
            <PasswordPair onChange={setPw} autoFocus />
          ) : (
            <Input autoFocus type="password" placeholder="Account password" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="current-password" />
          )}
          <DialogFooter className="mt-3">
            <Button type="submit" disabled={busy || (proved ? !pw : !account)}>
              {proved ? "Set password" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Change the password: the current one first, then the new pair. */
function ChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) setCurrent("");
  }, [open]);
  async function submit() {
    if (!pw || !current) return;
    setBusy(true);
    try {
      if (!(await unlockPrivate(current))) {
        toast.error("Wrong current password");
        return;
      }
      await setPrivatePassword(pw);
      toast.success("Password changed");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change the private notes password</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="grid gap-3"
        >
          <Input autoFocus type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <PasswordPair onChange={setPw} />
          <DialogFooter>
            <Button type="submit" disabled={!pw || !current || busy}>
              Change
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Turn the gate off: Private becomes a plain folder again; nothing is moved or deleted. */
function DisableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) setCurrent("");
  }, [open]);
  async function submit() {
    if (!current) return;
    setBusy(true);
    try {
      if (!(await unlockPrivate(current))) {
        toast.error("Wrong password");
        return;
      }
      await disablePrivate();
      toast.success(`${PRIVATE_FOLDER} is a plain folder again`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Turn off private notes</DialogTitle>
          <DialogDescription>The {PRIVATE_FOLDER} folder and everything in it stay where they are — just visible to anyone at this device.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input autoFocus type="password" placeholder="Password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <DialogFooter className="mt-3">
            <Button type="submit" variant="destructive" disabled={!current || busy}>
              Turn off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
