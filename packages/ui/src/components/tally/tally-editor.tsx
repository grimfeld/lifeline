import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

/** A Loggable target — structurally, so this package need not import Core. */
export interface TallyTargetOption {
  key: string;
  title: string;
  subtitle?: string;
  /** "none": a tick (a Habit, a Boolean Stat); "number": takes a value in `unit`. */
  wants: "none" | "number";
  unit?: string;
}

/** One Tally as Core keeps it (ADR 0059). */
export interface TallyValue {
  target: string;
  value: string;
}

/** A value the Document's type offers beyond "one" ("+ duration (min)"). */
export interface TallyValueOption {
  id: string;
  label: string;
}

function TallyRow({ t, targets, values, onChange, onRemove }: { t: TallyValue; targets: TallyTargetOption[]; values: TallyValueOption[]; onChange: (t: TallyValue) => void; onRemove: () => void }) {
  const target = targets.find((x) => x.key === t.target);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="text-muted-foreground text-xs">tallies to</span>
      <span className="font-medium">{target?.title ?? t.target}</span>
      {target?.subtitle && <span className="text-muted-foreground text-xs">{target.subtitle}</span>}
      {target?.wants === "number" && values.length > 0 ? (
        <Select value={t.value} onValueChange={(v) => onChange({ ...t, value: v })}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">+1{target.unit ? ` ${target.unit}` : ""}</SelectItem>
            {values.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-muted-foreground text-xs">{target?.wants === "number" ? `+1${target.unit ? ` ${target.unit}` : ""}` : "one completion"}</span>
      )}
      <Button size="icon" variant="ghost" className="ml-auto size-8" onClick={onRemove} aria-label="Remove tally">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * Core's one "tallies to…" editor (ADR 0059): a Document's Tallies over every
 * Loggable target. The owning App drops it into its own form and saves the
 * list back into the Document's `tallies` field; the occurrence noun ("each
 * session", "each day practised") is the type's.
 */
export function TallyEditor({ tallies, onChange, targets, values = [], occurrence }: { tallies: TallyValue[]; onChange: (next: TallyValue[]) => void; targets: TallyTargetOption[]; values?: TallyValueOption[]; occurrence: string }) {
  const [adding, setAdding] = useState("");
  const available = targets.filter((t) => !tallies.some((x) => x.target === t.key));
  return (
    <div className="grid gap-2">
      {tallies.map((t, i) => (
        <TallyRow key={t.target} t={t} targets={targets} values={values} onChange={(nt) => onChange(tallies.map((x, j) => (j === i ? nt : x)))} onRemove={() => onChange(tallies.filter((_, j) => j !== i))} />
      ))}
      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={adding || undefined}
            onValueChange={(key) => {
              if (!targets.some((x) => x.key === key)) return;
              onChange([...tallies, { target: key, value: "one" }]);
              setAdding("");
            }}
          >
            <SelectTrigger className="h-8 w-64">
              <SelectValue placeholder={`Log each ${occurrence} to…`} />
            </SelectTrigger>
            <SelectContent>
              {available.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.title}
                  {t.subtitle ? ` · ${t.subtitle}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">A Habit completion or a Stat entry, once per {occurrence}.</span>
        </div>
      ) : (
        targets.length === 0 && <p className="text-muted-foreground text-xs">No Habits or Stats to tally to yet.</p>
      )}
    </div>
  );
}
