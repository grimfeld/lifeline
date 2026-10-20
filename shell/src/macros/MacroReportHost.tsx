import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, cn } from "@lifeline/ui";
import { onMacroReport, openPeek, type MacroReport, type StepReport } from "@lifeline/core";
import { Check, Circle, X } from "lucide-react";

/**
 * Every Macro run ends here (ADR 0092): a dialog naming each step as done —
 * with what it made, openable in a Peek — stopped, with the refusal's reason,
 * or not reached. Mounted once beside the palette, wherever the run started.
 */
export function MacroReportHost() {
  const [report, setReport] = useState<MacroReport | null>(null);
  useEffect(() => onMacroReport(setReport), []);
  const stopped = report?.steps.some((s) => s.status === "stopped");
  return (
    <Dialog open={report !== null} onOpenChange={(o) => !o && setReport(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="min-w-0">{report?.name}</DialogTitle>
          <DialogDescription>{stopped ? "Stopped at a refused step. What was done stays done." : "Every step was done."}</DialogDescription>
        </DialogHeader>
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

function StepRow({ step, onOpen }: { step: StepReport; onOpen: (id: string) => void }) {
  const Icon = step.status === "done" ? Check : step.status === "stopped" ? X : Circle;
  const status = step.status === "done" ? "Done" : step.status === "stopped" ? "Stopped" : "Not reached";
  return (
    <li className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", step.status === "done" && "text-success", step.status === "stopped" && "text-destructive", step.status === "not-reached" && "text-muted-foreground")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("font-medium", step.status === "not-reached" && "text-muted-foreground")}>
          {step.title} <span className="text-muted-foreground font-normal">· {status}</span>
        </span>
        {step.status === "done" && <span className="text-muted-foreground">{step.message}</span>}
        {step.status === "stopped" && <span className="text-destructive">{step.reason}</span>}
      </div>
      {step.status === "done" && step.id && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpen(step.id!)}>
          Open
        </Button>
      )}
    </li>
  );
}
