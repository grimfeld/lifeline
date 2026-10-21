import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast, usePhone } from "@lifeline/ui";
import {
  chordOf,
  commandKey,
  howKeyRuns,
  invokeCommand,
  useAllCommands,
  useKeyBindings,
  type CommandDef,
} from "@lifeline/core";

type BoundCommand = CommandDef & { appId: string };

/**
 * Runs a Command when its Key binding is pressed (CONTEXT.md "Key binding"):
 * a complete headless Command runs at once, otherwise its dialog — a Macro's
 * asked form is its dialog — opens; a Command that takes the user somewhere
 * goes there. Desk only: on the phone nothing listens.
 */
export function KeyBindingHost() {
  const phone = usePhone();
  return phone ? null : <KeyBindingListener />;
}

function KeyBindingListener() {
  const bindings = useKeyBindings();
  const commands = useAllCommands();
  const navigate = useNavigate();
  const [active, setActive] = useState<BoundCommand | null>(null);

  const byKey = useMemo(() => {
    const index = new Map(commands.map((c) => [commandKey(c), c]));
    return new Map(bindings.map((b) => [b.key, index.get(b.command) ?? null]));
  }, [bindings, commands]);
  // The listener is added once; it reads the latest bindings through this.
  const latest = useRef(byKey);
  latest.current = byKey;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const chord = chordOf(e);
      if (!chord || !latest.current.has(chord)) return;
      e.preventDefault();
      const c = latest.current.get(chord);
      if (!c) return void toast.error("This key's Command no longer exists. Clear it in Settings → Keys.");
      switch (howKeyRuns(c)) {
        case "invoke":
          invokeCommand(c, {}).then(
            (r) => toast.success(r.message),
            (err: unknown) => toast.error(err instanceof Error ? err.message : String(err)),
          );
          return;
        case "dialog":
          return setActive(c);
        case "run":
          return void c.run!({ navigate });
        default:
          toast.error(`“${c.title}” needs the palette: it takes arguments it cannot ask for here.`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const Dialog = active?.dialog;
  return Dialog ? <Dialog open onOpenChange={(o) => !o && setActive(null)} /> : null;
}
