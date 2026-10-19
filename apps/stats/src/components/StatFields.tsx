import { cn } from "@lifeline/ui";
import { COLOR_SLOTS, colorVar, type ColorSlot, type StatKind } from "../domain/types";

/** What each Kind means, in the editor's words. */
export const KIND_COPY: Record<StatKind, { title: string; hint: string }> = {
  additive: { title: "Additive", hint: "Increments that add up — push-ups, books" },
  measurement: { title: "Measurement", hint: "Point-in-time readings — weight" },
  boolean: { title: "Boolean", hint: "Did it happen today — workouts, meditation" },
  collection: { title: "Collection", hint: "Distinct things collected — countries" },
};

/** Which of a Stat's Fields mean something for its Kind (the rest are zeroed on save). */
export const kindHas = (kind: StatKind) => ({
  unit: kind === "additive" || kind === "measurement",
  increment: kind === "additive",
  items: kind === "collection",
});

/** A Stat's colour: one swatch per slot, the chosen one ringed. Shared by the editor and the Peek. */
export function ColorSwatches({ value, onChange }: { value: ColorSlot; onChange: (c: ColorSlot) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_SLOTS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn("size-7 rounded-full border-2 transition-transform", value === c ? "border-foreground scale-110" : "border-transparent")}
          style={{ background: colorVar(c) }}
        />
      ))}
    </div>
  );
}
