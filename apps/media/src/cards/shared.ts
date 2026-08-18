import type { CardFieldDef, CardSettings } from "@lifeline/core";
import { MEDIA_TYPES, SLOTTED_TYPES, mediaType } from "../domain/mediaTypes";
import type { MediumFilter } from "../domain/cardQueries";

/** The medium knob every media card carries; "" = any medium. */
export const mediumField: CardFieldDef = {
  kind: "select",
  label: "Medium",
  default: "",
  options: [{ value: "", label: "Any medium" }, ...MEDIA_TYPES.map((t) => ({ value: t.id, label: t.plural }))],
};

/** Medium knob restricted to media that have Nightstand slots (books, comics); "" = any slotted medium. */
export const slottedMediumField: CardFieldDef = {
  kind: "select",
  label: "Medium",
  default: "",
  options: [{ value: "", label: "Any" }, ...SLOTTED_TYPES.map((t) => ({ value: t, label: mediaType(t).plural }))],
};

/** Medium knob with no "Any" — for cards that add (quick add). */
export const requiredMediumField: CardFieldDef = {
  kind: "select",
  label: "Medium",
  default: "book",
  options: MEDIA_TYPES.map((t) => ({ value: t.id, label: t.plural })),
};

export const mediumOf = (settings: CardSettings): MediumFilter => (typeof settings.medium === "string" ? (settings.medium as MediumFilter) : "");
