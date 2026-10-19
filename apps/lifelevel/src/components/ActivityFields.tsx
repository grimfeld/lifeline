import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
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

export function DifficultyField({ id, value, onChange }: { id: string; value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Difficulty</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Difficulty)}>
        <SelectTrigger id={id} className="w-full">
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
      <p className="text-muted-foreground text-xs">Self-assessed: how unpleasant it is plus how long it takes. Changing it later re-values all past XP.</p>
    </div>
  );
}

export function GravityField({ id, value, onChange }: { id: string; value: Gravity; onChange: (g: Gravity) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Gravity</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Gravity)}>
        <SelectTrigger id={id} className="w-full">
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
      <p className="text-muted-foreground text-xs">Severity of the real-life consequence — punishment scales with harm, not effort.</p>
    </div>
  );
}

/** `value` "" = random targeting. */
export function RivalHabitField({ id, value, habits, onChange }: { id: string; value: string; habits: Habit[]; onChange: (habitId: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Rival habit</Label>
      <Select value={value || RANDOM} onValueChange={(v) => onChange(v === RANDOM ? "" : v)}>
        <SelectTrigger id={id} className="w-full min-w-0">
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
      <p className="text-muted-foreground text-xs">Fixed pairs a vice with the virtue it undoes; random is more destructive because it is unjust.</p>
    </div>
  );
}
