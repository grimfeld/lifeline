import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Badge,
  Button,
  Checkbox,
  Combobox,
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
  Tip,
  cn,
  toast,
} from "@lifeline/ui";
import {
  MACRO_APP,
  builtinOf,
  checkMacro,
  commandKey,
  commandNavigates,
  commandRun,
  deleteMacro,
  moveStep,
  removeStep,
  resetMacro,
  restoreMacro,
  returnsDocument,
  saveMacro,
  useAllCommands,
  useLiveQuery,
  useMacros,
  type CommandArg,
  type MacroCheck,
  type MacroRecord,
  type MacroStep,
  type OwnedCommand,
  type StepArg,
} from "@lifeline/core";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { ArgInput, argLabel } from "../macros/ArgInput";

/**
 * `/settings/macros` (ADR 0092): the user's Macros — each a Command made of
 * other Commands, run in order. Listed here, made and mended in an editor;
 * deleted at once, with Undo (ADR 0079).
 */
export function MacrosPage() {
  const macros = useMacros();
  const commands = useAllCommands();
  const [editing, setEditing] = useState<MacroRecord | "new" | null>(null);
  // Checked as a run checks it (ADR 0092), again whenever a Document a fixed link names changes.
  const checks = useLiveQuery(
    async () => new Map<string, MacroCheck>(await Promise.all(macros.map(async (m) => [m.id, await checkMacro(m, commands)] as const))),
    [macros, commands],
  );

  async function remove(m: MacroRecord) {
    const before = await deleteMacro(m.id);
    toast.success(`Deleted “${m.name}”`, before ? { action: { label: "Undo", onClick: () => void restoreMacro(before) } } : undefined);
  }

  /** A built-in back to how it ships (ADR 0094); Undo puts the user's version back. */
  async function reset(m: MacroRecord) {
    const before = await resetMacro(m.id);
    toast.success(`Reset “${m.name}” to default`, before ? { action: { label: "Undo", onClick: () => void saveMacro(before) } } : undefined);
  }

  return (
    <Page>
      <PageHeader title="Macros">
        <PhoneDock>
          <Button onClick={() => setEditing("new")}>
            <Plus /> New Macro
          </Button>
        </PhoneDock>
      </PageHeader>
      <p className="text-muted-foreground text-sm">
        A Macro runs several Commands in order, as one Command in the palette, in every Workspace. Each step is done by the App that owns it; a refused step
        stops the Macro there, and what was done stays done.
      </p>
      {macros.length === 0 ? (
        <EmptyState>No Macros yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Macros">
          {macros.map((m) => {
            const check = checks?.get(m.id);
            const broken = check && !check.ok ? check.reasons : undefined;
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <button
                  type="button"
                  className="hover:bg-accent focus-visible:ring-ring -mx-2 -my-1 flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => setEditing(m)}
                >
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-medium">{m.name}</span>
                    {broken && <Badge variant="destructive">Broken</Badge>}
                  </span>
                  <span className="text-muted-foreground w-full truncate text-xs">{stepSummary(m, commands)}</span>
                  {broken && (
                    <ul className="text-destructive flex w-full min-w-0 flex-col text-xs" aria-label={`Why ${m.name} is broken`}>
                      {broken.map((r) => (
                        <li key={r} className="break-words">
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
                {builtinOf(m) && (
                  <Tip label={`Reset ${m.name} to default`}>
                    <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => void reset(m)}>
                      <RotateCcw />
                    </Button>
                  </Tip>
                )}
                <Tip label={`Delete ${m.name}`}>
                  <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => void remove(m)}>
                    <Trash2 />
                  </Button>
                </Tip>
              </li>
            );
          })}
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
  return m.steps.map((s) => commands.find((c) => commandKey(c) === s.command)?.title ?? s.command).join(" → ");
}

/** A step as the editor holds it: the Command, where each argument comes from, and whether a refusal skips it. */
interface DraftStep {
  command: string;
  args: Record<string, StepArg>;
  skipIfRefused: boolean;
}

function toDraft(step: MacroStep): DraftStep {
  return { command: step.command, args: step.args, skipIfRefused: step.skipIfRefused === true };
}

function fromDraft(step: DraftStep): MacroStep {
  // A fixed value left empty is no value at all.
  const given = Object.entries(step.args).filter(([, a]) => a.from !== "fixed" || (a.value !== undefined && a.value !== ""));
  return { command: step.command, args: Object.fromEntries(given), ...(step.skipIfRefused ? { skipIfRefused: true } : {}) };
}

function MacroEditor({ macro, commands, onClose }: { macro?: MacroRecord; commands: readonly OwnedCommand[]; onClose: () => void }) {
  const [name, setName] = useState(macro?.name ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => macro?.steps.map(toDraft) ?? []);
  // Any Command but a Macro can be a step — headless, dialog-only or one that goes somewhere (ADR 0092).
  const stepable = useMemo(() => commands.filter((c) => c.appId !== MACRO_APP && commandRun(c) !== "none"), [commands]);
  const byKey = useMemo(() => new Map(stepable.map((c) => [commandKey(c), c])), [stepable]);
  const options = useMemo(() => stepable.map((c) => ({ value: commandKey(c), label: c.title, keywords: c.keywords })), [stepable]);
  const misplaced = steps.some((s, i) => {
    const def = byKey.get(s.command);
    return def && i < steps.length - 1 && commandNavigates(def);
  });

  // A step result follows the step it names, as a step moves or one before it goes.
  const move = (i: number, by: -1 | 1) => setSteps((s) => moveStep(s, i, by));
  const update = (i: number, change: Partial<DraftStep>) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...change } : st)));
  const setArg = (i: number, key: string, arg: StepArg) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, args: { ...st.args, [key]: arg } } : st)));

  async function save() {
    await saveMacro({ id: macro?.id, name: name.trim(), steps: steps.map(fromDraft) });
    toast.success(macro ? `Saved “${name.trim()}”` : `Made the Macro “${name.trim()}”`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="min-w-0">{macro ? `Edit ${macro.name}` : "New Macro"}</DialogTitle>
          <DialogDescription>Its steps run in order. Each argument is fixed here, asked when the Macro runs, or what an earlier step made.</DialogDescription>
        </DialogHeader>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" autoFocus={!macro} />
        </Field>
        <ol className="flex flex-col gap-3" aria-label="Steps">
          {steps.map((s, i) => {
            const def = byKey.get(s.command);
            const kind = def && commandRun(def);
            // Only an earlier step that returns a Document can give one to a link.
            const earlier = steps.slice(0, i).flatMap((e, j) => {
              const d = byKey.get(e.command);
              return d && returnsDocument(d) ? [{ index: j, title: d.title }] : [];
            });
            return (
              <li key={i} className="flex flex-col gap-3 rounded-lg border p-3" aria-label={`Step ${i + 1}`}>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="text-muted-foreground shrink-0 text-xs">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{def?.title ?? s.command}</span>
                  <Tip label="Move up">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                  </Tip>
                  <Tip label="Move down">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                  </Tip>
                  <Tip label="Remove step">
                    <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => setSteps((st) => removeStep(st, i))}>
                      <X />
                    </Button>
                  </Tip>
                </div>
                {!def && <p className="text-destructive text-sm">This Command no longer exists.</p>}
                {kind === "headless" &&
                  def!.args!.map((arg) => (
                    <ArgSource key={arg.key} arg={arg} source={s.args[arg.key]} earlier={earlier} onChange={(a) => setArg(i, arg.key, a)} />
                  ))}
                {kind === "headless" && <SkipToggle checked={s.skipIfRefused} onChange={(skipIfRefused) => update(i, { skipIfRefused })} />}
                {kind === "dialog" && <p className="text-muted-foreground text-sm">Opens its own dialog at its turn.</p>}
                {kind === "navigates" && (
                  <p className={cn("text-sm", i < steps.length - 1 ? "text-destructive" : "text-muted-foreground")}>
                    {i < steps.length - 1 ? "Takes you somewhere, so it must be the last step." : "Takes you somewhere; it is the last step."}
                  </p>
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
          leading={<Plus />}
          onValueChange={(command) => setSteps((s) => [...s, { command, args: {}, skipIfRefused: false }])}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || steps.length === 0 || misplaced} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkipToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id}>Skip if refused</Label>
    </div>
  );
}

const FIXED = "fixed";
const ASKED = "asked";

/** One argument of a step: where its value comes from, and the fixed value when it is fixed. Only a link can take what an earlier step made. */
function ArgSource({ arg, source, earlier, onChange }: { arg: CommandArg; source?: StepArg; earlier: { index: number; title: string }[]; onChange: (a: StepArg) => void }) {
  const current = source ?? { from: "fixed", value: undefined };
  const choice = current.from === "step" ? `step:${current.step}` : current.from;
  const label = argLabel(arg);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Select
        value={choice}
        onValueChange={(v) => onChange(v === FIXED ? { from: "fixed", value: undefined } : v === ASKED ? { from: "asked" } : { from: "step", step: Number(v.slice(5)) })}
      >
        <SelectTrigger size="sm" className="w-full min-w-0 md:w-auto md:self-start" aria-label={`Source of ${arg.label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FIXED}>Fixed</SelectItem>
          <SelectItem value={ASKED}>Asked when it runs</SelectItem>
          {arg.kind === "link" &&
            earlier.map((e) => (
              <SelectItem key={e.index} value={`step:${e.index}`}>
                <span className="truncate">
                  What step {e.index + 1} made ({e.title})
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {current.from === "fixed" ? (
        <ArgInput arg={arg} value={current.value} onChange={(value) => onChange({ from: "fixed", value })} />
      ) : (
        <p className="text-muted-foreground min-w-0 text-sm break-words">
          {label}: {current.from === "asked" ? "asked when the Macro runs" : `what step ${current.step + 1} made`}
        </p>
      )}
    </div>
  );
}
