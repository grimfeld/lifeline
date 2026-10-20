import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Button,
  Checkbox,
  Combobox,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  Label,
  Page,
  PageHeader,
  PhoneDock,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TimeField,
  Tip,
  toast,
} from "@lifeline/ui";
import {
  MACRO_APP,
  deleteMacro,
  isInvocable,
  restoreMacro,
  saveMacro,
  stepKey,
  useAllCommands,
  useMacros,
  type CommandArg,
  type MacroRecord,
  type MacroStep,
  type OwnedCommand,
} from "@lifeline/core";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from "lucide-react";

/**
 * `/settings/macros` (ADR 0092): the user's Macros — each a Command made of
 * other Commands, run in order. Listed here, made and mended in an editor;
 * deleted at once, with Undo (ADR 0079).
 */
export function MacrosPage() {
  const macros = useMacros();
  const commands = useAllCommands();
  const [editing, setEditing] = useState<MacroRecord | "new" | null>(null);

  async function remove(m: MacroRecord) {
    const before = await deleteMacro(m.id);
    toast.success(`Deleted “${m.name}”`, before ? { action: { label: "Undo", onClick: () => void restoreMacro(before) } } : undefined);
  }

  return (
    <Page>
      <PageHeader title="Macros">
        <PhoneDock>
          <Button onClick={() => setEditing("new")}>
            <Plus /> New macro
          </Button>
        </PhoneDock>
      </PageHeader>
      <p className="text-muted-foreground text-sm">
        A Macro runs several Commands in order, as one Command in the palette, in every Workspace. Each step is done by the App that owns it; a refused step
        stops the Macro there, and what was done stays done.
      </p>
      {macros.length === 0 ? (
        <EmptyState>No macros yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Macros">
          {macros.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <button className="flex min-w-0 flex-1 flex-col items-start text-left hover:underline" onClick={() => setEditing(m)}>
                <span className="w-full truncate font-medium">{m.name}</span>
                <span className="text-muted-foreground w-full truncate text-xs">{stepSummary(m, commands)}</span>
              </button>
              <Tip label={`Delete ${m.name}`}>
                <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label={`Delete ${m.name}`} onClick={() => void remove(m)}>
                  <Trash2 />
                </Button>
              </Tip>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="link" className="justify-self-start px-0">
        <Link to="/settings">
          <ArrowLeft /> Settings
        </Link>
      </Button>
      {editing !== null && <MacroEditor macro={editing === "new" ? undefined : editing} commands={commands} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function stepSummary(m: MacroRecord, commands: readonly OwnedCommand[]): string {
  if (m.steps.length === 0) return "No steps";
  return m.steps.map((s) => commands.find((c) => stepKey(c) === s.command)?.title ?? s.command).join(" → ");
}

/** A step as the editor holds it: the Command, and the fixed value typed for each argument. */
interface DraftStep {
  command: string;
  values: Record<string, unknown>;
}

function toDraft(step: MacroStep): DraftStep {
  return { command: step.command, values: Object.fromEntries(Object.entries(step.args).map(([k, a]) => [k, a.value])) };
}

function fromDraft(step: DraftStep): MacroStep {
  const filled = Object.entries(step.values).filter(([, v]) => v !== undefined && v !== "");
  return { command: step.command, args: Object.fromEntries(filled.map(([k, value]) => [k, { from: "fixed" as const, value }])) };
}

function MacroEditor({ macro, commands, onClose }: { macro?: MacroRecord; commands: readonly OwnedCommand[]; onClose: () => void }) {
  const [name, setName] = useState(macro?.name ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => macro?.steps.map(toDraft) ?? []);
  // A step runs headless with fixed values, so only headless Commands — and never a Macro — can be one.
  const stepable = useMemo(() => commands.filter((c) => c.appId !== MACRO_APP && isInvocable(c)), [commands]);
  const byKey = useMemo(() => new Map(stepable.map((c) => [stepKey(c), c])), [stepable]);
  const options = useMemo(() => stepable.map((c) => ({ value: stepKey(c), label: c.title, keywords: c.keywords })), [stepable]);

  const move = (i: number, by: -1 | 1) =>
    setSteps((s) => {
      const next = [...s];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const setValue = (i: number, key: string, value: unknown) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, values: { ...st.values, [key]: value } } : st)));

  async function save() {
    await saveMacro({ id: macro?.id, name: name.trim(), steps: steps.map(fromDraft) });
    toast.success(macro ? `Saved “${name.trim()}”` : `Made the macro “${name.trim()}”`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="min-w-0">{macro ? `Edit ${macro.name}` : "New macro"}</DialogTitle>
          <DialogDescription>Its steps run in order; each argument is given the value set here.</DialogDescription>
        </DialogHeader>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" autoFocus={!macro} />
        </Field>
        <ol className="flex flex-col gap-3" aria-label="Steps">
          {steps.map((s, i) => {
            const def = byKey.get(s.command);
            return (
              <li key={i} className="flex flex-col gap-3 rounded-lg border p-3" aria-label={`Step ${i + 1}`}>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="text-muted-foreground shrink-0 text-xs">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{def?.title ?? s.command}</span>
                  <Tip label="Move up">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                  </Tip>
                  <Tip label="Move down">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                  </Tip>
                  <Tip label="Remove step">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="Remove step" onClick={() => setSteps((st) => st.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </Tip>
                </div>
                {def ? (
                  def.args?.map((arg) => <ArgInput key={arg.key} arg={arg} value={s.values[arg.key]} onChange={(v) => setValue(i, arg.key, v)} />)
                ) : (
                  <p className="text-destructive text-sm">This Command no longer exists.</p>
                )}
              </li>
            );
          })}
        </ol>
        <Combobox
          aria-label="Add a step"
          placeholder="Add a step: search Commands…"
          options={options}
          limit={30}
          leading={<Plus className="size-4" />}
          onValueChange={(command) => setSteps((s) => [...s, { command, values: {} }])}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || steps.length === 0} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NONE = "\u0000none";

/** One argument's fixed value, entered in the control its kind calls for. */
function ArgInput({ arg, value, onChange }: { arg: CommandArg; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  const label = arg.required ? `${arg.label} (required)` : arg.label;
  switch (arg.kind) {
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true ? true : undefined)} />
          <Label htmlFor={id}>{label}</Label>
        </div>
      );
    case "date":
      return (
        <Field label={label} hint={arg.hint}>
          <DatePicker value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} />
        </Field>
      );
    case "time":
      return (
        <Field label={label} hint={arg.hint}>
          <TimeField value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} />
        </Field>
      );
    case "select":
      return (
        <Field label={label} hint={arg.hint}>
          <Select value={typeof value === "string" ? value : NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {arg.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="truncate">{o.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    default:
      return (
        <Field label={label} hint={arg.hint ?? kindHint(arg)}>
          <Input value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}

function kindHint(arg: CommandArg): string | undefined {
  switch (arg.kind) {
    case "list":
    case "multiselect":
      return arg.options ? `Comma-separated, among ${arg.options.map((o) => o.value).join(", ")}` : "Comma-separated";
    case "link":
      return "The title of the Document";
    case "json":
    case "rows":
      return "As JSON";
    default:
      return undefined;
  }
}
