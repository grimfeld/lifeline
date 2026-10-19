import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { decodeHandoff, HANDOFF_DONE_PATH, type HandoffDecodeError } from "@lifeline/handoff";
import { intakeByKey } from "@lifeline/core";
import { Button, PhoneDock } from "@lifeline/ui";
import { CircleCheck } from "lucide-react";

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
 */
export function HandoffPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once: the fragment is the Handoff, and moving on drops it.
  const [decoded] = useState(() => decodeHandoff(location.hash));
  const intake = decoded.ok && decoded.intake ? intakeByKey(decoded.intake) : undefined;
  const [stage, setStage] = useState<"open" | "cancelled" | "saved">("open");
  // The dialog closes after it saves: a ref, so that close is not taken for a cancel.
  const saved = useRef(false);

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
      {!intake ? (
        <p className="text-muted-foreground text-sm">
          {decoded.intake ? "The Intake this was sent to is not in this Lifeline." : "This Handoff names no Intake."} Send it again and choose what to make of it.
        </p>
      ) : (
        <>
          {stage === "cancelled" && (
            <>
              <p className="text-muted-foreground text-sm">Nothing was saved.</p>
              <PhoneDock>
                <Button className="justify-self-start" onClick={() => setStage("open")}>
                  {intake.icon && <intake.icon />} Open the {intake.title} again
                </Button>
              </PhoneDock>
            </>
          )}
          <intake.dialog
            open={stage === "open"}
            onOpenChange={(o) => !o && !saved.current && setStage("cancelled")}
            onSaved={() => {
              saved.current = true;
              setStage("saved");
            }}
            handoff={handoff}
          />
        </>
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
