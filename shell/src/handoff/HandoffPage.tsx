import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { decodeHandoff, encodeHandoff, HANDOFF_DONE_PATH, handoffFromShare, type HandoffDecodeError } from "@lifeline/handoff";
import { allIntakes, allWorkspaces, currentWorkspaceId, docHref, getDocument, intakeByKey, lastIntakeKey, pb, rememberIntake, setCurrentWorkspace, useWorkspaces, type WorkspaceRecord } from "@lifeline/core";
import { Button, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { CircleCheck, Lock } from "lucide-react";
import { arrivingHandoff, dropPendingHandoff, keepPendingHandoff } from "./pending";
import { HandoffSignIn } from "./HandoffSignIn";

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

/**
 * What arrived, as a codec fragment, and how: the share sheet sends query
 * parameters (the manifest's GET share target); everything else a fragment, or
 * the one this tab already holds.
 */
function arrival(search: string, hash: string): { fragment: string; shared: boolean } {
  const q = new URLSearchParams(search);
  if (hash.replace(/^#/, "") || !["title", "text", "url"].some((k) => q.has(k))) return { fragment: arrivingHandoff(hash), shared: false };
  return { fragment: encodeHandoff(handoffFromShare({ title: q.get("title"), text: q.get("text"), url: q.get("url") })), shared: true };
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 md:p-6">{children}</div>;
}

/**
 * `/handoff` — the Handoff page (ADR 0080, CONTEXT.md "Handoff page"): where a
 * Handoff made outside Lifeline arrives, codec-encoded in the fragment so it
 * never reaches a server log. It opens the Intake the sender named, prefilled;
 * nothing is written until that dialog saves. Then it says so and moves to
 * `/handoff/done`, the address the Lifeline extension waits for to close its
 * window. Signed out, it asks for sign-in first (or working locally); the
 * Handoff waits in this tab's session storage meanwhile, out of the address.
 *
 * Naming no Intake, or one this Lifeline does not know, it asks which Intake
 * receives it. With more than one Workspace it also asks where the Document
 * lands: the choice becomes the current Workspace before the dialog opens,
 * because a dialog stamps the current Workspace on what it makes.
 *
 * From the phone's share sheet the Handoff comes as query parameters instead
 * (`?title=&text=&url=`, the manifest's GET share target), and there is no
 * extension window to close: once saved, the page stays and offers to open
 * what was made, or to go back.
 */
export function HandoffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once: the address is the Handoff (or the one this tab already holds), and moving on drops it.
  const [{ fragment, shared }] = useState(() => arrival(location.search, location.hash));
  const [decoded] = useState(() => decodeHandoff(fragment));
  const [made, setMade] = useState<string>();
  // Signed out, sign-in (or working locally) comes before the Intake step.
  const [signInDone, setSignInDone] = useState(() => pb.authStore.isValid);
  const named = decoded.ok && decoded.intake ? intakeByKey(decoded.intake) : undefined;
  const [intakeKey, setIntakeKey] = useState(() => named?.key ?? (intakeByKey(lastIntakeKey(SENDER)) ? lastIntakeKey(SENDER) : (allIntakes()[0]?.key ?? "")));
  const intake = intakeByKey(intakeKey);
  // Undefined until the first read: whether to ask for a Workspace waits on it.
  const live = useWorkspaces();
  const [first, setFirst] = useState<WorkspaceRecord[]>();
  // Read again once signed in: a sign-in can bring the Account's Workspaces.
  useEffect(() => void allWorkspaces().then(setFirst), [signInDone]);
  const workspaces = live.length > 0 ? live : first;
  const [workspaceId, setWorkspaceId] = useState<string>();
  const wsValue = workspaceId ?? (workspaces?.find((w) => w.id === currentWorkspaceId()) ?? workspaces?.[0])?.id ?? "";
  const [stage, setStage] = useState<"pending" | "choose" | "open" | "cancelled" | "saved">("pending");
  // The dialog closes after it saves: a ref, so that close is not taken for a cancel.
  const saved = useRef(false);

  // Held in this tab while the page is open, and out of the address bar; leaving the page abandons it.
  useEffect(() => {
    if (!decoded.ok) return;
    keepPendingHandoff(fragment);
    if (location.hash) navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    return dropPendingHandoff;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  // After sign-in, a named Intake opens at once — unless there is a Workspace to choose. Decided once, when the Workspaces are known.
  useEffect(() => {
    if (stage === "pending" && signInDone && workspaces) setStage(named && workspaces.length < 2 ? "open" : "choose");
  }, [stage, signInDone, workspaces, named]);

  function open() {
    if (!intake) return;
    if (wsValue) setCurrentWorkspace(wsValue);
    rememberIntake(SENDER, intake.key);
    setStage("open");
  }

  useEffect(() => {
    if (stage !== "saved" || shared) return;
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
  if (stage === "saved") return <HandoffSaved made={shared ? made : undefined} what={intake?.title} />;

  return (
    <Frame>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{handoff.title || "Untitled"}</h1>
        {handoff.url && <p className="text-muted-foreground text-sm">{handoff.url}</p>}
      </div>
      {!signInDone ? (
        <HandoffSignIn onDone={() => setSignInDone(true)} />
      ) : (
        (stage === "choose" || stage === "cancelled") && (
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
        )
      )}
      {signInDone && intake && (
        <intake.dialog
          key={intake.key}
          open={stage === "open"}
          onOpenChange={(o) => !o && !saved.current && setStage("cancelled")}
          onSaved={(id) => {
            saved.current = true;
            setMade(id);
            dropPendingHandoff();
            setStage("saved");
          }}
          handoff={handoff}
        />
      )}
    </Frame>
  );
}

/**
 * "Saved" — on the Handoff page for a moment, then at its done address,
 * `/handoff/done`. From the share sheet it stays, with the Document `made`
 * (a `what`: "Quote") to open, or a way back.
 */
export function HandoffSaved({ made, what }: { made?: string; what?: string }) {
  const navigate = useNavigate();
  async function openMade() {
    const doc = made ? await getDocument(made) : undefined;
    navigate(doc ? docHref(doc) : "/", { replace: true });
  }
  // Opened by the share sheet there may be nothing to go back to: then home.
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true }));
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <CircleCheck className="text-success size-5 shrink-0" />
        <h1 className="text-xl font-semibold tracking-tight">Saved</h1>
      </div>
      {made ? (
        <div className="flex flex-wrap items-center gap-2 max-md:contents">
          <PhoneDock>
            <Button onClick={() => void openMade()}>Open the {what ?? "Document"}</Button>
          </PhoneDock>
          <PhoneDock>
            <Button variant="outline" onClick={back}>
              Go back
            </Button>
          </PhoneDock>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">You can close this window.</p>
      )}
    </Frame>
  );
}
