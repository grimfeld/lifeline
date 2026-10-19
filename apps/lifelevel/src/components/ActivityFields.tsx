import type { AriaAttributes } from "react";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { DIFFICULTIES, GRAVITIES, type Difficulty, type Gravity, type Habit } from "../domain/types";

/**
 * The Life Level activities' own Field controls, shared by their editors and
 * their Peeks (ADR 0085): Difficulty, Gravity and Rival habit, each with the
 * words that say what choosing it does.
 */

export const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: "Easy — light lift, quick decay",
  normal: "Normal",
  hard: "Hard — more XP, gentler decay",
  expert: "Expert",
  master: "Master — top XP, slowest decay",
};

export const GRAVITY_COPY: Record<Gravity, string> = {
  minor: "Minor — a slip",
  severe: "Severe — real harm",
  catastrophic: "Catastrophic — deep damage",
};

/** The Rival habit's "none": a fresh victim rolled on every log. Stored as "". */
const RANDOM = "__random__";

/** What `Field` hands its control, put on the Select's trigger so the Label and the messages reach it. */
type Control = { id?: string; "aria-describedby"?: string; "aria-invalid"?: AriaAttributes["aria-invalid"] };

/** `error`: what the owner refused, shown under the field (CODING_STANDARDS.md § Forms and feedback). */
export function DifficultyField({ value, onChange, error }: { value: Difficulty; onChange: (d: Difficulty) => void; error?: string }) {
  return (
    <Field label="Difficulty" hint="Self-assessed: how unpleasant it is plus how long it takes. Changing it later re-values all past XP." error={error}>
      <DifficultySelect value={value} onChange={onChange} />
    </Field>
  );
}

function DifficultySelect({ value, onChange, ...control }: Control & { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Difficulty)}>
      <SelectTrigger {...control} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DIFFICULTIES.map((d) => (
          <SelectItem key={d} value={d}>
            {DIFFICULTY_COPY[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function GravityField({ value, onChange, error }: { value: Gravity; onChange: (g: Gravity) => void; error?: string }) {
  return (
    <Field label="Gravity" hint="Severity of the real-life consequence — punishment scales with harm, not effort." error={error}>
      <GravitySelect value={value} onChange={onChange} />
    </Field>
  );
}

function GravitySelect({ value, onChange, ...control }: Control & { value: Gravity; onChange: (g: Gravity) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Gravity)}>
      <SelectTrigger {...control} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRAVITIES.map((g) => (
          <SelectItem key={g} value={g}>
            {GRAVITY_COPY[g]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** `value` "" = random targeting. */
export function RivalHabitField({ value, habits, onChange, error }: { value: string; habits: Habit[]; onChange: (habitId: string) => void; error?: string }) {
  return (
    <Field label="Rival habit" hint="Fixed pairs a vice with the virtue it undoes; random is more destructive because it is unjust." error={error}>
      <RivalSelect value={value} habits={habits} onChange={onChange} />
    </Field>
  );
}

function RivalSelect({ value, habits, onChange, ...control }: Control & { value: string; habits: Habit[]; onChange: (habitId: string) => void }) {
  return (
    <Select value={value || RANDOM} onValueChange={(v) => onChange(v === RANDOM ? "" : v)}>
      <SelectTrigger {...control} className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={RANDOM}>Random — chaos picks a fresh victim each log</SelectItem>
        {habits.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
