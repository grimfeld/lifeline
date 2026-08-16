import type { CardFieldDef, CardSettings } from "@lifeline/core";
import { MEDIA_TYPES } from "../domain/mediaTypes";
import type { MediumFilter } from "../domain/cardQueries";

/** The medium knob every media card carries; "" = any medium. */
export const mediumField: CardFieldDef = {
  kind: "select",
  label: "Medium",
  default: "",
  options: [{ value: "", label: "Any medium" }, ...MEDIA_TYPES.map((t) => ({ value: t.id, label: t.plural }))],
};

export const mediumOf = (settings: CardSettings): MediumFilter => (typeof settings.medium === "string" ? (settings.medium as MediumFilter) : "");
