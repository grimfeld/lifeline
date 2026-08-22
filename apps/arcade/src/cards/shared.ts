import type { CardSettings } from "@lifeline/core";
import type { MediumFilter } from "../domain/cardQueries";

/** Single-type App (ADR 0024): no medium knob — every card covers all games. */
export const mediumOf = (_settings: CardSettings): MediumFilter => "";
