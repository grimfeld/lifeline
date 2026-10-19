import type { Document, RecallableDef } from "@lifeline/core";
import { QUOTES, type Quote } from "./types";

/**
 * A kept Quote, read through the Recallable Contract (ADR 0073), face aside:
 * one Prompt — recall the passage from its Source and locator. The Prompt is
 * known by the Quote, not its words, so fixing the passage never resets it.
 * Its origin is the Quote itself, so a Practice narrowed to a Source finds it
 * through the Quote's own Source.
 */
export const quoteReading: Omit<RecallableDef, "face"> = {
  typeId: QUOTES,
  slots: () => ["passage"],
  topicOf: (d: Document) => String((d as Quote).topic ?? ""),
  inPractice: (d: Document) => !!(d as Quote).kept,
  addedAt: (d: Document) => (d as Quote).keptAt || d.createdAt || "",
  originOf: (d: Document) => d.id,
};
