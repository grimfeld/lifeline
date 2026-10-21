import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Page,
  PageHeader,
  PhoneDock,
  Tip,
  toast,
  type ComboboxOption,
} from "@lifeline/ui";
import {
  bindRefusal,
  chordLabel,
  chordOf,
  commandAppTitle,
  commandKey,
  commandRun,
  keyRefusal,
  removeKeyBinding,
  restoreKeyBinding,
  saveKeyBinding,
  useAllCommands,
  useKeyBindings,
  type KeyBindingRecord,
  type OwnedCommand,
} from "@lifeline/core";
import { ChevronLeft, Pencil, Plus, X } from "lucide-react";

/**
 * The Commands a key may be asked for: every one the palette could run (CONTEXT.md "Key binding").
 * One a key cannot run (`bindRefusal`) is listed too, and refused with why when picked.
 */
function useBindable(): OwnedCommand[] {
  const commands = useAllCommands();
  return useMemo(() => commands.filter((c) => commandRun(c) !== "none"), [commands]);
}

/**
 * `/settings/keys`: the user's Key bindings, all at once (CONTEXT.md "Key
 * binding"). Bind a key, change one, remove one; a binding whose Command no
 * longer exists is shown dead, to be cleared. The keys work on the desk only,
 * but the list can be read and edited anywhere.
 */
export function KeysPage() {
  const bindings = useKeyBindings();
  const commands = useBindable();
  const byKey = useMemo(() => new Map(commands.map((c) => [commandKey(c), c])), [commands]);
  // `null` while closed; `{}` binds a new key; with a binding, changes it.
  const [editing, setEditing] = useState<{ binding?: KeyBindingRecord } | null>(null);

  async function unbind(b: KeyBindingRecord) {
    await removeKeyBinding(b.id);
    toast.success(`${chordLabel(b.key)} removed`, { action: { label: "Undo", onClick: () => void restoreKeyBinding(b) } });
  }

  return (
    <Page>
      <div>
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/settings">
            <ChevronLeft /> Settings
          </Link>
        </Button>
      </div>
      <PageHeader title="Keys">
        <PhoneDock>
          <Button onClick={() => setEditing({})}>
            <Plus /> Bind a key
          </Button>
        </PhoneDock>
      </PageHeader>
      <p className="text-muted-foreground text-sm">
        Give any Command a key, and pressing it runs the Command without the palette: one that needs nothing runs at once, one that asks for something opens its
        dialog. Keys work on the desk only, the same in every Workspace.
      </p>

      {bindings.length === 0 ? (
        <EmptyState>No keys bound yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Key bindings">
          {bindings.map((b) => {
            const c = byKey.get(b.command);
            return (
              <li key={b.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <kbd className="bg-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-xs">{chordLabel(b.key)}</kbd>
                {c ? (
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.title} <span className="text-muted-foreground text-xs">{commandAppTitle(c.appId)}</span>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="text-destructive">Dead</span> <span className="text-muted-foreground text-xs">{b.command} no longer exists</span>
                  </span>
                )}
                {c && (
                  <Tip label={`Change ${chordLabel(b.key)}`}>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setEditing({ binding: b })}>
                      <Pencil />
                    </Button>
                  </Tip>
                )}
                <Tip label={c ? `Remove ${chordLabel(b.key)}` : `Clear ${chordLabel(b.key)}`}>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => void unbind(b)}>
                    <X />
                  </Button>
                </Tip>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <BindDialog binding={editing.binding} bindings={bindings} commands={commands} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function BindDialog({
  binding,
  bindings,
  commands,
  onClose,
}: {
  binding?: KeyBindingRecord;
  bindings: KeyBindingRecord[];
  commands: OwnedCommand[];
  onClose: () => void;
}) {
  const [command, setCommand] = useState(binding?.command ?? "");
  const [key, setKey] = useState(binding?.key ?? "");
  const [busy, setBusy] = useState(false);
  const byKey = useMemo(() => new Map(commands.map((c) => [commandKey(c), c])), [commands]);
  const titleOf = (k: string) => byKey.get(k)?.title ?? k;
  const options: ComboboxOption[] = useMemo(
    () => commands.map((c) => ({ value: commandKey(c), label: c.title, description: commandAppTitle(c.appId), keywords: c.keywords })),
    [commands],
  );
  const picked = byKey.get(command);
  // A Command a key cannot run is refused under the field, with why.
  const unbindable = picked ? bindRefusal(picked) : undefined;

  const refusal = key ? keyRefusal(key, bindings, binding?.id) : undefined;
  const holder = refusal ? bindings.find((b) => b.key === key && b.id !== binding?.id) : undefined;
  const [saveError, setSaveError] = useState<string>();
  const error = holder ? `${refusal?.replace(/\.$/, "")} by “${titleOf(holder.command)}”.` : (refusal ?? saveError);

  async function save() {
    if (!command || !key || refusal || unbindable) return;
    setBusy(true);
    try {
      await saveKeyBinding({ id: binding?.id, key, command });
      toast.success(`${chordLabel(key)} runs “${titleOf(command)}”`);
      onClose();
    } catch (e) {
      // Taken meanwhile (on another desk): said under the key, as any refusal is.
      setSaveError(e instanceof Error ? e.message : "This key could not be bound.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{binding ? "Change key" : "Bind a key"}</DialogTitle>
          <DialogDescription>Pick a Command, then press the key that runs it, with ⌘ or Ctrl.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Command" error={unbindable}>
            <Combobox
              aria-label="Command"
              placeholder="Search Commands…"
              value={command || null}
              options={options}
              limit={30}
              onValueChange={(v) => setCommand(v)}
            />
          </Field>
          {command && !unbindable && <p className="min-w-0 truncate text-sm">Runs “{titleOf(command)}”</p>}
          <Field label="Key" error={error} hint={key ? undefined : "Focus the box and press the key."}>
            <KeyRecorder
              value={key}
              onChange={(k) => {
                setKey(k);
                setSaveError(undefined);
              }}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !command || !key || !!refusal || !!unbindable} onClick={() => void save()}>
            {binding ? "Save" : "Bind"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A box that records the next ⌘/Ctrl key pressed in it. It takes the press
 * before anything else does, so recording a key already bound (or ⌘K) neither
 * runs that Command nor opens the palette. Plain keys pass: Tab still leaves.
 */
function KeyRecorder({ value, onChange, id, ...aria }: { value: string; onChange: (key: string) => void; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) {
  return (
    <Button
      id={id}
      type="button"
      variant="outline"
      className="justify-start font-mono"
      {...aria}
      onKeyDown={(e) => {
        const chord = chordOf(e.nativeEvent);
        if (!chord) return;
        e.preventDefault();
        e.stopPropagation();
        onChange(chord);
      }}
    >
      {value ? chordLabel(value) : <span className="text-muted-foreground font-sans">Press a key…</span>}
    </Button>
  );
}
