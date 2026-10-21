import { useEffect, useState, type ComponentType } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, cn } from "@lifeline/ui";
import {
  argProblems,
  localWrites,
  onMacroReport,
  openPeek,
  provideMacroUi,
  type CommandArg,
  type MacroReport,
  type MacroShape,
  type StepReport,
} from "@lifeline/core";
import { Check, Circle, Redo2, X } from "lucide-react";
import { ArgInput } from "./ArgInput";

interface Asking {
  macro: MacroShape;
  args: CommandArg[];
  initial?: Record<string, unknown>;
  done: (answers: Record<string, unknown> | undefined) => void;
}

interface StepDialog {
  Dialog: ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void }>;
  /** Called once it is closed. */
  done: () => void;
}

/**
 * Everything a Macro run shows (ADR 0092), mounted once beside the palette,
 * wherever the run started: the one form asking every asked argument before
 * the first step, a dialog-only step's own dialog at its turn, and the report
 * every run ends with.
 */
export function MacroHost() {
  const [asking, setAsking] = useState<Asking | null>(null);
  const [stepDialog, setStepDialog] = useState<StepDialog | null>(null);
  useEffect(
    () =>
      provideMacroUi({
        ask: (macro, args, initial) => new Promise((done) => setAsking({ macro, args, initial, done })),
        // A dialog says only that it closed: it was done when it wrote something while open, cancelled when it wrote nothing.
        openDialog: (def) =>
          new Promise<boolean>((done) => {
            if (!def.dialog) return done(false);
            const before = localWrites();
            setStepDialog({ Dialog: def.dialog, done: () => done(localWrites() > before) });
          }),
      }),
    [],
  );
  const StepDialogComponent = stepDialog?.Dialog;
  return (
    <>
      {asking && (
        <AskedForm
          asking={asking}
          onDone={(answers) => {
            setAsking(null);
            asking.done(answers);
          }}
        />
      )}
      {StepDialogComponent && (
        <StepDialogComponent
          open
          onOpenChange={(o) => {
            if (o) return;
            stepDialog.done();
            setStepDialog(null);
          }}
        />
      )}
      <MacroReportDialog />
    </>
  );
}

/** Every asked argument of a Macro, in one form, checked against its signature before the first step runs. */
function AskedForm({ asking, onDone }: { asking: Asking; onDone: (answers: Record<string, unknown> | undefined) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>(asking.initial ?? {});
  // What is wrong with each value, shown under its field once Run is pressed.
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit() {
    const problems = await argProblems(asking.args, values);
    if (Object.keys(problems).length === 0) return onDone(values);
    setErrors(problems);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onDone(undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="min-w-0">{asking.macro.name}</DialogTitle>
          <DialogDescription>Asked once, before the first step runs.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {asking.args.map((a) => (
            <ArgInput key={a.key} arg={a} value={values[a.key]} error={errors[a.key]} onChange={(v) => setValues((s) => ({ ...s, [a.key]: v }))} />
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onDone(undefined)}>
              Cancel
            </Button>
            <Button type="submit">Run</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Every Macro run ends here: each step done — with what it made, openable in a Peek — skipped or stopped, with why, or not reached. */
function MacroReportDialog() {
  const [report, setReport] = useState<MacroReport | null>(null);
  useEffect(() => onMacroReport(setReport), []);
  const stopped = report?.steps.some((s) => s.status === "stopped");
  const skipped = report?.steps.some((s) => s.status === "skipped");
  return (
    <Dialog open={report !== null} onOpenChange={(o) => !o && setReport(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="min-w-0">{report?.name}</DialogTitle>
          <DialogDescription>
            {report?.broken ? "Broken, so nothing was run. Mend it in Settings → Macros." : stopped ? "Stopped at a refused step. What was done stays done." : skipped ? "Every step was done or skipped." : "Every step was done."}
          </DialogDescription>
        </DialogHeader>
        {report?.broken && (
          <ul className="text-destructive flex flex-col gap-1 text-sm" aria-label="Why it is broken">
            {report.broken.map((r) => (
              <li key={r} className="break-words">
                {r}
              </li>
            ))}
          </ul>
        )}
        <ol className="flex flex-col gap-2" aria-label="Steps">
          {report?.steps.map((s, i) => (
            <StepRow
              key={i}
              step={s}
              onOpen={(id) => {
                setReport(null);
                openPeek(id);
              }}
            />
          ))}
        </ol>
        <DialogFooter>
          <Button onClick={() => setReport(null)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS = {
  done: { Icon: Check, label: "Done", tone: "text-success" },
  skipped: { Icon: Redo2, label: "Skipped", tone: "text-muted-foreground" },
  stopped: { Icon: X, label: "Stopped", tone: "text-destructive" },
  "not-reached": { Icon: Circle, label: "Not reached", tone: "text-muted-foreground" },
} as const;

function StepRow({ step, onOpen }: { step: StepReport; onOpen: (id: string) => void }) {
  const { Icon, label, tone } = STATUS[step.status];
  return (
    <li className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("font-medium break-words", step.status === "not-reached" && "text-muted-foreground")}>
          {step.title} <span className="text-muted-foreground font-normal">· {label}</span>
        </span>
        {step.status === "done" && <span className="text-muted-foreground break-words">{step.message}</span>}
        {step.status === "skipped" && <span className="text-muted-foreground break-words">{step.reason}</span>}
        {step.status === "stopped" && <span className="text-destructive break-words">{step.reason}</span>}
      </div>
      {step.status === "done" && step.id && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpen(step.id!)}>
          Open
        </Button>
      )}
    </li>
  );
}
