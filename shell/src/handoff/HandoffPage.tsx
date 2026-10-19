import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { decodeHandoff, HANDOFF_DONE_PATH, type HandoffDecodeError } from "@lifeline/handoff";
import { allIntakes, allWorkspaces, currentWorkspaceId, intakeByKey, lastIntakeKey, rememberIntake, setCurrentWorkspace, useWorkspaces, type WorkspaceRecord } from "@lifeline/core";
import { Button, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { CircleCheck, Lock } from "lucide-react";

/** Per-device memory of the Intake last chosen for a Handoff from outside Lifeline, beside the selection's and each App's own. */
const SENDER = "outside";

/** How long "Saved" shows before the page moves to its done address (where the extension closes its window). */
const SAVED_MS = 800;

/** What to tell the person when the fragment cannot be read. */
const UNREADABLE: Record<HandoffDecodeError, string> = {
  empty: "Nothing was handed over. Send it again from where it came from.",
  malformed: "It may have been cut short on the way. Send it again from where it came from.",
  version: "It was sent by a newer Lifeline extension than this Lifeline can read. Reload Lifeline, then send it again.",
};

function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 md:p-6">{children}</div>;
}

/**
 * `/handoff` — the Handoff page (ADR 0080, CONTEXT.md "Handoff page"): where a
 * Handoff made outside Lifeline arrives, codec-encoded in the fragment so it
 * never reaches a server log. It opens the Intake the sender named, prefilled;
 * nothing is written until that dialog saves. Then it says so and moves to
 * `/handoff/done`, the address the Lifeline extension waits for to close its
 * window.
 *
 * Naming no Intake, or one this Lifeline does not know, it asks which Intake
 * receives it. With more than one Workspace it also asks where the Document
 * lands: the choice becomes the current Workspace before the dialog opens,
 * because a dialog stamps the current Workspace on what it makes.
 */
export function HandoffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once: the fragment is the Handoff, and moving on drops it.
  const [decoded] = useState(() => decodeHandoff(location.hash));
  const named = decoded.ok && decoded.intake ? intakeByKey(decoded.intake) : undefined;
  const [intakeKey, setIntakeKey] = useState(() => named?.key ?? (intakeByKey(lastIntakeKey(SENDER)) ? lastIntakeKey(SENDER) : (allIntakes()[0]?.key ?? "")));
  const intake = intakeByKey(intakeKey);
  // Undefined until the first read: whether to ask for a Workspace waits on it.
  const live = useWorkspaces();
  const [first, setFirst] = useState<WorkspaceRecord[]>();
  useEffect(() => void allWorkspaces().then(setFirst), []);
  const workspaces = live.length > 0 ? live : first;
  const [workspaceId, setWorkspaceId] = useState<string>();
  const wsValue = workspaceId ?? (workspaces?.find((w) => w.id === currentWorkspaceId()) ?? workspaces?.[0])?.id ?? "";
  const [stage, setStage] = useState<"pending" | "choose" | "open" | "cancelled" | "saved">("pending");
  // The dialog closes after it saves: a ref, so that close is not taken for a cancel.
  const saved = useRef(false);

  // A named Intake opens at once — unless there is a Workspace to choose. Decided once, when the Workspaces are known.
  useEffect(() => {
    if (stage === "pending" && workspaces) setStage(named && workspaces.length < 2 ? "open" : "choose");
  }, [stage, workspaces, named]);

  function open() {
    if (!intake) return;
    if (wsValue) setCurrentWorkspace(wsValue);
    rememberIntake(SENDER, intake.key);
    setStage("open");
  }

  useEffect(() => {
    if (stage !== "saved") return;
    const t = setTimeout(() => navigate(HANDOFF_DONE_PATH, { replace: true }), SAVED_MS);
    return () => clearTimeout(t);
  }, [stage, navigate]);

  if (!decoded.ok) {
    return (
      <Frame>
        <h1 className="text-xl font-semibold tracking-tight">This Handoff can't be read</h1>
        <p className="text-muted-foreground text-sm">{UNREADABLE[decoded.error]}</p>
      </Frame>
    );
  }
  const { handoff } = decoded;
  if (stage === "saved") return <HandoffSaved />;

  return (
    <Frame>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{handoff.title || "Untitled"}</h1>
        {handoff.url && <p className="text-muted-foreground text-sm">{handoff.url}</p>}
      </div>
      {(stage === "choose" || stage === "cancelled") && (
        <>
          {stage === "cancelled" ? (
            <p className="text-muted-foreground text-sm">Nothing was saved.</p>
          ) : (
            decoded.intake && !named && <p className="text-muted-foreground text-sm">The Intake this was sent to is not in this Lifeline. Choose another.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 max-md:contents">
            {(!named || stage === "cancelled") && (
              <PhoneDock order={1}>
                <Select value={intakeKey} onValueChange={setIntakeKey}>
                  <SelectTrigger aria-label="Intake" className="min-w-32">
                    <SelectValue placeholder="Make it a…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allIntakes().map((i) => (
                      <SelectItem key={i.key} value={i.key}>
                        {i.icon && <i.icon />}
                        {i.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PhoneDock>
            )}
            {workspaces && workspaces.length > 1 && (
              <PhoneDock order={1}>
                <Select value={wsValue} onValueChange={setWorkspaceId}>
                  <SelectTrigger aria-label="Workspace" className="min-w-0 max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.separated && <Lock />}
                        <span className="truncate">{w.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PhoneDock>
            )}
            <PhoneDock>
              <Button disabled={!intake} onClick={open}>
                {intake?.icon && <intake.icon />} Open the {intake?.title ?? "Intake"}
              </Button>
            </PhoneDock>
          </div>
        </>
      )}
      {intake && (
        <intake.dialog
          key={intake.key}
          open={stage === "open"}
          onOpenChange={(o) => !o && !saved.current && setStage("cancelled")}
          onSaved={() => {
            saved.current = true;
            setStage("saved");
          }}
          handoff={handoff}
        />
      )}
    </Frame>
  );
}

/** "Saved" — on the Handoff page for a moment, then at its done address, `/handoff/done`. */
export function HandoffSaved() {
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <CircleCheck className="text-success size-5 shrink-0" />
        <h1 className="text-xl font-semibold tracking-tight">Saved</h1>
      </div>
      <p className="text-muted-foreground text-sm">You can close this window.</p>
    </Frame>
  );
}
