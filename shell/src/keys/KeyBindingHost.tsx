import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast, usePhone } from "@lifeline/ui";
import {
  bindRefusal,
  chordOf,
  commandKey,
  howKeyRuns,
  invokeCommand,
  useAllCommands,
  useKeyBindings,
  type OwnedCommand,
} from "@lifeline/core";

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
  const [active, setActive] = useState<OwnedCommand | null>(null);

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
            (err: unknown) => toast.error(`“${c.title}” was refused`, { description: err instanceof Error ? err.message : String(err) }),
          );
          return;
        case "dialog":
          return setActive(c);
        case "run":
          return void c.run!({ navigate });
        default:
          // A binding made before its Command needed values (Keys refuses one now).
          toast.error(bindRefusal(c) ?? `“${c.title}” cannot be run by a key.`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const Dialog = active?.dialog;
  return Dialog ? <Dialog open onOpenChange={(o) => !o && setActive(null)} /> : null;
}
