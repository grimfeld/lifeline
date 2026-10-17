import type React from "react";
import { recallableDefs } from "../registry";
import type { Document } from "../documents/types";

/**
 * How one Prompt of a Recallable Document is shown in a Practice: its
 * question, and — once revealed — its answer. Drawn by the owning App, which
 * alone knows what its Documents mean.
 */
export interface RecallFaceProps {
  doc: Document;
  slot: string;
  revealed: boolean;
}

/**
 * The Recallable Contract for one Document type (ADR 0073, CONTEXT.md
 * "Recallable"): which Prompts its Documents yield and how each is shown.
 * The owning App never schedules, grades or keeps anything about practice —
 * the Knowledge App does, over every Recallable type, without knowing any by
 * name.
 */
export interface RecallableDef {
  typeId: string;
  /**
   * The Prompts a Document yields, each known by its slot ("forward",
   * "blank:ganas"), in the order they were written. A slot is the Prompt's
   * identity: it must not change when the Document is merely corrected.
   */
  slots(doc: Document): string[];
  /** The Topic it is practised in. Empty while it is in none. */
  topicOf(doc: Document): string;
  /** False while it sits out of every Practice — paused, or no longer kept. Its Recalls stay. */
  inPractice(doc: Document): boolean;
  /** ISO instant it was added: new Prompts enter practice oldest first. */
  addedAt(doc: Document): string;
  /**
   * The Document it was taken from, if it keeps one as a link (ADR 0073) —
   * what a Practice narrowed to a Source reads through. Absent: none.
   */
  originOf?(doc: Document): string;
  face: React.ComponentType<RecallFaceProps>;
}

/** The Recallable declaration for a type, if any App makes it Recallable. */
export function recallableDef(typeId: string): (RecallableDef & { appId: string }) | undefined {
  return recallableDefs().find((d) => d.typeId === typeId);
}
