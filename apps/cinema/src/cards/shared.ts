import type { CardFieldDef, CardSettings } from "@lifeline/core";
import { WORK_TYPES } from "../domain/workTypes";
import type { MediumFilter } from "../domain/cardQueries";

/** The medium knob (movies | series); "" = both. */
export const mediumField: CardFieldDef = {
  kind: "select",
  label: "Medium",
  default: "",
  options: [{ value: "", label: "Movies and series" }, ...WORK_TYPES.map((t) => ({ value: t.id, label: t.plural }))],
};

export const mediumOf = (settings: CardSettings): MediumFilter => (typeof settings.medium === "string" ? (settings.medium as MediumFilter) : "");
